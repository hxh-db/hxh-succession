const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const facts = require('../character-facts.js');
const people = require('../data/characters.json');
const events = require('../data/events.json');
const hanzo = people.find(p => p.id === 'P12-H01');
assert.equal(hanzo.assignment_history[1].event_id, 'E361-006');
assert.ok(events.find(e => e.id === 'E361-006').characters.includes(hanzo.id));
const rows = facts.assignmentRows(hanzo, people);
assert.equal(rows[0].text, '初期：第12王子モモゼ／第1層 1012号室（第350話）');
assert.equal(rows[1].text, '転属後：第13王子マラヤーム／第1層 1013号室（第361話）');
const latest = facts.latestLocation(hanzo, events);
assert.equal(latest.location, '第1層 1013号室');
assert.equal(latest.chapter, 375);
assert.equal(latest.review, 'review_recorded'); // 第375話の原作再照合（2026-10-10）で E375-005〜007 が review_recorded になった
const html = fs.readFileSync(path.join(root, 'characters/P12-H01/index.html'), 'utf8');
for (const row of rows) assert.ok(html.includes(row.text));
assert.ok(html.includes(facts.latestLocationLabel(hanzo, events)));
assert.ok(html.includes('E361-006') && !html.includes('E361-003'));
// 2026-10-10 の原作再照合で E361-005 は日付表示なしの estimated になったため、画像で日付を確認した E366-006 を使う
const confirmed = events.find(e => e.id === 'E366-006');
assert.equal(facts.dateCertaintyLabel(confirmed), '');
assert.equal(facts.dayLabel(confirmed), '1日目');
assert.equal(facts.dayLabel({day: 1, date_certainty: 'estimated'}), '推定1日目');
assert.equal(facts.dayLabel({day: 1}), '1日目（確度未確認）');
assert.equal(facts.dateCertaintyLabel({day: 1}), '日付の確度未確認');
assert.equal(facts.dateCertaintyLabel({}), '日付不明');
assert.equal(facts.dayLabel({relative_days_before_departure: 35, date_certainty: 'confirmed'}), '出航35日前');
// 再照合後の第366話：日付表示のある E366-006 だけが confirmed、他は estimated（第366話の各場面すべてを検査する）
const ch366Day1 = events.filter(e => e.chapter === 366 && e.day === 1);
assert.ok(ch366Day1.length > 1);
assert.ok(ch366Day1.every(e => facts.dateCertainty(e) === (e.id === 'E366-006' ? 'confirmed' : 'estimated')));
// Render the real badge function: a confirmed blank label must not turn into 'unknown'.
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`), body = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let i = body; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw Error(name);
}
class Element { constructor() { this.children = []; } appendChild(e) { this.children.push(e); } }
const ctx = vm.createContext({CharacterFacts: facts, document: {createElement: () => new Element()}});
vm.runInContext(['getDateCertaintyLabel', 'getEventVerificationLabel', 'makeEventReviewRibbon'].map(extract).join('\n'), ctx);
const ribbon = ctx.makeEventReviewRibbon(confirmed, {estimated: false});
assert.ok(!ribbon.children.some(e => /日付不明|日付の確度未確認/.test(e.textContent)));
const unknownRibbon = ctx.makeEventReviewRibbon({day: 1, chapter: 361, id: 'test'}, {estimated: true});
assert.ok(unknownRibbon.children.some(e => e.textContent === '日付の確度未確認'));
assert.ok(source.includes('CharacterFacts.assignmentRows(record, charactersData)'));
assert.ok(source.includes('CharacterFacts.assignmentRows(character, charactersData)'));
assert.ok(!extract('showDetailModal').includes('label: "現在地"'));
console.log('PASS: shared assignment/location across card, modal and static page; confirmed/estimated/unreviewed dates; rendered date badges');
