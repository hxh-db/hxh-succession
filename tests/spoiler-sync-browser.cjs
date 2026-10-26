const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {fixture, ready} = require('./helpers/browser-fixture.cjs');
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1280, 390]) {
      const {context, base} = await fixture(browser, {width, local: false, prefix: '/hxh-succession'});
      const main = await context.newPage(), errors = [];
      main.on('pageerror', error => errors.push(error.message));
      await main.goto(base + '?c_search=' + encodeURIComponent('クラピカ') + '#characters'); await ready(main);
      await main.locator('#globalSpoilerToggle').click();
      const other = await context.newPage();
      other.on('pageerror', error => errors.push(error.message));
      await other.goto(base + 'characters/P14-H01/');
      assert.equal(await other.locator('#pageSpoilerToggle').getAttribute('aria-pressed'), 'true');
      const article = await context.newPage(); await article.goto(base + 'theories/Q001/');
      assert.ok(await article.locator('.spoiler-article').evaluate(el => el.open));
      await main.locator('.directory-character-card h3 a').first().click();
      await main.waitForURL('**/characters/P14-H01/');
      await other.locator('#pageSpoilerToggle').click();
      await main.waitForFunction(() => document.getElementById('globalSpoilerToggle').getAttribute('aria-pressed') === 'false');
      await main.waitForFunction(() => !CharacterRoutes.isActive() && location.hash === '#characters');
      await main.waitForFunction(() => !document.getElementById('main-content').inert);
      assert.equal(await main.locator('#detailModal').getAttribute('aria-hidden'), 'true');
      assert.equal(await main.locator('body').evaluate(el => el.classList.contains('modal-open')), false);
      assert.equal(await main.locator('#characterSearch').inputValue(), 'クラピカ');
      await article.waitForFunction(() => !document.querySelector('.spoiler-article').open);
      // Propagate in the opposite direction and close enlarged images when hiding.
      await main.locator('#globalSpoilerToggle').click();
      await other.waitForFunction(() => document.getElementById('pageSpoilerToggle').getAttribute('aria-pressed') === 'true');
      await article.waitForFunction(() => document.querySelector('.spoiler-article').open);
      await other.locator('.zoomable-image[data-zoom-src]').first().click();
      assert.ok(await other.locator('#imageLightbox').evaluate(el => el.open));
      await main.locator('#globalSpoilerToggle').click();
      await other.waitForFunction(() => !document.getElementById('imageLightbox').open);
      // An unsaved event-creation form is independent of spoiler disclosure.
      await main.locator('#globalSpoilerToggle').click();
      await main.locator('[data-primary-view="timeline"]').click();
      await main.locator('#addTimelineEvent').click();
      await main.locator('#newEvent-description').fill('入力中の内容');
      await other.waitForFunction(() => document.getElementById('pageSpoilerToggle').getAttribute('aria-pressed') === 'true');
      await other.locator('#pageSpoilerToggle').click();
      await main.waitForFunction(() => !spoilersRevealed);
      assert.ok(await main.locator('#newEvent-description').isVisible());
      assert.equal(await main.locator('#newEvent-description').inputValue(), '入力中の内容');
      await main.keyboard.press('Escape');
      assert.equal(await main.locator('#main-content').evaluate(el => el.inert), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: main/static/article sync, modal history cleanup, image hiding and unsaved form preserved`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
