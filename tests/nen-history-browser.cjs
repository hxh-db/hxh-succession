const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [1280,390]){
  const {context,base}=await fixture(browser,{local:false,width,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>localStorage.setItem('hxh-succession-spoilers-revealed-v1','true'));
  const open=async(chapter,query)=>{await page.goto(base+`?c_group=personnel&c_when=chapter-${chapter}&c_search=${encodeURIComponent(query)}#characters`);await ready(page);};
  for(const [name,id,before,after,word] of [['ビル','P14-H02',387,388,'発芽'],['ロンギ','P05-G01',400,401,'透明言葉'],['ヒュリコフ','P01-P06',412,413,'錬金術師']]){
   await open(before,`${name} ${word}`);assert.equal(await page.locator('.directory-character-card').count(),0);
   await open(after,`${name} ${word}`);assert.equal(await page.locator('.directory-character-card').count(),1);
   const card=page.locator(`.directory-character-card[data-character-id="${id}"]`);
   await card.locator('h3 a').click();
   assert.match(await page.locator('#modalContent').innerText(),/読者へ示された情報/);
   if(id==='P01-P06')assert.doesNotMatch(await page.locator('#modalContent').innerText(),/鋼の錬金術師|365日|700日|解呪アイテム/);
   await page.locator('#modalClose').click();
   await page.locator('#globalSpoilerToggle').click();assert.equal(await page.locator('.directory-character-card').count(),0);
  }
  await open(415,'ヒュリコフ 鋼の錬金術師');assert.equal(await page.locator('.directory-character-card').count(),1);
  await page.locator('.directory-character-card h3 a').click();assert.match(await page.locator('#modalContent').innerText(),/365日/);
  fs.mkdirSync('.local/nen-history-20261027',{recursive:true});await page.screenshot({path:`.local/nen-history-20261027/history-${width}.png`});
  await open(374,'ヌクオコン 担当外れ');assert.equal(await page.locator('.directory-character-card').count(),0);
  await page.locator('#characterSearch').fill('ヌクオコン');assert.equal(await page.locator('.directory-character-card').count(),1);
  const tags=await page.evaluate(()=>getCharacterTags(currentCharacterResults[0]).map(t=>t.label));assert.ok(!tags.includes('呪殺'));
  await page.locator('#characterSearch').fill('');assert.equal(await page.evaluate(()=>currentCharacterResults.length),230);
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();
  console.log(`PASS ${width}: 3 reader-reveal boundaries, names/types/detail/spoilers, 415 flashback, 374 assignment search and 230 roster slots`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
