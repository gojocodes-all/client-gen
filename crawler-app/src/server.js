import express from 'express';
import helmet from 'helmet';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CheerioCrawler, EnqueueStrategy, log } from 'crawlee';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JOB_TTL_MS = 60 * 60 * 1000;
const jobs = new Map();
const startsByIp = new Map();

log.setLevel(log.LEVELS.WARNING);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.get('/api/health', (_req, res) => res.json({ ok: true, engine: 'Crawlee CheerioCrawler', version: '1.0.0' }));

app.post('/api/crawls', async (req, res) => {
  try {
    enforceStartRate(req.ip || 'unknown');
    const config = await normalizeConfig(req.body || {});
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const job = {
      id,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      config,
      pages: [],
      leads: [],
      errors: [],
      stats: { requested: 0, processed: 0, succeeded: 0, failed: 0, leads: 0 },
      crawler: null,
      stopRequested: false
    };
    jobs.set(id, job);
    runCrawl(job).catch(error => {
      job.status = 'failed';
      job.errors.push(cleanError(error));
      job.updatedAt = new Date().toISOString();
    });
    res.status(202).json(publicJob(job));
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: cleanError(error) });
  }
});

app.get('/api/crawls/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Crawl job not found or expired.' });
  res.json(publicJob(job));
});

app.post('/api/crawls/:id/stop', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Crawl job not found or expired.' });
  job.stopRequested = true;
  job.status = job.status === 'running' ? 'stopping' : job.status;
  if (job.crawler) {
    try { await job.crawler.stop('Stopped by user'); } catch {}
  }
  res.json(publicJob(job));
});

app.get('/api/crawls/:id/export.json', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Crawl job not found or expired.' });
  const payload = exportRows(job);
  res.setHeader('Content-Disposition', `attachment; filename="mahoraga-crawl-${job.id.slice(0, 8)}.json"`);
  res.json(payload);
});

