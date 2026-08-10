import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

test('package scripts expose isolated tests and artifact freshness', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.test, 'node tools/run-tests.mjs');
  assert.equal(
    pkg.scripts['check:artifacts'],
    'git diff --exit-code -- data docs/review REVIEW.md',
  );
  assert.equal(pkg.license, 'MIT');
});

test('CI pins actions and runs tests, verification, and freshness checks', () => {
  const workflow = read('.github/workflows/ci.yml');
  const actionUses = [...workflow.matchAll(/uses:\s+[^@\s]+@([a-f0-9]{40})/g)];
  assert.equal(actionUses.length, 2);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run verify/);
  assert.match(workflow, /run: npm run check:artifacts/);
  assert.doesNotMatch(workflow, /korean-elementary-learning-map/);
});

test('agent session directories stay outside source control', () => {
  assert.match(read('.gitignore'), /^\.senpi\/$/m);
});

