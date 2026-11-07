const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {fixture, ready} = require('./helpers/browser-fixture.cjs');

async function verify(browser, width) {
  const {context, base} = await fixture(browser, {width, local:false, prefix:'/hxh-succession'});
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const range = page.locator('#spoilerRange');
    const article = page.locator('.spoiler-article');
    const articleSummary = article.locator(':scope > summary');
    const evidence = article.locator('[data-section="evidence"]');
    const evidenceSummary = evidence.locator(':scope > summary');
    const lastLink = evidence.locator('a[href*="event="]').last();
    const sourceUrl = base + 'theories/Q012/?q=' + encodeURIComponent('クラピカ') + '&read=369';
    const hasFocus = node => node.evaluate(element => element === document.activeElement);
    const visit = async (fragment, value) => {
      if (!await range.count()) {
        await page.goto(sourceUrl);
        await range.waitFor();
      }
      if (await range.inputValue() !== value) await range.selectOption(value);
      await page.goto(sourceUrl + fragment, {waitUntil:'commit'});
      await range.waitFor();
      if (!await article.evaluate(element => element.open)) await articleSummary.click();
      if (fragment) {
        await page.waitForFunction(() => document.activeElement?.parentElement?.dataset.section === 'evidence');
      } else {
        await evidenceSummary.click();
      }
    };
    const capture = async () => {
      await lastLink.focus();
      await lastLink.scrollIntoViewIfNeeded();
      return {url:page.url(), destination:await lastLink.evaluate(link => link.href), y:await page.evaluate(() => scrollY)};
    };
    const back = async source => {
      await page.goBack({waitUntil:'commit'});
      await page.waitForURL(source.url, {waitUntil:'commit'});
      await range.waitFor();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const verifyReturn = async source => {
      assert.ok(await article.evaluate(element => element.open));
      assert.ok(await evidence.evaluate(element => element.open));
      assert.ok(await hasFocus(lastLink), 'return to the exact evidence link');
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - source.y) < 3);
      assert.equal(new URL(page.url()).searchParams.get('read'), '369');
    };
    for (const [fragment, value] of [['#evidence', 'all'], ['', 'basic']]) {
      await visit(fragment, value);
      const source = await capture();
      const destination = new URL(source.destination);
      assert.equal(destination.searchParams.get('event'), 'E361-008');
      assert.equal(destination.searchParams.get('from_theory'), 'Q012');
      assert.equal(destination.searchParams.get('theory_q'), 'クラピカ');
      assert.equal(destination.searchParams.get('theory_read'), '369');
      if (fragment) await lastLink.press('Enter');
      else await lastLink.click();
      await page.waitForURL(source.destination, {waitUntil:'commit'});
      await ready(page);
      await back(source);
      await verifyReturn(source);
      assert.equal(await range.inputValue(), value);
      await page.goForward({waitUntil:'commit'});
      await ready(page);
      await back(source);
      await verifyReturn(source);
    }

    await visit('#evidence', 'all');
    const native = await capture();
    const nativeHistory = await page.evaluate(() => history.state?.theoryEvidenceReading);
    const popupPromise = context.waitForEvent('page');
    await lastLink.click({modifiers:['Control']});
    const popup = await popupPromise;
    await popup.bringToFront();
    await popup.waitForURL(native.destination, {waitUntil:'commit'});
    assert.equal(page.url(), native.url);
    assert.deepEqual(await page.evaluate(() => history.state?.theoryEvidenceReading), nativeHistory);
    await popup.close();
    await page.bringToFront();

    await lastLink.press('Enter');
    await ready(page);
    await back(native);
    await verifyReturn(native);
    await evidenceSummary.click();
    await page.reload();
    await range.waitFor();
    await page.waitForFunction(() => document.activeElement?.parentElement?.dataset.section === 'evidence');
    assert.equal(await evidence.evaluate(element => element.open), false, 'a manual close takes precedence over the fragment and old return state');

    // A copy of the same address starts directly at the evidence section.
    const direct = await context.newPage();
    await direct.goto(native.url);
    await direct.waitForFunction(() => document.activeElement?.parentElement?.dataset.section === 'evidence');
    assert.ok(await direct.locator('[data-section="evidence"]').evaluate(element => element.open));
    await direct.close();
    await page.bringToFront();
    await page.locator('.toc a[href="#evidence"]').click();
    await page.waitForFunction(() => document.querySelector('[data-section="evidence"]').open);

    const latest = await capture();
    await lastLink.press('Enter');
    await ready(page);
    await range.selectOption('basic');
    await back(latest);
    assert.equal(await range.inputValue(), 'basic');
    assert.ok(await hasFocus(articleSummary));
    assert.equal(await article.evaluate(element => element.open), false);
    assert.match(await page.title(), /^考察記事/);
    assert.deepEqual(errors, []);
    console.log('PASS ' + width + ': direct fragments and manual folds, exact history return, native tabs, manual close and latest basic setting');
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    for (const width of [1280, 390]) await verify(browser, width);
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
