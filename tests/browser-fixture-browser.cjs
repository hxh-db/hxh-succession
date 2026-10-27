const assert = require('node:assert/strict');
const http = require('node:http');
const {chromium} = require('./helpers/isolated-browser.cjs');
(async () => {
  let hits = 0;
  const otherServer = http.createServer((_request, response) => {hits++;response.end('unrelated service');});
  await new Promise((resolve, reject) => {otherServer.once('error', reject);otherServer.listen(0, '127.0.0.1', resolve);});
  let browser;
  try {
    browser = await chromium.launch({channel:'msedge',headless:true});
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${otherServer.address().port}/`);
    const result = await page.evaluate(async () => {
      const file = await fetch('/api/drafts'), original = await file.json(), revision = file.headers.get('ETag');
      const write = async headers => {
        const response = await fetch('/api/drafts', {method:'PUT',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({...original,items:{'guide:test':{memo:'isolated'}}})});
        return response.status;
      };
      const missing = await write({}), stale = await write({'If-Match':'"stale"'});
      const before = await (await fetch('/api/drafts')).json();
      const saved = await write({'If-Match':revision});
      const afterResponse = await fetch('/api/drafts'), after = await afterResponse.json();
      return {original,before,missing,stale,saved,after,newRevision:afterResponse.headers.get('ETag'),revision,
        privateStatus:(await fetch('/.local/drafts.json')).status};
    });
    assert.equal(result.missing,428);
    assert.equal(result.stale,412);
    assert.deepEqual(result.original,result.before);
    assert.equal(result.saved,200);
    assert.equal(result.after.items['guide:test'].memo,'isolated');
    assert.notEqual(result.revision,result.newRevision);
    assert.equal(result.privateStatus,404);
    assert.equal(hits,0,'Existing servers must receive no browser-test traffic');
    assert.ok(otherServer.listening,'The unrelated server must remain running');
    console.log('PASS: isolated browser intercepts all site traffic, preserves unrelated server, requires ETag and blocks private paths');
  } finally {
    try {await browser?.close();}
    finally {await new Promise(resolve => otherServer.close(resolve));}
  }
})().catch(error => {console.error(error);process.exitCode=1;});
