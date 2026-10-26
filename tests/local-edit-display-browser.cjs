const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {fixture, ready} = require('./helpers/browser-fixture.cjs');
const original = require('../data/events.json').find(event => event.id === 'E383-004');
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1280, 390]) for (const local of [true, false]) {
      const {context, base, state} = await fixture(browser, {width, local});
      await context.addInitScript(() => localStorage.setItem('hxh-succession-spoilers-revealed-v1', 'true'));
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '?event=' + original.id + '#timeline'); await ready(page);
      const modal = page.locator('#detailModal');
      await modal.waitFor({state: 'visible'});
      await modal.locator('.local-editor-label textarea').first().fill('編集を戻しても残すメモ');
      await modal.getByRole('button', {name: '今すぐ保存', exact: true}).click();
      await modal.locator('.local-editor-status').first().filter({hasText: /保存しました/}).waitFor();
      await modal.locator('.local-editor-fields > summary').click();
      const form = modal.locator('.local-editor-form');
      await form.getByLabel('出来事', {exact: true}).fill('自分で修正した出来事。補足を記録する。');
      await form.getByLabel('日（0〜12日、空欄は未設定）', {exact: true}).fill('2');
      await form.getByLabel('推測時刻', {exact: true}).fill('');
      await Promise.all([page.waitForEvent('load'), form.getByRole('button', {name: '編集を保存', exact: true}).click()]);
      await ready(page); await modal.waitFor({state: 'visible'});
      assert.equal(await page.locator('#modalTitle').innerText(), '自分で修正した出来事。');
      assert.match(await modal.locator('.record-link-scope').innerText(), /編集を保存していない環境では公開データ/);
      let model = await page.evaluate(id => {
        const event = eventsData.find(event => event.id === id);
        return {day: CharacterFacts.dayLabel(event), clock: getTimeLabel(event), inferred: inferredTimePlacements.has(id), title: event.title};
      }, original.id);
      assert.equal(model.day, '2日目（確度未確認）');
      assert.equal(model.clock, null); assert.equal(model.inferred, false); assert.equal(model.title, undefined);
      await modal.locator('.event-source-details > summary').click();
      assert.ok((await modal.locator('.event-review-ribbon').innerText()).includes('自分で編集・変更箇所は未照合'));
      assert.match(await modal.locator('.event-source-details').innerText(), /変更箇所の裏付けではありません/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      // A caller-supplied confirmed time is not original verification evidence.
      await modal.locator('.local-editor-fields > summary').click();
      await form.getByLabel('確定時刻', {exact: true}).fill('10:10');
      await Promise.all([page.waitForEvent('load'), form.getByRole('button', {name: '編集を保存', exact: true}).click()]);
      await ready(page); await modal.waitFor({state: 'visible'});
      await modal.locator('.event-source-details > summary').click();
      assert.match(await modal.locator('.event-review-ribbon').innerText(), /自分で入力した確定時刻（未照合）/);
      // Undo restores public metadata without discarding this item's independent memo.
      await modal.locator('.local-editor-fields > summary').click();
      await Promise.all([page.waitForEvent('load'), form.getByRole('button', {name: 'この項目の編集を戻す', exact: true}).click()]);
      await ready(page); await modal.waitFor({state: 'visible'});
      assert.equal(await page.locator('#modalTitle').innerText(), original.title);
      assert.equal(await modal.locator('.record-link-scope').count(), 0);
      assert.equal(await modal.locator('.local-editor-label textarea').first().inputValue(), '編集を戻しても残すメモ');
      assert.equal(await page.evaluate(id => eventsData.find(event => event.id === id).time_estimate, original.id), original.time_estimate);
      if (local) assert.equal(state.drafts.items['event:' + original.id].memo, '編集を戻しても残すメモ');
      // Older records store their place in room. The editor must show and clear it too.
      await page.goto(base + '?event=E360-002#timeline'); await ready(page);
      await modal.waitFor({state: 'visible'});
      await modal.locator('.local-editor-fields > summary').click();
      assert.equal(await form.getByLabel('場所', {exact: true}).inputValue(), '第1層 1014号室');
      await form.getByLabel('場所', {exact: true}).fill('');
      await Promise.all([page.waitForEvent('load'), form.getByRole('button', {name: '編集を保存', exact: true}).click()]);
      await ready(page); await modal.waitFor({state: 'visible'});
      assert.equal(await page.evaluate(() => getLocationKey(eventsData.find(event => event.id === 'E360-002'))), '場所不明');
      await modal.locator('.local-editor-fields > summary').click();
      await Promise.all([page.waitForEvent('load'), form.getByRole('button', {name: 'この項目の編集を戻す', exact: true}).click()]);
      await ready(page); await modal.waitFor({state: 'visible'});
      assert.equal(await page.evaluate(() => getLocationKey(eventsData.find(event => event.id === 'E360-002'))), '第1層 1014号室');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width} ${local ? 'file' : 'browser'}: edit, reload, corrected headline/date/clock, provenance and undo preserving memo`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
