// Fully isolated contexts + mocked API/static origin. No real browser notes or draft file are written.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const KEY = 'hxh-succession-local-drafts-v1';
const personalFile = path.join(ROOT, '.local/drafts.json');
const hash = () => fs.existsSync(personalFile) ? createHash('sha256').update(fs.readFileSync(personalFile)).digest('hex') : null;
const ready = page => page.waitForFunction(() => viewLinksReady && !restoringReadingState);
const old = {format: 'hxh-succession-local-drafts', version: 1, exportedAt: '2026-10-20T00:00:00Z', entries: [], items: {
  'bodyguard:P14-H01': {memo: 'テスト用人物メモ', edits: {role: 'テスト用編集'}, updatedAt: '2026-10-20T00:00:00Z'},
  'guide:soemonoTitle': {memo: 'テスト用基礎資料メモ', updatedAt: '2026-10-20T00:00:00Z'},
  'theory:Q001': {title: '記事メモ', memo: 'テスト用記事メモ', updatedAt: '2026-10-20T00:00:00Z'},
  'event:LOCAL-RESET-TEST': {memo: 'テスト用追加', updatedAt: '2026-10-20T00:00:00Z', createdRecord: {
    id: 'LOCAL-RESET-TEST', chapter: 361, chapter_order: 99, description: 'テスト用の追加した出来事', day: 1,
    characters: [], type: 'その他', time_start: null, local_created: true
  }}
}};

