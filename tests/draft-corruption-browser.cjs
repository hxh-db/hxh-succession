const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {fixture, ready, empty, ROOT} = require('./helpers/browser-fixture.cjs');
const path = require('node:path');
const KEY = 'hxh-succession-local-drafts-v1';
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    const cases = [
      {width: 390, local: false, raw: '{broken browser data'},
      {width: 1280, local: false, raw: JSON.stringify({version: 1, items: {'guide:test': null}})},
      {width: 390, local: true, raw: JSON.stringify({version: 1, items: {'guide:test': {memo: 42}}})},
      {width: 1280, local: true, badFile: true},
      {width: 390, local: false, raw: JSON.stringify({version: 1, resetAt: 'invalid', items: {}})},
      {width: 1280, local: true, raw: JSON.stringify({version: 1, items: {'guide:test': {memo: 'keep', updatedAt: '2026-02-30T00:00:00Z'}}})},
      {width: 390, local: true, file: {...empty(), resetAt: 'invalid'}},
      {width: 1280, local: true, file: {...empty(), items: {'event:E383-004': {edits: {day: 13}}}}}
    ];
    for (const options of cases) {
      const file = options.file || (options.badFile ? {...empty(), items: {'guide:test': null}} : empty());
      const {context, base, state} = await fixture(browser, {...options, drafts: file});
      if (options.raw) await context.addInitScript(({KEY, raw}) => {
        if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, raw);
      }, {KEY, raw: options.raw});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base); await ready(page);
      assert.ok(await page.locator('#databaseLoadStatus').isHidden(), 'private notes must not prevent the public database from loading');
      assert.equal(await page.locator('.directory-character-card').count(), 60);
      assert.match(await page.locator('#draftStorageStatus').innerText(), /メモ.*(?:読み込めません|形式が正しくありません)/);
      assert.match(await page.locator('#draftCount').textContent(), /他は未確認/);
      assert.doesNotMatch(await page.locator('#draftOverviewList').textContent(), /まだメモはありません/);
      assert.ok(await page.locator('#addTimelineEvent').isDisabled());
      for (const id of ['exportLocalDrafts', 'chooseLocalDrafts', 'resetLocalDrafts']) assert.ok(await page.locator('#' + id).isDisabled());
      assert.equal(await page.locator('#exportLocalDrafts').evaluate(el => getComputedStyle(el).opacity), '0.45');
      assert.equal(state.puts, 0);
      assert.deepEqual(state.drafts, file);
      if (options.raw) {
        assert.equal(await page.evaluate(KEY => localStorage.getItem(KEY), KEY), options.raw);
        await page.locator('#localDraftsLink').click();
        await page.locator('.local-drafts-backup > summary').click();
        const pending = page.waitForEvent('download');
        await page.locator('#exportUnreadableBrowserDraft').click();
        const download = await pending;
        assert.equal(fs.readFileSync(await download.path(), 'utf8'), options.raw);
        if (options.width === 390 && !options.local) {
          const output = path.join(ROOT, '.local/quality-20261026-recovery');
          fs.mkdirSync(output, {recursive: true});
          await page.locator('#draftStorageStatus').scrollIntoViewIfNeeded();
          await page.screenshot({path: path.join(output, 'damaged-notes-390.png')});
        }
      } else {
        await page.locator('.local-drafts-backup > summary').click();
        assert.ok(await page.locator('#exportUnreadableBrowserDraft').isHidden());
      }
      await page.locator('#characterSearch').fill('クラピカ');
      await page.locator('.directory-character-card h3 a').first().click();
      assert.equal(await page.locator('#modalTitle').innerText(), 'クラピカ');
      assert.equal(await page.locator('#modalContent .local-editor textarea').count(), 0);
      assert.match(await page.locator('#modalContent').innerText(), /メモを読み込めないため編集を停止/);
      const article = await context.newPage(); await article.goto(base + 'theories/Q001/');
      await article.waitForFunction(() => document.querySelector('.local-editor-status')?.textContent.includes('読み込めません'));
      assert.ok(await article.locator('.local-editor textarea').isDisabled());
      assert.equal(state.puts, 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      console.log(`PASS ${options.local ? 'file' : 'browser'} ${options.width}: public search works, damaged data retained/exportable, all note mutations blocked`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
