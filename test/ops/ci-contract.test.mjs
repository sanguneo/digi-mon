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
  assert.equal(pkg.scripts['check:types'], 'node tools/check-types.mjs');
  assert.equal(pkg.license, 'MIT');
});

test('type check runs without a build step and covers the engine', () => {
  const pkg = JSON.parse(read('package.json'));
  // typescript 는 devDependency 로만 둔다. 런타임 의존성 0개가 이 저장소의 계약이다.
  assert.ok(pkg.devDependencies.typescript, 'typescript 가 devDependency 에 없다');
  assert.equal(pkg.dependencies, undefined);

  const tsconfig = JSON.parse(read('tsconfig.json'));
  assert.equal(tsconfig.compilerOptions.checkJs, true);
  assert.equal(tsconfig.compilerOptions.noEmit, true, '빌드 단계를 만들지 않는다');
  assert.ok(tsconfig.include.some((pattern) => pattern.startsWith('src/engine')));
});

test('CI pins actions and runs tests, verification, and freshness checks', () => {
  const workflow = read('.github/workflows/ci.yml');
  const actionUses = [...workflow.matchAll(/uses:\s+[^@\s]+@([a-f0-9]{40})/g)];
  assert.equal(actionUses.length, 2);
  assert.match(workflow, /run: npm run check:types/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run verify/);
  assert.match(workflow, /run: npm run check:artifacts/);
  assert.doesNotMatch(workflow, /korean-elementary-learning-map/);
});

test('agent session directories stay outside source control', () => {
  assert.match(read('.gitignore'), /^\.senpi\/$/m);
});

