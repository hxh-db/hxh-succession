const assert = require('node:assert/strict');
const fs = require('node:fs');
const people = require('../data/characters.json');
const events = require('../data/events.json');
const roster = require('../data/personnel_roster.json');
const overrides = require('../data/personnel_roster_overrides.json');
const images = require('../data/character_images.json');
const {select} = require('../personnel-roster.js');
const ids = ['INIT-P02-STAFF-16', 'P02-P15'];
const event = events.find(e => e.id === 'E416-004');
assert.equal(roster.members.length, 230);
assert.equal(new Set(roster.members.map(m => m.character_id)).size, 230);
assert.equal(event.chapter, 416);
assert.equal(event.source_id, 'user-original-ch416');
assert.equal(event.verification_status, 'review_recorded');
assert.match(event.description, /従事者2人を殺害/);
for (const [index, id] of ids.entries()) {
  const person = people.find(p => p.id === id);
  assert.equal(person.name, index === 0 ? 'カミーラ従事者1（仮称）' : 'フカタキ');
  assert.equal(person.type, 'attendant');
  if (index === 0) {
    assert.equal(person.identity_status, 'unnamed_confirmed');
    assert.equal(person.is_count_only, false);
    assert.equal(person.nen_status, 'unknown');
  }
  assert.equal(person.status, '死亡');
  assert.equal(person.status_log[0].chapter, 416);
  assert.equal(person.status_log[0].event_id, event.id);
  assert.equal(person.status_log[0].killer, 'P01');
  assert.ok(event.characters.includes(id));
  assert.equal(event.character_presence[id], 'present');
  assert.ok(event.status_effects.some(effect => effect.character === id && effect.status === '死亡'));
  assert.equal(roster.members.filter(m => m.character_id === id).length, 1);
  assert.ok(!roster.later.some(m => m.character_id === id));
  if (index === 0) {
    assert.equal(overrides.identity_updates[id].image, person.image, 'rebuild must retain confirmed portraits');
    assert.equal(images.find(image => image.id === id).source_chapter, 416);
  } else assert.equal(person.image, 'images/characters/fukataki.png');
  const png = fs.readFileSync(person.image);
  if (index === 0) {
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.readUInt32BE(16) < 150 && png.readUInt32BE(20) < 150);
  }
  for (const period of ['departure', 'chapter-374', 'chapter-415']) {
    const historical = select(roster, people, {period, events}).find(p => p.id === id);
    assert.ok(historical && !historical.roster_view.inactive);
    assert.equal(historical.status_log.length, 0, 'do not leak later death to earlier roster');
    assert.equal(historical.notes, null, 'unreviewed latest notes are absent, including later deaths');
  }
  assert.equal(select(roster, people, {period: 'chapter-416', events}).find(p => p.id === id).roster_view.inactive, true);
  const html = fs.readFileSync(`characters/${id}/index.html`, 'utf8');
  assert.ok(html.includes(person.name));
  const early = html.split('<details class="character-page-spoilers"')[0];
  assert.doesNotMatch(early, /ベンジャミンの銃撃|従事者2人を殺害/);
}
assert.equal(people.find(p => p.id === 'P02-P01').status_log[0].killer, null, 'Moswana suicide is a separate act');
assert.equal(people.filter(p => p.name === 'フカタキ').length, 1);
assert.equal(people.find(p => p.id === 'INIT-P02-STAFF-17').identity_status, 'provisional');
assert.equal(people.find(p => p.id === 'INIT-P02-STAFF-17').status, '未確認');
assert.ok(!event.characters.includes('INIT-P02-STAFF-17'), 'do not duplicate Fukataki as a second unnamed maid');
assert.ok(event.revealed_facts.some(text => /血飛沫/.test(text)));
console.log('PASS: Fukataki plus 1 new maid, source portraits, linked deaths, stable 230 slots, no duplication, premature death or Moswana conflation');
