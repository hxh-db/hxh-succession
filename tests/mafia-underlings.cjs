const assert = require('node:assert/strict');
const fs = require('node:fs');
const people = require('../data/characters.json');
const events = require('../data/events.json');
const images = require('../data/character_images.json');
const mafia = require('../data/mafia.json');
const byId = new Map(people.map(person => [person.id, person]));
const event = id => events.find(event => event.id === id);
const added = ['SAA-005', 'SAA-006', ...Array.from({length: 7}, (_, i) => `SAA-U0${i + 1}`)];
assert.equal(byId.size, people.length, 'duplicate character IDs');
assert.equal(people.filter(person => person.name === 'タッシ').length, 1);
assert.equal(byId.get('EII-007').affiliation, '不明');
assert.match(byId.get('EII-007').role, /所属一家未確定/);
assert.ok(!/殺害|消失|死亡|3101/.test(byId.get('EII-007').role), 'role must not leak later events');
assert.equal(byId.get('SAA-005').name, 'ツドンケ');
assert.equal(byId.get('SAA-005').role, '舎弟頭');
assert.equal(byId.get('SAA-006').name, 'ソンビン');
assert.equal(people.filter(person => person.affiliation === 'エイ＝イ一家').length, 23, 'do not add victims to Morena original 23');
for (const id of added) {
  const person = byId.get(id);
  assert.ok(person, id);
  assert.equal(person.type, 'mafia');
  assert.equal(person.affiliation, 'シャ＝ア一家');
  assert.equal(person.nen_status, 'unknown', `${id}: knowing about Nen is not confirmed Nen use`);
  assert.ok(!person.generated_by && !person.roster_projection);
  const image = images.find(image => image.id === id);
  assert.equal(image.image, person.image);
  assert.equal(image.source_chapter, person.source_chapter);
  const data = fs.readFileSync(image.image);
  assert.equal(data.subarray(1, 4).toString(), 'PNG');
  assert.ok(data.readUInt32BE(16) <= 250 && data.readUInt32BE(20) <= 300, 'portrait only, not full page');
  const member = mafia.find(org => org.name === 'シャ＝ア一家').members.find(member => member.character_id === id);
  assert.equal(member.name, person.name);
  assert.equal(member.ability, person.nen_ability);
  const html = fs.readFileSync(`characters/${id}/index.html`, 'utf8');
  assert.ok(html.includes(`characters/${id}/`));
  for (const claim of person.review_claims) for (const eventId of claim.event_ids) {
    assert.ok(event(eventId).characters.includes(id), `${id}: missing event link ${eventId}`);
    assert.ok(event(eventId).source_locator.pages.length);
    assert.ok(html.includes(`title="場面ID ${eventId}"`), `${id}: missing source link ${eventId}`);
  }
  if (id.includes('-U')) {
    assert.match(person.name, /^シャ＝ア組員[1-7]（仮称）$/);
    assert.equal(person.identity_status, 'unnamed_confirmed');
  }
}
for (const id of ['SAA-005', 'SAA-006', ...added.filter(id => /U0[1-6]/.test(id))]) {
  assert.equal(event('E392-004').character_presence[id], 'present');
}
assert.ok(event('E393-001').characters.includes('SAA-005'));
assert.equal(byId.get('SAA-U07').status, '死亡');
assert.equal(event('E378-003').character_presence['SAA-U07'], 'body', 'latest evidence is the recovered body');
assert.ok(event('E378-003').status_effects.some(effect => effect.character === 'SAA-U07' && effect.status === '死亡'));
assert.equal(byId.get('SAA-U07').status_log[0].event_id, 'E378-003');
assert.equal(byId.get('SAA-U07').status_log[0].killer, null, 'do not infer assailant from proximity');
console.log('PASS: 9 individually identified mafia additions, stable Tasshi ID, original 23 unchanged, portraits, source pages and death references');
