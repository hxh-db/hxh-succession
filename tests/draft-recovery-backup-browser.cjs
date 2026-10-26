const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {fixture, ready, empty} = require('./helpers/browser-fixture.cjs');
const KEY = 'hxh-succession-local-drafts-v1';
const note = (memo, updatedAt = '2026-10-26T01:00:00Z') => ({memo, updatedAt});
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const local of [true, false]) for (const width of [1280, 390]) {
      const file = {...empty(), exportedAt: '2026-10-26T02:00:00Z', items: {'theory:Q001': note('PCの後の保存')}};
      const {context, base, state} = await fixture(browser, {local, width, drafts: file});
      await context.addInitScript(({KEY, initial}) => {
        if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(initial));
      }, {KEY, initial: {version: 1, items: {'bodyguard:P14-H01': note('未同期の控え')}}});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base); await ready(page);
      assert.equal(await page.evaluate(() => localDrafts.items['bodyguard:P14-H01'].memo), '未同期の控え');
      if (local) assert.equal(state.drafts.items['bodyguard:P14-H01'].memo, '未同期の控え');
      const other = await context.newPage(); await other.goto(base + 'theories/Q002/');
      await other.locator('.local-editor textarea:not([disabled])').waitFor({state: 'attached'});
      await other.locator('.spoiler-article').evaluate(el => {el.open = true;});
      await other.locator('.local-editor-collapsed > summary').click();
      await other.locator('.local-editor textarea').fill('別ページの新しいメモ');
      await other.locator('.local-editor button').click();
      await other.waitForFunction(() => document.querySelector('.local-editor-status').textContent.includes('保存しました'));
      // A separate browser may update only the file, with no storage event on this page.
      if (local) {
        state.drafts.items['guide:shipDecksTitle'] = note('別ブラウザからPC保存', '2026-10-26T03:00:00Z');
        state.revision++;
      }
      await page.locator('#localDraftsLink').click();
      await page.locator('.local-drafts-backup > summary').click();
      assert.ok(await page.locator('#exportUnreadableBrowserDraft').isHidden());
      async function backup() {
        const pending = page.waitForEvent('download');
        await page.locator('#exportLocalDrafts').click();
        const download = await pending;
        return JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      }
      const downloaded = await backup();
      assert.equal(downloaded.items['bodyguard:P14-H01'].memo, '未同期の控え');
      assert.equal(downloaded.items['theory:Q002'].memo, '別ページの新しいメモ');
      assert.equal(await page.locator('#draftCount').innerText(), `（${downloaded.entries.length}件）`);
      assert.ok((await page.locator('#draftOverviewList').textContent()).includes('別ページの新しいメモ'));
      if (local) assert.equal(downloaded.items['guide:shipDecksTitle'].memo, '別ブラウザからPC保存');
      assert.equal(await page.evaluate(() => localDrafts.items['theory:Q002'].memo), '別ページの新しいメモ');
      if (local) {
        state.failGet = true;
        const retained = await backup();
        assert.equal(retained.items['bodyguard:P14-H01'].memo, '未同期の控え');
        assert.match(await page.locator('#localDraftsTransferStatus').innerText(), /PCの最新メモは取得できず/);
        state.failGet = false;
      }
      await page.reload(); await ready(page);
      assert.equal(await page.evaluate(() => localDrafts.items['bodyguard:P14-H01'].memo), '未同期の控え');
      assert.deepEqual(errors, []);
      console.log(`PASS ${local ? 'file' : 'browser'} ${width}: boot recovery, fresh multi-page backup, file-only updates and offline fallback`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
