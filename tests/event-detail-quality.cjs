const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const events = require('../data/events.json');
const sources = require('../data/sources.json');
const schema = require('../data/events.schema.json').items.properties;
const byId = new Map(events.map(e => [e.id, e]));
const sourceIds = new Set(sources.map(s => s.id));
const edges = new Map(events.map(e => [e.id, []]));
assert.equal(byId.size, events.length, 'duplicate event IDs');
for (const e of events) {
  assert.equal(e.source_locator.chapter, e.chapter, `${e.id}: source chapter`);
  assert.equal(e.source_locator.scene_id, e.id, `${e.id}: source scene`);
  assert.ok(sourceIds.has(e.source_id), `${e.id}: missing source`);
  assert.equal(new Set(e.characters).size, e.characters.length, `${e.id}: duplicate character`);
  if (e.verification_status === 'unverified') assert.ok(e.verification_note?.trim(), `${e.id}: unexplained review scope`);
  for (const field of ['character_presence', 'character_locations']) {
    for (const id of Object.keys(e[field] || {})) assert.ok(e.characters.includes(id), `${e.id}: ${field} outside related characters`);
  }
  for (const effect of e.status_effects || []) assert.ok(e.characters.includes(effect.character), `${e.id}: unrelated status effect`);
  for (const field of ['time_start', 'time_estimate', 'time_end']) {
    if (e[field]) assert.match(e[field], new RegExp(schema[field].pattern), `${e.id}: ${field}`);
  }
  assert.ok(!(e.time_start && e.time_estimate), `${e.id}: both exact and estimated time`);
  for (const field of ['time_before_event_id', 'time_after_event_id']) {
    if (!e[field]) continue;
    const other = byId.get(e[field]);
    assert.ok(other && other !== e, `${e.id}: invalid order reference`);
    const [before, after] = field === 'time_before_event_id' ? [e, other] : [other, e];
    edges.get(before.id).push(after.id);
    if (before.day != null && after.day != null) {
      assert.ok(before.day <= after.day, `${e.id}: reversed days`);
      const a = before.time_start || before.time_estimate, b = after.time_start || after.time_estimate;
      if (before.day === after.day && a && b) assert.ok(a <= b, `${e.id}: reversed clocks`);
    }
  }
  for (const field of ['simultaneous_with', 'same_incident_with']) {
    for (const id of e[field] || []) assert.ok(id !== e.id && byId.get(id)?.[field]?.includes(e.id), `${e.id}: invalid reciprocal link ${id}`);
  }
}
const done = new Set(), visiting = new Set();
function visit(id) {
  assert.ok(!visiting.has(id), `cyclic narrative order: ${id}`);
  if (done.has(id)) return;
  visiting.add(id);
  edges.get(id).forEach(visit);
  visiting.delete(id); done.add(id);
}
events.forEach(e => visit(e.id));
for (const field of ['time_start','time_estimate','time_end']) {
  const clock = new RegExp(schema[field].pattern);
  for(const value of ['00:00','12:00','23:59']) assert.ok(clock.test(value));
  for(const value of ['24:00','29:59','12:60','0:00']) assert.ok(!clock.test(value));
}
const e = id => byId.get(id);
assert.deepEqual(e('E343-001').characters, ['HA-004','HA-009']);
assert.ok(!e('E343-001').description.includes('クラピカ'));
assert.ok(e('E343-005').revealed_facts.some(s => s.includes('2か月位')));
assert.ok(e('E344-005').description.includes('疑問'));
assert.ok(e('E361-007').revealed_facts.some(s => s.includes('ステルスドルフィンを解除')));
assert.ok(!JSON.stringify(e('E361-007').revealed_facts).includes('クラピカを解除'));
assert.ok(e('E393-003').description.includes('リンチの姿をした人物'));
assert.equal(e('E393-003').character_presence['SWU-004'], 'unknown');
assert.equal(e('E375-008').time_estimate, undefined);
assert.equal(e('E375-008').time_after_event_id, 'E375-006');
assert.equal(e('E375-008').time_inference, false);
assert.equal(e('E415-007').date_certainty, 'provisional');
assert.equal(e('E415-007').time_start, '13:50');
// Pure UI helper: an unrelated or unclassified character must never silently become an attendee.
const script = fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');
const start = script.indexOf('function getEventCharacterLabels(');
const finish = script.indexOf('\n}\n', start) + 2;
assert.ok(start >= 0 && finish > start);
const ctx = vm.createContext({formatRoyalName:id=>id});
vm.runInContext(script.slice(start,finish),ctx);
const labels = Array.from(ctx.getEventCharacterLabels({characters:['A','B','C','D','E'],character_presence:{A:'present',B:'body',C:'mentioned',D:'remote'}}));
assert.deepEqual(labels,['A（その場に登場）','B（遺体）','C（話題・紹介のみ）','D（遠隔・映像）','E（所在区分未判定）']);
console.log(`PASS: ${events.length} events, source/participant/order consistency, explicit review limits, identity and ability regressions`);
