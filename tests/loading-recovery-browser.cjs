const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {fixture, ready, ROOT} = require('./helpers/browser-fixture.cjs');
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1280, 390, 320]) {
      const {context, base, state} = await fixture(browser, {width, local: false, prefix: '/hxh-succession'});
      state.failData = 'data/events.json';
      const page = await context.newPage();
      await page.goto(base + '?c_search=' + encodeURIComponent('クラピカ') + '#characters');
      await page.locator('#retryDatabaseLoad').waitFor();
      assert.match(await page.locator('#databaseLoadMessage').innerText(), /データを読み込めませんでした/);
      assert.equal(await page.locator('#main-content').getAttribute('aria-busy'), 'false');
      assert.ok(await page.locator('#characters').evaluate(el => el.inert));
      assert.ok(await page.locator('#databaseLoadStatus a[href="characters/"]').isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width === 390) {
        fs.mkdirSync(path.join(ROOT, '.local/quality-20261026'), {recursive: true});
        await page.screenshot({path: path.join(ROOT, '.local/quality-20261026/load-error-390.png')});
      }
      state.failData = null;
      await Promise.all([page.waitForEvent('load'), page.locator('#retryDatabaseLoad').click()]); await ready(page);
      assert.ok(await page.locator('#databaseLoadStatus').isHidden());
      assert.equal(await page.locator('#characterSearch').inputValue(), 'クラピカ');
      assert.equal(await page.locator('#characters').evaluate(el => el.inert), false);
      assert.ok(await page.locator('.directory-character-card[data-character-id="P14-H01"]').isVisible());
      // New-event dialog must isolate background controls and return keyboard focus.
      await page.locator('[data-primary-view="timeline"]').click();
      await page.locator('#addTimelineEvent').click();
      assert.equal(await page.locator('#detailModal').getAttribute('aria-hidden'), 'false');
      assert.equal(await page.locator('#detailModal').getAttribute('data-event-id'), '');
      assert.ok(await page.locator('#main-content').evaluate(el => el.inert));
      assert.equal(await page.evaluate(() => document.activeElement.id), 'newEvent-description');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#main-content').evaluate(el => el.inert), false);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'addTimelineEvent');
      console.log(`PASS ${width}: visible failure, recovery with query retained, responsive layout and modal focus`);
      await context.close();
    }
    // Requests that never finish must become a recoverable error, including body streaming.
    const {context, base} = await fixture(browser, {local: false});
    await context.addInitScript(() => {
      const original = AbortSignal.timeout;
      AbortSignal.timeout = ms => original(ms === 15000 ? 200 : ms);
    });
    await context.route('**/data/events.json?*', () => {});
    const stalled = await context.newPage();
    await stalled.goto(base, {waitUntil: 'domcontentloaded'});
    await stalled.locator('#retryDatabaseLoad').waitFor({timeout: 5000});
    assert.match(await stalled.locator('#databaseLoadMessage').innerText(), /読み込めませんでした/);
    await context.close();
    const nojs = await fixture(browser, {javaScriptEnabled: false, local: false});
    const fallback = await nojs.context.newPage();
    await fallback.goto(nojs.base);
    assert.ok(await fallback.locator('#characters noscript p').isVisible());
    assert.match(await fallback.locator('#characters noscript p').innerText(), /JavaScriptが無効/);
    await fallback.locator('#databaseLoadStatus a[href="characters/"]').click();
    assert.ok(await fallback.locator('h1').filter({hasText: '人物索引'}).isVisible());
    await nojs.context.close();
    console.log('PASS: timeout and no-JavaScript static fallback');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
