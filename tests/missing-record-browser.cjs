const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {fixture, ready} = require('./helpers/browser-fixture.cjs');
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1280, 390, 320]) {
      const {context, base} = await fixture(browser, {local: false, width, prefix: '/hxh-succession'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const [query, message, hash] of [
        ['event=LOCAL-other-browser&t_chapter=361', /保存したPC／ブラウザ/, 'timeline'],
        ['event=E999-999&t_chapter=361', /リンク先の出来事が見つかりません/, 'timeline'],
        ['person=MISSING&c_search=' + encodeURIComponent('クラピカ'), /リンク先の人物が見つかりません/, 'characters']
      ]) {
        await page.goto(base + '?' + query + '#' + hash); await ready(page);
        assert.ok(await page.locator('#recordLinkStatus').isVisible());
        assert.match(await page.locator('#recordLinkMessage').innerText(), message);
        assert.ok(await page.locator('#detailModal').isHidden());
        assert.equal(await page.locator('#globalSpoilerToggle').getAttribute('aria-pressed'), 'false');
        await page.locator('#clearRecordLink').click(); await ready(page);
        assert.ok(await page.locator('#recordLinkStatus').isHidden());
        const url = new URL(page.url());
        assert.equal(url.searchParams.has('event'), false); assert.equal(url.searchParams.has('person'), false);
        if (hash === 'timeline') assert.equal(await page.locator('#chapterFilter').inputValue(), '361');
        else assert.equal(await page.locator('#characterSearch').inputValue(), 'クラピカ');
        await page.goBack(); await ready(page);
        assert.ok(await page.locator('#recordLinkStatus').isVisible(), 'history must restore the missing-link explanation');
        await page.goForward(); await ready(page);
        assert.ok(await page.locator('#recordLinkStatus').isHidden());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
      await page.goto(base + '?event=LOCAL-other-browser#timeline'); await ready(page);
      await page.locator('[data-primary-view="guide"]').click();
      assert.ok(await page.locator('#recordLinkStatus').isHidden(), 'navigation must clear stale link errors');
      await page.goto(base + '?event=E383-004#timeline'); await ready(page);
      assert.ok(await page.locator('#recordLinkStatus').isHidden(), 'valid links must retain the normal spoiler gate');
      await page.locator('[data-primary-view="characters"]').click();
      assert.ok(await page.locator('#recordLinkStatus').isHidden());
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: missing personal/public event and person, useful recovery, retained filters, history and hidden spoilers`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
