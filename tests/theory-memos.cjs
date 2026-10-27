const assert = require('node:assert/strict');
const {createStore, KEY} = require('../theories/theory-memos.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const values = new Map();
const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
let file = {format: 'hxh-succession-local-drafts', version: 1,
  items: {'guide:soemonoTitle': {memo: '既存メモ', updatedAt: '2026-01-01'}}};
let fail = false;
const fetcher = async (url, options) => {
  assert.equal(url, '/hxh-succession/api/drafts');
  if (fail) return {ok: false};
  if (options.method === 'PUT') file = JSON.parse(options.body);
  return {ok: true, json: async () => structuredClone(file)};
};
(async () => {
  const store = createStore({storage, fetcher, api: '/hxh-succession/api/drafts'});
  assert.equal(await store.load('theory:Q001'), '');
  await store.save('theory:Q001', '謎・考察：記事1', '  考察メモ  ');
  file.items['event:E361-001'] = {memo: '別ページで追加', updatedAt: '2026-01-02'};
  await store.save('theory:Q002', '謎・考察：記事2', '別のメモ');
  assert.equal(file.items['guide:soemonoTitle'].memo, '既存メモ');
  assert.equal(file.items['event:E361-001'].memo, '別ページで追加');
  assert.equal(file.items['theory:Q001'].memo, '考察メモ');
  assert.equal(file.entries.find(entry => entry.key === 'theory:Q002').title, '謎・考察：記事2');
  const restored = createStore({storage, fetcher, api: '/hxh-succession/api/drafts'});
  assert.equal(await restored.load('theory:Q001'), '考察メモ');
  await restored.save('theory:Q001', '謎・考察：記事1', '');
  assert.equal(file.items['theory:Q001'].memo, '');
  assert.equal(file.items['theory:Q002'].memo, '別のメモ');
  const before = JSON.stringify(file);
  fail = true;
  await assert.rejects(restored.save('theory:Q001', '記事1', '上書き禁止'));
  assert.equal(JSON.stringify(file), before);
  const publicStore = createStore({storage, api: null});
  await publicStore.load('theory:Q001');
  await publicStore.save('theory:Q001', '記事1', 'ブラウザ保存');
  assert.equal(JSON.parse(values.get(KEY)).items['theory:Q001'].memo, 'ブラウザ保存');
  // Old/imported candidates may contain surrounding whitespace. Saving the
  // untouched textarea must not turn that normalization into a selection.
  const draftState=require('../draft-state.js'),conflictTime='2026-10-26T00:00:00Z';
  const spaced=draftState.merge(...['  候補A  ','  候補B  '].map(memo=>({version:1,
    items:{'theory:Q001':{memo,updatedAt:conflictTime}}})));
  let spacedRaw=JSON.stringify(spaced);
  const spacedStore=createStore({storage:{getItem:()=>spacedRaw,setItem:(_key,value)=>{spacedRaw=value;}},api:null});
  const untouched=await spacedStore.load('theory:Q001');
  await spacedStore.save('theory:Q001','記事1',untouched);
  assert.equal(JSON.parse(spacedRaw).items['theory:Q001'].conflicts.memo.length,2);
  spacedStore.checkpoint('theory:Q001','記事1',untouched);
  assert.deepEqual(JSON.parse(spacedRaw).items['theory:Q001'].conflicts.memo.map(choice=>choice.value),['  候補A  ','  候補B  ']);
  // Main-page importer/exporter accepts article notes and preserves their readable titles.
  const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const importer = source.slice(source.indexOf('function validateDraftImport('), source.indexOf('function renderDraftOverview('));
  const fields = source.match(/const LOCAL_EDIT_FIELDS = ([\s\S]*?);\r?\n/)[1];
  const sandbox = vm.createContext({payload: file, DraftState: require('../draft-state.js')});
  vm.runInContext(`const LOCAL_EDIT_FIELDS = ${fields}; ${importer}
    result = validateDraftImport(payload);`, sandbox);
  assert.equal(sandbox.result['theory:Q002'].title, '謎・考察：記事2');
  assert.equal(sandbox.result['theory:Q002'].memo, '別のメモ');
  const dirs = fs.readdirSync(path.join(root, 'theories'), {withFileTypes: true}).filter(entry => entry.isDirectory());
  assert.equal(dirs.length, 17);
  for (const dir of dirs) {
    const html = fs.readFileSync(path.join(root, 'theories', dir.name, 'index.html'), 'utf8');
    assert.ok(html.includes(`data-theory-id="${dir.name}"`));
    assert.ok(html.includes('../../theories/theory-memos.js?v='));
    assert.ok(!html.includes('考察メモ'));
  }
  console.log('PASS: 17 article memo hooks; save, restore, isolation, merge, failure safety, backup import');
})().catch(error => {console.error(error); process.exitCode = 1;});
