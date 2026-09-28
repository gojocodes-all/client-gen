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

  assert.match(serviceWorker, /const CACHE = 'client-gen-v4';/);
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
