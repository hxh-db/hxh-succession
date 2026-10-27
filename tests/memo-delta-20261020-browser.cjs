const {chromium}=require('./helpers/isolated-browser.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root='http://127.0.0.1:8765/';
const ready=page=>page.waitForFunction(()=>viewLinksReady && !restoringReadingState);
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:844}});
   await context.addInitScript(()=>localStorage.setItem('hxh-succession-spoilers-revealed-v1','true'));
   const page=await context.newPage();const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/drafts',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({format:'hxh-succession-local-drafts',version:1,items:{},entries:[]})}));
   await page.goto(root+'?event=E386-002#timeline');await ready(page);
   assert.match(await page.locator('#modalTitle').innerText(),/カイザル/);
   assert.ok(await page.locator('#modalContent [data-character-link="JUD-001"]').count()>0);
   assert.equal(await page.locator('#modalContent [data-character-link="HA-002"]').count(),0);
   await page.goto(root+'?event=E386-008#timeline');await ready(page);
   assert.match(await page.locator('#modalTitle').innerText(),/1007号室前.*自死/);
   assert.match(await page.locator('#modalContent').innerText(),/09:46頃？/);
   await page.goto(root+'?event=E386-009#timeline');await ready(page);
   assert.match(await page.locator('#modalTitle').innerText(),/所属と認識番号/);
   assert.match(await page.locator('#modalContent').innerText(),/返答は.*描かれない/);
   await page.goto(root+'?c_search='+encodeURIComponent('オウ＝ケンイ')+'#characters');await ready(page);
   assert.match(await page.locator('.directory-character-card[data-character-id="SAA-002"] .nen-knowledge-label').innerText(),/念：確認済み/);
   await page.locator('#globalSpoilerToggle').click();
   assert.ok(await page.locator('.directory-character-card[data-character-id="SAA-002"] .nen-knowledge-label').isHidden());
   await page.locator('#globalSpoilerToggle').click();
   assert.ok(await page.locator('.directory-character-card[data-character-id="SAA-002"] .nen-knowledge-label').isVisible());
   await page.goto(root+'?t_chapter=386&t_period=all#timeline');await ready(page);
   const order=await page.evaluate(()=>getChronologicalEntries(filteredEventsData).map(entry=>entry.event.id));
   const chain=['E386-003','E386-008','E386-006','E386-009','E386-004'];
   for(let i=1;i<chain.length;i++) assert.ok(order.indexOf(chain[i-1])<order.indexOf(chain[i]));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   fs.mkdirSync('.local/notes-delta-20261020/screens',{recursive:true});
   await page.screenshot({path:`.local/notes-delta-20261020/screens/timeline-${width}.png`});
   assert.deepEqual(errors,[]);await context.close();
   console.log(`PASS ${width}: Kaiser participant link, separated death and wake scenes, approximate time, Nen badge and no horizontal overflow`);
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
