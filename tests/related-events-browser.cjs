/* Regression: character details share the timeline chronology, not chapter order. */
const {chromium} = require('playwright');
const {spawn} = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  let server, browser;
  const port = '18771', root = `http://127.0.0.1:${port}/`;
  try {
    server = spawn('python', ['local_server.py'], {cwd: path.resolve(__dirname, '..'), windowsHide: true,
      env: {...process.env, SUCCESSION_LOCAL_PORT: port, SUCCESSION_NOTES_DIR: path.resolve(__dirname, '../.local/related-events-20261025/drafts')},
      stdio: ['ignore', 'pipe', 'ignore']});
    await new Promise((resolve, reject) => {
      server.once('error', reject); server.once('exit', code => reject(Error(`server exited ${code}`)));
      server.stdout.once('data', resolve);
    });
    browser = await chromium.launch({channel: 'msedge', headless: true});
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({viewport: {width, height: 844}});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/drafts', route => route.fulfill({contentType: 'application/json',
        body: JSON.stringify({format: 'hxh-succession-local-drafts', version: 1, items: {}, entries: []})}));
      const ready = () => page.waitForFunction(() => viewLinksReady && !restoringReadingState);
      await page.goto(root + '?c_search=' + encodeURIComponent('クラピカ') + '#characters'); await ready();
      const person = page.locator('.directory-character-card[data-character-id="P14-H01"] h3 a');
      await person.click();
      const list = page.locator('#detailModal .related-events-spoiler').filter({has: page.locator('summary', {hasText: '関連する出来事'})});
      await list.locator('summary').evaluate(element => {element.parentElement.open = true;});
      assert.ok(await list.isHidden(), 'related event headlines must remain behind the spoiler control');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('detailModal').classList.contains('hidden'));
      await page.locator('#globalSpoilerToggle').click();
      await person.click(); await list.locator('summary').click();
      const links = list.locator('.related-event-link');
      const audit = await page.evaluate(() => {
        const person = charactersData.find(p => p.id === 'P14-H01');
        const related = getRelatedEvents(person, person.type);
        const expected = getChronologicalEntries(related).map(entry => entry.event.id);
        const chapterOrder = related.slice().sort((a, b) => sortKey(a) - sortKey(b)).map(e => e.id);
        const actual = [...document.querySelectorAll('#detailModal .related-event-link')].map(link => link.dataset.eventId);
        return {expected, chapterOrder, actual};
      });
      assert.deepEqual(audit.actual, audit.expected);
      assert.notDeepEqual(audit.actual, audit.chapterOrder, 'the fixture must expose the chapter-order regression');
      assert.match(await list.locator('[data-event-id="E361-005"] .related-event-date').innerText(), /14:00$/);
      assert.match(await links.locator('.related-event-date').allTextContents().then(texts => texts.join('\n')), /頃？/);
      const preboard = links.locator('[class="related-event-date"]').filter({hasText: '乗船前'});
      for (const label of await preboard.allTextContents()) assert.doesNotMatch(label, /\d{1,2}:\d{2}/);
      assert.equal(await list.locator('p').count(), 0, 'no long descriptions or editorial notes');
      for (const link of await links.all()) assert.ok((await link.locator('span').first().getAttribute('class')).includes('related-event-date'));
      const target = links.filter({has: page.locator('.related-event-date', {hasText: '頃？'})}).first();
      await target.focus();
      const eventId = await target.getAttribute('data-event-id');
      fs.mkdirSync('.local/related-events-20261025', {recursive: true});
      await page.screenshot({path: `.local/related-events-20261025/detail-${width}.png`});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(await page.locator('#detailModal .modal-card').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await target.press('Enter');
      await page.waitForFunction(id => document.getElementById('detailModal').dataset.eventId === id, eventId);
      assert.equal(new URL(page.url()).searchParams.get('event'), eventId);
      await page.goBack(); await ready();
      assert.equal(await page.locator('#characterSearch').inputValue(), 'クラピカ');
      assert.ok(await page.locator('#characters').isVisible());
      // Approximate-clock visibility is shared with the timeline, without replacing it with 00:00.
      await page.evaluate(() => {document.getElementById('timeDisplayMode').value = 'original';});
      await person.click(); await list.locator('summary').click();
      assert.doesNotMatch((await links.locator('.related-event-date').allTextContents()).join('\n'), /頃？/);
      assert.match((await links.locator('.related-event-date').allTextContents()).join('\n'), /順序のみ/);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('detailModal').classList.contains('hidden'));
      await page.goto(root + '?c_when=chapter-374&c_search=' + encodeURIComponent('ヒュリコフ') + '#characters'); await ready();
      await page.locator('.directory-character-card[data-character-id="P01-P06"] h3 a').click();
      const chapters = await page.locator('#detailModal .related-event-chapter').allTextContents();
      assert.ok(chapters.length > 0);
      assert.ok(chapters.every(text => Number(text.match(/\d+/)[0]) <= 374), 'chapter-scoped details must not expose later events');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}: chronological order, date-first rows, approximate clocks, preboarding, spoiler/chapter scope, keyboard links and back`);
    }
  } finally {await browser?.close(); server?.kill();}
})().catch(error => {console.error(error); process.exitCode = 1;});
