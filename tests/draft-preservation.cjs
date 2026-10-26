// Independent saves, empty-item tombstones, resets and concurrent file revisions.
const assert = require('node:assert/strict');
const state = require('../draft-state.js');
const {createStore, KEY} = require('../theories/theory-memos.js');
const item = (memo, n) => ({memo, updatedAt: `2026-10-25T00:00:0${n}.000Z`});
const source = items => ({version: 1, items});
(async () => {
  const values = new Map();
  const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
  const persist = (drafts, extra = {}) => state.persist({source: drafts, storage, key: KEY, ...extra});
  storage.setItem(KEY, JSON.stringify(source({'theory:Q001': item('article', 2)})));
  await persist(source({'guide:test': item('main', 3)}));
  assert.equal(JSON.parse(values.get(KEY)).items['theory:Q001'].memo, 'article');
  const cleared = source({'guide:test': item('', 4)});
  await persist(cleared);
  await persist(source({'guide:test': item('stale', 3), 'event:test': item('another', 5)}));
  const browser = JSON.parse(values.get(KEY));
  assert.equal(browser.items['guide:test'].memo, '', 'a cleared memo must not return');
  assert.equal(state.envelope(browser).entries.length, 2, 'empty sync records are not user notes');
  assert.ok(state.hasContent({createdRecord: {id: 'LOCAL-test'}, memo: ''}));
  assert.ok(Date.parse(state.timestamp(item('', 5))) > Date.parse(item('', 5).updatedAt));
  // Timestamps with offsets must be compared as dates, not alphabetically.
  assert.equal(state.merge(source({x: {memo: 'later', updatedAt: '2026-10-25T01:00:00Z'}}),
    source({x: {memo: 'earlier', updatedAt: '2026-10-25T09:00:00+09:00'}})).items.x.memo, 'later');

  let file = state.envelope(source({'theory:Q001': item('file', 2)})), revision = 1, conflicts = 1, puts = 0;
  const fetcher = async (_url, options) => {
    if (options.method !== 'PUT') return {ok: true, headers: {get: () => `"${revision}"`}, json: async () => structuredClone(file)};
    puts++;
    if (conflicts-- > 0) {
      file.items['event:other-browser'] = item('concurrent', 5);
      revision++;
      return {ok: false, status: 412};
    }
    assert.equal(options.headers['If-Match'], `"${revision}"`);
    file = JSON.parse(options.body); revision++;
    return {ok: true, status: 200};
  };
  values.clear();
  await persist(source({'guide:test': item('pending', 3)}), {fetcher, api: '/api/drafts'});
  assert.equal(puts, 2);
  assert.equal(file.items['event:other-browser'].memo, 'concurrent');
  assert.equal(file.items['guide:test'].memo, 'pending');
  assert.equal(file.items['theory:Q001'].memo, 'file');
  assert.equal(JSON.parse(values.get(KEY)).items['event:other-browser'].memo, 'concurrent');
  // Article and database share the same persistence implementation.
  const article = createStore({storage, fetcher, api: '/api/drafts'});
  await article.load('theory:Q001');
  await article.save('theory:Q001', 'article', 'new article');
  await persist(source({'guide:second': item('second', 5)}), {fetcher, api: '/api/drafts'});
  assert.equal(file.items['theory:Q001'].memo, 'new article');
  // Failed saves retain a browser copy; a later retry keeps other pages' additions.
  await assert.rejects(persist(source({'guide:retry': item('retry me', 5)}), {
    api: '/api/drafts', fetcher: async () => ({ok: false})
  }));
  assert.equal(JSON.parse(values.get(KEY)).items['guide:retry'].memo, 'retry me');
  await persist(source({}), {fetcher, api: '/api/drafts'});
  assert.equal(file.items['guide:retry'].memo, 'retry me');
  await assert.rejects(state.persist({source: source({}), key: KEY,
    storage: {getItem() { return null; }, setItem() { throw Error('quota'); }}}), /保存できません/);
  file = state.envelope(state.reset(source({})));
  await assert.rejects(persist(source({'guide:old': item('must not return', 5)}), {fetcher, api: '/api/drafts'}), /リセット/);
  assert.deepEqual(file.items, {});
  console.log('PASS: main/article merge, clearing, real timestamp order, file conflict retry, failures and reset safety');
})().catch(error => {console.error(error); process.exitCode = 1;});
