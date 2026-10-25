const {chromium} = require('playwright');
const {spawn} = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  let server, browser;
  const base = 'http://127.0.0.1:18773/';
  const id = 'INIT-P02-STAFF-16';
  try {
    server = spawn('python', ['local_server.py'], {cwd: path.resolve(__dirname, '..'), windowsHide: true,
      env: {...process.env, SUCCESSION_LOCAL_PORT: '18773', SUCCESSION_NOTES_DIR: path.resolve(__dirname, '../.local/camilla-attendants/drafts')},
      stdio: ['ignore', 'pipe', 'ignore']});
    await new Promise((resolve, reject) => {
      server.once('error', reject); server.once('exit', code => reject(Error(`server exited ${code}`)));
      server.stdout.once('data', resolve);
    });
    browser = await chromium.launch({channel: 'msedge', headless: true});
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({viewport: {width, height: 844}});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/drafts', route => route.fulfill({contentType: 'application/json',
        body: JSON.stringify({format: 'hxh-succession-local-drafts', version: 1, items: {}, entries: []})}));
      const ready = () => page.waitForFunction(() => viewLinksReady && !restoringReadingState);
      await page.goto(`${base}?c_search=${encodeURIComponent('カミーラ従事者1')}#characters`); await ready();
      const link = page.locator(`.directory-character-card[data-character-id="${id}"] h3 a`);
      assert.equal(await link.count(), 1);
      await link.click();
      assert.ok(await page.locator('#detailModal .modal-person-timeline').isHidden());
      await page.keyboard.press('Escape');
      await page.locator('#globalSpoilerToggle').click();
      await link.click();
      assert.ok(await page.locator('#detailModal .modal-person-timeline [data-event-id="E416-004"]').isVisible());
      assert.match(await page.locator('#detailModal').innerText(), /死亡/);
      assert.ok(await page.locator('#detailModal img').evaluateAll(imgs => imgs.some(img => img.complete && img.naturalWidth > 0)));
      assert.ok(await page.locator('#detailModal .modal-card').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.goto(`${base}?c_group=personnel&c_when=chapter-374&person=${id}&detail=1#characters`); await ready();
      assert.equal(await page.locator('#detailModal .modal-person-timeline [data-event-id="E416-004"]').count(), 0);
      assert.doesNotMatch(await page.locator('#detailModal').innerText(), /ベンジャミンの銃撃を受けて死亡/);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS: Camilla attendants search, spoiler gate, event timeline and historical view at ${width}px`);
    }
    const noJs = await browser.newContext({javaScriptEnabled: false});
    const page = await noJs.newPage();
    for (const person of ['INIT-P02-STAFF-16', 'P02-P15']) {
      const response = await page.goto(`${base}characters/${person}/`);
      assert.equal(response.status(), 200);
      assert.match(await page.locator('h1').innerText(), /カミーラ従事者|フカタキ/);
      assert.ok(await page.locator('img').first().evaluate(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('.character-page-spoilers').getAttribute('open'), null);
      await page.locator('.character-page-spoilers > summary').click();
      assert.match(await page.locator('.character-status-history').innerText(), /第416話：死亡/);
    }
    await noJs.close();
    console.log('PASS: both standalone pages work without JavaScript and keep deaths collapsed initially');
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
