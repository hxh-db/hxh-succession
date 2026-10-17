const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/theories/');
  const search=page.locator('#essay-search'), read=page.locator('#essay-read-through');
  for (const [word,id] of [['パリストン','Q010'],['ビヨンド','Q010'],['TSK17','Q009']]) {
   await search.fill(word);
   assert.ok(await page.locator(`.essay-card:visible a[href*="/${id}/"]`).isVisible());
  }
  await search.fill('ウッディー');
  assert.match(await page.locator('.essay-card:visible a').first().getAttribute('href'),/Q001/);
  await search.fill('クラピカ');
  assert.match(await page.locator('.essay-card:visible').filter({has:page.locator('a[href*="/Q002/"]')}).innerText(),/参照場面に登場/);
  await search.fill(''); await read.selectOption('370');
  assert.ok(await page.locator('.essay-card:visible').count()>0);
  assert.ok(await page.locator('.essay-card:visible').evaluateAll(cards=>cards.every(c=>Number(c.dataset.chapter)<=370)));
  assert.equal(await page.locator('.essay-card:visible a[href*="/Q001/"]').count(),0);
  await read.selectOption('376'); await search.fill('ウッディー');
  await page.locator('.essay-card:visible a[href*="/Q001/"]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('main a')].some(a=>a.textContent==='謎・考察一覧へ戻る' && new URL(a.href).searchParams.get('read')==='376'));
  await page.getByRole('link',{name:'謎・考察一覧へ戻る',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('essay-read-through')?.value==='376');
  assert.equal(await search.inputValue(),'ウッディー');
  await page.reload();
  await page.waitForFunction(()=>document.getElementById('essay-read-through')?.value==='376');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(__dirname,'../.local/theory-search-mobile.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto('http://127.0.0.1:8765/theories/Q002/');
  await page.locator('.spoiler-article').evaluate(el=>{el.open=true;});
  await page.locator('.comparison-scroll').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(__dirname,'../.local/theory-conditions-mobile.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: topic-first search, reference reason, TSK17, chapter exclusion, URL/return/reload, mobile search and conditions table');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
