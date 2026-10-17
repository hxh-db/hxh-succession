const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/drafts',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({format:'hxh-succession-local-drafts',version:1,items:{},entries:[]})}));
  for (const [id,title] of [['E361-001','サイールドによる3名の殺害'],['E361-007','クラピカがサイールドを拘束し、裏窓を奪う']]) {
   await page.goto(`http://127.0.0.1:8765/?event=${id}#timeline`);
   await page.waitForFunction(()=>!document.getElementById('detailModal').classList.contains('hidden'));
   assert.equal(await page.locator('#modalTitle').innerText(),title);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await page.goto('http://127.0.0.1:8765/characters/KNG-001/');
  assert.match(await page.locator('h1').innerText(),/ホイコーロ国王/);
  assert.doesNotMatch(await page.locator('body').innerText(),/ナスビー/);
  for (const [id,day,time] of [['E374-001','2日目','13:25頃？'],['E374-002','3日目','01:27'],['E359-005','1日目','12:45頃？'],['E359-006','1日目','12:45頃？']]) {
   await page.goto(`http://127.0.0.1:8765/?event=${id}#timeline`);
   await page.waitForFunction(()=>!document.getElementById('detailModal').classList.contains('hidden'));
   const fields=await page.locator('#modalContent .detail-list dt').evaluateAll(items=>Object.fromEntries(items.map(el=>[el.textContent,el.nextElementSibling.textContent])));
   assert.ok(fields['日'].includes(day));
   assert.ok(fields['時刻'].includes(time));
  }
  await page.goto('http://127.0.0.1:8765/?event=E361-008#timeline');
  await page.waitForFunction(()=>!document.getElementById('detailModal').classList.contains('hidden'));
  assert.equal(await page.locator('#modalTitle').innerText(),'クラピカの緋の目が黒目に戻る');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: split event direct links, mobile modal, king static display, no draft writes or JS errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
