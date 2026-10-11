const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const events = JSON.parse(fs.readFileSync(path.join(root, 'data/events.json'), 'utf8'));
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  const body = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let i = body; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw Error(name);
}
const periods = ['preboard', 'ritual', ...Array.from({length: 13}, (_, i) => `day-${i}`), 'provisional', 'unknown'].map(id => ({id}));
const ctx = vm.createContext({CharacterFacts: require('../character-facts.js'), eventsData: events, inferredTimePlacements: new Map(), TIMELINE_PERIODS: periods,
  getChronologyKind: e => e.chronology_kind || 'event', console});
vm.runInContext(['parseTimeString', 'sortKey', 'getEventDateCertainty', 'inferEventDay', 'getEventPeriodId',
  'getTimelineTimePlacement', 'buildInferredTimePlacements', 'getChronologicalEntries'].map(extract).join('\n'), ctx);
ctx.inferredTimePlacements = ctx.buildInferredTimePlacements(events);
// 2026-10-10 ユーザー判断：E361-005 の14:00は台詞（出航2時間）由来のため仮時刻へ移し、画像に『PM2:00』の表示がある E415-004 を確定14:00の例にする
const exact = events.find(e => e.id === 'E415-004');
assert.equal(ctx.getTimelineTimePlacement(exact).label, '14:00');
assert.equal(ctx.getTimelineTimePlacement(exact).estimated, false);
const demoted = events.filter(e => e.time_estimate_basis === 'editorial-time-demotion-20261010');
// 2026-10-10 の16件に、2026-10-11 の外部レビュー対応で E369-001・E413-002・E414-001 の3件を追加
assert.equal(demoted.length, 19);
for (const e of demoted) {
  assert.equal(e.time_start, null, e.id);
  assert.equal(ctx.getTimelineTimePlacement(e).label, `${e.time_estimate}頃？`, e.id);
  assert.equal(ctx.getTimelineTimePlacement(e).estimated, true, e.id);
}
for (const id of ['E361-004', 'E361-005', 'E361-006', 'E359-011']) {
  assert.equal(ctx.getTimelineTimePlacement(events.find(e => e.id === id)).label, '14:00頃？');
}
for (const e of events.filter(e => e.chapter < 358)) {
  assert.equal(ctx.getTimelineTimePlacement(e), null, `No invented preboarding clock: ${e.id}`);
}
const relativeDay = events.find(e => e.id === 'E349-002');
assert.equal(relativeDay.date_certainty, 'confirmed');
assert.equal(relativeDay.relative_days_before_departure, 35);
const ordered = ctx.getChronologicalEntries(events);
assert.equal(ordered.length, events.length);
assert.equal(new Set(ordered.map(e => e.event.id)).size, events.length);
assert.equal(ordered.find(e => e.event.id === 'E349-002').relativeLabel, '出航35日前');
for (const e of ordered) assert.ok(!/（仮）|より前|より後/.test(e.placement?.label || e.relativeLabel || ''));
const subset = events.filter((_, i) => i % 3 === 0);
assert.deepEqual(Array.from(ctx.getChronologicalEntries(subset), e => e.event.id),
  Array.from(ordered, e => e.event.id).filter(id => subset.some(e => e.id === id)));
console.log('PASS: exact 14:00, demoted clocks, approximate clocks, no invented preboarding clock, confirmed relative date, stable filtered order');
