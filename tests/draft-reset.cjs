const assert = require('node:assert/strict');
const {merge, reset, epoch} = require('../draft-state.js');
const {createStore, KEY} = require('../theories/theory-memos.js');
const fs = require('node:fs');

(async () => {
  const old = {version: 1, items: {
    'theory:Q001': {memo: 'old article', updatedAt: '2026-10-20T00:00:00Z'},
    'guide:soemonoTitle': {memo: 'old guide'},
    'event:LOCAL-1': {memo: 'old event', edits: {description: 'edited'}, createdRecord: {id: 'LOCAL-1'}}
  }};
  const empty = reset(old, Date.parse('2026-10-20T01:00:00Z'));
  assert.deepEqual(merge(old, empty).items, {});
  assert.deepEqual(merge(empty, old).items, {});
  assert.ok(epoch(reset(empty, epoch(empty))) > epoch(empty));
  const after = {...empty, items: {'theory:Q002': {memo: 'new'}}};
  assert.deepEqual(Object.keys(merge(old, after).items), ['theory:Q002']);
  const map = new Map([[KEY, JSON.stringify(old)]]);
  const storage = {getItem: key => map.get(key), setItem: (key, value) => map.set(key, value)};
  const stale = createStore({storage, api: null});
  assert.equal(await stale.load('theory:Q001'), 'old article');
  storage.setItem(KEY, JSON.stringify(empty));
  await assert.rejects(stale.save('theory:Q001', 'article', 'must not return'), /リセット/);
  assert.deepEqual(JSON.parse(map.get(KEY)).items, {});
  const fresh = createStore({storage, api: null});
  assert.equal(await fresh.load('theory:Q001'), '');
  await fresh.save('theory:Q001', 'article', 'new note');
  assert.equal(JSON.parse(map.get(KEY)).items['theory:Q001'].memo, 'new note');
  assert.equal(epoch(JSON.parse(map.get(KEY))), epoch(empty));
  let file = {format: 'hxh-succession-local-drafts', ...old, entries: []};
  const store = createStore({storage: {getItem() { return null; }, setItem() {}}, api: '/api/drafts',
    fetcher: async (_url, options) => {
      assert.notEqual(options.method, 'PUT', 'stale file writer must stop before PUT');
      return {ok: true, json: async () => structuredClone(file)};
    }});
  await store.load('theory:Q001');
  file = {...file, ...empty};
  await assert.rejects(store.save('theory:Q001', 'article', 'stale'), /リセット/);
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes('id="resetLocalDrafts"'));
  assert.ok(html.includes('id="confirmDraftReset"'));
  assert.ok(html.includes('id="draftResetConfirmation" hidden'));
  assert.ok(html.indexOf('src="draft-state.js') < html.indexOf('src="script.js'));
  console.log('PASS: reset generations, stale browser/file writers blocked, new notes work, backup controls');
})().catch(error => {console.error(error); process.exitCode = 1;});
