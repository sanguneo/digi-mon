import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'out', 'worksheets');
const TEST_SEEDS = ['cli-invalid', 'cli-collision', 'cli-forms'];

function runWorksheet(...args) {
  return spawnSync(
    process.execPath,
    [path.join(ROOT, 'bin', 'worksheet.mjs'), ...args],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: process.env,
    },
  );
}

function removeTestOutputs() {
  for (const name of readdirSync(OUT)) {
    if (TEST_SEEDS.some((seed) => name.includes(seed))) {
      rmSync(path.join(OUT, name), { force: true });
    }
  }
}

afterEach(removeTestOutputs);

test('--help prints usage without loading or generating a worksheet', () => {
  const result = runWorksheet('--help', '--subject', '__invalid__');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:|사용법:/);
  assert.doesNotMatch(result.stdout, /out\/worksheets/);
});

test('invalid count and difficulty fail without writing artifacts', () => {
  const invalidCount = runWorksheet(
    '--subject',
    'math',
    '--seed',
    'cli-invalid',
    '--count',
    'abc',
  );
  assert.notEqual(invalidCount.status, 0);
  assert.match(invalidCount.stderr, /count/);

  const invalidDifficulty = runWorksheet(
    '--subject',
    'math',
    '--seed',
    'cli-invalid',
    '--difficulty',
    '9',
  );
  assert.notEqual(invalidDifficulty.status, 0);
  assert.match(invalidDifficulty.stderr, /difficulty/);

  assert.equal(
    readdirSync(OUT).some((name) => name.includes('cli-invalid')),
    false,
  );
});

test('parallel forms write a deterministic manifest and one artifact set per form', () => {
  const result = runWorksheet(
    '--subject',
    'math',
    '--seed',
    'cli-forms',
    '--count',
    '2',
    '--difficulty',
    '1',
    '--forms',
    '3',
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /A\/B\/C/);

  const names = readdirSync(OUT).filter((name) => name.includes('cli-forms'));
  const manifestNames = names.filter((name) => name.endsWith('.forms.json'));
  assert.equal(manifestNames.length, 1);
  const manifest = JSON.parse(readFileSync(path.join(OUT, manifestNames[0]), 'utf8'));
  assert.equal(manifest.schema, 'digi-mon/worksheet-form-set@1');
  assert.equal(manifest.formCount, 3);
  assert.deepEqual(manifest.forms.map((form) => form.label), ['A', 'B', 'C']);
  assert.equal(names.filter((name) => name.endsWith('.answers.txt')).length, 3);
  assert.equal(
    names.filter((name) => name.endsWith('.txt') && !name.endsWith('.answers.txt')).length,
    3,
  );
});

test('same subject and seed with different options do not overwrite', () => {
  const first = runWorksheet(
    '--subject',
    'math',
    '--seed',
    'cli-collision',
    '--count',
    '1',
  );
  const second = runWorksheet(
    '--subject',
    'math',
    '--seed',
    'cli-collision',
    '--count',
    '2',
  );

  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  const jsonFiles = readdirSync(OUT).filter(
    (name) => name.includes('cli-collision') && name.endsWith('.json'),
  );
  assert.equal(jsonFiles.length, 2);
});

