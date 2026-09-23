(function exposeDataParsers(root, factory) {
  'use strict';

  const api = Object.freeze(factory());
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClientGenDataParsers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  function extractRecordsFromJson(input) {
    if (Array.isArray(input)) {
      if (!input.length) return [];
      if (input.every(isPlainObject)) return input;
      return input.map((value, index) => isPlainObject(value) ? value : ({ index:index + 1, value }));
    }
    if (!isPlainObject(input)) return [{ value: input }];

    const candidates = [];
    walk(input, '$', 0);
    if (candidates.length) {
      candidates.sort((first, second) => second.score - first.score);
      return candidates[0].rows;
    }

    const values = Object.values(input);
    if (values.length > 1 && values.every(isPlainObject)) return values;
    return [input];

    function walk(node, path, depth) {
      if (depth > 8 || node == null) return;
      if (Array.isArray(node)) {
        const objects = node.filter(isPlainObject);
        if (objects.length) {
          const keyCounts = new Map();
          objects.slice(0, 100).forEach(object => Object.keys(object).forEach(key => keyCounts.set(key, (keyCounts.get(key) || 0) + 1)));
          const common = [...keyCounts.values()].filter(count => count >= Math.max(2, objects.length * .5)).length;
          candidates.push({ rows:objects, path, score:objects.length * (1 + Math.min(common, 12) / 4) - depth * 2 });
        }
        node.slice(0, 30).forEach((value, index) => walk(value, `${path}[${index}]`, depth + 1));
      } else if (isPlainObject(node)) {
        Object.entries(node).slice(0, 100).forEach(([key, value]) => walk(value, `${path}.${key}`, depth + 1));
      }
    }
  }

  function parseDelimited(text, delimiter) {
    const matrix = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"' && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (character === '"') quoted = false;
        else cell += character;
      } else if (character === '"') quoted = true;
      else if (character === delimiter) {
        row.push(cell);
        cell = '';
      } else if (character === '\n') {
        row.push(cell);
        matrix.push(row);
        row = [];
        cell = '';
      } else if (character !== '\r') cell += character;
    }

    if (cell.length || row.length) {
      row.push(cell);
      matrix.push(row);
    }
    while (matrix.length && matrix[0].every(value => !String(value).trim())) matrix.shift();
    if (!matrix.length) return [];

    const headers = makeUniqueHeaders(matrix.shift().map((header, index) => String(header).trim() || `column_${index + 1}`));
    return matrix
      .filter(values => values.some(value => String(value).trim()))
      .map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  function detectDelimiter(text) {
    const firstLines = text.split(/\r?\n/).slice(0, 6).join('\n');
    const options = [',', '\t', ';', '|'];
    let best = ',';
    let bestScore = -1;

    for (const delimiter of options) {
      const counts = firstLines.split('\n').map(line => countOutsideQuotes(line, delimiter));
      const nonzero = counts.filter(Boolean);
      const average = nonzero.reduce((total, count) => total + count, 0) / Math.max(nonzero.length, 1);
      const variance = nonzero.reduce((total, count) => total + Math.abs(count - average), 0) / Math.max(nonzero.length, 1);
      const score = average * 3 - variance;
      if (score > bestScore) {
        best = delimiter;
        bestScore = score;
      }
    }
    return best;
  }

  function countOutsideQuotes(line, delimiter) {
    let quoted = false;
    let count = 0;
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === '"') quoted = !quoted;
      else if (!quoted && line[index] === delimiter) count += 1;
    }
    return count;
  }

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function makeUniqueHeaders(headers) {
    const seen = {};
    return headers.map(header => {
      const base = header || 'column';
      seen[base] = (seen[base] || 0) + 1;
      return seen[base] === 1 ? base : `${base}_${seen[base]}`;
    });
  }

  return { extractRecordsFromJson, parseDelimited, detectDelimiter };
});
