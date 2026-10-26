const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {fixture, ready, ROOT, empty} = require('./helpers/browser-fixture.cjs');
const KEY = 'hxh-succession-local-drafts-v1';
const personal = path.join(ROOT, '.local/drafts.json');
const hash = () => fs.existsSync(personal) ? createHash('sha256').update(fs.readFileSync(personal)).digest('hex') : null;
async function editorFor(page, name = 'クラピカ') {
  await page.locator('#characterSearch').fill(name);
  await page.locator('.directory-character-card h3 a').first().click();
  const editor = page.locator('#modalContent .local-editor').first();
  const parent = editor.locator('xpath=ancestor::details[1]');
  if (await parent.count() && !await parent.getAttribute('open').then(value => value !== null)) await parent.locator(':scope > summary').click();
  return editor;
}
(async () => {
  const before = hash();
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const local of [true, false]) for (const width of [1280, 390]) {
      const {context, base, state} = await fixture(browser, {local, width, prefix: local ? '' : '/hxh-succession'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base); await ready(page);
      const article = await context.newPage();
      await article.goto(base + 'theories/Q001/');
      await article.locator('.local-editor textarea:not([disabled])').waitFor({state: 'attached'});
      await article.locator('details.spoiler-article').evaluate(el => { el.open = true; });
      await article.locator('.local-editor-collapsed > summary').click();
      await article.locator('.local-editor textarea').fill('記事で先に書いたメモ');
      await article.locator('.local-editor button').click();
      await article.waitForFunction(() => document.querySelector('.local-editor-status').textContent.includes('保存しました'));
      const editor = await editorFor(page);
      await editor.locator(':scope > label textarea').fill('人物メモ');
      await editor.locator(':scope > button').click();
      await page.waitForFunction(() => document.querySelector('#modalContent .local-editor-status').textContent.includes('保存しました'));
      let saved = local ? state.drafts : await page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
      assert.equal(saved.items['theory:Q001'].memo, '記事で先に書いたメモ');
      assert.equal(saved.items['bodyguard:P14-H01'].memo, '人物メモ');
      // Clearing a memo must survive a stale article tab saving something else.
      await editor.locator(':scope > label textarea').fill('');
      await editor.locator(':scope > button').click();
      await page.waitForFunction(() => localDrafts.items['bodyguard:P14-H01']?.memo === '' && document.querySelector('#modalContent .local-editor-status').textContent.includes('保存しました'));
      await article.locator('.local-editor textarea').fill('記事の追記');
      await article.locator('.local-editor button').click();
      await article.waitForFunction(() => document.querySelector('.local-editor-status').textContent.includes('保存しました'));
      saved = local ? state.drafts : await article.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
      assert.equal(saved.items['bodyguard:P14-H01'].memo, '');
      await page.locator('#modalClose').click();
      await page.waitForFunction(() => !CharacterRoutes.isActive());
      // A locally created event with no memo must remain after "save memo" and reload.
      await page.evaluate(async () => {
        const record = buildLocalEventRecord({description: '保存テストの出来事', chapter: 361, day: null,
          time: '', timeCertainty: 'estimated', characters: []}, 'LOCAL-preservation-test');
        localDrafts.items[`event:${record.id}`] = {createdRecord: record, updatedAt: DraftState.timestamp()};
        await saveLocalDrafts();
        showDetailModal(record.id, 'event', record);
      });
      const eventEditor = page.locator('#modalContent .local-editor');
      await eventEditor.locator(':scope > button').click();
      await page.waitForFunction(() => document.querySelector('#modalContent .local-editor-status').textContent.includes('保存しました'));
      await page.reload(); await ready(page);
      assert.equal(await page.evaluate(() => eventsData.filter(event => event.id === 'LOCAL-preservation-test').length), 1);
      if (local) {
        const retryEditor = await editorFor(page);
        state.failPut = true;
        await retryEditor.locator(':scope > label textarea').fill('失敗後に再保存するメモ');
        await retryEditor.locator(':scope > button').click();
        await page.waitForFunction(() => document.querySelector('#modalContent .local-editor-status').textContent.includes('保存できません'));
        state.failPut = false;
        state.drafts.items['guide:other-browser'] = {memo: '別ブラウザの追加', updatedAt: new Date().toISOString()}; state.revision++;
        await retryEditor.locator(':scope > button').click();
        await page.waitForFunction(() => document.querySelector('#modalContent .local-editor-status').textContent.includes('保存しました'));
        assert.equal(state.drafts.items['guide:other-browser'].memo, '別ブラウザの追加');
        assert.equal(state.drafts.items['bodyguard:P14-H01'].memo, '失敗後に再保存するメモ');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${local ? 'file' : 'browser'} ${width}: independent pages, empty memo, local event, retry and subpath`);
      await context.close();
    }
  } finally { await browser.close(); assert.equal(hash(), before, 'real notes must stay unchanged'); }
})().catch(error => {console.error(error); process.exitCode = 1;});
