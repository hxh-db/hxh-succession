const assert=require('node:assert/strict'),P=require('../personnel-roster.js'),F=require('../character-facts.js');
const people=require('../data/characters.json'),events=require('../data/events.json'),roster=require('../data/personnel_roster.json');
const at=(id,chapter)=>P.select(roster,people,{period:`chapter-${chapter}`,events}).find(p=>p.id===id);
const h365=at('P01-P06',365),h366=at('P01-P06',366),h414=at('P01-P06',414),h415=at('P01-P06',415);
assert.equal(h365.type,null);assert.equal(h366.type,'soldier');assert.equal(h366.soldier_category,'私設兵');
assert.deepEqual(F.familyRelations(h414,people),[]);assert.deepEqual(F.familyRelations(h415,people).map(r=>r.id),['BYD-001']);
assert.equal(F.familyHistoryUnorganized(at('P05-G01',400)),true);
const raw={id:'test',name:'最新の名前',aliases:['最新の別名'],image:'latest-face.png',type:'hunter',is_hunter:true,
 role:'後の役割',affiliation:'後の所属',parent_ids:['parent'],secret_new_field:'unknown future extension',notes:'後の備考',
 status:'死亡',status_log:[{chapter:420,status:'死亡',event_id:'future'}],
 fact_history:[{chapter:400,values:{role:'確認した役割',parent_ids:['parent']},basis:'確認した範囲',source_event_ids:['known']} ]};
const early=P.projectPerson(raw,{period:'chapter-374',people:[]});
assert.equal(early.name,raw.name);assert.equal(early.image,raw.image);assert.deepEqual(early.aliases,raw.aliases);
assert.equal(early.role,null);assert.equal(early.affiliation,null);assert.equal(early.type,null);assert.equal(early.is_hunter,null);
assert.deepEqual(early.parent_ids,[]);assert.equal(early.notes,null);assert.equal(early.secret_new_field,undefined);
assert.ok(!JSON.stringify(early).includes('後の'));assert.equal(early.status,'状態未確認');
assert.equal(F.matchesSearch(F.buildSearchText(F.searchFields(early,{revealed:true})),'状態未確認'),false,'placeholder is not a confirmed attribute');
assert.equal(P.projectPerson(raw,{period:'chapter-400'}).role,'確認した役割');
assert.equal(P.projectPerson(raw,{period:'all'}),raw);assert.equal(P.projectPerson(raw,{period:'latest'}),raw);
const edited={...raw,local_edited:true,local_public_values:{role:raw.role},role:'自分用'};
assert.equal(P.projectPerson(edited,{period:'chapter-400'}).local_edited,undefined);
assert.equal(P.select(roster,people,{period:'chapter-374',events}).length,230);
for(let queen=1;queen<=7;queen++)assert.equal(P.select(roster,people,{period:'chapter-374',queen,events}).filter(p=>p.roster_projection).length,1);
console.log('PASS: identity-only defaults, source-revealed roles/family, no latest extension leakage, local-edit separation and stable roster frames');
