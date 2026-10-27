const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tags = require('../data/character_tags.json');
const source = fs.readFileSync('script.js', 'utf8');
const fn = source.slice(source.indexOf('function getCatalogTagRow('), source.indexOf('function getCharacterFilterFacet('));
const rowFor = vm.runInNewContext(`${fn}; getCatalogTagRow`);
for (const id of ['group-beyond-team', 'group-kurapika-team', 'group-zodiacs']) {
  const tag = tags.definitions.find(tag => tag.id === id);
  assert.ok(tag, id);
  assert.equal(rowFor(tag), 'ハンター', id);
  assert.ok(tags.assignments.some(assignment => assignment.tag_ids.includes(id)), `${id}: membership preserved`);
}
assert.equal(tags.definitions.find(tag => tag.id === 'group-kurapika-team').label, 'クラピカチーム');
assert.equal(tags.definitions.find(tag => tag.id === 'group-beyond-team').label, 'ビヨンドチーム');
assert.equal(rowFor({id: 'other-group', category: '所属'}), 'その他所属');
assert.equal(rowFor({id: 'hunter-beyond-kyousen', category: '所属'}), 'ハンター');
console.log('PASS: Beyond and Kurapika team tags share the hunter row; stable IDs and existing memberships retained');
