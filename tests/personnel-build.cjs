'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'hxh-personnel-build-'));
const rosterScript = 'scripts/build-personnel-roster.cjs';
const reviewScript = 'scripts/build-initial-personnel-review.cjs';
const assignments = 'data/intake/initial_personnel_assignments_20261013.json';
const coverage = 'data/intake/initial_personnel_coverage_20261013.json';
const inputs = [rosterScript, reviewScript, 'personnel-roster.js',
  'data/characters.json', 'data/events.json', 'data/character_images.json',
  'data/count_only_characters.json', 'data/personnel_roster_overrides.json',
  'data/personnel_snapshots.json', assignments,
  'data/intake/initial_personnel_review_20261013.json'];
const read = file => fs.readFileSync(path.join(fixture, file), 'utf8');
const readJSON = file => JSON.parse(read(file));
const writeJSON = (file, value) => fs.writeFileSync(path.join(fixture, file), JSON.stringify(value, null, 2) + '\n');
const hashes = () => Object.fromEntries(fs.readdirSync(fixture, {recursive: true})
  .filter(file => fs.statSync(path.join(fixture, file)).isFile())
  .sort().map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(fixture, file))).digest('hex')]));
function run(script, check = false, failure = null) {
  const before = hashes();
  const result = spawnSync(process.execPath, [script, ...(check ? ['--check'] : [])], {
    cwd: fixture, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024
  });
  assert.ifError(result.error);
  const output = result.stdout + result.stderr;
  if (failure) {
    assert.notEqual(result.status, 0, output);
    assert.match(output, failure);
  } else assert.equal(result.status, 0, output);
  if (check) assert.deepEqual(hashes(), before, '--check must not modify any input or output');
}

try {
  for (const file of inputs) {
    fs.mkdirSync(path.dirname(path.join(fixture, file)), {recursive: true});
    fs.copyFileSync(path.join(root, file), path.join(fixture, file));
  }
  // A newly reviewed face may be appended after generated records. Rebuild
  // must retain that person and converge to a stable, complete generated file.
  const people = readJSON('data/characters.json');
  const face = people.find(person => person.id === 'HA-U01');
  assert.ok(face, 'The reviewed chapter-383 face must remain registered');
  writeJSON('data/characters.json', [...people.filter(person => person.id !== face.id), face]);
  run(rosterScript);
  run(reviewScript);
  assert.deepEqual(readJSON('data/characters.json').find(person => person.id === face.id), face);
  const report = readJSON(coverage);
  assert.equal(report.summary.initial_slots, 230);
  assert.equal(report.record_reviews.find(person => person.id === face.id).status, 'face_reference');
  assert.ok(!readJSON('data/personnel_roster.json').members.some(member => member.character_id === face.id));
  const stable = hashes();
  run(rosterScript);
  run(reviewScript);
  assert.deepEqual(hashes(), stable, 'Two complete builds must produce identical files');
  run(rosterScript, true);
  run(reviewScript, true);

  // Simulate core.autocrlf: the reports and source hashes represent identical
  // content across LF, CRLF and mixed checkouts, and checks remain read-only.
  for (const file of fs.readdirSync(fixture, {recursive: true}).filter(file => /\.(json|md)$/.test(file))) {
    fs.writeFileSync(path.join(fixture, file), read(file).replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'));
  }
  run(rosterScript, true);
  run(reviewScript, true);
  run(rosterScript);
  run(reviewScript);
  assert.deepEqual(readJSON(coverage), report, 'Checkout line endings must not change source hashes');
  run(rosterScript, true);
  run(reviewScript, true);

  // Real content changes must still fail, even if the change is only in an
  // input field whose text is not repeated in the generated report.
  const configText = read(assignments);
  const config = JSON.parse(configText);
  writeJSON(assignments, {...config, regression_test_note: 'changed source content'});
  run(reviewScript, true, /再生成が必要/);
  fs.writeFileSync(path.join(fixture, assignments), configText);
  run(reviewScript, true);
  fs.appendFileSync(path.join(fixture, 'data/personnel_roster_report.md'), '\nSTALE REPORT\n');
  run(rosterScript, true, /再生成が必要/);
  run(rosterScript);
  run(reviewScript, true);

  // Reproduce the original classification omission without bypassing it or
  // assigning an uncertain face to an initial personnel slot.
  const unclassified = structuredClone(config);
  for (const review of unclassified.record_reviews) review.ids = review.ids.filter(id => id !== face.id);
  writeJSON(assignments, unclassified);
  run(reviewScript, true, /未分類の人員レコード:.*HA-U01/);
  fs.writeFileSync(path.join(fixture, assignments), configText);
  run(reviewScript, true);
  console.log('PASS: personnel builds converge; LF/CRLF checks are read-only; stale inputs, outputs and missing HA-U01 classification fail');
} finally {
  fs.rmSync(fixture, {recursive: true, force: true});
}
