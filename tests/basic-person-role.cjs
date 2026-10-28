const assert=require('node:assert/strict'),F=require('../character-facts.js');
const people=require('../data/characters.json');
for(const id of ['P02-P07','P12-Q05','P01-P02','P11-G01']){
 const person=people.find(p=>p.id===id),text=F.buildSearchText(F.searchFields(person));
 assert.doesNotMatch(F.basicRole(person)||'',/担当外れ|呪殺|暗殺|潜入|引き継/);
 assert.equal(F.matchesSearch(text,person.mission),false,`${id}: secret mission is not basic search metadata`);
 assert.equal(F.matchesSearch(F.buildSearchText(F.searchFields(person,{revealed:true})),person.mission),true);
}
assert.equal(F.basicRole({role:'第14王子護衛',mission:'護衛'}),'第14王子護衛');
assert.equal(F.basicRole({role:'呪殺師',mission:'呪殺'}),null);
assert.equal(F.basicRole({role:'暗殺要員',mission:'暗殺'}),null);
assert.equal(F.basicRole({role:'私設兵（後の補足）',mission:'監視'}),'私設兵');
console.log('PASS: basic role/search excludes covert missions and subsequent assignment notes; full facts remain available');
