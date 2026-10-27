/* Uses Edge and the local server; intercept drafts so no personal notes are written. */
const {chromium} = require('./helpers/isolated-browser.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const width of [1280,390]) {
      const page = await browser.newPage({viewport:{width,height:844}});
      const errors = []; page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/api/drafts',route=>route.fulfill({contentType:'application/json',
        body:JSON.stringify({format:'hxh-succession-local-drafts',version:1,items:{},entries:[]})}));
      await page.goto('http://127.0.0.1:8765/?c_when=chapter-374&t_period=day-1&t_chapter=361#timeline');
      await page.locator('.schedule-event').first().waitFor({state:'attached'});
      if (await page.locator('#globalSpoilerToggle').getAttribute('aria-pressed') === 'false') {
        await page.locator('#globalSpoilerToggle').click();
      }
      const filters = await page.evaluate(()=>({person:document.getElementById('participantFilter').value,
        chapter:document.getElementById('chapterFilter').value,period:activeTimelinePeriodId}));
      const chip = page.locator('.schedule-event a[data-character-link="P14-H01"]').first();
      assert.ok((await chip.getAttribute('href')).endsWith('/characters/P14-H01/'));
      await chip.focus();
      const scrollY = await page.evaluate(()=>window.scrollY);
      await chip.press('Enter');
      await page.waitForURL('**/characters/P14-H01/');
      assert.equal(await page.locator('#modalTitle').innerText(),'クラピカ');
      assert.equal(await page.locator('#detailModal').getAttribute('data-event-id'),'');
      await page.goBack();
      await page.waitForFunction(()=>document.getElementById('detailModal').classList.contains('hidden'));
      await page.waitForFunction(top=>Math.abs(window.scrollY-top)<2,scrollY);
      assert.deepEqual(await page.evaluate(()=>({person:document.getElementById('participantFilter').value,
        chapter:document.getElementById('chapterFilter').value,period:activeTimelinePeriodId})),filters);
      await page.goForward(); await page.waitForURL('**/characters/P14-H01/');
      await page.locator('#modalClose').click();
      await page.waitForFunction(()=>document.getElementById('detailModal').classList.contains('hidden'));
      const card = page.locator('.schedule-event').filter({has:page.locator('[data-character-link="P14-H01"]')}).first();
      await card.locator(':scope > span').first().click();
      const eventId = await page.locator('#detailModal').getAttribute('data-event-id');
      assert.ok(eventId);
      const eventTitle = await page.locator('#modalTitle').innerText();
      const person = page.locator('#modalContent a[data-character-link="P14-H01"]').first();
      await person.click(); await page.waitForURL('**/characters/P14-H01/');
      await page.getByRole('button',{name:'元の出来事へ戻る',exact:true}).click();
      await page.waitForFunction(id=>document.getElementById('detailModal').dataset.eventId===id,eventId);
      assert.equal(await page.locator('#modalTitle').innerText(),eventTitle);
      assert.equal(await page.locator('#detailModal').getAttribute('aria-hidden'),'false');
      assert.equal(await page.locator('#modalContent a[data-character-link="P14-H01"]').first().evaluate(el=>el===document.activeElement),true);
      await page.goForward(); await page.waitForURL('**/characters/P14-H01/');
      await page.keyboard.press('Escape');
      await page.waitForFunction(id=>document.getElementById('detailModal').dataset.eventId===id,eventId);
      await page.locator('#modalContent a[data-character-link="P14-H01"]').first().click();
      await page.waitForURL('**/characters/P14-H01/');
      await page.getByRole('button',{name:'この人物の出来事を見る',exact:true}).click();
      await page.waitForFunction(()=>document.getElementById('detailModal').classList.contains('hidden')
        && document.getElementById('participantFilter').value==='P14-H01');
      assert.ok(page.url().includes('t_person=P14-H01'));
      await page.goto('http://127.0.0.1:8765/?event=E361-008#timeline');
      await page.waitForFunction(()=>document.getElementById('detailModal').dataset.eventId==='E361-008');
      await page.locator('#modalContent a[data-character-link="P14-H01"]').first().click();
      await page.waitForURL('**/characters/P14-H01/');
      await page.goBack();
      await page.waitForFunction(()=>document.getElementById('detailModal').dataset.eventId==='E361-008');
      assert.ok(page.url().includes('event=E361-008'));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.deepEqual(errors,[]);
      await page.close();
      console.log(`PASS: event/person links, keyboard, back/forward/close, event return, filters and mobile width ${width}`);
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
