const assert=require('node:assert/strict');
const fs=require('node:fs');
const events=require('../data/events.json');
const people=require('../data/characters.json');
const sources=require('../data/sources.json');
const e=id=>events.find(event=>event.id===id);
for(const [id,time] of [['E377-002','08:10'],['E377-003','08:15'],['E380-001','09:50'],['E380-002','09:55']]) {
  assert.equal(e(id).time_estimate,time);
  assert.equal(e(id).time_start,null);
  assert.equal(e(id).time_estimate_basis,'user-memo-delta-20261020');
}
assert.ok(sources.some(source=>source.id==='user-memo-delta-20261020' && source.source_type==='user_hypothesis'));
assert.equal(people.find(p=>p.id==='SAA-002').nen_status,'confirmed');
assert.match(people.find(p=>p.id==='SAA-002').nen_ability,/未確認/);
assert.ok(people.find(p=>p.id==='SAA-002').review_claims.some(row=>row.event_ids.includes('E379-004')));
assert.match(e('E381-008').title,/ウショウヒ.*フウゲツ.*虫射球/);
assert.match(e('E384-005').title,/テータ.*翌日.*殺害.*決意/);
assert.match(e('E384-005').notes,/原文.*明日にでも/);
assert.ok(e('E386-002').characters.includes('JUD-001'));
assert.ok(!e('E386-002').characters.includes('HA-002'));
for(const field of ['title','description']) assert.match(e('E386-002')[field],/カイザル/);
assert.ok(e('E386-002').revealed_facts.some(text=>/カイザル.*守る為の拘束/.test(text)));
assert.ok(!JSON.stringify([e('E386-002').description,e('E386-002').revealed_facts,e('E386-002').mysteries]).includes('ミザイストム'));
const before=e('E386-003'),death=e('E386-008'),wake=e('E386-009');
assert.equal(before.room,'第1層 1009号室');
assert.ok(!before.status_effects?.length);
assert.ok(!before.description.includes('死亡する'));
assert.equal(death.room,'第1層 1007号室');
assert.deepEqual(death.status_effects,[{character:'P07-G06',status:'死亡'}]);
assert.equal(death.series,'鳴動');assert.equal(death.series_index,3);
assert.equal(events.filter(event=>event.series==='鳴動' && event.series_index===3).length,1);
assert.equal(wake.source_locator.pages[0],117);
assert.match(wake.description,/返答は.*描かれない/);
assert.ok(!wake.description.includes('スミドリが戻る'));
assert.ok(before.chapter_order<death.chapter_order && death.chapter_order<e('E386-006').chapter_order && e('E386-006').chapter_order<wake.chapter_order && wake.chapter_order<e('E386-004').chapter_order);
assert.ok(before.time_estimate<death.time_estimate && death.time_estimate<wake.time_estimate && wake.time_estimate<e('E386-004').time_estimate);
assert.equal(people.find(p=>p.id==='P07-G06').status_log.find(log=>log.chapter===386).event_id,death.id);
for(const event of [death,wake]) {assert.equal(event.time_start,null);assert.equal(event.time_estimate_basis,'editorial-scene-split-20261020');}
const code=fs.readFileSync('script.js','utf8');
const reset=code.slice(code.indexOf('resetButton.addEventListener("click", async () =>'),code.indexOf('editor.appendChild(form);',code.indexOf('resetButton.addEventListener("click", async () =>')));
// Run the actual reset handler: restoring public fields must preserve the memo and local event.
const vm = require('node:vm');
const originalDraft = {memo: 'keep memo', edits: {notes: 'local edit'}, createdRecord: {id: 'LOCAL-test'}, updatedAt: '2026-01-01T00:00:00Z'};
let handler;
const sandbox = vm.createContext({
  resetButton: {addEventListener(_event, callback) { handler = callback; }}, memoTimer: null,
  localDrafts: {items: {test: structuredClone(originalDraft)}}, recordKey: 'test',
  DraftState: require('../draft-state.js'), saveLocalDrafts: async () => true,
  reopenDetailAfterReload() {}, record: {}, category: 'event', view: 'modal', formStatus: {}
});
vm.runInContext(reset, sandbox);
(async () => {
  await handler();
  const result = sandbox.localDrafts.items.test;
  assert.equal(result.memo, originalDraft.memo);
  assert.equal(result.createdRecord.id, originalDraft.createdRecord.id);
  assert.equal(Object.keys(result.edits).length, 0);
  assert.ok(Date.parse(result.updatedAt) > Date.parse(originalDraft.updatedAt));
  console.log('PASS: memo delta clocks, Nen basis, short headlines, Kaiser attribution, three-scene split, death/series references and non-destructive edit reset');
})().catch(error => {console.error(error); process.exitCode = 1;});
