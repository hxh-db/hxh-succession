const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {fixture, ready} = require('./helpers/browser-fixture.cjs');
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const local of [false, true]) for (const width of [1280, 390]) {
      const {context, base} = await fixture(browser, {local, width});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '?c_search=' + encodeURIComponent('クラピカ') + '#characters'); await ready(page);
      await page.locator('.directory-character-card h3 a').first().click();
      const editor = page.locator('#modalContent .local-editor');
      const parent = editor.locator('xpath=ancestor::details[1]');
      if (await parent.count() && !await parent.getAttribute('open').then(value => value !== null)) await parent.locator(':scope > summary').click();
      await editor.locator(':scope > label textarea').fill('入力直後の再読み込みでも残す');
      // A person URL reloads its static entry page; return to the app to read private notes.
      await page.reload();
      await page.goto(base); await ready(page);
      assert.equal(await page.evaluate(() => localDrafts.items['bodyguard:P14-H01']?.memo), '入力直後の再読み込みでも残す');
      await page.goto(base + 'theories/Q001/');
      await page.locator('.local-editor textarea:not([disabled])').waitFor({state: 'attached'});
      await page.locator('.spoiler-article').evaluate(el => {el.open = true;});
      await page.locator('.local-editor-collapsed > summary').click();
      await page.locator('.local-editor textarea').fill('記事の入力直後も残す');
      await page.reload();
      await page.locator('.local-editor textarea:not([disabled])').waitFor({state: 'attached'});
      assert.equal(await page.locator('.local-editor textarea').inputValue(), '記事の入力直後も残す');
      await page.goto(base); await ready(page);
      assert.equal(await page.evaluate(() => localDrafts.items['theory:Q001']?.memo), '記事の入力直後も残す');
      if (!local && width === 390) {
        await page.locator('#characterSearch').fill('クラピカ');
        await page.locator('.directory-character-card h3 a').first().click();
        await page.evaluate(() => {
          window.normalSetItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) {
            if (key === 'hxh-succession-local-drafts-v1') throw Error('test quota failure');
            return window.normalSetItem.call(this, key, value);
          };
        });
        await page.locator('#modalContent .local-editor > label textarea').fill('保存できないときは移動を止める');
        const warning = page.waitForEvent('dialog');
        const reload = page.reload().catch(() => {});
        const dialog = await warning;
        assert.equal(dialog.type(), 'beforeunload');
        await dialog.dismiss(); await reload;
        assert.equal(await page.locator('#modalContent .local-editor > label textarea').inputValue(), '保存できないときは移動を止める');
        await page.evaluate(() => {Storage.prototype.setItem = window.normalSetItem;});
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${local ? 'file' : 'browser'} ${width}: reload before debounce preserves main/article notes and migrates the browser copy`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
