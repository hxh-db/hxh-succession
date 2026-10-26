// One non-mutating entry point for data, generated pages and regression checks.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--browser')) {
  console.error('Usage: node scripts/check-project.cjs [--browser]');
  process.exit(2);
}
const env = {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'};
const packages = path.join(ROOT, '.local/validation-packages');
if (fs.existsSync(packages)) env.PYTHONPATH = [packages, env.PYTHONPATH].filter(Boolean).join(path.delimiter);
const bundled = path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
if (fs.existsSync(path.join(bundled, 'playwright'))) env.NODE_PATH = [env.NODE_PATH, bundled].filter(Boolean).join(path.delimiter);
const python = process.env.PYTHON || 'python';
const checks = [
  [python, ['validate_data.py']],
  [process.execPath, ['scripts/build-personnel-roster.cjs', '--check']],
  [process.execPath, ['scripts/build-initial-personnel-review.cjs', '--check']],
  [process.execPath, ['scripts/build-character-pages.cjs', '--check']],
  [python, ['scripts/build-theories.py', '--check']],
  [python, ['scripts/build-web-research.py', '--check']],
  [python, ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py']]
];
for (const file of fs.readdirSync(path.join(ROOT, 'tests')).sort()) {
  if (!file.endsWith('.cjs') || file.includes('-browser') || file === 'serve-prefix.cjs') continue;
  checks.push([process.execPath, [`tests/${file}`]]);
}
if (args.includes('--browser')) {
  for (const name of ['draft-preservation', 'draft-reset', 'loading-recovery', 'spoiler-sync', 'event-link-spoilers', 'draft-recovery-backup', 'draft-corruption', 'draft-navigation', 'local-edit-display', 'draft-field-merge', 'event-creation', 'missing-record', 'draft-inflight-checkpoint', 'web-research']) {
    checks.push([process.execPath, [`tests/${name}-browser.cjs`]]);
  }
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
process.exitCode = failures ? 1 : 0;
