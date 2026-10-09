const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = f => JSON.parse(fs.readFileSync(path.join(root,'data',f),'utf8'));
const people = read('characters.json'), sources = read('sources.json');
const setting = people.filter(p=>p.author_setting);
assert.equal(setting.length,14);
assert.equal(setting.filter(p=>p.setting_only).length,9);
assert.equal(new Set(setting.map(p=>p.author_setting.slot)).size,14);
assert.equal(new Set(setting.map(p=>p.name)).size,14);
for (const p of setting) {
 const source = sources.find(s=>s.id===p.author_setting.source_id);
 assert.equal(source.source_type,'author_official_x');
 assert.equal(source.verification_status,'primary_image_checked');
 assert.ok(source.url.startsWith('https://x.com/Un4v5s8bgsVk9Xp/status/'));
 assert.equal(p.name,p.author_setting.name_in_sheet);
 if(p.setting_only) {
  assert.equal(p.author_setting.body_mapping,'unmatched'); assert.ok(p.is_identity_reference);
  assert.equal(p.initial_room,null); assert.equal(p.room,null); assert.equal(p.image,null);
  assert.equal(p.nen_status,'unknown'); assert.equal(p.source_chapter,null);
 }
 const html = fs.readFileSync(path.join(root,'characters',p.id,'index.html'),'utf8');
 assert.ok(html.includes(source.url) && html.includes('作者の公式設定資料'));
}
assert.equal(people.find(p=>p.id==='P09-U01').name,'フリチョセフ');
assert.equal(people.find(p=>p.id==='P09-U02').name,'ニコラウルス');
assert.ok(people.find(p=>p.id==='P09-U02').role.includes('兵隊長'));
assert.ok(people.find(p=>p.id==='P09-P05').author_setting.source_id.endsWith('-correction'));
assert.ok(!people.some(p=>p.name==='スドミリ'));
for(const id of ['P09-P01','P09-P02']) assert.equal(people.find(p=>p.id===id).verification_status,'unverified');
const app = fs.readFileSync(path.join(root,'script.js'),'utf8');
assert.ok(app.includes('g.camp === prince.camp && !g.setting_only'));
console.log('PASS: 14 setting rows, 9 scoped additions, 2 stable-ID identifications, correction, sources, generated pages and no placement inflation');
