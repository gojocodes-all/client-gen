(() => {
  'use strict';

  const APP_VERSION = '1.0.0';
  const DB_NAME = 'client-gen-db';
  const DB_VERSION = 1;
  const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_ROWS_PER_DATASET = 25000;
  const DEFAULT_PROFILE = { name: 'Gojo', brand: 'GOJO.DEV' };

  const ROLE_CONFIG = {
    name: {
      label: 'Business name', hint: 'Company / business / organisation name',
      aliases: ['title','name','businessname','business_name','company','companyname','company_name','organization','organisation','schoolname','hotelname','brand']
    },
    phone: {
      label: 'Phone', hint: 'WhatsApp/contact number',
      aliases: ['phone','phoneunformatted','phonenumber','phone_number','telephone','tel','mobile','mobilenumber','mobile_number','whatsapp','whatsappnumber','contactnumber','contact_number']
    },
    email: {
      label: 'Email', hint: 'Business email address',
      aliases: ['email','emailaddress','email_address','mail','contactemail','contact_email']
    },
    website: {
      label: 'Website', hint: 'Business-owned website URL',
      aliases: ['website','websiteurl','website_url','site','siteurl','site_url','domain','homepage','web']
    },
    category: {
      label: 'Category', hint: 'Business category / industry',
      aliases: ['category','categoryname','category_name','categories','industry','businesscategory','business_category','type','businesstype','business_type','sector']
    },
    address: {
      label: 'Address', hint: 'Street/full address',
      aliases: ['address','fulladdress','full_address','streetaddress','street_address','locationaddress','location_address','street']
    },
    city: {
      label: 'City', hint: 'City / town',
      aliases: ['city','town','locality','municipality']
    },
    state: {
      label: 'State / region', hint: 'State / region / province',
      aliases: ['state','region','province','county']
    },
    country: {
      label: 'Country', hint: 'Country or ISO country code',
      aliases: ['country','countrycode','country_code','nation']
    },
    rating: {
      label: 'Rating', hint: 'Usually a 0–5 review score',
      aliases: ['rating','score','totalscore','total_score','stars','reviewscore','review_score']
    },
    reviews: {
      label: 'Reviews', hint: 'Number of customer reviews',
      aliases: ['reviews','reviewcount','review_count','reviewscount','reviews_count','totalreviews','total_reviews']
    },
    imageCount: {
      label: 'Images', hint: 'Number of listing images',
      aliases: ['images','imagecount','image_count','imagescount','images_count','photos','photocount','photo_count']
    },
    sourceUrl: {
      label: 'Source URL', hint: 'Crawler/listing page, not the business website',
      aliases: ['sourceurl','source_url','listingurl','listing_url','mapsurl','maps_url','googlemapsurl','google_maps_url','url','profileurl','profile_url']
    },
    searchQuery: {
      label: 'Search query', hint: 'Crawler search term / query',
      aliases: ['searchstring','search_string','searchquery','search_query','query','keyword','keywords','searchterm','search_term']
    }
  };

  const STATUS_LABELS = {
    new: 'New', contacted: 'Contacted', replied: 'Replied', interested: 'Interested',
    follow_up: 'Follow-up', won: 'Won', not_interested: 'Not interested', do_not_contact: 'Do not contact'
  };

  const TYPE_DEFS = [
    { id: 'school', label: 'Education', words: ['school','academy','college','education','educational','nursery','primary','secondary','university','institute','learning','training','montessori'], benefit: 'show admissions information, programmes, school facilities and enquiry details clearly to parents and students' },
    { id: 'real_estate', label: 'Real estate', words: ['real estate','property','properties','realtor','housing','estate agent','property management','property developer','housing development','short term apartment','apartment rental'], benefit: 'show available properties, collect inspection enquiries and move serious prospects into WhatsApp faster' },
    { id: 'healthcare', label: 'Healthcare', words: ['hospital','clinic','medical','healthcare','health care','dental','dentist','pharmacy','optical','laboratory','diagnostic','physio','therapy'], benefit: 'make services, opening information, location and appointment enquiries easier to find' },
    { id: 'food', label: 'Food & dining', words: ['restaurant','cafe','coffee','bakery','catering','food','eatery','kitchen','grill','fast food'], benefit: 'put the menu, location, ordering options and customer enquiries in one easy place' },
    { id: 'beauty', label: 'Beauty & grooming', words: ['salon','barber','beauty','spa','makeup','nails','hair','skincare','cosmetic'], benefit: 'show services and work clearly while making bookings and WhatsApp enquiries easier' },
    { id: 'retail', label: 'Retail', words: ['store','shop','boutique','supermarket','fashion','furniture','electronics','retail','market','mall','outlet'], benefit: 'show products, store information and enquiry or ordering options without making customers hunt through posts' },
    { id: 'professional', label: 'Professional services', words: ['consulting','consultant','law firm','lawyer','legal','accounting','accountant','architect','agency','services company','insurance','research','engineering'], benefit: 'present services and credibility clearly and turn visitors into qualified enquiries' },
    { id: 'fitness', label: 'Fitness & activities', words: ['gym','fitness','sports','yoga','dance','martial arts','recreation'], benefit: 'show programmes, schedules, membership information and enquiry options clearly' },
    { id: 'automotive', label: 'Automotive', words: ['automotive','mechanic','auto repair','car dealer','vehicle','tyre','tire','car wash','auto parts'], benefit: 'show services or available vehicles and make quote and appointment enquiries easier' },
    { id: 'hospitality', label: 'Hospitality', words: ['hotel','resort','guest house','guesthouse','lodging','vacation rental','serviced apartment'], benefit: 'show rooms, facilities, location and booking enquiries in a trustworthy, mobile-friendly way' },
    { id: 'nonprofit', label: 'Community & nonprofit', words: ['church','ministry','foundation','charity','ngo','nonprofit','non-profit','community organization','community organisation'], benefit: 'keep programmes, events, contact information and important updates easy for people to find' },
    { id: 'other', label: 'Other business', words: [], benefit: 'explain what the business offers clearly and turn interested visitors into direct enquiries' }
  ];

  const DIAL_CODES = { NG:'234', GH:'233', KE:'254', ZA:'27', GB:'44', US:'1', CA:'1', IN:'91', AE:'971', RW:'250', UG:'256', TZ:'255' };

  const state = {
    datasets: [],
    leads: [],
    tone: 'friendly',
    filters: { search:'', type:'all', status:'all', priority:'all', phoneOnly:false },
    sort: 'score_desc',
    activeDatasetId: null,
    activeLeadId: null,
    theme: 'dark'
  };

  const els = {};
  let saveTimer = null;
  let toastTimer = null;
  let xlsxPromise = null;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    bindEvents();
    await loadWorkspace();
    applyTheme();
    render();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  function cacheElements() {
    const ids = [
      'themeBtn','leadCountHero','dueCountHero','importPanel','dropZone','fileInput','chooseFileBtn','importStatus','workspace',
      'metricHot','metricPhones','metricInterested','metricWon','openMappingBtn','mappingSummary','searchInput','typeFilter','statusFilter',
      'priorityFilter','phoneOnlyFilter','exportCsvBtn','exportWorkspaceBtn','clearBtn','visibleLeadCount','toneSelect','sortSelect','emptyFiltered',
      'leadList','mappingDialog','mappingForm','mappingGrid','mappingDatasetLabel','applyMappingBtn','leadDialog','leadForm','dialogLeadName',
      'dialogLeadMeta','messageEditor','regenerateBtn','copyMessageBtn','whatsappLink','leadStatusSelect','followupInput','notesInput','rawContext','saveLeadBtn','toast'
    ];
    ids.forEach(id => els[id] = document.getElementById(id));
  }

  function bindEvents() {
    els.themeBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(); saveWorkspace();
    });
    els.chooseFileBtn.addEventListener('click', e => { e.stopPropagation(); els.fileInput.click(); });
    els.dropZone.addEventListener('click', () => els.fileInput.click());
    els.dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); } });
    els.fileInput.addEventListener('change', e => importFiles([...e.target.files]));
    ['dragenter','dragover'].forEach(type => els.dropZone.addEventListener(type, e => { e.preventDefault(); els.dropZone.classList.add('dragging'); }));
    ['dragleave','drop'].forEach(type => els.dropZone.addEventListener(type, e => { e.preventDefault(); els.dropZone.classList.remove('dragging'); }));
    els.dropZone.addEventListener('drop', e => importFiles([...e.dataTransfer.files]));

    els.searchInput.addEventListener('input', e => { state.filters.search = e.target.value; renderLeads(); });
    els.typeFilter.addEventListener('change', e => { state.filters.type = e.target.value; renderLeads(); });
    els.statusFilter.addEventListener('change', e => { state.filters.status = e.target.value; renderLeads(); });
    els.priorityFilter.addEventListener('change', e => { state.filters.priority = e.target.value; renderLeads(); });
    els.phoneOnlyFilter.addEventListener('change', e => { state.filters.phoneOnly = e.target.checked; renderLeads(); });
    els.toneSelect.addEventListener('change', e => { state.tone = e.target.value; saveWorkspace(); renderLeads(); });
    els.sortSelect.addEventListener('change', e => { state.sort = e.target.value; saveWorkspace(); renderLeads(); });

    els.openMappingBtn.addEventListener('click', () => openMappingDialog());
    els.mappingForm.addEventListener('submit', e => {
      e.preventDefault();
      applyMappingFromDialog();
      els.mappingDialog.close();
    });

    els.exportCsvBtn.addEventListener('click', exportFilteredCsv);
    els.exportWorkspaceBtn.addEventListener('click', exportWorkspace);
    els.clearBtn.addEventListener('click', clearWorkspace);

    els.leadList.addEventListener('click', onLeadListClick);
    els.regenerateBtn.addEventListener('click', regenerateActiveLeadMessage);
    els.copyMessageBtn.addEventListener('click', copyActiveMessage);
    els.saveLeadBtn.addEventListener('click', saveLeadEdits);
    els.messageEditor.addEventListener('input', updateActiveWhatsAppLink);
    els.leadStatusSelect.addEventListener('change', updateActiveWhatsAppLink);
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
  }

  async function importFiles(files) {
    if (!files.length) return;
    els.importStatus.textContent = `Reading ${files.length} file${files.length === 1 ? '' : 's'}…`;
    let added = 0;
    const errors = [];

    for (const file of files) {
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error(`File is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`);
        const parsed = await parseFile(file);
        if (!parsed.rows.length) throw new Error('No table-like records found');
        const rows = parsed.rows.slice(0, MAX_ROWS_PER_DATASET).map(flattenRecord);
        const fields = collectFields(rows);
        const mapping = inferMapping(fields, rows);
        const dataset = {
          id: uid('ds'), name: file.name, format: parsed.format, importedAt: new Date().toISOString(),
          rowCount: rows.length, truncated: parsed.rows.length > MAX_ROWS_PER_DATASET,
          rows, fields, mapping
        };
        state.datasets.push(dataset);
        state.activeDatasetId = dataset.id;
        rebuildLeadsForDataset(dataset, true);
        added += rows.length;
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    els.fileInput.value = '';
    if (added) {
      state.leads = dedupeLeads(state.leads);
      els.importStatus.textContent = `Imported ${added.toLocaleString()} rows${errors.length ? ` · ${errors.length} file error${errors.length > 1 ? 's' : ''}` : ''}.`;
      toast(`Adapted to ${added.toLocaleString()} new rows.`);
      await saveWorkspace(true);
      render();
      if (errors.length) console.warn(errors);
    } else {
      els.importStatus.textContent = errors.join(' · ') || 'Nothing was imported.';
    }
  }

  async function parseFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return parseExcel(file);

    const text = await file.text();
    if (ext === 'json') return { format:'JSON', rows: extractRecordsFromJson(JSON.parse(text)) };
    if (ext === 'ndjson' || ext === 'jsonl') {
      const rows = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean).map(line => JSON.parse(line));
      return { format:'NDJSON', rows };
    }
    if (ext === 'csv') return { format:'CSV', rows: parseDelimited(text, ',') };
    if (ext === 'tsv') return { format:'TSV', rows: parseDelimited(text, '\t') };
    if (ext === 'xml') return { format:'XML', rows: parseXml(text) };
    if (ext === 'html' || ext === 'htm') return { format:'HTML', rows: parseHtmlTables(text) };

    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return { format:'JSON', rows: extractRecordsFromJson(JSON.parse(trimmed)) };
    if (/^<\?xml|^<[A-Za-z]/.test(trimmed)) {
      try { return { format:'XML', rows: parseXml(trimmed) }; } catch (_) { return { format:'HTML', rows: parseHtmlTables(trimmed) }; }
    }
    const delimiter = detectDelimiter(text);
    return { format: delimiter === '\t' ? 'TSV' : 'CSV', rows: parseDelimited(text, delimiter) };
  }

  async function parseExcel(file) {
    await loadSheetJS();
    const wb = window.XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:false });
    const rows = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const parsed = window.XLSX.utils.sheet_to_json(sheet, { defval:'', raw:false });
      parsed.forEach(row => rows.push({ ...row, __sheet: sheetName }));
    }
    return { format:'Excel', rows };
  }

  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve();
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_URL;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load the Excel parser. Check your internet connection and try again.'));
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }

  function extractRecordsFromJson(input) {
    if (Array.isArray(input)) {
      if (!input.length) return [];
      if (input.every(isPlainObject)) return input;
      return input.map((v, i) => isPlainObject(v) ? v : ({ index:i + 1, value:v }));
    }
    if (!isPlainObject(input)) return [{ value: input }];

    const candidates = [];
    walk(input, '$', 0);
    if (candidates.length) {
      candidates.sort((a,b) => b.score - a.score);
      return candidates[0].rows;
    }

    const vals = Object.values(input);
    if (vals.length > 1 && vals.every(isPlainObject)) return vals;
    return [input];

    function walk(node, path, depth) {
      if (depth > 8 || node == null) return;
      if (Array.isArray(node)) {
        const objects = node.filter(isPlainObject);
        if (objects.length) {
          const keyCounts = new Map();
          objects.slice(0, 100).forEach(obj => Object.keys(obj).forEach(k => keyCounts.set(k, (keyCounts.get(k) || 0) + 1)));
          const common = [...keyCounts.values()].filter(n => n >= Math.max(2, objects.length * .5)).length;
          candidates.push({ rows:objects, path, score:objects.length * (1 + Math.min(common, 12) / 4) - depth * 2 });
        }
        node.slice(0, 30).forEach((v,i) => walk(v, `${path}[${i}]`, depth + 1));
      } else if (isPlainObject(node)) {
        Object.entries(node).slice(0, 100).forEach(([k,v]) => walk(v, `${path}.${k}`, depth + 1));
      }
    }
  }

  function parseDelimited(text, delimiter) {
    const matrix = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else {
        if (ch === '"') quoted = true;
        else if (ch === delimiter) { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); matrix.push(row); row = []; cell = ''; }
        else if (ch !== '\r') cell += ch;
      }
    }
    if (cell.length || row.length) { row.push(cell); matrix.push(row); }
    while (matrix.length && matrix[0].every(v => !String(v).trim())) matrix.shift();
    if (!matrix.length) return [];
    const headers = makeUniqueHeaders(matrix.shift().map((h,i) => String(h).trim() || `column_${i + 1}`));
    return matrix.filter(r => r.some(v => String(v).trim())).map(r => Object.fromEntries(headers.map((h,i) => [h, r[i] ?? ''])));
  }

  function detectDelimiter(text) {
    const firstLines = text.split(/\r?\n/).slice(0, 6).join('\n');
    const options = [',','\t',';','|'];
    let best = ',', bestScore = -1;
    for (const d of options) {
      const counts = firstLines.split('\n').map(line => countOutsideQuotes(line, d));
      const nonzero = counts.filter(Boolean);
      const avg = nonzero.reduce((a,b) => a + b, 0) / Math.max(nonzero.length,1);
      const variance = nonzero.reduce((a,b) => a + Math.abs(b - avg), 0) / Math.max(nonzero.length,1);
      const score = avg * 3 - variance;
      if (score > bestScore) { best = d; bestScore = score; }
    }
    return best;
  }

  function countOutsideQuotes(line, delimiter) {
    let q = false, count = 0;
    for (let i=0;i<line.length;i++) {
      if (line[i] === '"') q = !q;
      else if (!q && line[i] === delimiter) count++;
    }
    return count;
  }

  function parseHtmlTables(text) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const tables = [...doc.querySelectorAll('table')];
    if (!tables.length) throw new Error('No HTML table found');
    const scored = tables.map(table => ({ table, score: table.rows.length * Math.max(1, table.rows[0]?.cells.length || 1) })).sort((a,b) => b.score - a.score);
    return htmlTableToRows(scored[0].table);
  }

  function htmlTableToRows(table) {
    const tr = [...table.querySelectorAll('tr')];
    if (!tr.length) return [];
    let headerIndex = tr.findIndex(r => r.querySelector('th'));
    if (headerIndex < 0) headerIndex = 0;
    const headers = makeUniqueHeaders([...tr[headerIndex].cells].map((c,i) => cleanText(c.textContent) || `column_${i + 1}`));
    return tr.slice(headerIndex + 1).map(r => [...r.cells].map(c => cleanText(c.textContent)))
      .filter(cells => cells.some(Boolean))
      .map(cells => Object.fromEntries(headers.map((h,i) => [h, cells[i] ?? ''])));
  }

  function parseXml(text) {
    if (/<!DOCTYPE/i.test(text)) throw new Error('XML with DOCTYPE is blocked for safety');
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('Invalid XML');
    const allParents = [doc.documentElement, ...doc.querySelectorAll('*')];
    const groups = [];
    for (const parent of allParents) {
      const children = [...parent.children];
      if (children.length < 2) continue;
      const byTag = new Map();
      children.forEach(child => byTag.set(child.tagName, [...(byTag.get(child.tagName) || []), child]));
      for (const [tag, els] of byTag) {
        if (els.length < 2) continue;
        const fieldCount = Object.keys(xmlElementToObject(els[0])).length;
        groups.push({ els, score: els.length * Math.max(2, fieldCount), tag });
      }
    }
    groups.sort((a,b) => b.score - a.score);
    if (groups.length) return groups[0].els.map(xmlElementToObject);
    return [xmlElementToObject(doc.documentElement)];
  }

  function xmlElementToObject(el) {
    const obj = {};
    [...el.attributes].forEach(a => obj[`@${a.name}`] = a.value);
    for (const child of el.children) {
      const key = child.tagName;
      if (!child.children.length) {
        const value = cleanText(child.textContent);
        if (obj[key] == null) obj[key] = value;
        else obj[key] = `${obj[key]} | ${value}`;
      } else {
        const nested = xmlElementToObject(child);
        Object.entries(nested).forEach(([k,v]) => obj[`${key}.${k}`] = v);
      }
    }
    if (!el.children.length && !Object.keys(obj).length) obj.value = cleanText(el.textContent);
    return obj;
  }

  function flattenRecord(record) {
    if (!isPlainObject(record)) return { value: scalarToString(record) };
    const out = {};
    flatten(record, '', 0);
    return out;

    function flatten(value, prefix, depth) {
      if (depth > 6) { out[prefix || 'value'] = scalarToString(value); return; }
      if (value == null) { out[prefix || 'value'] = ''; return; }
      if (Array.isArray(value)) {
        if (value.every(v => v == null || ['string','number','boolean'].includes(typeof v))) out[prefix] = value.filter(v => v != null && v !== '').join(' | ');
        else out[prefix] = value.slice(0, 12).map(v => isPlainObject(v) ? Object.values(v).map(scalarToString).filter(Boolean).join(': ') : scalarToString(v)).filter(Boolean).join(' | ');
        return;
      }
      if (isPlainObject(value)) {
        const entries = Object.entries(value);
        if (!entries.length) { if (prefix) out[prefix] = ''; return; }
        entries.forEach(([k,v]) => flatten(v, prefix ? `${prefix}.${k}` : k, depth + 1));
        return;
      }
      out[prefix || 'value'] = scalarToString(value);
    }
  }

  function collectFields(rows) {
    const set = new Set();
    rows.slice(0, 1000).forEach(r => Object.keys(r).forEach(k => set.add(k)));
    return [...set];
  }

  function inferMapping(fields, rows) {
    const mapping = {};
    const used = new Set();
    for (const role of Object.keys(ROLE_CONFIG)) {
      const ranked = fields.map(field => ({ field, score: scoreFieldForRole(field, sampleValues(rows, field), role) })).sort((a,b) => b.score - a.score);
      const best = ranked.find(x => !used.has(x.field)) || ranked[0];
      const threshold = ['phone','email','website'].includes(role) ? 42 : 36;
      if (best && best.score >= threshold) {
        mapping[role] = { field:best.field, confidence:Math.min(99, Math.round(best.score)) };
        if (['name','phone','email','website','category','address','city','state','country'].includes(role)) used.add(best.field);
      } else mapping[role] = { field:'', confidence:0 };
    }
    return mapping;
  }

  function scoreFieldForRole(field, values, role) {
    const cfg = ROLE_CONFIG[role];
    const key = normalizeKey(field);
    const leaf = normalizeKey(field.split('.').pop());
    let score = 0;
    for (const alias of cfg.aliases) {
      const a = normalizeKey(alias);
      if (key === a || leaf === a) score = Math.max(score, 72);
      else if (key.endsWith(a) || key.includes(a)) score = Math.max(score, 50);
      else if (tokenOverlap(field, alias) >= .8) score = Math.max(score, 42);
    }
    const nonempty = values.map(v => String(v ?? '').trim()).filter(Boolean);
    if (!nonempty.length) return score * .35;
    const ratio = fn => nonempty.filter(fn).length / nonempty.length;
    const uniqueRatio = new Set(nonempty.map(v => v.toLowerCase())).size / nonempty.length;
    const avgLen = nonempty.reduce((a,b) => a + b.length, 0) / nonempty.length;

    if (role === 'phone') score += ratio(isPhoneLike) * 55;
    if (role === 'email') score += ratio(v => /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v)) * 68;
    if (role === 'website') {
      score += ratio(v => isHttpUrl(v) && !isListingUrl(v)) * 28;
      if (/image|photo|logo|avatar|thumbnail/i.test(field)) score -= 35;
      if (ratio(isListingUrl) > .5) score -= 35;
    }
    if (role === 'sourceUrl') score += ratio(v => isHttpUrl(v)) * 35 + ratio(isListingUrl) * 25;
    if (role === 'rating') score += ratio(v => isFiniteNumber(v) && +v >= 0 && +v <= 5) * 35;
    if (role === 'reviews' || role === 'imageCount') score += ratio(v => /^\d+$/.test(v) && +v >= 0) * 25;
    if (role === 'address') score += ratio(isAddressLike) * 30 + (avgLen > 20 ? 5 : 0);
    if (role === 'country') score += ratio(v => /^[A-Za-z]{2,3}$/.test(v) || /^[A-Za-z .'-]{4,30}$/.test(v)) * 8;
    if (role === 'city' || role === 'state') score += (uniqueRatio < .4 ? 8 : 0) + (avgLen < 30 ? 4 : 0);
    if (role === 'category') score += (avgLen < 90 ? 6 : 0) + (uniqueRatio < .75 ? 8 : 0) + ratio(v => /school|real estate|restaurant|clinic|store|agency|company|hotel|salon|services|developer|institution/i.test(v)) * 16;
    if (role === 'name') score += (uniqueRatio > .65 ? 12 : 0) + (avgLen >= 3 && avgLen <= 80 ? 9 : 0) + ratio(v => !isHttpUrl(v) && !isPhoneLike(v) && !isAddressLike(v)) * 6;
    if (role === 'searchQuery') score += (uniqueRatio < .35 ? 10 : 0) + (avgLen < 100 ? 4 : 0);
    return Math.max(0, score);
  }

  function sampleValues(rows, field) {
    const out = [];
    const step = Math.max(1, Math.floor(rows.length / 80));
    for (let i=0;i<rows.length && out.length<80;i+=step) out.push(rows[i]?.[field]);
    return out;
  }

  function rebuildLeadsForDataset(dataset, preserveExisting) {
    const existing = new Map(state.leads.filter(l => l.datasetId === dataset.id).map(l => [l.sourceIndex, l]));
    state.leads = state.leads.filter(l => l.datasetId !== dataset.id);
    dataset.rows.forEach((row, index) => {
      const lead = normalizeLead(row, dataset, index);
      const old = existing.get(index);
      if (preserveExisting && old) {
        lead.status = old.status;
        lead.notes = old.notes;
        lead.followupDate = old.followupDate;
        lead.messageOverrides = old.messageOverrides || {};
        lead.generation = old.generation || 0;
        lead.updatedAt = old.updatedAt || lead.updatedAt;
      }
      state.leads.push(lead);
    });
  }

  function normalizeLead(row, dataset, index) {
    const get = role => {
      const f = dataset.mapping[role]?.field;
      return f ? cleanText(row[f]) : '';
    };
    const category = get('category');
    const searchQuery = get('searchQuery');
    const name = get('name') || guessFallbackName(row) || `Unnamed lead ${index + 1}`;
    const country = get('country');
    const phoneRaw = get('phone');
    const type = classifyBusiness([category, searchQuery, name].filter(Boolean).join(' · '));
    const lead = {
      id: uidFrom(`${dataset.id}:${index}:${name}:${phoneRaw}`), datasetId:dataset.id, sourceIndex:index,
      name, phone: normalizePhoneDisplay(phoneRaw), phoneRaw, email:get('email'), website:cleanWebsite(get('website')),
      category, address:get('address'), city:get('city'), state:get('state'), country,
      rating: parseNumber(get('rating')), reviews: parseInteger(get('reviews')), imageCount: parseInteger(get('imageCount')),
      sourceUrl:get('sourceUrl'), searchQuery, typeId:type.id, typeLabel:type.label,
      status:'new', notes:'', followupDate:'', generation:0, messageOverrides:{},
      fieldKnowledge: {
        website: Boolean(dataset.mapping.website?.field),
        phone: Boolean(dataset.mapping.phone?.field),
        email: Boolean(dataset.mapping.email?.field)
      },
      importedAt: dataset.importedAt, updatedAt: dataset.importedAt,
      rawContext: selectRawContext(row, dataset.mapping)
    };
    lead.whatsappPhone = normalizeWhatsAppPhone(phoneRaw, country);
    lead.score = scoreLead(lead);
    return lead;
  }

  function selectRawContext(row, mapping) {
    const mapped = new Set(Object.values(mapping).map(v => v.field).filter(Boolean));
    const useful = Object.entries(row).filter(([k,v]) => cleanText(v) && !mapped.has(k)).slice(0, 8);
    return useful.map(([key,value]) => ({ key, value: cleanText(value).slice(0, 240) }));
  }

  function guessFallbackName(row) {
    const candidates = Object.entries(row).map(([k,v]) => ({ k, v:cleanText(v) })).filter(x => x.v && x.v.length >= 3 && x.v.length <= 90 && !isPhoneLike(x.v) && !isHttpUrl(x.v) && !isAddressLike(x.v));
    candidates.sort((a,b) => scoreFieldForRole(a.k, [a.v], 'name') - scoreFieldForRole(b.k, [b.v], 'name')).reverse();
    return candidates[0]?.v || '';
  }

  function classifyBusiness(text) {
    const hay = String(text).toLowerCase();
    let best = TYPE_DEFS[TYPE_DEFS.length - 1], bestScore = 0;
    for (const type of TYPE_DEFS.slice(0,-1)) {
      let score = 0;
      type.words.forEach(w => { if (hay.includes(w)) score += w.includes(' ') ? 3 : 2; });
      if (score > bestScore) { best = type; bestScore = score; }
    }
    return best;
  }

  function scoreLead(lead) {
    if (lead.status === 'do_not_contact') return 0;
    let score = 24;
    if (lead.whatsappPhone) score += 22; else score -= 18;
    if (lead.email) score += 5;
    if (lead.category) score += 8;
    if (lead.address || lead.city) score += 4;
    if (lead.fieldKnowledge.website) score += lead.website ? 3 : 23;
    else score += 8;
    if (lead.reviews != null) {
      if (lead.reviews >= 50) score += 12;
      else if (lead.reviews >= 10) score += 9;
      else if (lead.reviews >= 2) score += 5;
    }
    if (lead.imageCount != null && lead.imageCount >= 5) score += 5;
    if (lead.rating != null && lead.rating >= 4) score += 4;
    return clamp(Math.round(score), 0, 100);
  }

  function dedupeLeads(leads) {
    const map = new Map();
    for (const lead of leads) {
      const key = leadDedupKey(lead);
      if (!map.has(key)) map.set(key, lead);
      else map.set(key, mergeLeads(map.get(key), lead));
    }
    return [...map.values()];
  }

  function leadDedupKey(lead) {
    if (lead.whatsappPhone) return `p:${lead.whatsappPhone}`;
    if (lead.email) return `e:${lead.email.toLowerCase()}`;
    if (lead.website) return `w:${websiteHost(lead.website)}`;
    return `n:${normalizeKey(lead.name)}:${normalizeKey(lead.city || lead.address)}`;
  }

  function mergeLeads(a,b) {
    const pick = (x,y) => cleanText(x).length >= cleanText(y).length ? x : y;
    const richer = { ...a };
    ['phone','phoneRaw','email','website','category','address','city','state','country','sourceUrl','searchQuery'].forEach(k => richer[k] = pick(a[k], b[k]));
    richer.rating = a.rating ?? b.rating;
    richer.reviews = Math.max(a.reviews ?? -1, b.reviews ?? -1); if (richer.reviews < 0) richer.reviews = null;
    richer.imageCount = Math.max(a.imageCount ?? -1, b.imageCount ?? -1); if (richer.imageCount < 0) richer.imageCount = null;
    richer.rawContext = [...(a.rawContext || []), ...(b.rawContext || [])].slice(0,10);
    richer.score = scoreLead(richer);
    return richer;
  }

  function render() {
    const has = state.leads.length > 0;
    els.workspace.hidden = !has;
    els.leadCountHero.textContent = state.leads.length.toLocaleString();
    els.dueCountHero.textContent = countDueFollowups().toLocaleString();
    els.searchInput.value = state.filters.search;
    els.statusFilter.value = state.filters.status;
    els.priorityFilter.value = state.filters.priority;
    els.phoneOnlyFilter.checked = state.filters.phoneOnly;
    els.toneSelect.value = state.tone;
    els.sortSelect.value = state.sort;
    renderMetrics();
    renderMappingSummary();
    renderTypeFilter();
    renderLeads();
  }

  function renderMetrics() {
    els.metricHot.textContent = state.leads.filter(l => l.score >= 70 && l.status !== 'do_not_contact').length;
    els.metricPhones.textContent = state.leads.filter(l => l.whatsappPhone).length;
    els.metricInterested.textContent = state.leads.filter(l => l.status === 'interested').length;
    els.metricWon.textContent = state.leads.filter(l => l.status === 'won').length;
    els.dueCountHero.textContent = countDueFollowups();
  }

  function renderMappingSummary() {
    const ds = getActiveDataset();
    if (!ds) { els.mappingSummary.innerHTML = ''; return; }
    const roles = ['name','phone','website','category','address'];
    els.mappingSummary.innerHTML = roles.map(role => {
      const m = ds.mapping[role] || {field:'',confidence:0};
      const cls = m.confidence >= 75 ? 'high' : m.confidence >= 50 ? 'mid' : '';
      return `<div class="mapping-row"><span>${escapeHtml(ROLE_CONFIG[role].label)}</span><code title="${escapeAttr(m.field || 'Not detected')}">${escapeHtml(m.field || 'Not detected')}</code><span class="confidence ${cls}">${m.confidence ? `${m.confidence}%` : '—'}</span></div>`;
    }).join('');
  }

  function renderTypeFilter() {
    const current = state.filters.type;
    const counts = new Map();
    state.leads.forEach(l => counts.set(l.typeId, (counts.get(l.typeId) || 0) + 1));
    els.typeFilter.innerHTML = `<option value="all">All types (${state.leads.length})</option>` + TYPE_DEFS.filter(t => counts.has(t.id)).map(t => `<option value="${t.id}">${escapeHtml(t.label)} (${counts.get(t.id)})</option>`).join('');
    els.typeFilter.value = counts.has(current) || current === 'all' ? current : 'all';
  }

  function getFilteredLeads() {
    let leads = state.leads.filter(lead => {
      const f = state.filters;
      const hay = [lead.name,lead.category,lead.address,lead.city,lead.state,lead.phone,lead.email,lead.typeLabel].join(' ').toLowerCase();
      if (f.search && !hay.includes(f.search.toLowerCase())) return false;
      if (f.type !== 'all' && lead.typeId !== f.type) return false;
      if (f.status !== 'all' && lead.status !== f.status) return false;
      if (f.phoneOnly && !lead.whatsappPhone) return false;
      if (f.priority === 'hot' && lead.score < 70) return false;
      if (f.priority === 'warm' && (lead.score < 45 || lead.score >= 70)) return false;
      if (f.priority === 'low' && lead.score >= 45) return false;
      return true;
    });
    leads.sort((a,b) => {
      if (state.sort === 'name_asc') return a.name.localeCompare(b.name);
      if (state.sort === 'recent') return new Date(b.updatedAt) - new Date(a.updatedAt);
      if (state.sort === 'followup') return followupSortValue(a) - followupSortValue(b) || b.score - a.score;
      return b.score - a.score || a.name.localeCompare(b.name);
    });
    return leads;
  }

  function renderLeads() {
    const leads = getFilteredLeads();
    els.visibleLeadCount.textContent = leads.length.toLocaleString();
    els.emptyFiltered.hidden = leads.length > 0;
    els.leadList.innerHTML = leads.map(leadCardHtml).join('');
  }

  function leadCardHtml(lead) {
    const scoreClass = lead.score >= 70 ? 'hot' : lead.score >= 45 ? 'warm' : '';
    const loc = [lead.city, lead.state].filter(Boolean).join(', ') || lead.address || 'Location not mapped';
    const contact = lead.whatsappPhone ? lead.phone || lead.whatsappPhone : 'No WhatsApp-ready phone';
    const websiteSignal = lead.fieldKnowledge.website ? (lead.website ? 'Website found' : 'No website in data') : 'Website unknown';
    const disabled = !lead.whatsappPhone || lead.status === 'do_not_contact';
    return `<article class="lead-card" data-id="${lead.id}">
      <div class="score-box ${scoreClass}" title="Lead opportunity score"><strong>${lead.score}</strong><span>SCORE</span></div>
      <div class="lead-main"><h3 title="${escapeAttr(lead.name)}">${escapeHtml(lead.name)}</h3><p>${escapeHtml(lead.category || lead.typeLabel)} · ${escapeHtml(websiteSignal)}</p></div>
      <div class="lead-signal location-signal"><strong>${escapeHtml(loc)}</strong><span>${escapeHtml(lead.typeLabel)}</span></div>
      <div class="lead-signal"><span class="status-badge ${lead.status}">${escapeHtml(STATUS_LABELS[lead.status] || lead.status)}</span><span>${escapeHtml(contact)}</span></div>
      <div class="lead-actions">
        <button class="mini-button" type="button" data-action="open">Details</button>
        <button class="mini-button wa" type="button" data-action="wa" ${disabled ? 'disabled' : ''}>WhatsApp</button>
      </div>
    </article>`;
  }

  function onLeadListClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const card = btn.closest('.lead-card');
    const lead = state.leads.find(l => l.id === card?.dataset.id);
    if (!lead) return;
    if (btn.dataset.action === 'open') openLeadDialog(lead.id);
    if (btn.dataset.action === 'wa') openWhatsAppForLead(lead.id);
  }

  function openMappingDialog(datasetId = state.activeDatasetId) {
    const ds = state.datasets.find(d => d.id === datasetId) || state.datasets[0];
    if (!ds) return;
    state.activeDatasetId = ds.id;
    const datasetChooser = state.datasets.length > 1 ? `<label class="mapping-item"><div class="mapping-role"><strong>Dataset</strong><span>Edit one source at a time</span></div><select id="mappingDatasetSelect">${state.datasets.map(d => `<option value="${d.id}" ${d.id===ds.id?'selected':''}>${escapeHtml(d.name)} · ${d.rowCount} rows</option>`).join('')}</select><span></span></label>` : '';
    els.mappingGrid.innerHTML = datasetChooser + Object.entries(ROLE_CONFIG).map(([role,cfg]) => {
      const current = ds.mapping[role] || {field:'',confidence:0};
      return `<label class="mapping-item">
        <div class="mapping-role"><strong>${escapeHtml(cfg.label)}</strong><span>${escapeHtml(cfg.hint)}</span></div>
        <select data-role="${role}"><option value="">Not mapped</option>${ds.fields.map(f => `<option value="${escapeAttr(f)}" ${f===current.field?'selected':''}>${escapeHtml(f)}</option>`).join('')}</select>
        <span class="mapping-confidence">${current.confidence ? `${current.confidence}% auto` : 'manual'}</span>
      </label>`;
    }).join('');
    els.mappingDatasetLabel.textContent = `${ds.name} · ${ds.format} · ${ds.rowCount.toLocaleString()} rows`;
    const chooser = document.getElementById('mappingDatasetSelect');
    chooser?.addEventListener('change', e => openMappingDialog(e.target.value));
    if (!els.mappingDialog.open) els.mappingDialog.showModal();
  }

  function applyMappingFromDialog() {
    const ds = getActiveDataset();
    if (!ds) return;
    els.mappingGrid.querySelectorAll('select[data-role]').forEach(sel => {
      ds.mapping[sel.dataset.role] = { field:sel.value, confidence:sel.value ? 100 : 0 };
    });
    rebuildLeadsForDataset(ds, true);
    state.leads = dedupeLeads(state.leads);
    saveWorkspace(); render(); toast('Schema mapping applied.');
  }

  function openLeadDialog(id) {
    const lead = state.leads.find(l => l.id === id);
    if (!lead) return;
    state.activeLeadId = id;
    els.dialogLeadName.textContent = lead.name;
    els.dialogLeadMeta.textContent = [lead.category || lead.typeLabel, lead.city || lead.state || '', lead.phone || 'No phone'].filter(Boolean).join(' · ');
    els.messageEditor.value = getLeadMessage(lead);
    els.leadStatusSelect.value = lead.status;
    els.followupInput.value = lead.followupDate || '';
    els.notesInput.value = lead.notes || '';
    els.rawContext.innerHTML = [
      ['Score', `${lead.score}/100`], ['Website', lead.fieldKnowledge.website ? (lead.website || 'No website in imported data') : 'Not mapped / unknown'],
      ['Reviews', lead.reviews ?? 'Unknown'], ['Source', lead.sourceUrl || 'Unknown'],
      ...(lead.rawContext || []).slice(0,5).map(x => [x.key, x.value])
    ].map(([k,v]) => `<div><span>${escapeHtml(String(k))}</span><span>${escapeHtml(String(v))}</span></div>`).join('');
    updateActiveWhatsAppLink();
    els.leadDialog.showModal();
  }

  function saveLeadEdits() {
    const lead = getActiveLead(); if (!lead) return;
    lead.status = els.leadStatusSelect.value;
    lead.followupDate = els.followupInput.value;
    lead.notes = els.notesInput.value.trim();
    lead.messageOverrides[state.tone] = els.messageEditor.value.trim();
    lead.updatedAt = new Date().toISOString();
    lead.score = scoreLead(lead);
    saveWorkspace(); render(); toast('Lead updated.');
  }

  function regenerateActiveLeadMessage() {
    const lead = getActiveLead(); if (!lead) return;
    lead.generation = (lead.generation || 0) + 1;
    delete lead.messageOverrides[state.tone];
    els.messageEditor.value = generateMessage(lead, state.tone, lead.generation);
    updateActiveWhatsAppLink();
    saveWorkspace();
  }

  async function copyActiveMessage() {
    try { await navigator.clipboard.writeText(els.messageEditor.value); toast('Message copied.'); }
    catch (_) { els.messageEditor.select(); document.execCommand('copy'); toast('Message copied.'); }
  }

  function updateActiveWhatsAppLink() {
    const lead = getActiveLead(); if (!lead) return;
    const blocked = !lead.whatsappPhone || els.leadStatusSelect.value === 'do_not_contact';
    els.whatsappLink.setAttribute('aria-disabled', blocked ? 'true' : 'false');
    els.whatsappLink.href = blocked ? '#' : buildWhatsAppUrl(lead.whatsappPhone, els.messageEditor.value.trim());
  }

  function openWhatsAppForLead(id) {
    const lead = state.leads.find(l => l.id === id);
    if (!lead?.whatsappPhone || lead.status === 'do_not_contact') return;
    const message = getLeadMessage(lead);
    lead.status = lead.status === 'new' ? 'contacted' : lead.status;
    lead.updatedAt = new Date().toISOString();
    saveWorkspace(); render();
    window.open(buildWhatsAppUrl(lead.whatsappPhone, message), '_blank', 'noopener');
  }

  function getLeadMessage(lead) {
    return lead.messageOverrides?.[state.tone] || generateMessage(lead, state.tone, lead.generation || 0);
  }

  function generateMessage(lead, tone, generation = 0) {
    const seed = hashString(`${lead.id}:${tone}:${generation}`);
    const pick = (arr, salt=0) => arr[Math.abs((seed + salt * 7919)) % arr.length];
    const type = TYPE_DEFS.find(t => t.id === lead.typeId) || TYPE_DEFS[TYPE_DEFS.length - 1];
    const location = lead.city || lead.state || areaFromAddress(lead.address);
    const locationPhrase = location ? ` around ${location}` : '';
    const category = lead.category || type.label.toLowerCase();
    const siteNote = lead.fieldKnowledge.website && lead.website
      ? pick(['I saw that you already have a website, and I had a few ideas that could make the online experience clearer for customers.', 'I noticed you already have a website, so this would be more of an improvement idea than starting from zero.'], 2)
      : pick(['I had an idea for a focused website that could make it easier for potential customers to understand what you offer.', 'I think a simple, well-structured website could make your business easier to discover and contact online.'], 3);

    if (tone === 'short') {
      return `Hi 👋 I’m ${DEFAULT_PROFILE.name} from ${DEFAULT_PROFILE.brand}. I came across ${lead.name}${locationPhrase}. I build websites, and I think a focused site could help ${type.benefit}. Can I send you a quick idea?`;
    }
    if (tone === 'professional') {
      const open = pick(['Hello,', 'Hi there,'], 1);
      return `${open}\n\nI came across ${lead.name}, ${articleFor(category)} ${category}${locationPhrase}. My name is ${DEFAULT_PROFILE.name}, and I build business websites through ${DEFAULT_PROFILE.brand}.\n\n${siteNote} For a ${type.label.toLowerCase()} business, it could help ${type.benefit}.\n\nIf you’re open to it, I can send a concise idea of what I have in mind. No obligation.`;
    }
    const hello = pick(['Hi 👋', 'Hello 👋', 'Hi there 👋'], 1);
    const closer = pick(['Would you be open to me sending a quick idea of what I mean? No pressure at all.', 'Can I send you a quick concept of what I have in mind? No pressure.', 'If you’re open to it, I can send a quick idea so you can see what I mean.'], 4);
    return `${hello}\n\nI came across ${lead.name}${locationPhrase} while checking out ${type.label.toLowerCase()} businesses. I’m ${DEFAULT_PROFILE.name} from ${DEFAULT_PROFILE.brand}, and I build websites for businesses.\n\n${siteNote} For ${lead.name}, it could help ${type.benefit}.\n\n${closer}`;
  }

  function buildWhatsAppUrl(phone, message) {
    return `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`;
  }

  function exportFilteredCsv() {
    const leads = getFilteredLeads();
    if (!leads.length) return toast('No filtered leads to export.');
    const rows = leads.map(l => ({
      name:l.name, type:l.typeLabel, category:l.category, phone:l.phone, whatsapp_phone:l.whatsappPhone,
      email:l.email, website:l.website, address:l.address, city:l.city, state:l.state, score:l.score,
      status:STATUS_LABELS[l.status], follow_up:l.followupDate, notes:l.notes, message:getLeadMessage(l), source_url:l.sourceUrl
    }));
    downloadText(`client-gen-leads-${dateStamp()}.csv`, objectsToCsv(rows), 'text/csv;charset=utf-8');
  }

  function exportWorkspace() {
    downloadText(`client-gen-workspace-${dateStamp()}.json`, JSON.stringify({ version:APP_VERSION, exportedAt:new Date().toISOString(), state }, null, 2), 'application/json');
  }

  async function clearWorkspace() {
    if (!confirm('Clear all imported leads, notes, statuses and mappings from this device? This cannot be undone unless you exported a backup.')) return;
    state.datasets = []; state.leads = []; state.activeDatasetId = null; state.activeLeadId = null;
    await idbSet('state', null); render(); els.importStatus.textContent = ''; toast('Local workspace cleared.');
  }

  function objectsToCsv(rows) {
    const headers = Object.keys(rows[0] || {});
    const esc = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\r\n');
  }

  function downloadText(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], {type}));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadWorkspace() {
    try {
      const saved = await idbGet('state');
      if (saved && saved.leads && saved.datasets) {
        Object.assign(state, saved);
      }
    } catch (err) { console.warn('Could not restore workspace', err); }
  }

  function saveWorkspace(immediate = false) {
    clearTimeout(saveTimer);
    const work = () => idbSet('state', serializableState()).catch(err => console.warn('Could not save workspace', err));
    if (immediate) return work();
    saveTimer = setTimeout(work, 180);
  }

  function serializableState() {
    return {
      datasets:state.datasets, leads:state.leads, tone:state.tone, filters:state.filters,
      sort:state.sort, activeDatasetId:state.activeDatasetId, theme:state.theme
    };
  }

  function openDb() {
    return new Promise((resolve,reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve,reject) => { const tx=db.transaction('kv','readonly'); const r=tx.objectStore('kv').get(key); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
  }
  async function idbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve,reject) => { const tx=db.transaction('kv','readwrite'); tx.objectStore('kv').put(value,key); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); });
  }

  function getActiveDataset() { return state.datasets.find(d => d.id === state.activeDatasetId) || state.datasets[0]; }
  function getActiveLead() { return state.leads.find(l => l.id === state.activeLeadId); }

  function countDueFollowups() {
    const today = new Date(); today.setHours(0,0,0,0);
    return state.leads.filter(l => l.followupDate && !['won','not_interested','do_not_contact'].includes(l.status) && new Date(`${l.followupDate}T00:00:00`) <= today).length;
  }
  function followupSortValue(l) { return l.followupDate ? new Date(`${l.followupDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER; }

  function normalizeWhatsAppPhone(value, country) {
    let raw = String(value || '').trim();
    if (!raw) return '';
    const hadPlus = raw.startsWith('+');
    let digits = raw.replace(/\D/g,'');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (hadPlus) return digits.length >= 8 ? digits : '';
    const iso = String(country || '').trim().toUpperCase();
    const dial = DIAL_CODES[iso] || (iso === 'NIGERIA' ? '234' : '');
    if (digits.startsWith('0') && dial) digits = dial + digits.slice(1);
    else if (dial && !digits.startsWith(dial) && digits.length <= 11) digits = dial + digits.replace(/^0+/,'');
    else if (!dial && digits.startsWith('0')) return '';
    return digits.length >= 8 && digits.length <= 15 ? digits : '';
  }

  function normalizePhoneDisplay(value) { return cleanText(value); }
  function cleanWebsite(value) {
    const s = cleanText(value); if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return `https://${s}`;
    return s;
  }
  function websiteHost(value) { try { return new URL(cleanWebsite(value)).hostname.replace(/^www\./,'').toLowerCase(); } catch (_) { return normalizeKey(value); } }
  function isListingUrl(v) { return /google\.[^/]+\/maps|maps\.google|facebook\.com|instagram\.com|linkedin\.com|tiktok\.com|business\.site/i.test(String(v)); }
  function isHttpUrl(v) { try { const u=new URL(String(v)); return ['http:','https:'].includes(u.protocol); } catch (_) { return false; } }
  function isPhoneLike(v) {
    const s=String(v).trim(); const digits=s.replace(/\D/g,'');
    return digits.length >= 8 && digits.length <= 15 && /^[+\d\s().-]+$/.test(s);
  }
  function isAddressLike(v) { return /\b(street|st\.?|road|rd\.?|avenue|ave\.?|close|crescent|estate|way|lane|drive|dr\.?|junction|area|district|floor|building|plaza|lagos|abuja|nigeria)\b/i.test(String(v)) && String(v).length > 10; }
  function isFiniteNumber(v) { return v !== '' && v != null && Number.isFinite(Number(v)); }
  function parseNumber(v) { return isFiniteNumber(v) ? Number(v) : null; }
  function parseInteger(v) { return /^\d+$/.test(String(v || '').trim()) ? parseInt(v,10) : null; }
  function cleanText(v) { return scalarToString(v).replace(/\s+/g,' ').trim(); }
  function scalarToString(v) { if (v == null) return ''; if (typeof v === 'boolean') return v ? 'true' : 'false'; if (typeof v === 'object') return JSON.stringify(v); return String(v); }
  function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function makeUniqueHeaders(headers) { const seen={}; return headers.map(h => { const base=h || 'column'; seen[base]=(seen[base]||0)+1; return seen[base]===1?base:`${base}_${seen[base]}`; }); }
  function normalizeKey(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g,''); }
  function tokenOverlap(a,b) { const A=new Set(String(a).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)); const B=new Set(String(b).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)); if (!A.size || !B.size) return 0; const hit=[...A].filter(x=>B.has(x)).length; return hit/Math.max(A.size,B.size); }
  function areaFromAddress(address) { const parts=String(address||'').split(',').map(x=>x.trim()).filter(Boolean); return parts.length>=2 ? parts[parts.length-2].replace(/\b\d{5,6}\b/g,'').trim() : ''; }
  function articleFor(text) { return /^[aeiou]/i.test(String(text).trim()) ? 'an' : 'a'; }
  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
  function uid(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function hashString(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function uidFrom(str){ return `lead_${hashString(str).toString(36)}`; }
  function dateStamp(){ return new Date().toISOString().slice(0,10); }
  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/`/g,'&#096;'); }
  function toast(message){ clearTimeout(toastTimer); els.toast.textContent=message; els.toast.classList.add('show'); toastTimer=setTimeout(()=>els.toast.classList.remove('show'),2200); }
})();
