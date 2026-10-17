const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const facts = require('../character-facts.js');
const roster = require('../personnel-roster.js');
const people = require('../data/characters.json');
const events = require('../data/events.json');
const beasts = require('../data/spirit_beasts.json');
const mafia = require('../data/mafia.json');
const root = path.resolve(__dirname, '..');
const byId = new Map(people.map(p => [p.id, p]));
const byEvent = new Map(events.map(e => [e.id, e]));
let logs = 0, media = 0;
for (const p of people) {
  const html = fs.readFileSync(path.join(root, 'characters', p.id, 'index.html'), 'utf8');
  const [initial, later] = html.split('<details class="character-page-spoilers"');
  assert.ok(later, `${p.id}: spoiler boundary`);
  assert.ok(later.includes(facts.nenKnowledgeLabel(p)), `${p.id}: nen status parity`);
  assert.ok(later.includes(facts.nenTypeLabel(p)), `${p.id}: nen type parity`);
  assert.ok(!initial.includes('character-status-history'), `${p.id}: status spoiler leak`);
  assert.ok(!initial.includes('character-beast-detail'), `${p.id}: beast spoiler leak`);
  if (facts.registrationNotice(p)) assert.ok(initial.includes(facts.registrationNotice(p)), `${p.id}: registration scope`);
  if (p.verification_status === 'unverified') assert.ok(initial.includes('noindex,follow'));
  let chapter = 0;
  const effects = events.flatMap(e => (e.status_effects || []).filter(x => x.character === p.id).map(x => ({...x, chapter:e.chapter}))).sort((a,b) => a.chapter-b.chapter);
  if (effects.length) assert.equal(p.status, effects.at(-1).status, `${p.id}: latest registered status conflict`);
  for (const log of p.status_log || []) {
    logs++;
    const e = byEvent.get(log.event_id);
    assert.ok(e, `${p.id}: unlinked status log`);
    assert.equal(e.chapter, log.chapter, `${p.id}: wrong status chapter`);
    assert.ok(log.chapter >= chapter, `${p.id}: unsorted status history`);
    chapter = log.chapter;
    assert.ok(e.status_effects?.some(x => x.character === p.id && x.status === log.status), `${p.id}: status/effect conflict`);
    assert.ok(later.includes(`?event=${e.id}#timeline`), `${p.id}: missing status evidence link`);
  }
  for (const key of ['image', 'nen_ability_image']) if (p[key]) {
    media++;
    assert.ok(fs.existsSync(path.join(root, p[key])), `${p.id}: missing ${key}`);
  }
}
for (const beast of beasts) {
  assert.equal(people.filter(p => p.name === beast.prince).length, 1, beast.prince);
  const p = people.find(p => p.name === beast.prince);
  const html = fs.readFileSync(path.join(root, 'characters', p.id, 'index.html'), 'utf8');
  assert.ok(html.includes('character-beast-detail'), p.id);
  for (const id of beast.source_event_ids || []) {
    assert.ok(byEvent.has(id), `${p.id}: invalid beast event ${id}`);
    assert.ok(html.includes(`?event=${id}#timeline`), `${p.id}: missing beast link`);
  }
  for (const key of ['image', 'usage_image']) if (beast[key]) {
    media++;
    assert.ok(fs.existsSync(path.join(root, beast[key])));
    assert.ok(html.includes(`data-zoom-src="../../${beast[key]}"`));
  }
  if (beast.usage_image) assert.ok(beast.usage_image_source, `${p.id}: missing scene caption`);
}
for (const org of mafia) for (const member of org.members) {
  const person = byId.get(member.character_id);
  assert.ok(person, member.name);
  assert.equal(member.nen_type, person.nen_type);
  assert.equal(member.ability, person.nen_ability);
}
// Known factual failure modes: don't reattribute a prince's beast to their own ability.
for (const id of ['P10','P11']) {
  assert.equal(byId.get(id).nen_ability, null);
  assert.equal(facts.isConfirmedNenUser(byId.get(id)), false);
}
assert.equal(facts.isConfirmedNenUser(byId.get('P09')), true);
assert.equal(byId.get('SPD-005').nen_type, '放出系');
assert.equal(byId.get('SPD-006').nen_type, '具現化系');
assert.equal(byId.get('P14-H01').nen_type, '具現化系');
assert.match(facts.nenTypeLabel(byId.get('P14-H01')), /特質系（緋の眼発動時）/);
for (const id of ['SWU-001','SAA-001','P05-G02','SAA-002']) assert.equal(facts.isConfirmedNenUser(byId.get(id)), false);
assert.equal(facts.isConfirmedNenUser({nen_ability:'本人固有の念能力の名称・効果は未確認。'}), false);
assert.equal(facts.isConfirmedNenUser({nen_status:'confirmed',nen_ability:'詳細不明'}), true);
// A wish to leave is not an observed departure, and the historical view must agree.
for (const id of ['P14-M03','P14-M04']) {
  const p = byId.get(id);
  assert.equal(roster.state(p, {}, null, events).inactive, false);
  assert.equal(roster.state(p, {}, 361, events).inactive, false);
}
assert.equal(roster.state({status:'離脱'}, {}, null).inactive, true);
assert.equal(roster.state({status:'死亡'}, {}, null).inactive, true);
const historical = roster.select(require('../data/personnel_roster.json'), people, {period:'departure',events});
for (const p of historical) {
  assert.equal(p.nen_type_detail, null);
  assert.equal(facts.nenTypeLabel(p), 'この時点の能力情報は未整理');
}
assert.equal(facts.statusHistoryRows({status_log:[{chapter:1,status:'存命',event_id:'E001-001'}]},[{id:'E001-001',verification_status:'hypothesis'}])[0].review,'内容は推測');
console.log(`PASS: ${people.length} character details, ${logs} status references, ${beasts.length} beasts, ${media} media references; organization parity and historical/spoiler guards`);
