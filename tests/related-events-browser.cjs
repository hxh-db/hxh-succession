/* Regression: character details share the timeline chronology, not chapter order. */
const {chromium} = require('./helpers/isolated-browser.cjs');

const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  let browser;
  const port = '18771', root = `http://127.0.0.1:${port}/`;
  try {

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
      const list = page.locator('#detailModal .modal-person-timeline');
      assert.ok(await list.isHidden(), 'related event headlines must remain behind the spoiler control');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('detailModal').classList.contains('hidden'));
      await page.locator('#globalSpoilerToggle').click();
      await person.click();
      assert.ok(await list.isVisible(), 'timeline must already be expanded when the person opens');
      assert.equal(await list.locator('summary').count(), 0, 'no extra related-events disclosure');
      assert.equal(await list.locator('.chronological-axis').count(), 1);
      const links = list.locator('.schedule-event');
      const audit = await page.evaluate(() => {
        const person = charactersData.find(p => p.id === 'P14-H01');
        const related = getRelatedEvents(person, person.type);
        const expected = getChronologicalEntries(related).map(entry => entry.event.id);
        const chapterOrder = related.slice().sort((a, b) => sortKey(a) - sortKey(b)).map(e => e.id);
        const actual = [...document.querySelectorAll('#detailModal .modal-person-timeline .schedule-event')].map(link => link.dataset.eventId);
        return {expected, chapterOrder, actual};
      });
      assert.deepEqual(audit.actual, audit.expected);
      assert.notDeepEqual(audit.actual, audit.chapterOrder, 'the fixture must expose the chapter-order regression');
      assert.match(await list.locator('[data-event-id="E361-005"]').evaluate(el => el.closest('.chronological-row').querySelector('.chronological-time').textContent), /14:00$/);
      assert.match((await list.locator('.chronological-time').allTextContents()).join('\n'), /頃？/);
      const preboard = list.locator('.chronological-time').filter({hasText: '乗船前'});
      for (const label of await preboard.allTextContents()) assert.doesNotMatch(label, /\d{1,2}:\d{2}/);
      assert.ok(!(await list.innerText()).includes('整合性点検'), 'no editorial notes in event cards');
      const target = list.locator('.chronological-row.time-estimated .schedule-event').first();
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
      await page.locator('[data-primary-view="timeline"]').click();
      await page.locator('.timeline-view-tab[data-view="chapters"]').click();
      const chapter402 = page.locator('.chapter-group').filter({has: page.locator('summary').filter({hasText: '第402話'})});
      await chapter402.locator('summary').click();
      assert.match((await chapter402.locator('.schedule-event-time').allTextContents()).join('\n'), /07:55頃？/,
        'chapter view must show the estimated time used by the schedule view');
      await page.evaluate(() => {const select=document.getElementById('timeDisplayMode'); select.value='original'; select.dispatchEvent(new Event('change', {bubbles:true}));});
      assert.ok((await chapter402.locator('.schedule-event-time').allTextContents()).includes('順序のみ（仮時刻を非表示）'),
        'chapter view must respect the approximate-time display setting');
      await page.locator('[data-primary-view="characters"]').click();
      // Approximate-clock visibility is shared with the timeline, without replacing it with 00:00.
      await page.evaluate(() => {document.getElementById('timeDisplayMode').value = 'original';});
      await person.click();
      assert.doesNotMatch((await list.locator('.chronological-time').allTextContents()).join('\n'), /頃？/);
      assert.match((await list.locator('.chronological-time').allTextContents()).join('\n'), /順序のみ/);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('detailModal').classList.contains('hidden'));
      await page.goto(root + '?c_when=chapter-374&c_search=' + encodeURIComponent('ヒュリコフ') + '#characters'); await ready();
      await page.locator('.directory-character-card[data-character-id="P01-P06"] h3 a').click();
      const chapters = await list.locator('.schedule-event-chapter').allTextContents();
      assert.ok(chapters.length > 0);
      assert.ok(chapters.every(text => Number(text.match(/\d+/)[0]) <= 374), 'chapter-scoped details must not expose later events');
      await page.goto(root + '?event=E402-007#timeline'); await ready();
      assert.match(await page.locator('#modalContent').innerText(), /07:55頃？/);
      await page.goto(root + '?c_search=' + encodeURIComponent('ギャトーム') + '#characters'); await ready();
      await page.locator('.directory-character-card[data-character-id="EII-U02"] h3 a').click();
      assert.match(await page.locator('#modalContent').innerText(), /人物の同定は暫定/);
      assert.ok(await list.isVisible());
      await page.goto(root + 'theories/Q005/');
      await page.locator('.spoiler-article').evaluate(el => {el.open = true;});
      assert.match(await page.locator('#theory').innerText(), /考察/);
      assert.equal(await page.locator('.spoiler-article table tbody tr').count(), 3);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}: chronological order, date-first rows, approximate clocks, preboarding, spoiler/chapter scope, keyboard links and back`);
    }
  } finally {await browser?.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
