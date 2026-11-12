(() => {
  'use strict';

  const DEFAULT_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  let loadPromise = null;

  function load(url = DEFAULT_URL) {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (loadPromise) return loadPromise;

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;

      const fail = message => {
        if (loadPromise === promise) loadPromise = null;
        script.remove();
        reject(new Error(message));
      };

      script.onload = () => {
        if (!window.XLSX) {
          fail('The Excel parser loaded without initializing. Try again.');
          return;
        }
        resolve(window.XLSX);
      };
      script.onerror = () => fail('Could not load the Excel parser. Check your internet connection and try again.');
      document.head.appendChild(script);
    });

    loadPromise = promise;
    return promise;
  }

  window.ClientGenSheetJSLoader = { load };
})();
