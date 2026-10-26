const assert = require('node:assert/strict');
const state = require('../draft-state.js');
const source = item => ({version: 1, items: {'event:E383-004': item}});
const initial = {memo: '元のメモ', edits: {description: '元の修正'}, updatedAt: '2026-10-25T00:00:00Z'};
(async () => {
  const body = state.editItem(initial, {edits: {description: '別タブの修正'}});
  const memo = state.editItem(initial, {memo: '新しいメモ'});
  const merged = state.merge(source(body), source(memo)).items['event:E383-004'];
  assert.equal(merged.memo, '新しいメモ');
  assert.equal(merged.edits.description, '別タブの修正');
  const newMemo = state.editItem(undefined, {memo: '初めてのメモ'});
  const newEdits = state.editItem(undefined, {edits: {description: '初めての編集'}});
  assert.equal(state.merge(source(newMemo), source(newEdits)).items['event:E383-004'].memo, '初めてのメモ');
  assert.equal(state.merge(source(newMemo), source(newEdits)).items['event:E383-004'].edits.description, '初めての編集');
  const cleared = state.editItem(merged, {edits: {}});
  const laterMemo = state.editItem(merged, {memo: '後のメモ'});
  assert.deepEqual(state.merge(source(cleared), source(laterMemo)).items['event:E383-004'].edits, {});
  assert.equal(state.merge(source(cleared), source(laterMemo)).items['event:E383-004'].memo, '後のメモ');
  // Same-field conflicts retain the existing last-change rule, including clears.
  const blank = state.editItem(memo, {memo: ''});
  assert.equal(state.merge(source(memo), source(blank)).items['event:E383-004'].memo, '');
  const legacy = {...initial, memo: '意図したバックアップ復元', updatedAt: state.timestamp(blank)};
  assert.equal(state.merge(source(blank), source(legacy)).items['event:E383-004'].memo, legacy.memo);
  assert.equal(state.merge(source(blank), source(legacy)).items['event:E383-004'].edits.description, '元の修正');
  const a = state.editItem(initial, {memo: 'a'}), b = state.editItem(initial, {edits: {description: 'b'}}), c = state.editItem(initial, {memo: ''});
  a.updatedAt = a.fieldUpdatedAt.memo = '2026-10-26T01:00:00Z';
  b.updatedAt = b.fieldUpdatedAt.edits = '2026-10-26T02:00:00Z';
  c.updatedAt = c.fieldUpdatedAt.memo = '2026-10-26T03:00:00Z';
  for (const order of [[a,b,c], [a,c,b], [b,a,c], [b,c,a], [c,a,b], [c,b,a]]) {
    const merged = state.merge(...order.map(source));
    assert.equal(merged.items['event:E383-004'].memo, '');
    assert.equal(merged.items['event:E383-004'].edits.description, 'b');
    assert.deepEqual(state.merge(state.merge(source(order[0]), source(order[1])), source(order[2])),
      state.merge(source(order[0]), state.merge(source(order[1]), source(order[2]))));
    assert.deepEqual(state.merge(merged, merged), merged);
  }
  // A PC-only concurrent edit arrives between GET and PUT; retry keeps both fields.
  let value = null, file = state.envelope(source(initial)), revision = 0, conflicts = 1;
  const storage = {getItem: () => value, setItem: (_key, next) => {value = next;}};
  const fetcher = async (_url, options) => {
    if (options.method !== 'PUT') return {ok: true, headers: {get: () => String(revision)}, json: async () => structuredClone(file)};
    if (conflicts--) {
      file = state.envelope(source(body)); revision++;
      return {ok: false, status: 412};
    }
    assert.equal(options.headers['If-Match'], String(revision));
    file = JSON.parse(options.body); revision++;
    return {ok: true};
  };
  await state.persist({source: source(memo), storage, key: 'test', fetcher, api: '/api/drafts'});
  assert.equal(file.items['event:E383-004'].memo, '新しいメモ');
  assert.equal(file.items['event:E383-004'].edits.description, '別タブの修正');
  assert.equal(state.checkpoint({source: source(laterMemo), storage, key: 'test'}).items['event:E383-004'].edits.description, '別タブの修正');
  assert.throws(() => state.validateSnapshot(source({...initial, fieldUpdatedAt: {memo: 'invalid'}})), /形式/);
  assert.throws(() => state.validateSnapshot(source({...initial, fieldUpdatedAt: []})), /形式/);
  console.log('PASS: memo and edits merge independently across tabs, clear/undo, checkpoints, legacy backups and concurrent file retries');
})().catch(error => {console.error(error); process.exitCode = 1;});
