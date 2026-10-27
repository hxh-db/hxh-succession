const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const width of [1280,390]) {
      const {context,base}=await fixture(browser,{local:false,width,prefix:'/hxh-succession'});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      for(const fragment of ['#%','#%E3%81','#unknown-section','#%E5%9F%BA%E7%A4%8E','#characters']) {
        await page.goto(base+fragment);await ready(page);
        assert.ok(await page.locator('#databaseLoadStatus').isHidden(),fragment);
        assert.equal(await page.locator('#characters').evaluate(node=>node.inert),false,fragment);
        await page.locator('#characterSearch').fill('クラピカ');
        const card=page.locator('.directory-character-card[data-character-id="P14-H01"]');
        await card.locator('h3 a').click();
        assert.equal(await page.locator('#modalTitle').innerText(),'クラピカ');
        await page.keyboard.press('Escape');
        await page.locator('[data-primary-view="guide"]').click();
        assert.ok(await page.locator('#guide').isVisible());
      }
      // Unknown anchors are harmless, while valid UTF-8 anchors still scroll.
      const moved=await page.evaluate(()=>{
        const target=document.createElement('p');target.id='検査用の目印';target.textContent='目印';
        target.style.marginTop='1500px';
        const after=document.createElement('div');after.style.height='1200px';
        document.getElementById('guide').append(target,after);
        history.replaceState(history.state,'','#'+encodeURIComponent(target.id));
        window.scrollTo(0,0);scrollToCurrentHash();
        return {position:window.scrollY,targetTop:target.getBoundingClientRect().top};
      });
      assert.ok(moved.position>500);assert.ok(Math.abs(moved.targetTop)<10);
      assert.deepEqual(errors,[]);await context.close();
      console.log(`PASS URL fragments ${width}: malformed/unknown/UTF-8 anchors keep search, modal and navigation usable; valid anchor scrolls`);
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
