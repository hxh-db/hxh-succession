const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const people = require('../data/characters.json');
const roster = require('../data/personnel_roster.json');
const countOnly = new Set(require('../data/count_only_characters.json').ids);
const review = require('../data/intake/unnamed_roles_review_20261024.json');
const {select} = require('../personnel-roster.js');
const source = fs.readFileSync(require.resolve('../script.js'), 'utf8');
const predicate = source.slice(source.indexOf('function isDirectoryCharacter('), source.indexOf('function getPersonnelPeriod('));
const context = vm.createContext({countOnlyCharacterIds:countOnly, personnelRosterData:roster});
vm.runInContext(predicate, context);
const visible = p => context.isDirectoryCharacter(p);
const initialIds = new Set(roster.members.map(member => member.character_id));
assert.equal(review.records.length, 85);
for (const record of review.records) assert.ok(people.find(p => p.id === record.id).role_evidence);
for (const p of people.filter(p => p.generated_by)) {
  assert.equal(visible(p), !p.roster_projection && initialIds.has(p.id));
  if (p.identity_status === 'unnamed_confirmed') {
    assert.equal(p.is_count_only, false);
    assert.ok(p.image && p.source_chapter && p.role_evidence, 'identified slots need their own source portrait and evidence');
  } else {
    assert.equal(p.is_count_only, true);
    assert.ok(!p.image, 'do not borrow a face for an unidentified slot');
  }
  assert.ok(!p.name.includes('警護兵'));
}
for (const p of people.filter(p => /^INIT-P02-STAFF/.test(p.id) && p.is_count_only)) {
  assert.equal(p.type, 'unclassified');
  assert.equal(p.soldier_category, null);
  assert.equal(p.mission, null);
}
for (const p of people.filter(p => /^INIT-.*-HUNTERS/.test(p.id))) assert.equal(p.role, '護衛ハンター');
for (const id of countOnly) assert.equal(visible(people.find(p => p.id === id)), initialIds.has(id));
assert.equal(people.find(p => p.id === 'P02-P15').type, 'attendant');
for (const p of people.filter(p => /^(P06-U|P08-U|P07-U01|P10-U)/.test(p.id))) {
  assert.equal(p.type, 'unclassified');
  assert.equal(p.soldier_category, null);
  assert.equal(visible(p), true); // Keep identified faces, with the unverified military role removed.
}
assert.equal(visible(people.find(p => p.id === 'P14-M03')), true);
assert.equal(people.find(p => p.id === 'P14-M03').type, 'attendant');
for (const p of people.filter(p => /^P04-L0[345]$/.test(p.id))) assert.equal(p.soldier_category, '私設兵');
for (const period of ['departure','chapter-374','latest','all']) {
  const ledger = select(roster, people, {period});
  assert.equal(ledger.filter(p => context.isRosterDirectoryCharacter(p)).length, ledger.length);
  const fukataki = ledger.find(p => p.id === 'P02-P15');
  if (period === 'departure' || period === 'chapter-374') assert.equal(fukataki.role_evidence, null);
  else assert.match(fukataki.role_evidence, /第389話/);
}
assert.equal(select(roster, people, {period:'departure'}).length, 230);
assert.equal(select(roster, people, {period:'departure'}).filter(visible).length, 230);
for (let queen = 1; queen <= 7; queen++) {
  const ledger = select(roster, people, {period:'departure', queen});
  assert.equal(ledger.filter(p => context.isRosterDirectoryCharacter(p)).length, ledger.length);
  assert.equal(ledger.filter(p => p.roster_projection).length, 1);
}
assert.equal(people.filter(visible).filter(p => p.roster_projection).length, 0);
console.log('PASS: 230 visible initial members including unidentified slots, queen-only projections, no duplicate old slots or borrowed faces, role evidence and no future evidence leak');
