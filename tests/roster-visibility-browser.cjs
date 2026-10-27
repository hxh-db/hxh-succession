/* Keep all 230 departure slots visible without treating unidentified slots as confirmed people. */
const {chromium} = require('./helpers/isolated-browser.cjs');

const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const roster = require('../data/personnel_roster.json');
const people = require('../data/characters.json');
const {select} = require('../personnel-roster.js');

(async () => {
  let browser;
  const port = '18772', root = `http://127.0.0.1:${port}/`;
  try {

    browser = await chromium.launch({channel: 'msedge', headless: true});
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({viewport: {width, height: 844}});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/drafts', route => route.fulfill({contentType: 'application/json',
        body: JSON.stringify({format: 'hxh-succession-local-drafts', version: 1, items: {}, entries: []})}));
      const ready = () => page.waitForFunction(() => viewLinksReady && !restoringReadingState);
      const loadAll = async () => {while (await page.locator('#characterMoreButton').isVisible()) await page.locator('#characterMoreButton').click();};
      await page.goto(root + '?c_group=personnel&c_when=departure#characters'); await ready();
      assert.equal(await page.locator('.directory-character-card').count(), 60, 'preserve incremental rendering');
      assert.equal(await page.evaluate(() => currentCharacterResults.length), 230);
      await loadAll();
      const initial = await page.locator('.directory-character-card').evaluateAll(cards => cards.map(card => card.dataset.characterId));
      assert.equal(initial.length, 230);
      assert.equal(new Set(initial).size, 230);
      assert.deepEqual(initial.slice().sort(), roster.members.map(m => m.character_id).sort());
      assert.ok(!initial.some(id => id.startsWith('VIEW-')));
      assert.ok(!initial.includes('EII-T01'));
      // INIT-P02-STAFF-16 is now an individually observed attendant (chapter 416).
      assert.equal(people.find(p => p.id === 'INIT-P02-STAFF-16').is_count_only, false);
      assert.equal(await page.locator('.directory-character-card[data-character-id="INIT-P02-STAFF-16"] .nen-knowledge-label').count(), 0, 'keep redundant Nen status off directory cards');
      assert.match(await page.locator('#personnelRosterSummary').innerText(), /230枠.*個人未同定：114枠.*仮登録として一覧に表示/);
      const unknown = page.locator('.directory-character-card[data-character-id="INIT-P03-PRIVATE-04"]');
      assert.match(await unknown.innerText(), /個人未同定（人数枠）/);
      assert.match(await unknown.innerText(), /氏名・顔との対応が未確認/);
      assert.equal(await unknown.locator('.nen-knowledge-label').count(), 0, 'Count-only slots must not suggest an individual ability review');
      assert.equal(await unknown.locator('.character-avatar img, .character-avatar-image, .avatar img').count(), 0);
      await unknown.locator('h3 a').focus(); await page.keyboard.press('Enter');
      await page.waitForURL('**/characters/INIT-P03-PRIVATE-04/');
      assert.match(await page.locator('#modalContent').innerText(), /仮登録/);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('detailModal').classList.contains('hidden'));
      assert.equal(await page.locator('.directory-character-card').count(), 230);
      await page.reload(); await ready();
      assert.equal(await page.evaluate(() => currentCharacterResults.length), 230);
      await page.locator('#characterFilterToggle').click();
      for (let queen = 1; queen <= 7; queen++) {
        await page.locator('#characterQueenFilter').selectOption(String(queen));
        const ids = await page.locator('.directory-character-card').evaluateAll(cards => cards.map(card => card.dataset.characterId));
        const expected = select(roster, people, {period: 'departure', queen}).map(p => p.id);
        assert.deepEqual(ids.slice().sort(), expected.slice().sort());
        assert.equal(new Set(ids).size, expected.length);
        assert.ok(ids.includes(`VIEW-Q${queen}-P14-MONITORS`), 'show the queen-specific view, not an extra global person');
      }
      await page.locator('#characterQueenFilter').selectOption('1');
      assert.equal(await page.locator('.directory-character-card').count(), 12);
      await page.locator('#globalSpoilerToggle').click();
      await page.locator('#characterPeriodFilter').selectOption('chapter-374');
      assert.equal(await page.locator('.directory-character-card').count(), 12);
      assert.match(await page.locator('#personnelRosterSummary').innerText(), /履歴なし：9枠/);
      fs.mkdirSync('.local/roster-visibility-20261025', {recursive: true});
      await page.screenshot({path: `.local/roster-visibility-20261025/queen1-${width}.png`});
      await page.locator('#characterQueenFilter').selectOption('all');
      await page.locator('#characterSearch').fill('ヒュリコフ');
      await page.locator('.directory-character-card[data-character-id="P01-P06"] h3 a').click();
      await page.locator('#detailModal details').evaluateAll(details => details.forEach(detail => {detail.open = true;}));
      assert.doesNotMatch(await page.locator('#modalContent').innerText(), /第413話|第415話|第417話|鋼の錬金術師/);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('detailModal').classList.contains('hidden'));
      await page.locator('#characterSearch').fill('');
      for (const [period, expected] of [['departure', false], ['chapter-393', false], ['chapter-394', true], ['latest', true], ['all', true]]) {
        await page.locator('#characterPeriodFilter').selectOption(period);
        assert.equal(await page.evaluate(() => currentCharacterResults.some(p => p.id === 'EII-T01')), expected, period);
        assert.ok(await page.evaluate(() => new Set(currentCharacterResults.map(p => p.id)).size === currentCharacterResults.length));
      }
      await page.locator('#clearCharacterFilters').click();
      const all = await page.evaluate(() => currentCharacterResults.map(p => p.id));
      assert.ok(roster.members.every(m => all.includes(m.character_id)), 'all-people view also includes the initial slots');
      assert.ok(!all.some(id => id.startsWith('VIEW-')));
      assert.ok(all.includes('EII-T01'));
      assert.equal(await page.locator('.directory-character-card').count(), 60);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}: 230 unique initial cards, 7 queen lists, slot labels, no borrowed faces, history/reload, late-entry limits and all-people view`);
    }
  } finally {await browser?.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
