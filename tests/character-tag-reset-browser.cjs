const {chromium} = require('./helpers/isolated-browser.cjs');

const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  let browser;
  try {
    const port = '18770', root = `http://127.0.0.1:${port}/`;

    browser = await chromium.launch({channel: 'msedge', headless: true});
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({viewport: {width, height: 844}});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/drafts', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({format: 'hxh-succession-local-drafts', version: 1, items: {}, entries: []})}));
      const ready = () => page.waitForFunction(() => viewLinksReady && !restoringReadingState);
      await page.goto(root + '#characters'); await ready();
      const reset = page.locator('#resetCharacterTags');
      assert.ok(await reset.isVisible());
      assert.ok(await reset.isDisabled());
      assert.ok(await page.locator('#characterFilterPanel').isHidden());
      await page.locator('#characterSearch').fill('クラピカ');
      assert.ok(await reset.isDisabled(), 'search alone must not enable tag reset');
      await page.goto(root + '?c_tags=group-kurapika-team&c_prince=P14&c_type=hunter&c_search=' + encodeURIComponent('クラピカ') + '&c_view=table#characters'); await ready();
      assert.ok(await reset.isEnabled());
      const savedMemo = JSON.stringify({version: 1, items: {'guide:soemonoTitle': {memo: 'isolated test note', updatedAt: new Date().toISOString()}}});
      await page.evaluate(value => localStorage.setItem('hxh-succession-local-drafts-v1', value), savedMemo);
      await reset.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => activeCharacterTags.size === 0 && document.getElementById('characterPrinceFilter').value === 'all');
      assert.equal(await page.locator('#characterSearch').inputValue(), 'クラピカ');
      assert.equal(await page.locator('#characterTypeFilter').inputValue(), 'all');
      assert.equal(await page.locator('#characterViewTable').getAttribute('aria-pressed'), 'true');
      assert.ok(await page.locator('#characterFilterPanel').isHidden());
      assert.ok(await reset.isDisabled());
      assert.equal(await page.evaluate(() => localStorage.getItem('hxh-succession-local-drafts-v1')), savedMemo);
      const params = new URL(page.url()).searchParams;
      for (const name of ['c_tags', 'c_type', 'c_prince']) assert.equal(params.get(name), null);
      assert.equal(params.get('c_search'), 'クラピカ');
      assert.equal(params.get('c_view'), 'table');
      await page.reload(); await ready();
      assert.ok(await reset.isDisabled());
      assert.equal(await page.locator('#characterSearch').inputValue(), 'クラピカ');
      await page.goto(root + '?c_group=personnel&c_when=chapter-374&c_queen=1&c_prince=P14#characters'); await ready();
      await reset.click();
      assert.equal(await page.locator('#characterQueenFilter').inputValue(), 'all');
      assert.equal(await page.locator('#characterPeriodFilter').inputValue(), 'chapter-374');
      assert.ok(await reset.isDisabled());
      await page.locator('#clearCharacterFilters').click();
      assert.equal(await page.locator('#characterPeriodFilter').inputValue(), 'all');
      assert.equal(await page.locator('#characterSearch').inputValue(), '');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok((await reset.boundingBox()).height >= 44);
      fs.mkdirSync('.local/tag-reset-20261024', {recursive: true});
      await page.screenshot({path: `.local/tag-reset-20261024/top-${width}.png`});
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}: always-visible reset, keyboard, tags/royal/category cleared, query/time/view/memos retained, URL reload and full reset`);
    }
  } finally {if (browser) await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
