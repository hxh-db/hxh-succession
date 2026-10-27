'use strict';
const assert=require('node:assert/strict');
const state=require('../draft-state.js');
const TIME='2026-10-27T01:00:00.000Z';
const snapshot=item=>({version:1,items:{'event:E383-004':item}});
const item=(field,value,present=true)=>({...(present?{[field]:value}:{}),updatedAt:TIME});
const permutations=values=>values.length?values.flatMap((value,index)=>permutations(values.filter((_,i)=>i!==index)).map(rest=>[value,...rest])):[[]];
for(const [field,a,b] of [['memo','A','B'],['edits',{}, {description:'B'}],['title','A','B'],['createdRecord',{id:'LOCAL-A'},{id:'LOCAL-B'}]]) {
  const left=snapshot(item(field,a)),right=snapshot(item(field,b));
  const merged=state.merge(left,right);
  assert.deepEqual(state.merge(right,left),merged,field);
  assert.equal(merged.version,2);
  assert.equal(merged.items['event:E383-004'].conflicts[field].length,2);
  state.validateSnapshot(merged);
  assert.deepEqual(state.merge(merged,merged),merged,field);
  const record=merged.items['event:E383-004'];
  const choice=record.conflicts[field].find(choice=>JSON.stringify(choice.value)===JSON.stringify(b));
  const chosen=state.resolveConflict(record,field,choice);
  const resolved={version:2,items:{'event:E383-004':chosen}};
  assert.deepEqual(chosen[field],b);
  assert.ok(!state.hasConflicts(chosen));
  assert.ok(!state.hasConflicts(state.merge(left,merged,resolved,right).items['event:E383-004']));
  assert.deepEqual(state.merge(left,merged,resolved,right).items['event:E383-004'][field],b);
  state.validateSnapshot(resolved);
}
const inputs=['A','B','C'].map(text=>snapshot(item('memo',text)));
const expected=state.merge(...inputs);
for(const order of permutations(inputs)) {
  assert.deepEqual(state.merge(...order),expected);
  assert.deepEqual(state.merge(state.merge(order[0],order[1]),order[2]),expected);
  assert.deepEqual(state.merge(order[0],state.merge(order[1],order[2])),expected);
}
const newer=snapshot({memo:'newer',updatedAt:'2026-10-27T01:00:01Z'});
for(const order of permutations([...inputs.slice(0,2),newer])) {
  const result=state.merge(...order);
  assert.equal(result.items['event:E383-004'].memo,'newer');
  assert.ok(!state.hasConflicts(result.items['event:E383-004']));
  assert.deepEqual(state.merge(state.merge(order[0],order[1]),order[2]),result);
}
const empty=state.merge(snapshot(item('memo','')),inputs[0]);
assert.equal(empty.items['event:E383-004'].conflicts.memo.length,2);
assert.equal(state.envelope(empty).entries.length,1,'A blank displayed candidate must not hide the conflict');
const absent=state.merge(snapshot(item('memo',null,false)),inputs[0]);
assert.ok(absent.items['event:E383-004'].conflicts.memo.some(choice=>!choice.present));
const missing=absent.items['event:E383-004'].conflicts.memo.find(choice=>!choice.present);
assert.ok(!Object.hasOwn(state.resolveConflict(absent.items['event:E383-004'],'memo',missing),'memo'));
const pair=state.merge(...inputs.slice(0,2));
const noop=snapshot(state.editItem(inputs[0].items['event:E383-004'],{memo:'A'}));
assert.equal(noop.items['event:E383-004'].fieldUpdatedAt.memo,TIME);
assert.equal(state.merge(noop,pair).items['event:E383-004'].conflicts.memo.length,2,'Unchanged stale saves must not resolve a conflict');
const other=state.editItem(pair.items['event:E383-004'],{edits:{notes:'independent'}});
assert.equal(state.merge(pair,{version:2,items:{'event:E383-004':other}}).items['event:E383-004'].conflicts.memo.length,2);
assert.throws(()=>state.resolveConflict(expected.items['event:E383-004'],'memo',pair.items['event:E383-004'].conflicts.memo[0],pair.items['event:E383-004'].conflicts.memo),/更新/);
const sameA=snapshot(item('edits',{notes:'note',location:'place'}));
const sameB=snapshot(item('edits',{location:'place',notes:'note'}));
assert.ok(!state.hasConflicts(state.merge(sameA,sameB).items['event:E383-004']),'Object-key order is not a new candidate');
assert.deepEqual(state.merge(state.reset(expected),expected).items,{});
assert.equal(state.reset(expected).version,2);
console.log('PASS: equal-time conflicts preserve all candidates; merge order/grouping is stable; clears, legacy fields, no-op saves, resolution and resets retain intent');
