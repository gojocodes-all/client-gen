(() => {
  'use strict';

  const STORAGE_KEY = 'client-gen-whatsapp-status-v1';
  const LABELS = {
    unknown: 'WhatsApp unknown',
    confirmed: 'Confirmed on WhatsApp',
    not_on_whatsapp: 'Not on WhatsApp'
  };

  const statusFilter = document.getElementById('whatsappStatusFilter');
  const statusSelect = document.getElementById('leadWhatsappStatusSelect');
  const leadList = document.getElementById('leadList');
  const leadDialog = document.getElementById('leadDialog');
  const visibleLeadCount = document.getElementById('visibleLeadCount');
  const saveLeadBtn = document.getElementById('saveLeadBtn');

  if (!statusFilter || !statusSelect || !leadList || !leadDialog) return;

  let activeLeadId = null;
  let statuses = loadStatuses();

  injectStyles();
  addExplanation();

  leadList.addEventListener('click', event => {
    const card = event.target.closest('.lead-card');
    if (!card) return;
    activeLeadId = card.dataset.id || null;

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'wa' && getStatus(activeLeadId) === 'not_on_whatsapp') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  statusFilter.addEventListener('change', applyFilter);

  statusSelect.addEventListener('change', () => {
    if (!activeLeadId) return;
    setStatus(activeLeadId, statusSelect.value);
    decorateCards();
    applyFilter();
  });

  saveLeadBtn?.addEventListener('click', () => {
    if (!activeLeadId) return;
    setStatus(activeLeadId, statusSelect.value);
  });

  new MutationObserver(() => {
    if (leadDialog.open && activeLeadId) {
      statusSelect.value = getStatus(activeLeadId);
    }
  }).observe(leadDialog, { attributes:true, attributeFilter:['open'] });

  new MutationObserver(() => {
    decorateCards();
    applyFilter();
  }).observe(leadList, { childList:true, subtree:true });

  decorateCards();
  applyFilter();

  function loadStatuses() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function saveStatuses() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  }

  function getStatus(id) {
    return statuses[id] || 'unknown';
  }

  function setStatus(id, value) {
    if (!id) return;
    statuses[id] = ['confirmed','not_on_whatsapp'].includes(value) ? value : 'unknown';
    saveStatuses();
  }

  function decorateCards() {
    leadList.querySelectorAll('.lead-card').forEach(card => {
      const id = card.dataset.id;
      const value = getStatus(id);
      let badge = card.querySelector('.wa-status-chip');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'wa-status-chip';
        const signal = card.querySelector('.lead-signal');
        (signal || card.querySelector('.lead-main') || card).appendChild(badge);
      }
      badge.dataset.status = value;
      badge.textContent = LABELS[value];

      const waButton = card.querySelector('[data-action="wa"]');
      if (waButton && value === 'not_on_whatsapp') {
        waButton.disabled = true;
        waButton.title = 'Marked as not on WhatsApp';
      }
    });
  }

  function applyFilter() {
    const selected = statusFilter.value;
    let visible = 0;
    leadList.querySelectorAll('.lead-card').forEach(card => {
      const show = selected === 'all' || getStatus(card.dataset.id) === selected;
      card.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    if (visibleLeadCount && selected !== 'all') visibleLeadCount.textContent = String(visible);
  }

  function addExplanation() {
    const parent = statusSelect.parentElement;
    if (!parent || parent.querySelector('.wa-status-help')) return;
    const note = document.createElement('small');
    note.className = 'wa-status-help';
    note.textContent = 'WhatsApp does not provide a supported bulk “is this random number registered?” lookup. Mark this after checking the lead.';
    parent.appendChild(note);
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .wa-status-chip{display:block;margin-top:5px;font-size:9px;letter-spacing:.03em;color:var(--muted)}
      .wa-status-chip[data-status="confirmed"]{color:#53f28f}
      .wa-status-chip[data-status="not_on_whatsapp"]{color:#ff9b9b}
      .wa-status-help{display:block;margin-top:6px;color:var(--muted);font-size:10px;line-height:1.45}
    `;
    document.head.appendChild(style);
  }
})();
