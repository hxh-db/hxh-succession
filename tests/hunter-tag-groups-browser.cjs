const {chromium} = require('./helpers/isolated-browser.cjs');

const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  let browser;
  try {
    const port = '18768', root = `http://127.0.0.1:${port}/`;

    browser = await chromium.launch({channel: 'msedge', headless: true});
    for (const width of [1280, 390]) {
      const context = await browser.newContext({viewport: {width, height: 844}});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/drafts', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({format: 'hxh-succession-local-drafts', version: 1, items: {}, entries: []})}));
      const ready = () => page.waitForFunction(() => viewLinksReady && !restoringReadingState);
      await page.goto(root + '#characters'); await ready();
      await page.locator('#characterFilterToggle').click();
      const row = page.locator('[data-tag-category="ハンター"]');
      const beyond = row.locator('[data-tag-id="group-beyond-team"]');
      const kurapika = row.locator('[data-tag-id="group-kurapika-team"]');
      assert.equal(await beyond.innerText(), 'ビヨンドチーム');
      assert.equal(await kurapika.innerText(), 'クラピカチーム');
      assert.equal(await page.locator('[data-tag-category="その他所属"] [data-tag-id="group-beyond-team"]').count(), 0);
      await beyond.click();
      await page.waitForFunction(() => [...activeCharacterTags.values()].includes('group-beyond-team'));
      assert.ok(page.url().includes('group-beyond-team'));
      assert.ok(await page.locator('.directory-character-card[data-character-id="BYD-001"]').count());
      await kurapika.click();
      await page.waitForFunction(() => [...activeCharacterTags.values()].includes('group-kurapika-team') && ![...activeCharacterTags.values()].includes('group-beyond-team'));
      assert.ok(await page.locator('.directory-character-card[data-character-id="P14-H01"]').count());
      await page.reload(); await ready();
      assert.ok(await page.locator('.directory-character-card[data-character-id="P14-H01"]').count());
      assert.match(await page.locator('#characterActiveTag').innerText(), /クラピカチーム/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}: hunter-row placement, Kurapika team label, mutually exclusive filtering and stable permalink reload`);
    }
  } finally {if (browser) await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
