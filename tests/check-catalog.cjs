const assert = require('node:assert/strict');
const {auditBrowserCatalog,loadBrowserCatalog,selectBrowserChecks} = require('../scripts/check-catalog.cjs');
const catalog=loadBrowserCatalog(require('node:path').resolve(__dirname,'..'));
const fixture=[{name:'sample',groups:['drafts']}];
assert.throws(()=>auditBrowserCatalog(['sample-browser.cjs','forgotten-browser.cjs'],fixture),/Unregistered.*forgotten/);
assert.throws(()=>auditBrowserCatalog([],fixture),/Missing.*sample/);
assert.throws(()=>auditBrowserCatalog(['sample-browser.cjs'],[...fixture,...fixture]),/Duplicate/);
assert.throws(()=>auditBrowserCatalog(['sample-browser.cjs'],[{name:'sample',groups:[]}]),/Invalid/);
assert.throws(()=>auditBrowserCatalog(['sample-browser.cjs'],[{name:'sample',groups:['typo']}]),/Invalid/);
assert.throws(()=>selectBrowserChecks(catalog,'typo'),/Unknown browser group/);
assert.deepEqual(selectBrowserChecks(catalog,null),[]);
assert.equal(selectBrowserChecks(catalog,'all').length,catalog.length);
const union=selectBrowserChecks(catalog,'drafts,directory');
assert.equal(new Set(union.map(entry=>entry.name)).size,union.length);
for(const name of ['draft-inflight-checkpoint','draft-corruption','draft-field-merge']) {
  assert.ok(selectBrowserChecks(catalog,'drafts').some(entry=>entry.name===name));
  assert.ok(selectBrowserChecks(catalog,'critical').some(entry=>entry.name===name));
}
console.log(`PASS: ${catalog.length} browser checks registered; new, missing, duplicate and unclassified checks fail; group selection is complete and unique`);
