const assert = require('node:assert/strict');
const state = require('../draft-state.js');
const {createStore, KEY} = require('../theories/theory-memos.js');
(async () => {
  let value = JSON.stringify({version: 1, items: {'guide:other': {memo: 'keep'}}});
  const storage = {getItem: () => value, setItem: (_key, next) => {value = next;}};
  state.checkpoint({source: {version: 1, items: {'theory:Q001': {memo: 'pending', updatedAt: '2026-10-26T00:00:00Z'}}}, storage, key: KEY});
  assert.equal(JSON.parse(value).items['guide:other'].memo, 'keep');
  assert.equal(JSON.parse(value).items['theory:Q001'].memo, 'pending');
  value = JSON.stringify(state.reset(JSON.parse(value)));
  const reset = value;
  assert.throws(() => state.checkpoint({source: {version: 1, items: {}}, storage, key: KEY}), /リセット/);
  assert.equal(value, reset);
  value = '{broken';
  assert.throws(() => state.checkpoint({source: {version: 1, items: {}}, storage, key: KEY}), /ブラウザのメモ/);
  assert.equal(value, '{broken');
  // A delayed save started with old text cannot supersede a later exit checkpoint.
  value = null;
  let release, entered;
  const waiting = new Promise(resolve => {entered = resolve;});
  let delay = false, file = {format: 'hxh-succession-local-drafts', version: 1, items: {}};
  const store = createStore({storage, api: '/api/drafts', fetcher: async (_url, options) => {
    if (options.method === 'PUT') file = JSON.parse(options.body);
    else if (delay) {delay = false; entered(); await new Promise(resolve => {release = resolve;});}
    return {ok: true, json: async () => structuredClone(file)};
  }});
  await store.load('theory:Q001');
  delay = true;
  const saving = store.save('theory:Q001', 'article', 'old pending text');
  await waiting;
  store.checkpoint('theory:Q001', 'article', 'newer text before leaving');
  release(); await saving;
  assert.equal(JSON.parse(value).items['theory:Q001'].memo, 'newer text before leaving');
  assert.equal(file.items['theory:Q001'].memo, 'newer text before leaving');
  // The first queued save succeeding must not clear the later failed save's dirty state.
  const fs = require('node:fs'), vm = require('node:vm');
  const source = fs.readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');
  const save = source.slice(source.indexOf('async function saveLocalDrafts('), source.indexOf('function checkpointPendingDrafts('));
  let browserValue = null, writes = 0;
  const context = vm.createContext({DraftState: state, console: {warn() {}},
    updateDraftExitGuard() {}, updateDraftStorageStatus() {},
    localStorage: {getItem: () => browserValue, setItem: (_key, next) => {if (writes++) throw Error('quota'); browserValue = next;}}});
  vm.runInContext(`let draftResetInProgress = false, draftLoadError = '', draftSaveCount = 0, draftChangesUnsaved = false;
    let draftSaveQueue = Promise.resolve(), draftFileHealthy = true, draftStorageMode = 'browser';
    const LOCAL_DRAFTS_KEY = 'test', LOCAL_DRAFTS_API = null;
    let localDrafts = {version: 1, items: {}};
    function buildDraftExport() {return localDrafts;}
    ${save}`, context);
  const results = await vm.runInContext(`(async () => {
    localDrafts.items['guide:test'] = {memo: 'first', updatedAt: '2026-10-26T00:00:00Z'};
    const first = saveLocalDrafts();
    localDrafts.items['guide:test'] = {memo: 'second', updatedAt: '2026-10-26T00:00:01Z'};
    const second = saveLocalDrafts();
    return Promise.all([first, second]);
  })()`, context);
  assert.deepEqual(Array.from(results), [true, false]);
  assert.equal(vm.runInContext('draftChangesUnsaved', context), true);
  assert.equal(vm.runInContext('draftSaveCount', context), 0);
  console.log('PASS: synchronous exit copy preserves other notes, respects reset/corruption, and survives an older delayed save');
})().catch(error => {console.error(error); process.exitCode = 1;});
