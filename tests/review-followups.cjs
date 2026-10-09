const assert = require('node:assert/strict');
const fs = require('node:fs');
const facts = require('../character-facts.js');
const events = require('../data/events.json');
const people = require('../data/characters.json');
const {spoilerFields} = require('../scripts/build-character-pages.cjs');
for (const id of ['E378-002','E382-004','E415-002']) {
  const event = events.find(e => e.id === id);
  assert.ok(event.editorial_questions.length);
  assert.ok(!event.mysteries.some(text => /正確な時刻/.test(text)));
  assert.ok(facts.questionSections(event, events).some(s => s.heading.startsWith('編集上')));
}
const fixture = {mysteries:['犯人','方法','場所'], mystery_updates:[
  {text:'犯人',status:'resolved',related_event_ids:['R']},
  {text:'方法',status:'open',related_event_ids:['U']}
], editorial_questions:['正確な時刻']};
const sections = facts.questionSections(fixture,[{id:'R', verification_status:'review_recorded'},{id:'U', verification_status:'unverified'}]);
assert.equal(sections.length,4);
assert.ok(sections[0].heading.includes('後に判明') && sections[0].lines[0].includes('確認記録あり'));
assert.ok(sections[1].heading.includes('未解決') && sections[1].lines[0].includes('再照合待ち'));
assert.ok(sections[2].heading.includes('未判定'));
assert.ok(!events.find(e=>e.id==='E417-004').description.includes('自身の守護霊獣能力'));
const sandra = people.find(p=>p.id==='P14-M01');
assert.equal(spoilerFields(sandra,events).find(([label])=>label==='役割')[1],'従事者');
const source=fs.readFileSync('script.js','utf8'), html=fs.readFileSync('index.html','utf8'), css=fs.readFileSync('style.css','utf8');
assert.ok(source.includes('timelineLatestDay') && source.includes('Math.max(...days)'));
assert.ok(html.includes('id="timelinePeriodSelect"'));
assert.ok(html.includes('guide-initial-setting" aria-labelledby="shipMapTitle"'));
assert.ok(html.includes('guide-initial-setting" aria-labelledby="shipRolesTitle"'));
assert.ok(css.includes('.guide-data-section:not(.guide-initial-setting)'));
assert.ok(!source.includes('context.appendChild(makeRecordPermalink("character", character.id))'));
assert.ok(source.includes('記録・関連イベント・メモ') && source.includes('本人名の一致ではありません'));
const styleUrl = html.match(/href="(style\.css\?v=[^"]+)"/)[1];
assert.ok(fs.readFileSync('characters/index.html','utf8').includes(`../${styleUrl}`));
assert.ok(fs.readFileSync('characters/SWU-004/index.html','utf8').includes(`../../${styleUrl}`));
const lynch=people.find(p=>p.id==='SWU-004');
assert.equal(lynch.image,'images/characters/lynch.webp');
assert.ok(fs.existsSync(lynch.image));
console.log('PASS: separate editorial/story questions, resolution evidence, shorter fields, date navigation, guide spoiler scope, distinct entries and requested asset fixes');
