const assert=require('node:assert/strict');
const events=require('../data/events.json'),backlog=require('../data/research_backlog.json');
const byId=Object.fromEntries(events.map(e=>[e.id,e]));
const report=byId['E359-005'];
assert.equal(report.verification_status,'review_recorded');
assert.ok(report.title.includes('4名について'));
assert.ok(!report.title.includes('4名から'));
assert.ok(report.revealed_facts.some(line=>line.includes('15分前')));
assert.ok(report.notes.includes('報告者が4名本人とは示されない'));
assert.equal(report.time_start,null);assert.equal(report.time_estimate,'12:45');
assert.ok(Object.values(report.character_presence).every(kind=>kind==='mentioned'));
assert.equal(byId['E376-009'].character_presence.P03,'present');
assert.equal(byId['E405-006'].character_presence['HA-008'],'mentioned');
assert.ok(byId['E405-006'].revealed_facts.every(line=>line.includes('回想')));
assert.ok(byId['E405-001'].revealed_facts.some(line=>line.includes('No.9')));
assert.ok(!byId['E405-006'].description.includes('ヒソカを見つけたボノレノフ'));
for(const id of ['E405-005','E405-006']){
 const event=byId[id];assert.equal(event.chronology_kind,'flashback');
 assert.equal(event.day,null);assert.equal(event.time_start,null);assert.equal(event.time_estimate,undefined);
}
assert.ok(byId['E349-001'].mysteries.every(line=>!line.includes('どちらに近いか')));
assert.ok(byId['E349-001'].mysteries.some(line=>line.includes('全員が同日')));
for(const id of ['BACKLOG-002','BACKLOG-005','BACKLOG-006'])assert.equal(backlog.find(row=>row.id===id).status,'resolved');
assert.equal(backlog.find(row=>row.id==='BACKLOG-001').status,'needs_official_review');
assert.equal(events.length,465);
console.log('PASS: reported whereabouts stay distinct from direct sighting; individual rituals, undated scenes and explicit flashbacks retain their evidence limits');
