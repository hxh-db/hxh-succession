const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
const initial=require('../data/intake/initial_personnel_review_20261013.json');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try { for(const width of [1280,390,320]) {
  const {context,base}=await fixture(browser,{width,local:false,prefix:'/hxh-succession'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'#guide');await ready(page);
  await page.locator('#spoilerRange').selectOption('all');
  const tables=page.locator('#guide .guide-prince-table');
  assert.equal(await tables.count(),2,'only the two prince comparison tables use the sticky column');
  for(let index=0;index<2;index++) {
   const table=tables.nth(index),wrap=table.locator('..');
   assert.equal(await table.locator('tbody th[scope="row"]').count(),14);
   assert.equal(await wrap.getAttribute('tabindex'),'0');assert.equal(await wrap.getAttribute('role'),'region');
   const before=await table.locator('tbody').innerText();
   await wrap.scrollIntoViewIfNeeded();
   if(await wrap.evaluate(el=>el.scrollWidth>el.clientWidth+1)) {
    await wrap.focus();await wrap.press('ArrowRight');
    await page.waitForFunction(el=>el.scrollLeft>0,await wrap.elementHandle());
   }
   await wrap.evaluate(el=>el.scrollLeft=el.scrollWidth);
   const measure=()=>table.evaluate(el=>{
    const wrap=el.parentElement,box=wrap.getBoundingClientRect(),cells=[...el.querySelectorAll('tbody th')];
    return cells.map(cell=>{
     const rect=cell.getBoundingClientRect(),style=getComputedStyle(cell);
     return {left:rect.left-box.left,width:rect.width,wrapWidth:box.width,position:style.position,background:style.backgroundColor,fits:cell.scrollWidth<=cell.clientWidth+1};
    });
   });
   for(const cell of await measure()) {
    assert.equal(cell.position,'sticky');assert.ok(Math.abs(cell.left)<2,JSON.stringify(cell));
    assert.ok(cell.width<=114 && cell.width<cell.wrapWidth/2,JSON.stringify(cell));
    assert.notEqual(cell.background,'rgba(0, 0, 0, 0)');assert.ok(cell.fits);
   }
   assert.equal(await table.locator('tbody').innerText(),before,'scrolling preserves all numbers and caveats');
   await table.evaluate(el=>el.style.fontSize='200%');
   await wrap.evaluate(el=>el.scrollLeft=el.scrollWidth);
   for(const cell of await measure())assert.ok(cell.fits && cell.width<=114 && Math.abs(cell.left)<2,JSON.stringify(cell));
   await table.evaluate(el=>el.style.fontSize='');
   if(width===390&&process.env.HXH_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.HXH_SCREENSHOT_DIR,{recursive:true});
    await wrap.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(process.env.HXH_SCREENSHOT_DIR,`guide-table-${index}-390.png`)});
   }
  }
  const initialTable=page.locator('#guide .guide-initial-personnel-table');
  assert.deepEqual(await initialTable.locator('tbody tr').evaluateAll(rows=>rows.map(row=>Number(row.lastElementChild.textContent))),initial.princes.map(prince=>prince.initial_total));
  assert.equal(Number(await initialTable.locator('tfoot tr').last().locator('td').last().innerText()),initial.totals.initial);
  assert.ok(await page.locator('#guide .guide-table:not(.guide-prince-table) tbody tr > :first-child').evaluateAll(cells=>cells.every(cell=>getComputedStyle(cell).position!=='sticky')));
  await page.locator('#spoilerRange').selectOption('basic');assert.equal(await page.locator('#guide .guide-prince-table:visible').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS ${width}: two semantic prince columns, keyboard/right-edge reading, bounded names, 200% text, unchanged totals and basic protection`);
 }} finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
