// Serve real project files through Playwright routing, with isolated in-memory notes.
const fs = require('node:fs');
const path = require('node:path');
const DraftState = require('../../draft-state.js');
const ROOT = path.resolve(__dirname, '../..');
const MIME = {'.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png'};
const empty = () => ({format: 'hxh-succession-local-drafts', version: 1, items: {}, entries: []});
async function routeSite(context, {prefix = '', drafts = empty()} = {}) {
  const state = {drafts: structuredClone(drafts), revision: 0, failPut: false, failGet: false, puts: 0, failData: null};
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/api/drafts')) {
      if (route.request().method() === 'GET' && state.failGet) return route.fulfill({status: 503, body: '{}'});
      if (route.request().method() === 'PUT') {
        state.puts++;
        if (state.failPut) return route.fulfill({status: 500, body: '{}'});
        let payload;
        try {
          payload=route.request().postDataJSON();DraftState.validateSnapshot(payload,{required:true});
          if(payload.format!=='hxh-succession-local-drafts' || !Array.isArray(payload.entries)) throw new Error('invalid envelope');
        } catch (_) {return route.fulfill({status:400,body:'{}'});}
        const revision = route.request().headers()['if-match'];
        if (!revision) return route.fulfill({status: 428, body: '{}'});
        if (revision !== `"${state.revision}"`) return route.fulfill({status: 412, body: '{}'});
        if(state.drafts.version>payload.version) return route.fulfill({status:409,body:'{}'});
        state.drafts = payload;
        state.revision++;
      }
      return route.fulfill({contentType: 'application/json', headers: {ETag: `"${state.revision}"`}, body: JSON.stringify(state.drafts)});
    }
    let relative = decodeURIComponent(url.pathname).slice(prefix.length).replace(/^\//, '');
    if (relative.split('/').some(part => part.startsWith('.'))) return route.fulfill({status: 404, body: ''});
    if (relative === state.failData) return route.fulfill({status: 503, body: 'test failure'});
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const localPath = path.resolve(ROOT, relative);
    if (!localPath.startsWith(ROOT + path.sep) || !fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
      return route.fulfill({status: 404, body: ''});
    }
    return route.fulfill({contentType: MIME[path.extname(localPath)] || 'application/octet-stream', body: fs.readFileSync(localPath)});
  });
  return state;
}
async function fixture(browser, {width = 1280, local = true, prefix = '', drafts = empty(), javaScriptEnabled = true} = {}) {
  const base = (local ? 'http://127.0.0.1:18781' : 'https://hxh-quality.test') + prefix + '/';
  const context = await browser.newContext({viewport: {width, height: 900}, javaScriptEnabled});
  const state = await routeSite(context, {prefix, drafts});
  return {context, base, state};
}
const ready = page => page.waitForFunction(() => typeof viewLinksReady !== 'undefined' && viewLinksReady && !restoringReadingState && document.getElementById('main-content').getAttribute('aria-busy') === 'false');
module.exports = {fixture, routeSite, ready, ROOT, empty};
