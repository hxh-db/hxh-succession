const fs = require('node:fs');
const path = require('node:path');
const GROUPS = ['critical','drafts','directory','navigation','research'];
function auditBrowserCatalog(files, catalog) {
  if (!Array.isArray(catalog)) throw new Error('Browser check catalog must be an array');
  const available = new Set(files.filter(file => file.endsWith('-browser.cjs')));
  const seen = new Set();
  for (const entry of catalog) {
    if (!entry || typeof entry.name !== 'string' || !/^[a-z0-9-]+$/.test(entry.name) ||
        !Array.isArray(entry.groups) || !entry.groups.length || new Set(entry.groups).size !== entry.groups.length ||
        entry.groups.some(group => !GROUPS.includes(group))) throw new Error(`Invalid browser check registration: ${JSON.stringify(entry)}`);
    if (seen.has(entry.name)) throw new Error(`Duplicate browser check: ${entry.name}`);
    seen.add(entry.name);
    if (!available.delete(`${entry.name}-browser.cjs`)) throw new Error(`Missing browser check file: ${entry.name}-browser.cjs`);
  }
  if (available.size) throw new Error(`Unregistered browser checks: ${[...available].sort().join(', ')}. Add each to scripts/browser-checks.json.`);
  return catalog;
}
function loadBrowserCatalog(root) {
  return auditBrowserCatalog(fs.readdirSync(path.join(root,'tests')), JSON.parse(fs.readFileSync(path.join(root,'scripts/browser-checks.json'),'utf8')));
}
function selectBrowserChecks(catalog, selection) {
  if (!selection) return [];
  const groups = selection.split(',');
  for (const group of groups) if (group !== 'all' && !GROUPS.includes(group)) throw new Error(`Unknown browser group: ${group}. Choose ${[...GROUPS,'all'].join(', ')}.`);
  return catalog.filter(entry => groups.includes('all') || entry.groups.some(group => groups.includes(group)));
}
module.exports = {GROUPS,auditBrowserCatalog,loadBrowserCatalog,selectBrowserChecks};
