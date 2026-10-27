const assert=require('node:assert/strict');
const {select}=require('../personnel-roster.js');
const F=require('../character-facts.js');
const roster=require('../data/personnel_roster.json'),people=require('../data/characters.json'),events=require('../data/events.json');
const at=(id,chapter)=>select(roster,people,{period:`chapter-${chapter}`,events}).find(p=>p.id===id);
const matches=(person,query,revealed)=>F.matchesSearch(F.buildSearchText(F.searchFields(person,{revealed})),query);
for(const [id,before,after,query] of [['P14-H02',387,388,'発芽'],['P05-G01',400,401,'透明言葉'],['P01-P06',412,413,'錬金術師']]){
 const early=at(id,before),late=at(id,after);
 assert.equal(early.nen_status,'historical_unorganized');
 assert.equal(matches(early,query,true),false);
 assert.ok(late.nen_ability);assert.equal(late.nen_status,'confirmed');
 assert.equal(matches(late,query,true),true);
 assert.equal(matches(late,query,false),false);
 assert.equal(late.nen_ability_image,null);
 assert.ok(late.nen_history_view.source_event_ids.every(id=>events.find(e=>e.id===id).chapter<=after));
}
assert.doesNotMatch(at('P01-P06',413).nen_ability,/365|700|解呪アイテム/);
assert.doesNotMatch(at('P01-P06',413).nen_ability_name,/鋼/);
assert.match(at('P01-P06',415).nen_ability_name,/鋼/);
assert.match(at('P01-P06',415).nen_ability,/365日/);
const nuk=at('P02-P07',374);
assert.equal(nuk.role,null,'unreviewed role must not be taken from the latest record');
assert.equal(nuk.mission,null);
assert.equal(matches(nuk,'ヌクオコン 担当外れ',true),false);
assert.equal(select(roster,people,{period:'chapter-374',events}).length,230);
assert.match(people.find(p=>p.id==='P02-P07').role,/担当外れ/);
assert.equal(at('P12-H01',400).nen_status,'historical_unorganized');
assert.equal(select(roster,people,{period:'latest',events}).find(p=>p.id==='P01-P06').nen_ability,people.find(p=>p.id==='P01-P06').nen_ability);
console.log('PASS: reader-reveal boundaries for 3 people, flashback timing, unorganized fields, spoiler-safe search, no future imagery or assignment-release leak');
