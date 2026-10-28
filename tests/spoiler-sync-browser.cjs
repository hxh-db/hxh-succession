const {toggleDisclosure,disclosureState}=require('./helpers/disclosure.cjs');
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
      await toggleDisclosure(main);
      const other = await context.newPage();
      other.on('pageerror', error => errors.push(error.message));
      await other.goto(base + 'characters/P14-H01/');
      assert.equal(await disclosureState(other), 'true');
      const article = await context.newPage(); await article.goto(base + 'theories/Q001/');
      assert.ok(await article.locator('.spoiler-article').evaluate(el => el.open));
      await main.locator('.directory-character-card h3 a').first().click();
      await main.waitForURL('**/characters/P14-H01/');
      await toggleDisclosure(other);
      await main.waitForFunction(() => (document.getElementById('spoilerRange').value==='all'?'true':'false') === 'false');
      await main.waitForFunction(() => !CharacterRoutes.isActive() && location.hash === '#characters');
      await main.waitForFunction(() => !document.getElementById('main-content').inert);
      assert.equal(await main.locator('#detailModal').getAttribute('aria-hidden'), 'true');
      assert.equal(await main.locator('body').evaluate(el => el.classList.contains('modal-open')), false);
      assert.equal(await main.locator('#characterSearch').inputValue(), 'クラピカ');
      await article.waitForFunction(() => !document.querySelector('.spoiler-article').open);
      // Propagate in the opposite direction and close enlarged images when hiding.
      await toggleDisclosure(main);
      await other.waitForFunction(() => (document.getElementById('spoilerRange').value==='all'?'true':'false') === 'true');
      await article.waitForFunction(() => document.querySelector('.spoiler-article').open);
      await other.locator('.zoomable-image[data-zoom-src]').first().click();
      assert.ok(await other.locator('#imageLightbox').evaluate(el => el.open));
      await toggleDisclosure(main);
      await other.waitForFunction(() => !document.getElementById('imageLightbox').open);
      // An unsaved event-creation form is independent of spoiler disclosure.
      await toggleDisclosure(main);
      await main.locator('[data-primary-view="timeline"]').click();
      await main.locator('#addTimelineEvent').click();
      await main.locator('#newEvent-description').fill('入力中の内容');
      await other.waitForFunction(() => (document.getElementById('spoilerRange').value==='all'?'true':'false') === 'true');
      await toggleDisclosure(other);
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
