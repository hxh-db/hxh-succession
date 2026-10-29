const {chromium}=require('playwright'),assert=require('node:assert/strict');const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(browser,{width,local:false}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?c_search='+encodeURIComponent('クラピカ')+'&c_prince=P14#characters');await ready(page);
 const searchChip=()=>page.locator('#characterActiveTag button').filter({hasText:'検索：'}),princeChip=()=>page.locator('#characterActiveTag button').filter({hasText:'関係王子：'});
 assert.ok(await searchChip().isVisible());assert.ok(await princeChip().isVisible());await searchChip().focus();const top=await page.evaluate(()=>scrollY);await searchChip().press('Enter');
 assert.equal(await page.locator('#characterSearch').inputValue(),'');assert.equal(await page.locator('#characterPrinceFilter').inputValue(),'P14');assert.equal(await princeChip().evaluate(el=>el===document.activeElement),true);
 assert.ok(Math.abs(await page.evaluate(()=>scrollY)-top)<2);await princeChip().press('Enter');assert.equal(await page.locator('#characterPrinceFilter').inputValue(),'all');assert.equal(await page.evaluate(()=>document.activeElement.id),'characterSearch');
 await page.goto(base+'?c_search='+encodeURIComponent('クラピカ')+'&c_prince=P14#characters');await ready(page);
 await princeChip().focus();await princeChip().press('Enter');assert.equal(await searchChip().evaluate(el=>el===document.activeElement),true);assert.equal(await page.locator('#characterSearch').inputValue(),'クラピカ');
 await page.goto(base+'?c_search='+encodeURIComponent('クラピカ')+'&c_prince=P14#characters');await ready(page);await searchChip().click();
 assert.equal(await page.locator('#characterPrinceFilter').inputValue(),'P14');assert.equal(await page.evaluate(()=>document.activeElement.id==='characterSearch'||document.activeElement.closest('#characterActiveTag')!==null),false);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}: character filter keyboard next/previous/search focus, preserved conditions and pointer behaviour`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
