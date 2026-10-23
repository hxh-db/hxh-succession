const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const ready=page=>page.waitForFunction(()=>viewLinksReady && !restoringReadingState);
(async()=>{
 let server,browser;
 try {
  const port='18767';
  server=spawn('python',['local_server.py'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,SUCCESSION_LOCAL_PORT:port,SUCCESSION_NOTES_DIR:path.resolve(__dirname,'../.local/contextual-tags/drafts')},stdio:['ignore','pipe','ignore']});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.once('exit',code=>reject(Error(`test server exited: ${code}`)));server.stdout.once('data',resolve);});
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const width of [1366,390]) {
   const context=await browser.newContext({viewport:{width,height:900}});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/drafts',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({format:'hxh-succession-local-drafts',version:1,items:{},entries:[]})}));
   await page.goto(`http://127.0.0.1:${port}/`);await ready(page);
   await page.locator('#characterFilterToggle').click();
   // Compare availability with actual clicks, including hidden options, instead of duplicating filter logic.
   const checkOptions=async label=>{
    const result=await page.evaluate(()=>{
     const base=location.href;
     const selector='#characterFilterPanel button[data-tag-id], #characterCampNav button, #characterPrinceNav button';
     const buttons=[...document.querySelectorAll(selector)].filter(b=>spoilersRevealed || !b.closest('#characterSpoilerTagRows'));
     const failures=[];
     for(const button of buttons) {
      const hidden=button.hidden, selected=button.getAttribute('aria-pressed')==='true';
      button.click();
      const count=currentCharacterResults.length;
      if(!selected && hidden!==(count===0)) failures.push({tag:button.dataset.tagId||button.dataset.groupId||button.dataset.princeId,hidden,count});
      if(!hidden && count===0) failures.push({visibleButEmpty:button.textContent});
      restoreViewFromUrl(new URL(base));
     }
     return {failures,checked:buttons.length};
    });
    assert.deepEqual(result.failures,[],`${label} at ${width}`);
    assert.ok(result.checked>25);
    console.log(`PASS ${width} ${label}: ${result.checked} candidate clicks match visibility`);
   };
   await page.locator('#characterPrinceNav [data-prince-id="P14"]').click();
   await page.locator('#characterCampNav [data-group-id="hunter"]').click();
   await page.locator('[data-tag-id="initial-room-1014"]').click();
   await checkOptions('prince + category + room');
   const selectedRoom=page.locator('#characterFilterPanel [data-tag-id="initial-room-1014"]');
   assert.ok(await selectedRoom.isVisible());
   const before=await page.locator('#characterFilterPanel button[data-tag-id]:visible').count();
   await page.locator('#clearCharacterFilters').click();
   assert.ok(await page.locator('#characterFilterPanel button[data-tag-id]:visible').count()>before,'clear restores options');
   await page.locator('#characterSearch').fill('クラピカ');
   await checkOptions('search');
   const hiddenPrinces=page.locator('#characterPrinceNav button[hidden]');
   assert.ok(await hiddenPrinces.count()>0);
   assert.equal(await hiddenPrinces.first().isVisible(),false,'hidden prince buttons must not retain CSS display:flex');
   await page.locator('#clearCharacterFilters').click();
   const queen=page.locator('#characterFilterPanel [data-tag-id="affiliation-q03-guards"]');
   await queen.click();
   assert.equal(await queen.getAttribute('aria-pressed'),'true');
   await checkOptions('queen roster');
   await page.reload();await ready(page);
   assert.ok(await queen.isVisible());
   assert.equal(await queen.getAttribute('aria-pressed'),'true');
   await page.locator('#clearCharacterFilters').click();
   await page.locator('#globalSpoilerToggle').click();
   await page.locator('#characterFilterPanel [data-tag-id="relation-parent-child"]').click();
   await page.locator('#characterFilterPanel [data-tag-id="relation-siblings"]').click();
   await page.locator('#characterCampNav [data-group-id="mafia"]').click();
   await checkOptions('combined family + category');
   await page.locator('#characterSearch').fill('存在しない検索語123');
   assert.equal(await page.locator('.directory-character-card').count(),0);
   assert.ok(await page.locator('#characterFilterPanel [data-tag-id="relation-parent-child"]').isVisible());
   assert.ok(await page.locator('#characterFilterPanel [data-tag-id="relation-siblings"]').isVisible());
   assert.ok(await page.locator('#clearCharacterFilters').isEnabled());
   await page.locator('#clearCharacterFilters').click();
   assert.equal(await page.locator('.directory-character-card').count(),60);
   await page.locator('#characterFilterPanel [data-tag-id="name-unnamed"]').click();
   await page.locator('#characterFilterPanel [data-tag-id="name-known"]').click();
   assert.ok(await page.evaluate(()=>currentCharacterResults.length>0 && activeCharacterTags.get('名前')==='name-known'),'same-row replacement stays available');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(errors,[]);
   fs.mkdirSync('.local/contextual-tags',{recursive:true});
   await page.screenshot({path:`.local/contextual-tags/${width}.png`});
   await context.close();
  }
 } finally {await browser?.close();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
