(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const els = {
    form:$('crawlForm'), label:$('labelInput'), urls:$('urlInput'), maxPages:$('maxPagesInput'), maxDepth:$('maxDepthInput'), concurrency:$('concurrencyInput'), delay:$('delayInput'), follow:$('followLinksInput'), start:$('startBtn'), stop:$('stopBtn'), status:$('formStatus'),
    statStatus:$('statStatus'), statPages:$('statPages'), statLeads:$('statLeads'), statFailed:$('statFailed'), progress:$('progressBar'), json:$('jsonExport'), csv:$('csvExport'), empty:$('emptyState'), table:$('leadTableWrap'), rows:$('leadRows'), errors:$('errorDetails'), errorLog:$('errorLog')
  };
  let activeId = null;
  let pollTimer = null;

  els.form.addEventListener('submit', startCrawl);
  els.stop.addEventListener('click', stopCrawl);

  async function startCrawl(e) {
    e.preventDefault();
    clearInterval(pollTimer);
    setBusy(true);
    els.status.textContent = 'Starting crawler…';
    try {
      const payload = {
        label: els.label.value.trim(),
        startUrls: els.urls.value.split(/\n+/).map(v => v.trim()).filter(Boolean),
        maxPages: Number(els.maxPages.value),
        maxDepth: Number(els.maxDepth.value),
        concurrency: Number(els.concurrency.value),
        delaySecs: Number(els.delay.value),
        followLinks: els.follow.checked
      };
      const res = await fetch('/api/crawls', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start crawl.');
      activeId = data.id;
      applyJob(data);
      pollTimer = setInterval(poll, 1200);
      els.status.textContent = 'Crawler running. Results appear as pages finish.';
    } catch (err) {
      setBusy(false);
      els.status.textContent = err.message;
    }
  }

  async function poll() {
    if (!activeId) return;
    try {
      const res = await fetch(`/api/crawls/${activeId}`, { cache:'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read crawl state.');
      applyJob(data);
      if (['completed','failed','stopped'].includes(data.status)) {
        clearInterval(pollTimer);
        setBusy(false);
        els.status.textContent = data.status === 'completed' ? `Done. ${data.stats.leads} lead${data.stats.leads===1?'':'s'} ready for Client Gen.` : `Crawl ${data.status}.`;
      }
    } catch (err) {
      clearInterval(pollTimer);
      setBusy(false);
      els.status.textContent = err.message;
    }
  }

  async function stopCrawl() {
    if (!activeId) return;
    els.stop.disabled = true;
    els.status.textContent = 'Stopping after the current request…';
    try { await fetch(`/api/crawls/${activeId}/stop`, { method:'POST' }); } catch {}
  }

  function applyJob(job) {
    const statusLabel = {queued:'Queued',running:'Running',stopping:'Stopping',completed:'Complete',failed:'Failed',stopped:'Stopped'}[job.status] || job.status;
    els.statStatus.textContent = statusLabel;
    els.statPages.textContent = job.stats.processed ?? 0;
    els.statLeads.textContent = job.stats.leads ?? 0;
    els.statFailed.textContent = job.stats.failed ?? 0;
    const pct = Math.min(100, Math.round(((job.stats.processed || 0) / Math.max(1, job.config.maxPages || 1)) * 100));
    els.progress.style.width = `${job.status === 'completed' ? 100 : pct}%`;
    renderRows(job.leads || []);
    if (activeId) {
      els.json.href = `/api/crawls/${activeId}/export.json`;
      els.csv.href = `/api/crawls/${activeId}/export.csv`;
      els.json.classList.remove('disabled');
      els.csv.classList.remove('disabled');
    }
    if (job.errors?.length) {
      els.errors.hidden = false;
      els.errorLog.textContent = job.errors.join('\n');
    } else {
      els.errors.hidden = true;
    }
  }

  function renderRows(leads) {
    els.empty.hidden = leads.length > 0;
    els.table.hidden = leads.length === 0;
    els.rows.innerHTML = leads.map(lead => `<tr>
      <td><strong>${esc(lead.title || 'Unnamed')}</strong><small>${esc(lead.website || '')}</small></td>
      <td>${esc(lead.categoryName || 'Unknown')}</td>
      <td>${esc(lead.phone || '—')}</td>
      <td>${esc(lead.email || lead.emails?.[0] || '—')}</td>
      <td>${esc(lead.address || [lead.city,lead.state].filter(Boolean).join(', ') || '—')}</td>
      <td><a href="${safeUrl(lead.url)}" target="_blank" rel="noopener">Page ↗</a></td>
    </tr>`).join('');
  }

  function setBusy(busy) {
    els.start.disabled = busy;
    els.stop.disabled = !busy;
    els.start.textContent = busy ? 'Crawling…' : 'Start crawl';
  }

  function safeUrl(v) { try { const u = new URL(v); return ['http:','https:'].includes(u.protocol) ? escAttr(u.href) : '#'; } catch { return '#'; } }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function escAttr(v) { return esc(v).replace(/`/g, '&#096;'); }
})();
