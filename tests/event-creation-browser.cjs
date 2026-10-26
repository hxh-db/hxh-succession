const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {fixture, ready} = require('./helpers/browser-fixture.cjs');
const KEY = 'hxh-succession-local-drafts-v1';
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const local of [false, true]) for (const width of [1280, 390]) {
      const {context, base, state} = await fixture(browser, {local, width, prefix: local ? '' : '/hxh-succession'});
      await context.addInitScript(() => localStorage.setItem('hxh-succession-spoilers-revealed-v1', 'true'));
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base); await ready(page);
      await page.locator('[data-primary-view="timeline"]').click();
      await page.locator('#addTimelineEvent').click();
      const modal = page.locator('#detailModal'), form = modal.locator('.local-event-create-form');
      assert.match(await modal.locator(':scope #modalContent > .local-editor-help').innerText(), local ? /このPCに保存/ : /このブラウザに保存/);
      await form.getByLabel('出来事', {exact: true}).fill('追加画面から登録する検証用の出来事。');
      await form.getByLabel('話数', {exact: true}).fill('361');
      await form.getByLabel('日（0〜12日、空欄は未設定）', {exact: true}).fill('0');
      await form.getByLabel('時刻（空欄可）', {exact: true}).fill('00:00');
      await form.getByLabel('場所', {exact: true}).fill('テスト用の場所');
      await form.getByLabel('関係人物を探す', {exact: true}).fill('クラピカ');
      await form.locator('input[type="checkbox"][value="P14-H01"]').check();
      assert.match(await form.locator('.new-event-selected-people').innerText(), /クラピカ/);
      if (local) {
        state.failPut = true;
        await form.getByRole('button', {name: '追加して保存', exact: true}).click();
        await form.locator('.local-editor-status').filter({hasText: /保存できません/}).waitFor();
        assert.equal(await form.getByLabel('出来事', {exact: true}).inputValue(), '追加画面から登録する検証用の出来事。');
        state.failPut = false;
      }
      await Promise.all([page.waitForEvent('load'), form.getByRole('button', {name: '追加して保存', exact: true}).click()]);
      await ready(page); await modal.waitFor({state: 'visible'});
      const record = await page.evaluate(() => eventsData.find(event => event.local_created));
      assert.ok(record && /^LOCAL-/.test(record.id));
      assert.equal(record.day, 0); assert.equal(record.time_start, null); assert.equal(record.time_estimate, '00:00');
      assert.deepEqual(record.characters, ['P14-H01']);
      assert.equal(await page.locator('#modalTitle').innerText(), '追加画面から登録する検証用の出来事。');
      await modal.locator('.event-source-details > summary').click();
      assert.match(await modal.locator('.event-source-details').innerText(), /日付の確度：自分で入力した日付（未照合）/);
      assert.match(await modal.locator('.record-link-scope').innerText(), local ? /このPC/ : /このブラウザ/);
      const link = await modal.locator('.record-permalink').getAttribute('href');
      await page.goto(link); await ready(page); await modal.waitFor({state: 'visible'});
      assert.equal(await page.evaluate(id => eventsData.filter(event => event.id === id).length, record.id), 1);
      assert.equal(await page.evaluate(KEY => Object.values(JSON.parse(localStorage.getItem(KEY)).items).filter(item => item.createdRecord).length, KEY), 1);
      if (local) assert.equal(Object.values(state.drafts.items).filter(item => item.createdRecord).length, 1);
      if (!local) {
        const recipient = await fixture(browser, {local: false, width, prefix: '/hxh-succession'});
        const other = await recipient.context.newPage();
        await other.goto(link); await ready(other);
        assert.equal(await other.evaluate(id => eventsData.some(event => event.id === id), record.id), false);
        assert.match(await other.locator('#recordLinkMessage').innerText(), /保存したPC／ブラウザ/);
        assert.ok(!(await other.locator('body').innerText()).includes(record.description), 'the URL alone must not transfer private content');
        await recipient.context.close();
      }
      await page.locator('#modalClose').click();
      await page.locator('#localDraftsLink').click();
      await page.locator('.local-drafts-overview > summary').click();
      assert.match(await page.locator('#draftOverviewList').innerText(), local ? /このPCに保存/ : /このブラウザに保存/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      console.log(`PASS ${local ? 'file' : 'browser'} ${width}: actual creation, midnight/day zero, person choice, retry without duplicates, direct link and storage scope`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
