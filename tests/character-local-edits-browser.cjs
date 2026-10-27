const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture,ready,empty}=require('./helpers/browser-fixture.cjs');
const KEY='hxh-succession-local-drafts-v1';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const local of [true,false]) for(const width of [1280,390]) {
   const drafts={...empty(),items:{'prince:P12':{memo:'保持する人物メモ'},'bodyguard:P14-H01':{memo:'保持する護衛メモ'}}};
   const {context,base}=await fixture(browser,{local,width,drafts});
   await context.addInitScript(({KEY,drafts})=>{if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(drafts));localStorage.setItem('hxh-succession-spoilers-revealed-v1','true');},{KEY,drafts});
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   const open=async id=>{await page.goto(base+'?person='+id+'&detail=1#characters');await ready(page);await page.locator('#detailModal:not(.hidden)').waitFor();};
   const form=async()=>{
    const section=page.locator('#modalContent .local-editor');
    await section.locator('xpath=ancestor::details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
    const details=section.locator('.local-editor-fields');await details.evaluate(node=>{node.open=true;});
    return section.locator('.local-editor-form');
   };
   const save=async current=>{await Promise.all([page.waitForEvent('load'),current.getByRole('button',{name:'編集を保存',exact:true}).click()]);await ready(page);await page.locator('#detailModal:not(.hidden)').waitFor();};
   await open('P12');let editor=await form();
   await editor.getByLabel('状態',{exact:true}).fill('検査用の私的な状態');
   await editor.getByLabel('部屋',{exact:true}).fill('検査用の私的な場所');
   await editor.getByLabel('本人の念能力',{exact:true}).fill('検査用の私的な能力');
   await save(editor);
   const model=await page.evaluate(()=>{
    const person=charactersData.find(person=>person.id==='P12');
    return {label:CharacterFacts.statusLabel(person,eventsData),note:CharacterFacts.statusEditorialNote(person,eventsData),location:CharacterFacts.latestLocationLabel(person,eventsData),fields:person.local_edit_fields};
   });
   assert.match(model.label,/私的な状態.*未照合/);assert.doesNotMatch(model.label,/368/);assert.doesNotMatch(model.note,/E368-001/);
   assert.match(model.location,/私的な場所.*未照合/);
   const notice=page.locator('#modalContent .character-local-edit-notice');
   assert.match(await notice.innerText(),/自分用の変更.*未照合/s);
   await notice.locator('summary').click();assert.match(await notice.innerText(),/公開データの状態.*死亡/s);
   assert.match(await notice.innerText(),/E368-001/);
   await page.goto(base+'characters/P12/');
   assert.doesNotMatch(await page.locator('body').innerText(),/検査用の私的/);
   await page.locator('.editorial-status').evaluate(node=>{node.open=true;});
   assert.match(await page.locator('body').innerText(),/公開データ/);
   await open('P12');editor=await form();
   await Promise.all([page.waitForEvent('load'),editor.getByRole('button',{name:'この項目の編集を戻す',exact:true}).click()]);await ready(page);
   assert.equal(await page.locator('#modalContent .character-local-edit-notice').count(),0);
   assert.equal(await page.evaluate(()=>localDrafts.items['prince:P12'].memo),'保持する人物メモ');
   assert.match(await page.evaluate(()=>CharacterFacts.statusLabel(charactersData.find(person=>person.id==='P12'),eventsData)),/死亡.*368/);
   await open('P14-H01');editor=await form();
   await editor.getByLabel('役割',{exact:true}).fill('検査用の私的な役割');
   await editor.getByLabel('能力',{exact:true}).fill('検査用の私的な護衛能力');
   await save(editor);
   assert.equal(await page.locator('#modalContent img[src*="kurapika-dowsing-chain"]').count(),0,'Original ability image must not illustrate a private replacement');
   assert.match(await page.locator('#modalContent .character-local-edit-notice').innerText(),/役割.*念能力/s);
   await page.goto(base+'?c_group=personnel&c_when=chapter-374&c_search='+encodeURIComponent('クラピカ')+'#characters');await ready(page);
   const card=page.locator('.directory-character-card[data-character-id="P14-H01"]');
   assert.doesNotMatch(await card.innerText(),/検査用の私的/);
   assert.equal(await card.locator('.character-local-edit-notice').count(),0);
   await card.locator('h3 a').click();
   assert.match(await page.locator('.personnel-modal-period').innerText(),/公開データ.*自分用の変更は適用していません/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   await context.close();console.log(`PASS personal character edits ${local?'file':'browser'} ${width}: unverified status/place/ability/role, separate public evidence, undo+memo, static and historical public scope`);
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
