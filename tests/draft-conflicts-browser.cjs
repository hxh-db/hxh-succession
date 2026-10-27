const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {fixture,ready,empty,ROOT}=require('./helpers/browser-fixture.cjs');
const DraftState=require('../draft-state.js');
const KEY='hxh-succession-local-drafts-v1';
const A='同時刻の候補Aを保持する',B='同時刻の候補Bを保持する';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const article of [false,true]) for(const local of [false,true]) {
      const width=article?320:390,key=article?'theory:Q001':'event:E383-004';
      const initial={...empty(),items:{[key]:{memo:'元のメモ',updatedAt:'2026-10-26T00:00:00Z'}}};
      const {context,base,state}=await fixture(browser,{local,width,drafts:initial});
      await context.addInitScript(({KEY,initial})=>{
        if(!localStorage.getItem(KEY)) localStorage.setItem(KEY,JSON.stringify(initial));
        localStorage.setItem('hxh-succession-spoilers-revealed-v1','true');
        Date.now=()=>Date.parse('2026-10-28T00:00:00Z');
        // Simulate two editors whose cross-tab storage notification has not
        // arrived yet. File reads and real UI save/checkpoint code still run.
        window.addEventListener('storage',event=>event.stopImmediatePropagation(),true);
      },{KEY,initial});
      const pages=[await context.newPage(),await context.newPage()];
      const errors=[];
      const sections=[];
      for(const page of pages) {
        page.on('pageerror',error=>errors.push(error.message));
        await page.goto(base+(article?'theories/Q001/':'?event=E383-004#timeline'));
        if(!article) await ready(page);
        await page.locator('.local-editor textarea:not([disabled])').first().waitFor({state:'attached'});
        const section=page.locator(article?'.local-editor':'#modalContent .local-editor').first();
        await section.locator('xpath=ancestor::details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
        sections.push(section);
      }
      if(!article) {
        const boundaries=await pages[0].evaluate(()=>{
          const time='2026-10-27T00:00:00Z',key='event:LOCAL-candidate-test';
          const good=buildLocalEventRecord({description:'安全な追加記録',chapter:383,day:null,
            timeCertainty:'estimated',characters:[]},'LOCAL-candidate-test');
          const bad={...good,characters:['UNKNOWN-PERSON']};
          const item={createdRecord:good,updatedAt:time,conflicts:{createdRecord:[
            {present:true,value:good,updatedAt:time},{present:true,value:bad,updatedAt:time}]}};
          let rejected=false;
          try {validateDraftImport({format:'hxh-succession-local-drafts',version:2,items:{[key]:item}});}
          catch(error) {rejected=error.message.includes('未登録の人物');}
          const previous=localDrafts;
          try {
            localDrafts=DraftState.merge({version:1,items:{'event:E383-004':{memo:'',updatedAt:time}}},
              {version:1,items:{'event:E383-004':{memo:'空欄と競合する文章',updatedAt:time}}});
            renderDraftOverview();
            return {rejected,count:document.getElementById('draftCount').textContent,
              overview:document.getElementById('draftOverviewList').textContent};
          } finally {localDrafts=previous;renderDraftOverview();}
        });
        assert.ok(boundaries.rejected,'A hidden candidate cannot bypass created-event validation');
        assert.match(boundaries.count,/1件/);
        assert.match(boundaries.overview,/競合候補あり/,'A blank displayed candidate must still appear in the overview');
      }
      await Promise.all(sections.map((section,index)=>section.locator(':scope > label textarea').fill(index?B:A)));
      await Promise.all(sections.map(section=>section.locator(':scope > button').click()));
      for(const page of pages) await page.waitForFunction(article=>{
        const root=article?document:document.getElementById('modalContent');
        return root.querySelector('.local-editor-status')?.textContent.includes('保存しました');
      },article);
      const writerIndex=await sections[1].locator('.draft-conflicts').isVisible()?1:0;
      let writer=pages[writerIndex],section=sections[writerIndex];
      const read=()=>writer.evaluate(KEY=>JSON.parse(localStorage.getItem(KEY)),KEY);
      let saved=await read();
      assert.equal(saved.version,2);
      assert.deepEqual(saved.items[key].conflicts.memo.map(choice=>choice.value).sort(),[A,B]);
      // Saving the unchanged text shown to this editor is not a selection.
      await section.locator(':scope > button').click();
      await writer.waitForFunction(article=>(article?document:document.getElementById('modalContent')).querySelector('.local-editor-status')?.textContent.includes('保存しました'),article);
      assert.equal((await read()).items[key].conflicts.memo.length,2);
      if(!article) {
        const backup=await writer.evaluate(()=>buildDraftExport());
        assert.equal(backup.items[key].conflicts.memo.length,2);
        writer.once('dialog',dialog=>dialog.accept());
        await Promise.all([writer.waitForEvent('load'),writer.locator('#importLocalDrafts').setInputFiles({
          name:'isolated-conflicts.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))})]);
        await ready(writer);
        section=writer.locator('#modalContent .local-editor').first();
        await section.locator('xpath=ancestor::details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
        assert.equal((await read()).items[key].conflicts.memo.length,2,'Backup restore must retain both choices');
      }
      if(local) {
        state.failGet=true;
        await section.locator('.draft-conflict-choice').filter({hasText:B}).getByRole('button').click();
        await section.locator('.draft-conflict-status').filter({hasText:/読み込めません/}).waitFor();
        assert.equal(state.drafts.items[key].conflicts.memo.length,2);
        assert.equal((await read()).items[key].conflicts.memo.length,2);
        state.failGet=false;
      }
      const output=path.join(ROOT,'.local/quality-remaining-20261027');fs.mkdirSync(output,{recursive:true});
      if(!local) await section.locator('.draft-conflicts').screenshot({path:path.join(output,`conflicts-${article?'article':'main'}-${width}.png`)});
      await section.locator('.draft-conflict-choice').filter({hasText:B}).getByRole('button').click();
      await writer.waitForFunction(({KEY,key,B})=>{
        const item=JSON.parse(localStorage.getItem(KEY)).items[key];return item.memo===B && !item.conflicts;
      },{KEY,key,B});
      await section.locator('.draft-conflict-status').filter({hasText:'選んだ内容を保存しました'}).waitFor();
      // A stale editor's no-op save must not resurrect rejected candidates.
      const stale=sections[1-writerIndex];
      await stale.locator(':scope > button').click();
      await pages[1-writerIndex].waitForFunction(article=>(article?document:document.getElementById('modalContent')).querySelector('.local-editor-status')?.textContent.includes('保存しました'),article);
      saved=await read();
      assert.equal(saved.items[key].memo,B);assert.ok(!saved.items[key].conflicts);
      if(local) {assert.equal(state.drafts.items[key].memo,B);assert.ok(!state.drafts.items[key].conflicts);}
      await writer.reload();
      if(!article) await ready(writer);
      await writer.locator('.local-editor textarea:not([disabled])').first().waitFor({state:'attached'});
      const restored=writer.locator(article?'.local-editor textarea':'#modalContent .local-editor > label textarea').first();
      assert.equal(await restored.inputValue(),B);
      assert.ok(await writer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.deepEqual(errors,[]);
      console.log(`PASS ${article?'article':'main'} ${local?'file':'browser'} ${width}: equal-time real inputs, both choices, no-op safety, backup, resolution, stale save and reload`);
      await context.close();
    }
    // Non-memo choices reload the detail to apply the selected data. Exercise
    // that path separately from textarea saving, preserving the independent memo.
    for(const created of [false,true]) {
      const key=created?'event:LOCAL-conflict-check':'bodyguard:P14-H01';
      const field=created?'createdRecord':'edits',time='2026-10-27T00:00:00Z';
      const values=created?['追加した案A','追加した案B'].map(description=>({
        id:'LOCAL-conflict-check',chapter:383,chapter_order:1,chapter_title:null,description,day:null,
        date_certainty:'unknown',time_start:null,time_end:null,time_inference:false,is_estimate:false,
        characters:[],location:null,type:'その他',notes:'',chronology_kind:'event',local_created:true,
        revealed_facts:[],mysteries:[]
      })):[{room:'部屋の案A'},{room:'部屋の案B'}];
      const drafts=DraftState.envelope(DraftState.merge(...values.map(value=>({version:1,
        items:{[key]:{memo:'独立したメモを残す',[field]:value,updatedAt:time}}}))));
      const {context,base,state}=await fixture(browser,{local:true,width:390,drafts});
      await context.addInitScript(({KEY,drafts})=>{localStorage.setItem(KEY,JSON.stringify(drafts));
        localStorage.setItem('hxh-succession-spoilers-revealed-v1','true');},{KEY,drafts});
      const page=await context.newPage();
      await page.goto(base+(created?'?event=LOCAL-conflict-check#timeline':'?person=P14-H01&detail=1#characters'));await ready(page);
      const section=page.locator('#modalContent .local-editor');
      await section.locator('xpath=ancestor::details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
      if(!created) {
        // A backup/read-current operation can update memory without replacing
        // the open form. Keeping that form untouched must retain every choice.
        await page.evaluate(async({KEY,key,time})=>{
          const incoming={version:1,items:{[key]:{memo:'独立したメモを残す',edits:{room:'部屋の案0'},updatedAt:time}}};
          localStorage.setItem(KEY,JSON.stringify(DraftState.merge(localDrafts,incoming)));
          await readCurrentDrafts();
        },{KEY,key,time});
        await section.locator('.local-editor-fields > summary').click();
        await Promise.all([page.waitForEvent('load'),section.getByRole('button',{name:'編集を保存',exact:true}).click()]);
        await ready(page);
        assert.equal(state.drafts.items[key].conflicts.edits.length,3,'An unchanged stale form must not choose its displayed candidate');
        await section.locator('xpath=ancestor::details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
      }
      await Promise.all([page.waitForEvent('load'),section.locator('.draft-conflict-choice')
        .filter({hasText:created?'追加した案B':'部屋の案B'}).getByRole('button').click()]);
      await ready(page);
      assert.equal(state.drafts.items[key].memo,'独立したメモを残す');
      assert.ok(!state.drafts.items[key].conflicts);
      assert.deepEqual(state.drafts.items[key][field],values[1]);
      const displayed=await page.evaluate(created=>created?eventsData.find(item=>item.id==='LOCAL-conflict-check').description:
        charactersData.find(item=>item.id==='P14-H01').room,created);
      assert.equal(displayed,created?'追加した案B':'部屋の案B');
      await context.close();console.log(`PASS ${field}: candidate selection applies after reload and retains the independent memo`);
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
