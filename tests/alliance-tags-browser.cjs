const {toggleDisclosure}=require('./helpers/disclosure.cjs');
const {chromium} = require('./helpers/isolated-browser.cjs');

const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  let browser;
  try {
    const port = '18769', root = `http://127.0.0.1:${port}/`;

    browser = await chromium.launch({channel: 'msedge', headless: true});
    for (const width of [1280, 390]) {
      const context = await browser.newContext({viewport: {width, height: 844}});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/drafts', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({format: 'hxh-succession-local-drafts', version: 1, items: {}, entries: []})}));
      await page.goto(root + '?c_group=princes#characters');
      await page.waitForFunction(() => viewLinksReady && !restoringReadingState);
      const kacho = page.locator('.directory-character-card[data-character-id="P10"]');
      const fugetsu = page.locator('.directory-character-card[data-character-id="P11"]');
      assert.equal(await kacho.locator('.character-alliance-badge:visible').count(), 0, 'hidden spoilers must remain hidden');
      await toggleDisclosure(page);
      assert.deepEqual(await kacho.locator('.character-alliance-badge').allTextContents(), ['共闘', '第11王子フウゲツ']);
      assert.deepEqual(await fugetsu.locator('.character-alliance-badge').allTextContents(), ['共闘', '第10王子カチョウ']);
      assert.equal(await kacho.locator('.character-alliance-role').count(), 1);
      assert.equal(await kacho.locator('.character-alliance-partner').count(), 1);
      assert.ok(!(await kacho.locator('.character-alliance-badge').allTextContents()).some(text => /→|・/.test(text)));
      await kacho.locator('h3 a').click();
      await page.locator('#detailModal:not(.hidden)').waitFor();
      await page.locator('#modalClose').click();
      await page.waitForFunction(() => document.getElementById('detailModal').classList.contains('hidden'));
      assert.deepEqual(await kacho.locator('.character-alliance-badge').allTextContents(), ['共闘', '第11王子フウゲツ']);
      await toggleDisclosure(page);
      assert.equal(await kacho.locator('.character-alliance-badge:visible').count(), 0);
      assert.equal(await fugetsu.locator('.character-alliance-badge:visible').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}: separate relation/partner badges in both directions, shared spoiler safety and modal round-trip`);
    }
  } finally {if (browser) await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
