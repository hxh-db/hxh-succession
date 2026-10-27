const {chromium} = require('./helpers/isolated-browser.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ready = page => page.waitForFunction(() => viewLinksReady && !restoringReadingState);
const base = 'http://127.0.0.1:8765/';
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({viewport: {width, height: 844}});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/drafts', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({format: 'hxh-succession-local-drafts', version: 1, items: {}, entries: []})}));
      await page.goto(base + '?c_tags=' + encodeURIComponent('mafia-family-シャ＝ア一家') + '#characters');
      await ready(page);
      assert.equal(await page.locator('.directory-character-card').count(), 13);
      assert.match(await page.locator('#characterResultSummary').innerText(), /13人/);
      for (const id of ['SAA-005', 'SAA-006', 'SAA-U01', 'SAA-U07']) {
        const card = page.locator(`.directory-character-card[data-character-id="${id}"]`);
        assert.equal(await card.count(), 1);
        await card.scrollIntoViewIfNeeded();
        await card.locator('img').first().evaluate(img => img.decode());
        assert.equal(await card.locator('img').first().evaluate(img => img.complete && img.naturalWidth > 0), true);
      }
      assert.equal(await page.locator('.directory-character-card[data-character-id="EII-007"]').count(), 0);
      await page.locator('#characterSearch').fill('ツドンケ');
      const card = page.locator('.directory-character-card[data-character-id="SAA-005"]');
      await page.locator('#globalSpoilerToggle').click();
      await card.locator('h3 a').click();
      await page.locator('#detailModal:not(.hidden)').waitFor();
      assert.match(await page.locator('#modalContent').innerText(), /色紙|サイン/);
      assert.match(await page.locator('#modalContent').innerText(), /舎弟頭/);
      assert.ok(page.url().includes('characters/SAA-005'));
      await page.locator('#modalClose').click();
      await page.waitForFunction(() => document.getElementById('detailModal').classList.contains('hidden'));
      assert.equal(await page.locator('#characterSearch').inputValue(), 'ツドンケ');
      await page.goto(base + '?event=E380-002#timeline'); await ready(page);
      await page.locator('#modalContent [data-character-link="SAA-005"]').click();
      assert.match(await page.locator('#modalTitle').innerText(), /ツドンケ/);
      await page.goto(base + '?c_search=' + encodeURIComponent('タッシ') + '#characters'); await ready(page);
      assert.equal(await page.locator('.directory-character-card[data-character-id="EII-007"]').count(), 1);
      await page.goto(base + '?c_tags=' + encodeURIComponent('mafia-family-エイ＝イ一家') + '#characters'); await ready(page);
      assert.equal(await page.locator('.directory-character-card').count(), 23);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const direct = await context.newPage();
      await direct.goto(base + 'characters/SAA-005/');
      assert.match(await direct.locator('h1').innerText(), /ツドンケ/);
      assert.equal(await direct.locator('link[rel="canonical"]').getAttribute('href'), 'https://hxh-db.github.io/hxh-succession/characters/SAA-005/');
      await direct.close();
      await page.goto(base + '?c_tags=' + encodeURIComponent('mafia-family-シャ＝ア一家') + '#characters'); await ready(page);
      fs.mkdirSync('.local/mafia-additions-20261021/screens', {recursive: true});
      await page.screenshot({path: `.local/mafia-additions-20261021/screens/mafia-${width}.png`});
      assert.deepEqual(errors, []);
      const nojs = await browser.newContext({javaScriptEnabled: false});
      const staticPage = await nojs.newPage();
      await staticPage.goto(base + 'characters/SAA-005/');
      assert.match(await staticPage.locator('h1').innerText(), /ツドンケ/);
      await staticPage.locator('details.character-page-spoilers > summary').click();
      assert.match(await staticPage.locator('body').innerText(), /舎弟頭/);
      await nojs.close();
      await context.close();
      console.log(`PASS ${width}: 13-member Cha-R filter, named/unnamed portraits, search/modal/history, event participant, stable Tasshi, original 23, direct/no-JS page`);
    }
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
