// One non-mutating entry point for data, generated pages and regression checks.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {loadBrowserCatalog,selectBrowserChecks} = require('./check-catalog.cjs');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.some(arg => !['--browser','--list','--only-browser'].includes(arg) && !arg.startsWith('--browser=')) ||
    args.filter(arg => arg === '--browser' || arg.startsWith('--browser=')).length > 1 ||
    (args.includes('--only-browser') && !args.some(arg => arg === '--browser' || arg.startsWith('--browser=')))) {
  console.error('Usage: node scripts/check-project.cjs [--browser[=critical|drafts|directory|navigation|research|all]] [--only-browser] [--list]');
  process.exit(2);
}
const env = {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'};
const packages = path.join(ROOT, '.local/validation-packages');
if (fs.existsSync(packages)) env.PYTHONPATH = [packages, env.PYTHONPATH].filter(Boolean).join(path.delimiter);
const bundled = path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
if (fs.existsSync(path.join(bundled, 'playwright'))) env.NODE_PATH = [env.NODE_PATH, bundled].filter(Boolean).join(path.delimiter);
const python = process.env.PYTHON || 'python';
let catalog, selected;
try {
  catalog = loadBrowserCatalog(ROOT);
  const browserArg = args.find(arg => arg === '--browser' || arg.startsWith('--browser='));
  if (browserArg === '--browser=') throw new Error('Specify a browser group after --browser=');
  selected = selectBrowserChecks(catalog, browserArg === '--browser' ? 'critical' : browserArg?.slice('--browser='.length));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const browserTemp = path.join(ROOT,'.local/browser-runtime-temp');
if (selected.length && !args.includes('--list')) {
  fs.mkdirSync(browserTemp,{recursive:true});
  env.TEMP = env.TMP = browserTemp;
}
const checks = [
  [python, ['validate_data.py']],
  [process.execPath, ['scripts/build-personnel-roster.cjs', '--check']],
  [process.execPath, ['scripts/build-initial-personnel-review.cjs', '--check']],
  [process.execPath, ['scripts/build-character-pages.cjs', '--check']],
  [python, ['scripts/build-theories.py', '--check']],
  [python, ['scripts/build-web-research.py', '--check']],
  [python, ['scripts/build-review-status.py', '--check']],
  [python, ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py']]
];
for (const file of fs.readdirSync(path.join(ROOT, 'tests')).sort()) {
  if (!file.endsWith('.cjs') || file.includes('-browser') || file === 'serve-prefix.cjs') continue;
  checks.push([process.execPath, [`tests/${file}`]]);
}
if (args.includes('--only-browser')) checks.length = 0;
for (const {name} of selected) checks.push([process.execPath,[`tests/${name}-browser.cjs`]]);
const selectedNames = new Set(selected.map(entry=>entry.name));
const skipped = catalog.filter(entry=>!selectedNames.has(entry.name));
if (args.includes('--list')) {
  for (const [,argv] of checks) console.log(`SELECTED ${argv.join(' ')}`);
  for (const entry of catalog) console.log(`BROWSER ${selectedNames.has(entry.name)?'selected':'not selected'} tests/${entry.name}-browser.cjs [${entry.groups.join(', ')}]`);
  console.log(`${checks.length} selected checks; ${skipped.length} browser checks not selected. Listing only; no checks executed.`);
  process.exit(0);
}
let failures = 0;
for (const [command, argv] of checks) {
  const result = spawnSync(command, argv, {cwd: ROOT, env, encoding: 'utf8', windowsHide: true,
    maxBuffer: 4 * 1024 * 1024, timeout: 300000});
  const label = argv.join(' ');
  if (result.status !== 0 || result.error) {
    failures++;
    console.error(`FAIL ${label}\n${result.error?.message || ''}\n${result.stdout || ''}${result.stderr || ''}`);
  } else console.log(`PASS ${label}`);
}
console.log(`${checks.length - failures}/${checks.length} checks passed. No generated files were written.`);
if (skipped.length) console.log(`NOT RUN: ${skipped.length} browser checks (${skipped.map(entry=>entry.name).join(', ')}). Use --browser=all or --list to inspect selection.`);
process.exitCode = failures ? 1 : 0;
