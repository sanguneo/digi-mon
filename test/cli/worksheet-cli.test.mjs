import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'out', 'worksheets');
const TEST_SEEDS = ['cli-invalid', 'cli-collision'];

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

