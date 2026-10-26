// Booting must never treat an unrelated file export time as a deletion marker.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');
const loader = code.slice(code.indexOf('async function loadLocalDrafts('), code.indexOf('async function saveLocalDrafts('));
const state = require('../draft-state.js');
async function boot(browser, file) {
  const values = new Map([['test', JSON.stringify(browser)]]);
  const context = vm.createContext({console, AbortSignal, DraftState: state,
    localStorage: {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)},
    fetch: async () => ({ok: true, json: async () => structuredClone(file)}),
    validateDraftImport: payload => payload.items});
  vm.runInContext(`const LOCAL_DRAFTS_KEY = 'test', LOCAL_DRAFTS_API = '/api/drafts';
    let localDrafts, draftStorageMode = 'browser', draftFileHealthy = false, pendingDraftMigration = false;
    let draftLoadError = '', unreadableBrowserDraft = null;
    ${loader}`, context);
  await vm.runInContext('loadLocalDrafts()', context);
  return JSON.parse(vm.runInContext('JSON.stringify({localDrafts, pendingDraftMigration})', context));
}
(async () => {
  const browser = {version: 1, items: {
    'guide:local-only': {memo: 'PC保存に失敗してブラウザに残ったメモ', updatedAt: '2026-10-26T00:00:00Z'},
    'event:LOCAL-recovery': {createdRecord: {id: 'LOCAL-recovery'}, updatedAt: '2026-10-26T00:01:00Z'}
  }};
  const file = {format: 'hxh-succession-local-drafts', version: 1, exportedAt: '2026-10-26T01:00:00Z', items: {
    'theory:Q001': {memo: '別ページの後の保存', updatedAt: '2026-10-26T01:00:00Z'}
  }};
  const recovered = await boot(browser, file);
  assert.equal(recovered.localDrafts.items['guide:local-only']?.memo, browser.items['guide:local-only'].memo);
  assert.equal(recovered.localDrafts.items['event:LOCAL-recovery']?.createdRecord.id, 'LOCAL-recovery');
  assert.equal(recovered.localDrafts.items['theory:Q001'].memo, file.items['theory:Q001'].memo);
  assert.equal(recovered.pendingDraftMigration, true);
  const cleared = {...file, items: {...file.items, 'guide:local-only': {memo: '', updatedAt: '2026-10-26T02:00:00Z'}}};
  assert.equal((await boot(browser, cleared)).localDrafts.items['guide:local-only'].memo, '');
  const reset = {...file, ...state.reset(file)};
  assert.deepEqual((await boot(browser, reset)).localDrafts.items, {});
  console.log('PASS: boot preserves unsynced notes/events, keeps other pages, honors clearing and reset generations');
})().catch(error => {console.error(error); process.exitCode = 1;});
