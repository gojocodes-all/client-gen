const test = require('node:test');
const assert = require('node:assert/strict');
const {
  detectDelimiter,
  extractRecordsFromJson,
  parseDelimited
} = require('../data-parsers.js');

test('parseDelimited handles quoted delimiters, escaped quotes, and CRLF', () => {
  const rows = parseDelimited('name,notes\r\n"Ada Cafe","Open, daily"\r\n"Gojo ""Labs""",Remote', ',');

  assert.deepEqual(rows, [
    { name: 'Ada Cafe', notes: 'Open, daily' },
    { name: 'Gojo "Labs"', notes: 'Remote' }
  ]);
});

test('parseDelimited creates stable unique names for blank and duplicate headers', () => {
  assert.deepEqual(parseDelimited('name,name,\nFirst,Second,Third', ','), [
    { name: 'First', name_2: 'Second', column_3: 'Third' }
  ]);
});

test('parseDelimited ignores empty leading and data rows', () => {
  assert.deepEqual(parseDelimited('\n\nname|phone\nAda|08012345678\n|\n', '|'), [
    { name: 'Ada', phone: '08012345678' }
  ]);
});

test('detectDelimiter ignores separators inside quoted fields', () => {
  assert.equal(detectDelimiter('name;notes\nAda;"Open, daily"\nGojo;Remote'), ';');
  assert.equal(detectDelimiter('name\tphone\nAda\t08012345678'), '\t');
});

test('extractRecordsFromJson selects the strongest nested record collection', () => {
  const leads = [
    { name: 'Ada Cafe', phone: '08012345678' },
    { name: 'Gojo Labs', phone: '08087654321' }
  ];
  const input = { meta:{ page:1 }, payload:{ leads, notices:[{ message:'ready' }] } };

  assert.deepEqual(extractRecordsFromJson(input), leads);
});

test('extractRecordsFromJson adapts primitive arrays into row objects', () => {
  assert.deepEqual(extractRecordsFromJson(['Ada', 4, true]), [
    { index:1, value:'Ada' },
    { index:2, value:4 },
    { index:3, value:true }
  ]);
});
