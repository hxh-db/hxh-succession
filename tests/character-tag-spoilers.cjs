const assert=require('node:assert/strict'),F=require('../character-facts.js');
for(const category of ['血縁','状態','念','念の系統','念講習会'])assert.equal(F.tagIsSpoiler({category}),true);
for(const label of ['暗殺','呪殺','憑依','潜入'])assert.equal(F.tagIsSpoiler({category:'任務',label}),true);
for(const category of ['分類','所属','初期配置','名前'])assert.equal(F.tagIsSpoiler({category}),false);
assert.equal(F.tagIsSpoiler({category:'任務',label:'護衛'}),false);
assert.equal(F.tagIsSpoiler({category:'対象'}, {mission:'呪殺'}),true);
assert.equal(F.tagIsSpoiler({category:'対象'}, {mission:'監視'}),false);
assert.equal(F.tagIsSpoiler({category:'護衛'}, {assignment_history:[{}]}),true);
console.log('PASS: shared tag spoiler policy; public identity/affiliation and ordinary guard duties remain usable');
