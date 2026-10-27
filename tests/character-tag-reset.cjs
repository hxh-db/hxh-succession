const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('script.js', 'utf8');
const start = source.indexOf('const resetCharacterTagSelections = () => {');
const end = source.indexOf('document.getElementById("resetCharacterTags").addEventListener', start);
assert.ok(start >= 0 && end > start);
const state = {
  activeCharacterTags: new Map([['ハンター', 'group-kurapika-team']]),
  activeCharacterSection: 'hunter', activeCharacterSubgroup: 'old-group', activeCharacterAffiliation: 'old-affiliation',
  typeFilter: {value: 'hunter'}, campFilter: {value: 'ワブル陣営'}, princeFilter: {value: 'P14'}, queenFilter: {value: '1'},
  search: {value: 'クラピカ'}, periodFilter: {value: 'chapter-374'}
};
vm.runInNewContext(source.slice(start, end) + 'resetCharacterTagSelections();', state);
assert.equal(state.activeCharacterTags.size, 0);
assert.equal(state.activeCharacterSection, 'all');
assert.equal(state.activeCharacterSubgroup, null);
assert.equal(state.activeCharacterAffiliation, null);
for (const key of ['typeFilter', 'campFilter', 'princeFilter', 'queenFilter']) assert.equal(state[key].value, 'all');
assert.equal(state.search.value, 'クラピカ');
assert.equal(state.periodFilter.value, 'chapter-374');
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.indexOf('id="resetCharacterTags"') < html.indexOf('id="characterFilterPanel"'));
assert.match(html, /id="resetCharacterTags"[^>]*disabled>タグをリセット/);
console.log('PASS: tag-only reset clears all tag selectors while preserving query and roster time; control stays above the closed panel');
