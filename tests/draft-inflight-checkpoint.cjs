const assert = require('node:assert/strict');
const D = require('../draft-state.js');
const wrap = items => ({version: 1, items});
(async () => {
  for (const retry of [false, true]) for (const change of ['same', 'other', 'reset', 'corrupt']) {
    let raw = null, release, entered, gets = 0, puts = 0;
    const paused = new Promise(resolve => {entered = resolve;});
    const storage = {getItem: () => raw, setItem: (_, value) => {raw = value;}};
    const old = D.editItem({}, {memo: 'old'}), newer = D.editItem(old, {memo: 'new'});
    let file = D.envelope(wrap({'guide:existing': {memo: 'keep'}}));
    const saving = D.persist({source: wrap({'guide:pending': old}), storage, key: 'test', api: '/api/drafts',
      fetcher: async (_, options) => {
        if (options.method === 'PUT') {
          puts++;
          if (retry && puts === 1) return {ok: false, status: 412};
          file = JSON.parse(options.body); return {ok: true};
        }
        gets++;
        if (gets === (retry ? 2 : 1)) {entered(); await new Promise(resolve => {release = resolve;});}
        return {ok: true, headers: {get: () => String(gets)}, json: async () => structuredClone(file)};
      }});
    const outcome = saving.then(value => ({value}), error => ({error}));
    await paused;
    if (change === 'same') D.checkpoint({source: wrap({'guide:pending': newer}), storage, key: 'test'});
    if (change === 'other') D.checkpoint({source: wrap({'guide:other': newer}), storage, key: 'test'});
    if (change === 'reset') raw = JSON.stringify(D.reset(wrap({})));
    if (change === 'corrupt') raw = '{broken';
    const checkpoint = raw;
    release();
    const result = await outcome;
    if (['reset', 'corrupt'].includes(change)) {
      assert.ok(result.error, `${change}: old save must stop`);
      assert.equal(raw, checkpoint);
      assert.equal(puts, retry ? 1 : 0, 'no PUT may follow an invalidated checkpoint');
      assert.equal(file.items['guide:existing'].memo, 'keep');
    } else {
      assert.equal(result.error, undefined);
      const target = change === 'same' ? 'guide:pending' : 'guide:other';
      assert.equal(JSON.parse(raw).items[target].memo, 'new');
      assert.equal(file.items[target].memo, 'new');
      assert.equal(file.items['guide:existing'].memo, 'keep');
      assert.equal(result.value.items[target].memo, 'new');
    }
  }
  console.log('PASS: checkpoints made during GET/retry survive in browser and file; intervening reset/corruption stops stale writes');
})().catch(error => {console.error(error); process.exitCode = 1;});
