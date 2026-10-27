const assert=require('node:assert/strict');
const {createIndex}=require('../event-search.js');
const people=[{id:'P01',name:'ベンジャミン＝ホイコーロ',type:'prince',rank:1,status:'未来の状態',nen_ability:'後で判明する能力'}];
const events=[
  {id:'E350-001',chapter:350,title:'電話での連絡',description:'警備の方針を伝える',characters:['P01'],room:'1014',notes:'会議の準備'},
  {id:'E400-001',chapter:400,description:'別の部屋で会議',characters:[],room:'1010'},
  {id:'E410-001',chapter:410,description:'呪詛の疑い',characters:[],location:'第4層',is_estimate:true}
];
const index=createIndex(events,people),find=query=>events.filter(index.matcher(query)).map(event=>event.id);
assert.deepEqual(find('ベンジャミン 電話'),['E350-001']);
assert.deepEqual(find('電話　ベンジャミン'),['E350-001']);
assert.deepEqual(find('第1王子 1014'),['E350-001']);
assert.deepEqual(find('BENJAMIN 電話'),['E350-001']);
assert.deepEqual(find('350 準備'),['E350-001']);
assert.deepEqual(find('101'),[]);
assert.deepEqual(find('第11王子'),[]);
assert.deepEqual(find('未来の状態'),[]);
assert.deepEqual(find('後で判明する能力'),[]);
assert.deepEqual(find('['),[]);
assert.deepEqual(find('  '),events.map(event=>event.id));
assert.deepEqual(find('呪詛'),['E410-001'],'Speculative scenes remain searchable with their existing labels');
const internal={description:'非表示用の編集文字列'};
const formatted=createIndex([internal],[],{formatText:()=>''});
assert.ok(!formatted.matcher('編集文字列')(internal));
const real=require('../data/events.json'),actualPeople=require('../data/characters.json');
const actual=createIndex(real,actualPeople);
assert.ok(real.filter(actual.matcher('ベンジャミン 戒厳令')).some(event=>event.id==='E414-001'));
console.log('PASS: scene text/name/alias/romaji search; AND words, numeric boundaries, literal punctuation, and no inherited future facts');