(async () => {
  const beforeHash = hash();
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const mode of ['browser', 'file']) for (const width of [1280, 390]) {
      const context = await browser.newContext({viewport: {width, height: 844}, acceptDownloads: true});
      let file = structuredClone(old), failWrite = false, puts = 0;
      const base = mode === 'file' ? 'http://127.0.0.1:8765/' : 'https://hxh-reset.test/hxh-succession/';
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/api/drafts')) {
          if (route.request().method() === 'PUT') {
            puts++;
            if (failWrite) return route.fulfill({status: 500, body: '{}'});
            file = route.request().postDataJSON();
          }
          return route.fulfill({contentType: 'application/json', body: JSON.stringify(file)});
        }
        let relative = decodeURIComponent(url.pathname).replace(/^\/hxh-succession\//, '').replace(/^\//, '');
        if (!relative || relative.endsWith('/')) relative += 'index.html';
        const local = path.resolve(ROOT, relative);
        if (!local.startsWith(ROOT + path.sep) || !fs.existsSync(local) || !fs.statSync(local).isFile()) return route.fulfill({status: 404, body: ''});
        const mime = {'.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png'};
        return route.fulfill({contentType: mime[path.extname(local)] || 'application/octet-stream', body: fs.readFileSync(local)});
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '?c_search=' + encodeURIComponent('クラピカ') + '#characters'); await ready(page);
      await page.evaluate(({KEY, old}) => {
        localStorage.setItem(KEY, JSON.stringify(old));
        localStorage.setItem('hxh-succession-spoilers-revealed-v1', 'true');
        localStorage.setItem('unrelated-test-key', 'keep');
      }, {KEY, old});
      await page.reload(); await ready(page);
      const article = await context.newPage();
      await article.goto(base + 'theories/Q001/');
      await article.locator('.local-editor textarea:not([disabled])').waitFor({state: 'attached'});
      await page.locator('.local-drafts-transfer > summary').click();
      async function prepare() {
        const pending = page.waitForEvent('download');
        await page.locator('#resetLocalDrafts').click();
        const download = await pending;
        assert.match(download.suggestedFilename(), /^codex-notes-before-reset-/);
        const payload = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
        assert.equal(Object.keys(payload.items).length, 4);
        assert.equal(payload.items['event:LOCAL-RESET-TEST'].createdRecord.id, 'LOCAL-RESET-TEST');
        await page.locator('#draftResetConfirmation').waitFor();
        assert.ok(await page.locator('#draftResetSummary').innerText().then(text => text.includes('4件')));
        return payload;
      }
      await prepare();
      assert.equal(await page.evaluate(KEY => Object.keys(JSON.parse(localStorage.getItem(KEY)).items).length, KEY), 4);
      await page.locator('#cancelDraftReset').click();
      assert.ok(await page.locator('#draftResetConfirmation').isHidden());
      assert.equal(await page.evaluate(KEY => Object.keys(JSON.parse(localStorage.getItem(KEY)).items).length, KEY), 4);
      if (width === 1280) {
        await prepare();
        await page.evaluate(async () => {
          localDrafts.items['guide:soemonoTitle'].memo = 'バックアップ後の変更';
          localDrafts.items['guide:soemonoTitle'].updatedAt = new Date().toISOString();
          await saveLocalDrafts();
        });
        await page.locator('#confirmDraftReset').click();
        await page.waitForFunction(() => document.getElementById('draftResetStatus').textContent.includes('バックアップ後にメモが変わりました'));
        assert.equal(await page.evaluate(KEY => Object.keys(JSON.parse(localStorage.getItem(KEY)).items).length, KEY), 4);
      }
      const backup = await prepare();
      if (mode === 'browser') {
        await page.evaluate(KEY => {
          window.originalStorageSetItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) {
            if (key === KEY && JSON.parse(value).resetAt && !Object.keys(JSON.parse(value).items).length) throw new Error('simulated storage failure');
            return window.originalStorageSetItem.call(this, key, value);
          };
        }, KEY);
        await page.locator('#confirmDraftReset').click();
        await page.waitForFunction(() => document.getElementById('draftResetStatus').textContent.includes('リセットできませんでした'));
        assert.equal(await page.evaluate(KEY => Object.keys(JSON.parse(localStorage.getItem(KEY)).items).length, KEY), 4);
        await page.evaluate(() => {Storage.prototype.setItem = window.originalStorageSetItem;});
      }
      if (mode === 'file') {
        failWrite = true;
        await page.locator('#confirmDraftReset').click();
        await page.waitForFunction(() => document.getElementById('draftResetStatus').textContent.includes('リセットできませんでした'));
        assert.equal(Object.keys(file.items).length, 4);
        assert.equal(await page.evaluate(KEY => Object.keys(JSON.parse(localStorage.getItem(KEY)).items).length, KEY), 4);
        failWrite = false;
      }
      await page.locator('#confirmDraftReset').focus();
      await Promise.all([page.waitForEvent('load'), page.keyboard.press('Enter')]);
      await ready(page);
      assert.deepEqual(await page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)).items, KEY), {});
      if (mode === 'file') assert.deepEqual(file.items, {});
      assert.equal(await page.locator('#characterSearch').inputValue(), 'クラピカ');
      assert.equal(await page.evaluate(() => localStorage.getItem('hxh-succession-spoilers-revealed-v1')), 'true');
      assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-test-key')), 'keep');
      assert.match(await page.locator('#draftResetStatus').innerText(), /4件.*リセットしました/);
      const putsBeforeEmpty = puts;
      await page.locator('#resetLocalDrafts').click();
      await page.waitForFunction(() => document.getElementById('draftResetStatus').textContent.includes('リセットするメモ・編集はありません'));
      assert.equal(puts, putsBeforeEmpty);
      assert.ok(await page.evaluate(() => !eventsData.some(event => event.id === 'LOCAL-RESET-TEST')));
      await article.waitForFunction(() => document.querySelector('.local-editor textarea').disabled);
      assert.equal(await article.locator('.local-editor textarea').inputValue(), '');
      await article.reload();
      await article.locator('.local-editor textarea:not([disabled])').waitFor({state: 'attached'});
      assert.equal(await article.locator('.local-editor textarea').inputValue(), '');
      await article.close();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      fs.mkdirSync('.local/draft-reset-test', {recursive: true});
      await page.screenshot({path: `.local/draft-reset-test/${mode}-${width}.png`});
      // Backups remain compatible with the existing restore control after the generation changed.
      await page.locator('.local-drafts-backup > summary').click();
      await Promise.all([page.waitForEvent('load'), page.locator('#importLocalDrafts').setInputFiles({name: 'codex-notes-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))})]);
      await ready(page);
      assert.equal(await page.evaluate(KEY => Object.keys(JSON.parse(localStorage.getItem(KEY)).items).length, KEY), 4);
      assert.ok(await page.evaluate(() => eventsData.some(event => event.id === 'LOCAL-RESET-TEST')));
      assert.deepEqual(errors, []);
      console.log(`PASS ${mode} ${width}: backup/cancel, confirmed reset, failed-save safety, ${width === 1280 ? 'changed-backup guard, ' : ''}empty no-op, settings preserved, old article cleared, JSON restore`);
      await context.close();
    }
  } finally {await browser.close(); assert.equal(hash(), beforeHash, 'real personal notes must not change');}
})().catch(error => {console.error(error); process.exitCode = 1;});
