const assert = require('node:assert/strict');
const state = require('../draft-state.js');
const {createStore, KEY} = require('../theories/theory-memos.js');
(async () => {
  const pending = {version: 1, items: {'guide:new': {memo: 'new note', updatedAt: '2026-10-26T00:00:00Z'}}};
  const corrupt = ['{broken', ...[
    {version: 999, items: {}}, {version: 1, items: []},
    {version: 1, items: {'guide:old': null}},
    {version: 1, items: {'guide:old': {memo: 42}}},
    {version: 1, items: {'guide:old': {edits: []}}}
  ].map(value => JSON.stringify(value))];
  for (const raw of corrupt) {
    let value = raw, puts = 0;
    const storage = {getItem: () => value, setItem: (_key, next) => {value = next;}};
    await assert.rejects(state.persist({source: pending, key: KEY, storage, api: '/api/drafts',
      fetcher: async () => {puts++; throw Error('must not fetch');}}), /ブラウザのメモ/);
    assert.equal(value, raw, 'malformed browser data must remain byte-for-byte intact');
    assert.equal(puts, 0);
    const article = createStore({storage, api: null});
    await assert.rejects(article.load('theory:Q001'));
    await assert.rejects(article.save('theory:Q001', 'article', 'must not overwrite'));
    assert.equal(value, raw);
  }
  let value = JSON.stringify({version: 1, items: {'guide:old': {memo: 'old'}}}), puts = 0;
  const storage = {getItem: () => value, setItem: (_key, next) => {value = next;}};
  await assert.rejects(state.persist({source: pending, key: KEY, storage, api: '/api/drafts',
    fetcher: async (_url, options) => {
      if (options.method === 'PUT') puts++;
      return {ok: true, json: async () => ({format: 'hxh-succession-local-drafts', version: 1, items: {bad: null}})};
    }}), /形式/);
  assert.equal(puts, 0);
  assert.equal(JSON.parse(value).items['guide:old'].memo, 'old');
  assert.equal(JSON.parse(value).items['guide:new'].memo, 'new note');
  console.log('PASS: corrupt browser/file snapshots block overwrites, article writes stop, valid pending notes remain recoverable');
})().catch(error => {console.error(error); process.exitCode = 1;});
