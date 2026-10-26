const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {fixture, ready} = require('./helpers/browser-fixture.cjs');
const events = require('../data/events.json');
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1280, 390, 320]) {
      const {context, base} = await fixture(browser, {width, local: false, prefix: '/hxh-succession'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const event = events.find(event => event.id === 'E382-002');
      const linked = base + '?event=' + event.id + '&from_theory=halkenburg-four-days#timeline';
      await page.goto(linked); await ready(page);
      assert.ok(await page.locator('#detailModal').isHidden(), 'direct links must respect the hidden spoiler setting');
      assert.equal(await page.locator('#globalSpoilerToggle').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('#chapterFilter').inputValue(), String(event.chapter));
      assert.match(await page.locator('#timelineSpoilerGate p').innerText(), /リンク先は第382話/);
      assert.ok(!(await page.locator('body').innerText()).includes(event.title));
      await page.locator('#timelineSpoilerGate button').click();
      await page.locator('#detailModal:not(.hidden)').waitFor();
      assert.equal(await page.locator('#detailModal').getAttribute('data-event-id'), event.id);
      const returnLink = page.locator('.event-theory-return');
      assert.ok((await returnLink.getAttribute('href')).endsWith('/theories/halkenburg-four-days/#evidence'));
      // Hide spoilers from another page while a person is open over the linked event.
      const person = page.locator('#modalContent [data-character-link]').first();
      await person.click();
      await page.waitForFunction(() => CharacterRoutes.isActive());
      const other = await context.newPage();
      await other.goto(base + 'characters/P14/');
      await other.locator('#pageSpoilerToggle').click();
      await page.waitForFunction(() => !spoilersRevealed && !CharacterRoutes.isActive());
      assert.ok(await page.locator('#detailModal').isHidden(), 'returning to the event must not reveal it again');
      assert.equal(await page.locator('#detailModal').getAttribute('aria-hidden'), 'true');
      assert.equal(await page.locator('#main-content').evaluate(el => el.inert), false);
      assert.ok(await page.locator('#timelineSpoilerGate').isVisible());
      await page.locator('#timelineSpoilerGate button').click();
      await page.locator('#detailModal:not(.hidden)').waitFor();
      await page.reload(); await ready(page);
      assert.equal(await page.locator('#detailModal').getAttribute('data-event-id'), event.id);
      assert.ok(await page.locator('#detailModal').isVisible(), 'already-revealed direct links still open the event');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: direct links gated, explicit reveal, article return, nested history hiding and revealed reload`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
