const assert=require('node:assert/strict');
const fs=require('node:fs');
const facts=require('../character-facts.js');
const people=require('../data/characters.json');
const events=require('../data/events.json');
const byId=new Map(people.map(p=>[p.id,p]));
const relations=id=>facts.familyRelations(byId.get(id),people);
assert.ok(relations('P02').some(r=>r.id==='Q02' && facts.familyRelationLabel(r)==='親子'));
assert.ok(relations('SWU-001').some(r=>r.id==='KNG-001' && facts.familyRelationLabel(r)==='兄弟姉妹'));
assert.ok(relations('SWU-001').some(r=>r.id==='P03' && r.speculative && facts.familyRelationLabel(r)==='親子'));
const mother=relations('P09').find(r=>r.id==='Q01');
assert.ok(mother.speculative,'letter claim must not become confirmed maternity');
const nominal=relations('EII-001').find(r=>r.id==='KNG-001');
assert.ok(nominal.nominal);
assert.equal(facts.familyRelationLabel(nominal),'親子（名義上）');
assert.match(nominal.note,/第378話.*第408話.*別人|第378話.*第408話.*本物/);
assert.ok(!(byId.get('EII-001').parent_ids||[]).includes('KNG-001'));
assert.ok(!byId.get('KNG-001').children.includes('EII-001'));
assert.ok(relations('KNG-001').some(r=>r.id==='EII-001' && r.nominal));
const family=people.filter(p=>p.type==='mafia' && p.affiliation==='エイ＝イ一家');
assert.equal(family.length,23);
assert.ok(!family.some(p=>['EII-006','EII-007','EII-T01'].includes(p.id)));
assert.ok(family.some(p=>p.status==='死亡'),'23 is not a current-survivor count');
for(const id of ['EII-U01','EII-U02']) {
  const p=byId.get(id);
  assert.equal(p.identity_status,'unnamed_confirmed');
  assert.equal(p.source_chapter,378);
  assert.match(p.name,/^エイ＝イ組員[12]（仮称）$/);
  assert.equal(p.status,'生死未確認');
  assert.ok(events.find(e=>e.id==='E378-002').characters.includes(id));
  const img=fs.readFileSync(p.image);
  assert.equal(img.readUInt32BE(16),77);
  assert.ok(fs.readFileSync(`characters/${id}/index.html`,'utf8').includes('氏名未判明'));
}
for(const id of ['EII-001','KNG-001']) {
  const html=fs.readFileSync(`characters/${id}/index.html`,'utf8');
  const [before,later]=html.split('<details class="character-page-spoilers"');
  assert.ok(!before.includes('親子（名義上）'));
  assert.ok(later.includes('親子（名義上）'));
  assert.ok(later.includes(`../${id==='EII-001'?'KNG-001':'EII-001'}/`));
}
console.log('PASS: distinct family kinds, nominal Morena parentage, reciprocal links, 23 unique original members and verified unnamed portraits');
