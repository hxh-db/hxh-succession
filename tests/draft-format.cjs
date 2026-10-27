const assert = require('node:assert/strict');
const state = require('../draft-state.js');
const {createStore, KEY} = require('../theories/theory-memos.js');
const vectors = require('./fixtures/draft-format-cases.json');
const make = row => {
  const value = Object.hasOwn(row, 'source') ? structuredClone(row.source) : {...structuredClone(vectors.base), ...structuredClone(row.patch)};
  if (Object.hasOwn(row, 'item')) value.items['event:E383-004'] = structuredClone(row.item);
  return value;
};
(async () => {
  for (const row of vectors.cases) {
    const value = make(row), text = JSON.stringify(value);
    let stored = text, writes = 0;
    const storage = {getItem: () => stored, setItem: (_key, next) => {stored = next; writes++;}};
    const article = createStore({storage, api: null});
    if (row.valid) {
      assert.equal(state.validateSnapshot(value), value, row.name);
      await article.load('theory:Q001');
      await article.save('theory:Q001', 'test article', 'new memo');
      assert.equal(JSON.parse(stored).items['theory:Q001'].memo, 'new memo', row.name);
    } else {
      assert.throws(() => state.validateSnapshot(value), /形式/, row.name);
      await assert.rejects(article.load('theory:Q001'), undefined, row.name);
      await assert.rejects(article.save('theory:Q001', 'test article', 'must not write'), undefined, row.name);
      assert.equal(stored, text, row.name);
      assert.equal(writes, 0, row.name);
      await assert.rejects(state.persist({source: value, storage, key: KEY, api: null}), /形式/, row.name);
      assert.equal(stored, text, row.name);
    }
  }
  const legacy = {version:1,items:{'guide:legacy':{memo:'old note without clocks'}}};
  assert.throws(()=>state.validateSnapshot({...legacy,unknown:Infinity}),/形式/);
  assert.throws(()=>state.validateSnapshot({...legacy,unknown:{nested:NaN}}),/形式/);
  let writes=0;
  const untouched={getItem:()=>JSON.stringify(legacy),setItem:()=>{writes++;}};
  await assert.rejects(state.persist({source:null,storage:untouched,key:KEY,api:null}),/形式/);
  assert.throws(()=>state.checkpoint({source:null,storage:untouched,key:KEY}),/形式/);
  assert.equal(writes,0);
  assert.deepEqual(state.merge(legacy, {version:1,resetAt:'1960-01-01T00:00:00Z',items:{'guide:other':{memo:'older reset'}}}).items,
    {...legacy.items,'guide:other':{memo:'older reset'}});
  console.log(`PASS: ${vectors.cases.length} shared format cases; invalid browser/article/persist inputs never write; legacy dates survive`);
})().catch(error => {console.error(error);process.exitCode=1;});
