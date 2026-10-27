const {chromium} = require('./helpers/isolated-browser.cjs');
const assert = require('node:assert/strict');
(async()=>{
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const width of [1280,390]) {
      const page = await browser.newPage({viewport:{width,height:844}});
      await page.addInitScript(() => localStorage.setItem('hxh-succession-spoilers-revealed-v1', 'true'));
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/api/drafts',route=>route.fulfill({contentType:'application/json',
        body:JSON.stringify({format:'hxh-succession-local-drafts',version:1,items:{},entries:[]})}));
      const open=async id=>{
        await page.goto(`http://127.0.0.1:8765/?event=${id}#timeline`);
        await page.waitForFunction(value=>document.getElementById('detailModal').dataset.eventId===value,id);
      };
      await open('E371-001');
      assert.match(await page.locator('#modalTitle').innerText(),/^ハシトウがロベリーを拘束/);
      assert.equal(await page.locator('#modalContent a[data-character-link="P03-P03"]').count(),1);
      await open('E372-003');
      assert.equal(await page.locator('#modalTitle').innerText(),'ハンゾーがタフディーを殺害する');
      assert.match(await page.locator('#modalContent').innerText(),/本当に薬を使ったかは確認できない/);
      assert.match(await page.locator('#modalContent').textContent(),/死亡の瞬間.*直接描写はない/);
      await open('E373-002');
      assert.match(await page.locator('#modalTitle').innerText(),/私物の焼却を命じる/);
      await open('E375-002');
      assert.equal(await page.locator('#modalTitle').innerText(),'シカクがハルケンブルグの守護霊獣を分析する');
      for (const [id,time] of [['E374-005','01:30頃？'],['E375-007','07:30頃？'],['E375-009','07:00頃？']]) {
        await open(id);
        const when=await page.locator('#modalContent .detail-list dt').evaluateAll(items=>items.find(el=>el.textContent==='日時').nextElementSibling.textContent);
        assert.ok(when.includes(time),`${id}: ${when}`);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      }
      const order=await page.evaluate(()=>getChronologicalEntries(eventsData).map(entry=>entry.event.id));
      assert.ok(!order.includes('E372-009'));
      assert.ok(order.indexOf('E373-006')<order.indexOf('E373-005'));
      assert.ok(order.indexOf('E373-005')<order.indexOf('E373-007'));
      assert.ok(order.indexOf('E375-005')<order.indexOf('E375-007'));
      assert.ok(order.indexOf('E375-007')<order.indexOf('E375-006'));
      await page.goto('http://127.0.0.1:8765/characters/P12-Q05/');
      assert.doesNotMatch(await page.locator('body').textContent(),/最終ページが未提供/);
      assert.match(await page.locator('body').textContent(),/殺害/);
      assert.deepEqual(errors,[]);
      await page.close();
      console.log(`PASS: note corrections, named people, speech limits, approximate times and source order at width ${width}`);
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
