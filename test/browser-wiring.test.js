const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('browser entrypoint loads the parser module before the UI controller', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const parserPosition = html.indexOf('<script src="/data-parsers.js" defer></script>');
  const applicationPosition = html.indexOf('<script src="/app.js" defer></script>');

  assert.ok(parserPosition >= 0, 'parser script is present');
  assert.ok(applicationPosition > parserPosition, 'parser script loads before app.js');

  const listeners = new Map();
  const browserGlobal = {
    console,
    clearTimeout,
    setTimeout,
    document: {
      addEventListener(type, listener) {
        listeners.set(type, listener);
      }
    },
    navigator: {}
  };
  browserGlobal.window = browserGlobal;
  const context = vm.createContext(browserGlobal);

  vm.runInContext(fs.readFileSync(path.join(root, 'data-parsers.js'), 'utf8'), context, { filename:'data-parsers.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context, { filename:'app.js' });

  assert.equal(typeof context.ClientGenDataParsers.parseDelimited, 'function');
  assert.equal(typeof listeners.get('DOMContentLoaded'), 'function');
});

test('offline core cache includes every required application script', () => {
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

  assert.match(serviceWorker, /const CACHE = 'client-gen-v6';/);
  assert.match(serviceWorker, /'\/data-parsers\.js'/);
  assert.match(serviceWorker, /'\/app\.js'/);
  assert.match(serviceWorker, /'\/whatsapp-status\.js'/);
});

test('WhatsApp status storage can be cleared without the interface mounted', () => {
  const removedKeys = [];
  const browserGlobal = {
    console,
    document: {
      getElementById() { return null; }
    },
    localStorage: {
      getItem() { return JSON.stringify({ lead_1:'confirmed' }); },
      removeItem(key) { removedKeys.push(key); }
    }
  };
  browserGlobal.window = browserGlobal;
  const context = vm.createContext(browserGlobal);

  vm.runInContext(fs.readFileSync(path.join(root, 'whatsapp-status.js'), 'utf8'), context, { filename:'whatsapp-status.js' });
  context.ClientGenWhatsAppStatus.clear();

  assert.deepEqual(removedKeys, ['client-gen-whatsapp-status-v1']);
});

test('WhatsApp status cleanup reports unavailable browser storage', () => {
  const browserGlobal = {
    console: { warn() {} },
    document: {
      getElementById() { return null; }
    },
    localStorage: {
      getItem() { throw new Error('storage blocked'); },
      removeItem() { throw new Error('storage blocked'); }
    }
  };
  browserGlobal.window = browserGlobal;
  const context = vm.createContext(browserGlobal);

  vm.runInContext(fs.readFileSync(path.join(root, 'whatsapp-status.js'), 'utf8'), context, { filename:'whatsapp-status.js' });

  assert.equal(context.ClientGenWhatsAppStatus.clear(), false);
});

test('confirming a WhatsApp lead restores its available action immediately', () => {
  const listeners = new Map();
  const badge = { dataset:{}, textContent:'' };
  const whatsappButton = {
    dataset:{ action:'wa', baseDisabled:'false' },
    disabled:false,
    title:'',
  };
  const card = {
    dataset:{ id:'lead_1' },
    style:{},
    querySelector(selector) {
      if (selector === '.wa-status-chip') return badge;
      if (selector === '[data-action="wa"]') return whatsappButton;
      return null;
    },
  };
  const leadList = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelectorAll(selector) { return selector === '.lead-card' ? [card] : []; },
  };
  const statusFilter = {
    value:'all',
    addEventListener(type, listener) { listeners.set(`filter:${type}`, listener); },
  };
  const statusSelect = {
    value:'unknown',
    parentElement:{ appendChild() {}, querySelector() { return null; } },
    addEventListener(type, listener) { listeners.set(`status:${type}`, listener); },
  };
  const elements = {
    whatsappStatusFilter:statusFilter,
    leadWhatsappStatusSelect:statusSelect,
    leadList,
    leadDialog:{ open:false },
    visibleLeadCount:{ textContent:'1' },
    saveLeadBtn:{ addEventListener() {} },
  };
  const browserGlobal = {
    console,
    document:{
      createElement() { return { className:'', textContent:'' }; },
      getElementById(id) { return elements[id] || null; },
      head:{ appendChild() {} },
    },
    localStorage:{ getItem() { return null; }, setItem() {} },
    MutationObserver:class { constructor() {} observe() {} },
  };
  browserGlobal.window = browserGlobal;
  const context = vm.createContext(browserGlobal);

  vm.runInContext(fs.readFileSync(path.join(root, 'whatsapp-status.js'), 'utf8'), context, { filename:'whatsapp-status.js' });

  listeners.get('click')({
    preventDefault() {},
    stopImmediatePropagation() {},
    target:{
      closest(selector) {
        if (selector === '.lead-card') return card;
        if (selector === '[data-action]') return { dataset:{ action:'open' } };
        return null;
      },
    },
  });

  statusSelect.value = 'not_on_whatsapp';
  listeners.get('status:change')();
  assert.equal(whatsappButton.disabled, true);
  assert.equal(whatsappButton.title, 'Marked as not on WhatsApp');

  statusSelect.value = 'confirmed';
  listeners.get('status:change')();
  assert.equal(whatsappButton.disabled, false);
  assert.equal(whatsappButton.title, '');
});

test('mobile layout keeps lead details available and names repeated actions', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

  assert.match(app, /data-action="open" aria-label="View details for/);
  assert.match(app, /data-action="wa" aria-label="Open WhatsApp for/);
  assert.doesNotMatch(styles, /\.lead-actions \.mini-button:first-child\s*\{\s*display:\s*none/);
  assert.match(styles, /\.lead-actions\s*\{\s*flex-direction:\s*column;\s*\}/);
});


test('mapping dialog close button dismisses without submitting changes', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

  assert.match(
    html,
    /id="mappingCloseBtn" type="button" aria-label="Close mapping"/,
  );
  assert.match(
    app,
    /els\.mappingCloseBtn\.addEventListener\('click', \(\) => els\.mappingDialog\.close\(\)\);/,
  );
});
