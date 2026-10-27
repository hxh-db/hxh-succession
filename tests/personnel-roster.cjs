const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {select, chapterFor, state, counts, diagramCount} = require('../personnel-roster.js');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const roster = read('data/personnel_roster.json'), people = read('data/characters.json'), events = read('data/events.json');
const ids = new Set(people.map(p => p.id));
assert.equal(ids.size, people.length);
assert.equal(roster.members.length, 230);
assert.equal(new Set(roster.members.map(m => m.character_id)).size, 230);
for (const member of [...roster.members, ...roster.later]) {
  assert.ok(ids.has(member.character_id));
  for (const log of member.history || []) if (log.event_id) assert.ok(events.some(e => e.id === log.event_id && e.chapter === log.chapter));
}
const at = (period, queen = null) => select(roster, people, {period, queen, events});
assert.equal(at('departure').length, 230);
assert.equal(at('departure').find(p => p.id === 'P01-G01').status, '在籍（復元）');
assert.equal(state({id:'test'}, {history:[]}, 374).status, '状態未確認');
assert.equal(state({id:'test',status_log:[{chapter:373,status:'存命'}]}, {}, 374).status, '存命');
assert.equal(state({id:'test',status_log:[{chapter:375,status:'存命'}]}, {}, 374).status, '状態未確認');
const synthetic = [{roster_view:{status:'状態未確認',inactive:false}}, {roster_view:{status:'拘束',inactive:true}}, {roster_view:{status:'存命',inactive:false}}];
assert.deepEqual(counts(synthetic), {total:3, stopped:1, withoutStop:2, unknown:1});
const deployment = count => ({queen_rank:1,purpose:'下位王子の監視',count});
assert.equal(diagramCount({princes:[{queen_deployments:[deployment(9)]},{queen_deployments:[deployment(9)]}]},1),9);
assert.throws(() => diagramCount({princes:[{queen_deployments:[deployment(9),deployment(8)]}]},1), /不一致/);
assert.equal(at('chapter-374').find(p => p.id === 'P01-G01').status, '死亡');
assert.equal(at('chapter-374').find(p => p.id === 'P12-G06').status, '拘束');
const hurykov374 = at('chapter-374').find(p => p.id === 'P01-P06');
assert.deepEqual(hurykov374.review_claims.map(claim=>claim.event_ids), [['E366-004']]);
assert.equal(hurykov374.nen_ability_editorial, null);
assert.ok(at('latest').find(p => p.id === 'P01-P06').review_claims.length > 0);
for (const period of ['departure', 'chapter-374', 'chapter-413']) for (const person of at(period)) {
  for (const claim of person.review_claims || []) {
    assert.ok(claim.event_ids.every(id => events.find(e => e.id === id)?.chapter <= chapterFor(period)));
    assert.ok([...claim.text.matchAll(/第?(\d{3})話/g)].every(m => Number(m[1]) <= chapterFor(period)));
  }
}
assert.equal(at('departure').find(p => p.id === 'P12-H01').room, null, 'no unreviewed initial placement before the first dated record');
assert.equal(at('chapter-374').find(p => p.id === 'P12-H01').room, '第1層 1013号室');
const initialHanzo = people.find(p => p.id === 'P12-H01').initial_room;
assert.equal(at('departure').find(p => p.id === 'P12-H01').initial_room, null);
for (const period of ['chapter-374', 'latest']) {
  assert.equal(at(period).find(p => p.id === 'P12-H01').initial_room, initialHanzo);
}
assert.match(at('chapter-374').find(p => p.id === 'P12-H01').roster_view.assignment, /第13王子マラヤーム/);
assert.equal(at('chapter-374').find(p => p.id === 'P12-H01').notes, null, 'unreviewed latest notes are not historical facts');
for (const period of ['departure', 'chapter-374']) {
  const person = at(period).find(p => p.id === 'P12-H01');
  assert.equal(person.nen_status, 'historical_unorganized');
  assert.equal(person.nen_ability_image, null);
}
for (const period of ['departure', 'chapter-374', 'chapter-393']) assert.ok(!at(period).some(p => p.id === 'EII-T01'));
for (const period of ['all', 'latest', 'chapter-394']) assert.ok(at(period).some(p => p.id === 'EII-T01'));
assert.equal(at('departure', 1).length, 12);
assert.equal(at('chapter-374', 1).filter(p => !p.roster_view.inactive).length, 9);
assert.equal(at('chapter-374', 1).filter(p => p.roster_view.inactive).length, 3);
for (let queen = 1; queen <= 7; queen++) {
  const entries = at('departure', queen);
  assert.ok(entries.length > 0);
  assert.equal(new Set(entries.map(p => p.id)).size, entries.length);
  assert.ok(entries.every(p => p.roster_member.queen_rank === queen));
}
assert.equal(roster.identity_pools[0].character_ids.length, 7);
assert.equal(at('departure').filter(p => p.roster_projection).length, 0);
assert.equal(at('departure', 1).filter(p => p.roster_projection).length, 1);
assert.equal(chapterFor('chapter-368'), 368);
assert.ok(at('chapter-368').find(p => p.id === 'P12-H01').assignment_history.every(log => log.chapter <= 368));
assert.ok(at('departure').every(p => !p.nen_ability));
const excluded = roster.later.filter(p => p.observed_from === null);
for (const p of excluded) assert.ok(!at('latest').some(x => x.id === p.character_id));
console.log('PASS: 230 unique departure slots; 7 queen ledgers; 12→9; history, late entry, identity pools and no future ability leak');
