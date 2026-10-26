const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const facts = require('../character-facts.js');
const context = vm.createContext({CharacterFacts: facts});
const fields = code.match(/const LOCAL_EDIT_FIELDS = ([\s\S]*?);\r?\n/)[1];
vm.runInContext(`const LOCAL_EDIT_FIELDS = ${fields};
  const originalRecords = new Map(); let localDrafts = {items: {}};
  ${code.slice(code.indexOf('function localRecordKey('), code.indexOf('function buildLocalEventRecord('))}
  ${code.slice(code.indexOf('function applyLocalDrafts('), code.indexOf('function reopenDetailAfterReload('))}
  ${code.slice(code.indexOf('function parseTimeString('), code.indexOf('function getLocationKey('))}
  function apply(original, edits) {
    const event = {...original}; localDrafts.items = {['event:' + event.id]: {edits}};
    applyLocalDrafts([event], () => 'event'); return event;
  }`, context);
const original = {id: 'E383-004', chapter: 383, title: '元の見出し', summary: '元の要約',
  description: '元の出来事。元の詳細。', day: 8, date_certainty: 'confirmed',
  time_start: null, time_estimate: '21:31', time_estimate_basis: 'original-basis'};
let edited = context.apply(original, {description: '修正した出来事。修正した詳細。'});
assert.equal(context.getEventHeadline(edited), '修正した出来事。', 'edited body must replace the old derived headline');
assert.equal(edited.summary, undefined, 'old summary must not contradict the edited body');
edited = context.apply(original, {time_estimate: null});
assert.equal(edited.time_estimate_basis, undefined, 'old clock evidence cannot support a cleared clock');
assert.equal(edited.time_inference, false, 'cleared clocks must not be silently interpolated again');
const placements = context.buildInferredTimePlacements([
  {id: 'E383-003', chapter: 383, day: 8, time_start: '21:00'}, edited,
  {id: 'E383-005', chapter: 383, day: 8, time_start: '22:00'}
]);
assert.equal(placements.has(edited.id), false);
edited = context.apply({...original, period: 'preboard', relative_days_before_departure: 3}, {day: 2});
assert.equal(facts.dayLabel(edited), '2日目（確度未確認）');
assert.equal(edited.period, undefined);
assert.equal(edited.relative_days_before_departure, undefined);
assert.equal(edited.local_edited, true);
assert.equal(edited.time_inference, false, 'moving the day must not infer a new clock from unrelated public anchors');
edited = context.apply({...original, location: null, room: '第1層 1014号室', location_status: 'recorded', location_basis: 'original-room'}, {location: ''});
assert.equal(edited.room, null, 'clearing the location must not redisplay a hidden original room');
assert.equal(edited.location_status, 'unverified');
assert.equal(edited.location_basis, undefined);
edited = context.apply(original, {});
assert.equal(edited.title, original.title);
assert.equal(edited.time_estimate_basis, original.time_estimate_basis);
assert.equal(edited.date_certainty, original.date_certainty);
assert.equal(edited.local_edited, undefined);
assert.equal(original.description, '元の出来事。元の詳細。');
console.log('PASS: private edits update headlines, clear stale clock evidence, suppress interpolation, preserve date uncertainty and restore originals');
