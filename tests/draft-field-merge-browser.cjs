const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {fixture, ready, empty} = require('./helpers/browser-fixture.cjs');
const event = require('../data/events.json').find(event => event.id === 'E383-004');
const key = 'event:' + event.id;
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const local of [true, false]) for (const width of [1280, 390]) {
      const initial = {...empty(), items: {[key]: {memo: '元のメモ', edits: {}, updatedAt: '2026-10-25T00:00:00Z'}}};
      const {context, base, state} = await fixture(browser, {local, width, drafts: initial});
      await context.addInitScript(({initial}) => {
        localStorage.setItem('hxh-succession-spoilers-revealed-v1', 'true');
        if (!localStorage.getItem('hxh-succession-local-drafts-v1')) localStorage.setItem('hxh-succession-local-drafts-v1', JSON.stringify(initial));
      }, {initial});
      const first = await context.newPage(), second = await context.newPage(), errors = [];
      for (const page of [first, second]) {
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '?event=' + event.id + '#timeline'); await ready(page);
        await page.locator('#detailModal').waitFor({state: 'visible'});
      }
      const form = second.locator('#detailModal .local-editor-form');
      await second.locator('#detailModal .local-editor-fields > summary').click();
      await form.getByLabel('出来事', {exact: true}).fill('別タブから保存した本文。');
      await Promise.all([second.waitForEvent('load'), form.getByRole('button', {name: '編集を保存', exact: true}).click()]);
      await ready(second);
      async function saveMemo(text) {
        await first.locator('#detailModal .local-editor-label textarea').first().fill(text);
        await first.locator('#detailModal').getByRole('button', {name: '今すぐ保存', exact: true}).click();
        await first.locator('#detailModal .local-editor-status').first().filter({hasText: /保存しました/}).waitFor();
      }
      async function read() {
        return local ? state.drafts.items[key] : first.evaluate(key => JSON.parse(localStorage.getItem('hxh-succession-local-drafts-v1')).items[key], key);
      }
      // The first tab still has the old edits; its new memo must not roll them back.
      await saveMemo('最初のタブからのメモ');
      assert.equal((await read()).edits.description, '別タブから保存した本文。');
      assert.equal((await read()).memo, '最初のタブからのメモ');
      // Conversely the second tab has an old memo while changing the fields.
      await second.locator('#detailModal .local-editor-fields > summary').click();
      await form.getByLabel('詳細・備考', {exact: true}).fill('別タブの備考');
      await Promise.all([second.waitForEvent('load'), form.getByRole('button', {name: '編集を保存', exact: true}).click()]);
      await ready(second);
      assert.equal((await read()).memo, '最初のタブからのメモ');
      assert.equal((await read()).edits.notes, '別タブの備考');
      await second.locator('#detailModal .local-editor-fields > summary').click();
      await Promise.all([second.waitForEvent('load'), form.getByRole('button', {name: 'この項目の編集を戻す', exact: true}).click()]);
      await ready(second);
      await saveMemo('編集を戻した後のメモ');
      assert.deepEqual((await read()).edits, {}, 'an undone edit must not return from the stale first tab');
      assert.equal((await read()).memo, '編集を戻した後のメモ');
      await first.reload(); await ready(first);
      assert.equal(await first.locator('#modalTitle').innerText(), event.title);
      assert.equal(await first.locator('#detailModal .local-editor-label textarea').first().inputValue(), '編集を戻した後のメモ');
      // An explicit restore intentionally replaces newer values despite old field clocks.
      const backup = await first.evaluate(() => ({format: 'hxh-succession-local-drafts',
        ...JSON.parse(localStorage.getItem('hxh-succession-local-drafts-v1'))}));
      backup.items[key].memo = '古い控えから意図して復元したメモ';
      backup.items[key].edits = {description: '意図して復元した本文。'};
      backup.items[key].updatedAt = '2026-10-25T00:00:00Z';
      for (const field of Object.keys(backup.items[key].fieldUpdatedAt)) backup.items[key].fieldUpdatedAt[field] = '2026-10-25T00:00:00Z';
      await first.locator('#modalClose').click();
      await first.locator('#localDraftsLink').click();
      await first.locator('.local-drafts-backup > summary').click();
      first.once('dialog', dialog => dialog.accept());
      await Promise.all([first.waitForEvent('load'), first.locator('#importLocalDrafts').setInputFiles({
        name: 'isolated-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
      })]);
      await ready(first);
      assert.equal((await read()).memo, '古い控えから意図して復元したメモ');
      assert.equal((await read()).edits.description, '意図して復元した本文。');
      await first.reload(); await ready(first);
      assert.equal(await first.evaluate(id => eventsData.find(event => event.id === id).description, event.id), '意図して復元した本文。');
      assert.deepEqual(errors, []);
      console.log(`PASS ${local ? 'file' : 'browser'} ${width}: same-item memo/edit concurrency, reverse order, undo, reload and intentional old-backup restore`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
