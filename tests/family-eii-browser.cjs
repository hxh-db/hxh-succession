const {chromium}=require('./helpers/isolated-browser.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [1280,390]) {
   const page=await browser.newPage({viewport:{width,height:844}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/drafts',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({format:'hxh-succession-local-drafts',version:1,items:{},entries:[]})}));
   await page.goto('http://127.0.0.1:8765/?c_tags=mafia-family-%E3%82%A8%E3%82%A4%EF%BC%9D%E3%82%A4%E4%B8%80%E5%AE%B6#characters');
   await page.waitForFunction(()=>document.querySelectorAll('.directory-character-card').length===23);
   assert.match(await page.locator('#characterResultSummary').innerText(),/23人/);
   for(const id of ['EII-U01','EII-U02']) {
    const card=page.locator(`.directory-character-card[data-character-id="${id}"]`);
    assert.equal(await card.count(),1);
    assert.ok(await card.locator('.avatar-zoomable').count());
   }
   const morena=page.locator('.directory-character-card[data-character-id="EII-001"]');
   assert.ok(!(await morena.innerText()).includes('親子（名義上）'));
   await page.locator('#globalSpoilerToggle').click();
   await page.waitForFunction(()=>document.getElementById('globalSpoilerToggle').getAttribute('aria-pressed')==='true');
   assert.match(await morena.innerText(),/親子（名義上）/);
   assert.match(await morena.innerText(),/ホイコーロ国王/);
   await morena.locator('h3 a').click();
   assert.match(await page.locator('#modalContent').innerText(),/第378話.*第408話/);
   await page.locator('#modalContent a[data-character-link="KNG-001"]').click();
   assert.match(await page.locator('#modalTitle').innerText(),/ホイコーロ国王/);
   assert.match(await page.locator('#modalContent').innerText(),/親子（名義上）.*モレナ/s);
   await page.locator('#modalClose').click();
   await page.waitForFunction(()=>document.getElementById('detailModal').classList.contains('hidden'));
   await page.locator('#characterSearch').fill('');
   await page.goto('http://127.0.0.1:8765/?c_search=%E3%82%AA%E3%83%8B%E3%82%AA%E3%83%BC%E3%83%AB#characters');
   await page.locator('.directory-character-card[data-character-id="SWU-001"]').waitFor();
   const oni=page.locator('.directory-character-card[data-character-id="SWU-001"]');
   const siblings=oni.locator('.character-blood-chain').filter({has:page.getByRole('button',{name:'兄弟',exact:true})});
   assert.equal(await siblings.count(),1);
   assert.equal(await siblings.getByRole('button',{name:'ホイコーロ国王',exact:true}).count(),1);
   const brocco=siblings.getByRole('button',{name:'ブロッコ',exact:true});
   assert.equal(await brocco.count(),1);
   assert.match(await brocco.getAttribute('title'),/母親の同異は未確認/);
   assert.match(await oni.innerText(),/親子/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(errors,[]);
   await page.close();
   console.log(`PASS: 23-member filter, unnamed avatars, split family tags, nominal links, spoiler safety and width ${width}`);
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
