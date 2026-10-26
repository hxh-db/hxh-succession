const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');
const fields = code.match(/const LOCAL_EDIT_FIELDS = ([\s\S]*?);\r?\n/)[1];
const importer = code.slice(code.indexOf('function validateDraftImport('), code.indexOf('function renderDraftOverview('));
const context = vm.createContext({});
vm.runInContext(`const LOCAL_EDIT_FIELDS = ${fields}; ${importer}`, context);
const parse = (edits, key = 'event:E361-001') => context.validateDraftImport({
  format: 'hxh-succession-local-drafts', version: 1, items: {[key]: {memo: 'keep', edits}}
});
for (const day of [-1, 13, 1.5, '1']) assert.throws(() => parse({day}), /正しくありません/);
for (const time of ['24:00', '12:60', '9:00', 'morning']) assert.throws(() => parse({time_start: time}), /時刻は/);
for (const description of ['', '  ', null, 123]) assert.throws(() => parse({description}), /出来事を入力/);
assert.throws(() => parse({time_start: '00:00', time_estimate: '00:01'}), /同時/);
for (const key of ['constructor:x', 'toString:x', 'event:', 'event:  ', 'unknown:x']) assert.throws(() => parse({}, key), /不正な形式/);
for (const day of [0, 12, null]) assert.equal(parse({day})['event:E361-001'].edits.day, day);
for (const time of ['00:00', '23:59', null, '']) assert.equal(parse({time_start: time})['event:E361-001'].edits.time_start, time);
assert.equal(parse({description: 'valid', notes: '', ignored: 'discard'})['event:E361-001'].memo, 'keep');
assert.equal(parse({ignored: 'discard'})['event:E361-001'].edits.ignored, undefined);
const fieldClocks = {memo: '2026-10-26T00:00:00Z', edits: '2026-10-25T00:00:00Z'};
const dated = fieldUpdatedAt => context.validateDraftImport({format: 'hxh-succession-local-drafts', version: 1,
  items: {'event:E361-001': {memo: 'keep', fieldUpdatedAt}}})['event:E361-001'];
assert.deepEqual(JSON.parse(JSON.stringify(dated(fieldClocks).fieldUpdatedAt)), fieldClocks);
for (const clocks of [[], null, {memo: 'bad'}, {memo: 123}, {unknown: '2026-10-26T00:00:00Z'}]) {
  assert.throws(() => dated(clocks), /更新日時の形式/);
}
console.log('PASS: backup edits reject blank required text, invalid days/clocks, incompatible times and invalid keys; valid boundaries survive');
