const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createBrowser() {
  const scripts = [];
  const browserGlobal = {
    Promise,
    document: {
      createElement(tag) {
        assert.equal(tag, 'script');
        return {
          removed: false,
          remove() { this.removed = true; },
        };
      },
      head: {
        appendChild(script) { scripts.push(script); },
      },
    },
  };
  browserGlobal.window = browserGlobal;
  const context = vm.createContext(browserGlobal);
  vm.runInContext(fs.readFileSync('sheetjs-loader.js', 'utf8'), context, { filename:'sheetjs-loader.js' });
  return { context, scripts };
}

test('failed parser loads are cleaned up and can be retried', async () => {
  const { context, scripts } = createBrowser();

  const first = context.ClientGenSheetJSLoader.load();
  assert.equal(scripts.length, 1);
  scripts[0].onerror();
  await assert.rejects(first, /Check your internet connection and try again/);
  assert.equal(scripts[0].removed, true);

  const second = context.ClientGenSheetJSLoader.load();
  assert.equal(scripts.length, 2, 'retry appends a new parser script');
  context.XLSX = { read() {} };
  scripts[1].onload();
  assert.equal(await second, context.XLSX);
});

test('a script that does not initialize SheetJS is retryable', async () => {
  const { context, scripts } = createBrowser();

  const first = context.ClientGenSheetJSLoader.load();
  scripts[0].onload();
  await assert.rejects(first, /loaded without initializing/);
  assert.equal(scripts[0].removed, true);

  context.ClientGenSheetJSLoader.load();
  assert.equal(scripts.length, 2);
});

test('concurrent requests share one in-flight parser load', async () => {
  const { context, scripts } = createBrowser();

  const first = context.ClientGenSheetJSLoader.load();
  const second = context.ClientGenSheetJSLoader.load();
  assert.equal(first, second);
  assert.equal(scripts.length, 1);

  context.XLSX = { read() {} };
  scripts[0].onload();
  await Promise.all([first, second]);
});
