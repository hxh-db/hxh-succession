const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {fixture, ready} = require('./helpers/browser-fixture.cjs');
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const article of [false, true]) {
      const {context, base, state} = await fixture(browser, {width: 390});
      await context.addInitScript(() => localStorage.setItem('hxh-succession-spoilers-revealed-v1', 'true'));
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + (article ? 'theories/Q001/' : '?event=E383-004#timeline'));
      if (article) {
        await page.locator('.local-editor textarea:not([disabled])').waitFor({state: 'attached'});
        await page.locator('.local-editor-collapsed > summary').click();
      } else await ready(page);
      const editor = page.locator(article ? '.local-editor' : '#detailModal .local-editor');
      let release, entered, gets = 0;
      const paused = new Promise(resolve => {entered = resolve;}), writes = [];
      await page.route('**/api/drafts', async route => {
        if (route.request().method() === 'GET' && ++gets === (article ? 2 : 1)) {
          entered(); await new Promise(resolve => {release = resolve;});
        }
        if (route.request().method() === 'PUT') writes.push(route.request().postDataJSON());
        await route.fallback();
      });
      const memo = editor.locator(':scope > label textarea');
      await memo.fill('通信開始時の古いメモ');
      await editor.locator(':scope > button').click(); await paused;
      await memo.fill('通信待ち中の新しい入力');
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      const key = article ? 'theory:Q001' : 'event:E383-004';
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem('hxh-succession-local-drafts-v1')).items[key].memo, key), '通信待ち中の新しい入力');
      release();
      await editor.locator(':scope > .local-editor-status').filter({hasText: /保存しました/}).waitFor();
      assert.equal(writes[0].items[key].memo, '通信待ち中の新しい入力', 'the first resumed PUT must already contain the newer checkpoint');
      assert.equal(state.drafts.items[key].memo, '通信待ち中の新しい入力');
      await page.reload();
      if (article) await memo.waitFor({state: 'attached'}); else await ready(page);
      await page.waitForFunction(({article}) => {
        const input = document.querySelector(article ? '.local-editor textarea' : '#detailModal .local-editor textarea');
        return input?.value === '通信待ち中の新しい入力';
      }, {article});
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${article ? 'article' : 'event'}: persist GET delay, actual input, pagehide checkpoint, first PUT and reload retain newest text`);
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
