const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(b,{width,local:false,prefix:'/hxh-succession'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'#guide');await ready(p);const search=p.locator('#guideSearch'),faq=p.locator('#guide details').filter({has:p.locator('summary', {hasText:'辞退や船外への脱出'})}),section=faq.locator('..'),folds=section.locator('details');
 await search.fill('妨害した存在');assert.ok(await section.isHidden());assert.equal(await faq.evaluate(e=>e.open),false);
 const focusedBefore=await p.evaluate(()=>document.activeElement.id);await p.locator('#spoilerRange').selectOption('all');assert.ok(await faq.locator('p').isVisible(),'the matching explanation must be readable');assert.equal(await folds.evaluateAll(es=>es.filter(e=>e.open).length),1);assert.equal(await p.evaluate(()=>document.activeElement.id),focusedBefore);
 await search.fill('妨害した存在 正体');assert.equal(await p.evaluate(()=>document.activeElement.id),'guideSearch');assert.ok(await faq.locator('p').isVisible());const share=await p.locator('#currentViewLink').getAttribute('href');
 await p.locator('#guideSearchClear').click();assert.equal(await faq.evaluate(e=>e.open),false);assert.equal(await p.evaluate(()=>document.activeElement.id),'guideSearch');
 // Pre-existing manual openings are preserved; unrelated explanations do not all expand.
 await folds.nth(2).locator('summary').click();await search.fill('妨害した存在');assert.equal(await folds.evaluateAll(es=>es.filter(e=>e.open).length),2);
 await search.fill('準協会員');assert.equal(await faq.evaluate(e=>e.open),false);assert.equal(await folds.nth(4).evaluate(e=>e.open),true);await search.fill('');assert.equal(await folds.nth(4).evaluate(e=>e.open),false);assert.equal(await folds.nth(2).evaluate(e=>e.open),true);
 // A manual close or close/reopen during search must survive subsequent input and clear.
 await search.fill('妨害した存在');await faq.locator('summary').click();await search.fill('妨害した存在 正体');assert.equal(await faq.evaluate(e=>e.open),false);await search.fill('');assert.equal(await faq.evaluate(e=>e.open),false);
 await search.fill('妨害した存在');await faq.locator('summary').press('Enter');await faq.locator('summary').press('Enter');await search.fill('');assert.equal(await faq.evaluate(e=>e.open),true);
 // The summary is already visible: a summary-only hit need not open a body.
 await faq.locator('summary').click();await search.fill('辞退');assert.equal(await faq.evaluate(e=>e.open),false);await search.fill('');
 await section.evaluate(el=>{const d=document.createElement('details');d.className='guide-local-memo';d.innerHTML='<summary>この項目にメモ</summary><p>非公開検査語abc987</p>';el.append(d);return true;});await search.fill('非公開検査語abc987');assert.match(await p.locator('#guideSearchStatus').innerText(),/中0項目/);await search.fill('');
 const fresh=await fixture(b,{width,local:false,prefix:'/hxh-succession'}),q=await fresh.context.newPage();await q.goto(share);await ready(q);assert.equal(await q.locator('#spoilerRange').inputValue(),'basic');assert.ok(await q.locator('#guide details').filter({has:q.locator('summary',{hasText:'辞退や船外への脱出'})}).isHidden());await q.locator('#spoilerRange').selectOption('all');await q.reload();await ready(q);const target=q.locator('#guide details').filter({has:q.locator('summary',{hasText:'辞退や船外への脱出'})});assert.ok(await target.locator('p').isVisible());await q.locator('#spoilerRange').selectOption('basic');assert.ok(await target.isHidden());assert.equal(await target.evaluate(e=>e.open),false);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await fresh.context.close();await context.close();console.log(`PASS ${width}: matching authored explanations, selective folds, unchanged focus, clear/manual choices, summary hits, share/reload and basic disclosure`);
 }}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
