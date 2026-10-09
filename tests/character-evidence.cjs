const assert = require('node:assert/strict');
const fs = require('node:fs');
const facts = require('../character-facts.js');
const people = require('../data/characters.json');
const events = require('../data/events.json');
const person = id => people.find(p => p.id === id);
const event = id => events.find(e => e.id === id);
for (const id of ['P14', 'Q08', 'P13-H02', 'P01-P06']) {
  const rows = facts.claimRows(person(id), events);
  assert.ok(rows.length && rows.every(r => r.status === '原作再照合待ち'));
  const html = fs.readFileSync(`characters/${id}/index.html`, 'utf8');
  for (const row of rows) assert.ok(html.includes(row.text));
  assert.ok(!html.split('<details class="character-page-spoilers"')[0].includes('替え玉'));
}
assert.ok(!person('P14').notes.includes('替え玉と判明'));
assert.ok(!person('Q08').notes.includes('すり替えが明らか'));
assert.ok(!person('P13-H02').notes.includes('415話'));
assert.equal(facts.claimRows(person('P14'), events.map(e => e.id === 'E412-002' ? {...e, verification_status:'hypothesis'} : e))[0].status, '内容は推測');
const sandra = facts.latestLocation(person('P14-M01'), events);
assert.equal(sandra.chapter, 363);
assert.equal(sandra.presence, 'body');
assert.ok(facts.statusLabel(person('P14-M01'), events).includes('確認話数が競合'));
const momoze = facts.latestLocation(person('P12'), events);
assert.equal(momoze.eventId, 'E371-004');
assert.equal(momoze.presence, 'body');
assert.ok(facts.latestLocationLabel(person('P12'), events).startsWith('遺体の所在：'));
// Related characters alone cannot prove presence, even with a character-specific location.
const related = {id:'X', name:'test', room:'登録値'};
const fixture = [
  {id:'E001-001',chapter:1,day:1,time_start:'16:00',characters:['X'],location:'A',character_presence:{X:'present'}},
  {id:'E002-001',chapter:2,day:1,characters:['X'],location:'B',character_presence:{X:'present'}}
];
assert.equal(facts.latestLocation(related, fixture).location,'B'); // missing clock is not 00:00
assert.equal(facts.latestLocation(related, fixture.map(e=>({...e,character_presence:{X:'unknown'}}))).presence,'unknown');
assert.equal(facts.latestLocation(related, fixture.map(e=>({...e,character_presence:{X:'mentioned'}}))).eventId,null);
assert.equal(facts.latestLocation(related, fixture.map(e=>({...e,character_presence:{X:'remote'}}))).eventId,null);
assert.equal(facts.latestLocation(related, [fixture[0], {...fixture[1],time_estimate:'15:00',time_after_event_id:'E001-001'}]).location,'B');
assert.ok(facts.latestLocationLabel(related,[fixture[0],{...fixture[1],character_presence:{X:'unknown'}}]).includes('所在未判定'));
assert.ok(person('P14-P02').status_log[0].cause.includes('発見時刻未確定'));
for (const id of ['P14-H03','P14-P04','P14-P05']) {
  assert.equal(person(id).status_log[0].event_id,'E361-001');
  assert.equal(person(id).status_log[0].chapter,361);
}
assert.ok(event('E408-008').notes.includes('表示順のための仮配置'));
assert.ok(event('E410-001').description.includes('完全加入には残る条件'));
for (const query of ['サンドラ','ハンゾー']) {
  const sorted = people.slice().sort((a,b)=>facts.searchRank(a,query)-facts.searchRank(b,query));
  assert.equal(sorted[0].name,query);
}
const source = fs.readFileSync('script.js','utf8');
assert.ok(source.includes('CharacterFacts.searchRank(a, query) - CharacterFacts.searchRank(b, query) || sortCharacters(a, b)'));
assert.ok(source.indexOf('item.appendChild(description);',source.indexOf('function createScheduleEventCard')) < source.indexOf('makeEventReviewRibbon(event, placement, false)'));
console.log('PASS: inherited evidence, spoiler exclusions, presence/body/mention, partial clocks and relations, shared deaths, conflict disclosure and search relevance');