app.get('/api/crawls/:id/export.csv', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).send('Crawl job not found or expired.');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="mahoraga-crawl-${job.id.slice(0, 8)}.csv"`);
  res.send(toCsv(exportRows(job)));
});

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => console.log(`Mahoraga Crawler listening on :${PORT}`));

setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (new Date(job.updatedAt).getTime() < cutoff && !['running', 'stopping'].includes(job.status)) jobs.delete(id);
  }
  for (const [ip, stamps] of startsByIp) {
    const fresh = stamps.filter(ts => ts > Date.now() - 10 * 60 * 1000);
    fresh.length ? startsByIp.set(ip, fresh) : startsByIp.delete(ip);
  }
}, 10 * 60 * 1000).unref();

async function runCrawl(job) {
  job.status = 'running';
  job.updatedAt = new Date().toISOString();
  const seenLeads = new Map();
  const allowedHosts = new Set(job.config.startUrls.map(u => new URL(u).hostname.toLowerCase()));

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: job.config.maxPages,
    maxCrawlDepth: job.config.maxDepth,
    maxConcurrency: job.config.concurrency,
    minConcurrency: 1,
    sameDomainDelaySecs: job.config.delaySecs,
    requestHandlerTimeoutSecs: 30,
    navigationTimeoutSecs: 25,
    maxRequestRetries: 1,
    retryOnBlocked: false,
    respectRobotsTxtFile: true,
    preNavigationHooks: [async ({ request }) => {
      await assertPublicUrl(request.url);
      const host = new URL(request.url).hostname.toLowerCase();
      if (!allowedHosts.has(host)) throw new Error(`Cross-host navigation blocked: ${host}`);
    }],
    async requestHandler({ request, $, response, enqueueLinks }) {
      if (job.stopRequested) return;
      job.stats.processed += 1;
      job.stats.succeeded += 1;
      const page = extractPage($, request.loadedUrl || request.url, response?.statusCode || 200);
      job.pages.push(page);
      for (const lead of page.leads) {
        const key = leadKey(lead);
        if (!seenLeads.has(key)) seenLeads.set(key, lead);
        else seenLeads.set(key, mergeLead(seenLeads.get(key), lead));
      }
      job.leads = [...seenLeads.values()];
      job.stats.leads = job.leads.length;
      job.updatedAt = new Date().toISOString();

      if (job.config.followLinks && !job.stopRequested) {
        await enqueueLinks({
          strategy: EnqueueStrategy.SameHostname,
          transformRequestFunction: req => {
            try {
              const u = new URL(req.url);
              if (!['http:', 'https:'].includes(u.protocol)) return false;
              if (isProbablyAsset(u.pathname)) return false;
              return req;
            } catch { return false; }
          }
        });
      }
    },
    failedRequestHandler({ request, error }) {
      job.stats.failed += 1;
      job.errors.push(`${request.url}: ${cleanError(error)}`);
      job.updatedAt = new Date().toISOString();
    }
  });

  job.crawler = crawler;
  job.stats.requested = job.config.startUrls.length;
  try {
    await crawler.run(job.config.startUrls);
    job.status = job.stopRequested ? 'stopped' : 'completed';
  } finally {
    job.crawler = null;
    job.leads = [...seenLeads.values()];
    job.stats.leads = job.leads.length;
    job.updatedAt = new Date().toISOString();
  }
}

function extractPage($, url, statusCode) {
  const title = clean($('title').first().text());
  const h1 = clean($('h1').first().text());
  const description = clean($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '');
  const siteName = clean($('meta[property="og:site_name"]').attr('content') || '');
  const bodyText = clean($('body').text()).slice(0, 140000);
  const jsonLd = collectJsonLd($);
  const orgs = jsonLd.filter(isBusinessishJsonLd);
  const primary = orgs[0] || {};
  const name = clean(primary.name || siteName || h1 || simplifyTitle(title));
  const categoryName = clean(jsonLdType(primary) || inferCategoryFromPage(title, h1, description));
  const phones = unique([
    ...$('a[href^="tel:"]').map((_, el) => clean($(el).attr('href')?.replace(/^tel:/i, ''))).get(),
    ...extractPhones(bodyText),
    ...jsonLdPhones(orgs)
  ]).slice(0, 8);
  const emails = unique([
    ...$('a[href^="mailto:"]').map((_, el) => clean($(el).attr('href')?.replace(/^mailto:/i, '').split('?')[0])).get(),
    ...extractEmails(bodyText),
    ...jsonLdEmails(orgs)
  ]).slice(0, 8);
  const address = clean(jsonLdAddress(primary) || $('address').first().text() || $('[itemprop="address"]').first().text());
  const socialLinks = collectSocials($, url);
  const source = new URL(url);
  const record = {
    title: name || title || source.hostname,
    categoryName,
    address,
    city: clean(primary?.address?.addressLocality || ''),
    state: clean(primary?.address?.addressRegion || ''),
    countryCode: clean(primary?.address?.addressCountry || ''),
    phone: phones[0] || '',
    phoneUnformatted: normalizePhone(phones[0] || ''),
    emails,
    website: source.origin,
    url,
    description,
    pageTitle: title,
    socialLinks,
    crawlMeta: { statusCode, crawledAt: new Date().toISOString() }
  };
  return { url, title, statusCode, leads: [record], phoneCount: phones.length, emailCount: emails.length };
}

function collectJsonLd($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const value = JSON.parse($(el).text());
      flattenJsonLd(value, out);
    } catch {}
  });
  return out;
}

function flattenJsonLd(value, out) {
  if (!value) return;
  if (Array.isArray(value)) return value.forEach(v => flattenJsonLd(v, out));
  if (typeof value !== 'object') return;
  if (Array.isArray(value['@graph'])) value['@graph'].forEach(v => flattenJsonLd(v, out));
  if (value['@type'] || value.name || value.telephone || value.email || value.address) out.push(value);
}

function isBusinessishJsonLd(obj) {
  const type = jsonLdType(obj).toLowerCase();
  return /business|organization|organisation|school|college|university|restaurant|store|shop|clinic|hospital|hotel|lodging|professionalservice|realestate|localbusiness|corporation|ngo|church/.test(type) || Boolean(obj.telephone || obj.address);
}

function jsonLdType(obj) {
  const t = obj?.['@type'];
  return Array.isArray(t) ? t.join(' | ') : clean(t || '');
}

function jsonLdPhones(orgs) { return orgs.flatMap(o => Array.isArray(o.telephone) ? o.telephone : [o.telephone]).filter(Boolean).map(clean); }
function jsonLdEmails(orgs) { return orgs.flatMap(o => Array.isArray(o.email) ? o.email : [o.email]).filter(Boolean).map(clean); }
function jsonLdAddress(obj) {
  const a = obj?.address;
  if (!a) return '';
  if (typeof a === 'string') return a;
  return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean).join(', ');
}

function collectSocials($, baseUrl) {
  const allowed = /(^|\.)(facebook\.com|instagram\.com|linkedin\.com|tiktok\.com|youtube\.com|youtu\.be|x\.com|twitter\.com)$/i;
  return unique($('a[href]').map((_, el) => {
    try {
      const u = new URL($(el).attr('href'), baseUrl);
      return allowed.test(u.hostname) ? u.href.split('#')[0] : '';
    } catch { return ''; }
  }).get().filter(Boolean)).slice(0, 12);
}

function extractEmails(text) {
  return unique((String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).filter(e => !/\.(png|jpe?g|gif|webp)$/i.test(e)));
}

function extractPhones(text) {
  const matches = String(text).match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  return unique(matches.map(clean).filter(v => {
    const digits = v.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  }));
}

function normalizePhone(value) { return String(value || '').replace(/\D/g, ''); }
function simplifyTitle(value) { return clean(String(value || '').split(/[|–—]/)[0]); }
function inferCategoryFromPage(...parts) {
  const t = parts.join(' ').toLowerCase();
  const rules = [
    ['School / education', /school|academy|college|university|education|training/],
    ['Real estate', /real estate|property|realtor|estate agent|housing/],
    ['Healthcare', /clinic|hospital|medical|dental|pharmacy|health/],
    ['Food & dining', /restaurant|cafe|bakery|catering|food/],
    ['Beauty & grooming', /salon|barber|beauty|spa|hair/],
    ['Retail', /store|shop|boutique|retail|supermarket/],
    ['Hotel / hospitality', /hotel|resort|guest house|lodging/]
  ];
  return rules.find(([, re]) => re.test(t))?.[0] || '';
}

function leadKey(lead) {
  const phone = normalizePhone(lead.phone);
  if (phone) return `p:${phone}`;
  if (lead.emails?.[0]) return `e:${lead.emails[0].toLowerCase()}`;
  return `w:${lead.website}:${lead.title.toLowerCase()}`;
}

function mergeLead(a, b) {
  const richer = { ...a };
  for (const key of ['title', 'categoryName', 'address', 'city', 'state', 'countryCode', 'phone', 'phoneUnformatted', 'description']) {
    if (clean(b[key]).length > clean(richer[key]).length) richer[key] = b[key];
  }
  richer.emails = unique([...(a.emails || []), ...(b.emails || [])]);
  richer.socialLinks = unique([...(a.socialLinks || []), ...(b.socialLinks || [])]);
  return richer;
}

function exportRows(job) {
  return job.leads.map(lead => ({
    ...lead,
    emails: lead.emails || [],
    email: lead.emails?.[0] || '',
    socialLinks: lead.socialLinks || [],
    searchString: job.config.label || '',
    crawler: 'Mahoraga Crawler / Crawlee 3.17.0'
  }));
}

async function normalizeConfig(body) {
  const rawUrls = Array.isArray(body.startUrls) ? body.startUrls : String(body.startUrls || '').split(/[\n,]+/);
  const startUrls = unique(rawUrls.map(v => String(v).trim()).filter(Boolean)).slice(0, 5);
  if (!startUrls.length) throw badRequest('Enter at least one start URL.');
  for (const url of startUrls) await assertPublicUrl(url);
  return {
    startUrls,
    label: clean(body.label || '').slice(0, 120),
    maxPages: clampInt(body.maxPages, 1, 100, 30),
    maxDepth: clampInt(body.maxDepth, 0, 3, 1),
    concurrency: clampInt(body.concurrency, 1, 5, 2),
    delaySecs: clampNumber(body.delaySecs, 0.5, 10, 1),
    followLinks: body.followLinks !== false
  };
}

async function assertPublicUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { throw badRequest(`Invalid URL: ${value}`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw badRequest('Only http:// and https:// URLs are allowed.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw badRequest('Local/private targets are blocked.');
  if (net.isIP(host) && isPrivateIp(host)) throw badRequest('Local/private targets are blocked.');
  let addresses;
  try { addresses = await dns.lookup(host, { all: true }); } catch { throw badRequest(`Could not resolve ${host}.`); }
  if (!addresses.length || addresses.some(x => isPrivateIp(x.address))) throw badRequest('Local/private targets are blocked.');
  return url.href;
}

function isPrivateIp(ip) {
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return isPrivateIp(mapped);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const [a,b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
}

function enforceStartRate(ip) {
  const now = Date.now();
  const recent = (startsByIp.get(ip) || []).filter(ts => ts > now - 10 * 60 * 1000);
  if (recent.length >= 5) {
    const e = new Error('Too many crawl starts from this connection. Try again later.');
    e.statusCode = 429;
    throw e;
  }
  recent.push(now);
  startsByIp.set(ip, recent);
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    config: job.config,
    stats: { ...job.stats, requested: Math.max(job.stats.requested, job.stats.processed + job.stats.failed) },
    errors: job.errors.slice(-20),
    leads: job.leads.slice(-250),
    pages: job.pages.slice(-100)
  };
}

function isProbablyAsset(pathname) { return /\.(?:jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|rar|7z|mp3|mp4|avi|mov|css|js|xml|json|woff2?|ttf|eot)(?:$|\?)/i.test(pathname); }
function unique(values) { return [...new Set(values.filter(Boolean).map(v => typeof v === 'string' ? v.trim() : v))]; }
function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function cleanError(error) { return clean(error?.message || error || 'Unknown error').slice(0, 400); }
function clampInt(value, min, max, fallback) { const n = Number.parseInt(value, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function clampNumber(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function badRequest(message) { const e = new Error(message); e.statusCode = 400; return e; }
function csvCell(value) { const s = Array.isArray(value) ? value.join(' | ') : typeof value === 'object' && value ? JSON.stringify(value) : String(value ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function toCsv(rows) {
  if (!rows.length) return '';
  const headers = [...new Set(rows.flatMap(Object.keys))];
  return [headers.join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))].join('\r\n');
}
