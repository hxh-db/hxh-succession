const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const facts=require('../character-facts.js');
const roster=require('../personnel-roster.js');
const people=require('../data/characters.json'),events=require('../data/events.json');
const source=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
const fields=source.match(/const LOCAL_EDIT_FIELDS = ([\s\S]*?);\r?\n/)[1];
const apply=source.slice(source.indexOf('function applyLocalDrafts('),source.indexOf('function reopenDetailAfterReload('));
const original=structuredClone(people.find(person=>person.id==='P12'));
const guard=structuredClone(people.find(person=>person.id==='P01-P06'));
const edits={status:'自分用の状態',room:'自分用の場所',nen_ability:'自分用の能力',notes:'自分用の備考'};
const context=vm.createContext({records:[structuredClone(original),structuredClone(guard)],
  originalRecords:new Map(),localDrafts:{items:{'prince:P12':{memo:'keep memo',edits},'bodyguard:P01-P06':{edits:{role:'自分用の役割'}}}}});
vm.runInContext(`const LOCAL_EDIT_FIELDS=${fields};function localRecordKey(record,category){return category+':'+record.id;} ${apply}
  applyLocalDrafts(records,person=>person.type==='prince'?'prince':'bodyguard');`,context);
const changed=context.records[0],changedGuard=context.records[1];
assert.equal(changed.local_edited,true);
assert.match(facts.statusLabel(changed,events),/自分用の状態.*未照合/);
assert.doesNotMatch(facts.statusLabel(changed,events),/368/);
assert.doesNotMatch(facts.statusEditorialNote(changed,events),/E368-001|第368/);
assert.equal(facts.publicRecord(changed).status,original.status);
assert.match(facts.statusEditorialNote(facts.publicRecord(changed),events),/E368-001/);
assert.deepEqual(facts.statusHistoryRows(changed,events),facts.statusHistoryRows(original,events));
assert.match(facts.latestLocationLabel(changed,events),/自分用の場所.*未照合/);
assert.equal(facts.latestLocation(changed,events).eventId,null);
assert.match(facts.nenKnowledgeLabel(changed),/自分用.*未照合/);
assert.match(facts.nenTypeLabel(changed),/変更した能力は未照合/);
assert.deepEqual(facts.publicRecord(changedGuard),guard);
assert.equal(context.localDrafts.items['prince:P12'].memo,'keep memo');
const all=people.map(person=>person.id===changedGuard.id?changedGuard:person);
const ledger=require('../data/personnel_roster.json');
for(const period of ['departure','chapter-374']) {
 const before=roster.select(ledger,people,{period,events}).find(person=>person.id===guard.id);
 const after=roster.select(ledger,all,{period,events}).find(person=>person.id===guard.id);
 assert.deepEqual(after,before,`${period}: historical roster must use public values`);
}
const unmodified=structuredClone(original);
context.records=[unmodified];context.originalRecords=new Map();context.localDrafts={items:{'prince:P12':{edits:{status:original.status}}}};
vm.runInContext("applyLocalDrafts(records,()=> 'prince')",context);
assert.ok(!unmodified.local_edited,'Unchanged fields must not receive a local-edit warning');
assert.equal(facts.statusLabel(unmodified,events),facts.statusLabel(original,events));
console.log('PASS: personal status/place/ability/role values are unverified; public evidence and history retained; historical rosters unchanged; untouched values have no warning');
