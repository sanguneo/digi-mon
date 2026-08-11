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
  assert.equal(pkg.scripts['check:markdown'], 'markdownlint-cli2');
  assert.equal(
    pkg.scripts['export:quality-baseline'],
    'node tools/export-quality-baseline.mjs',
  );
  assert.match(pkg.scripts.verify, /node tools\/export-quality-baseline\.mjs/);
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
  assert.match(workflow, /run: npm run check:markdown/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run verify/);
  assert.match(workflow, /run: npm run check:artifacts/);
  assert.doesNotMatch(workflow, /korean-elementary-learning-map/);
});

test('declared Node version is the one CI actually verifies', () => {
  // 약속과 검증이 갈리면 둘 중 하나는 거짓이다. package.json 은 20 이상을
  // 선언하는데 CI 는 24만 돌린 적이 있다 — 20 은 아무도 검증하지 않는 약속이었다.
  const pkg = JSON.parse(read('package.json'));
  const declared = pkg.engines.node.match(/^>=(\d+)$/);
  assert.ok(declared, `engines.node 형식이 '>=주버전' 이 아니다: ${pkg.engines.node}`);

  const workflow = read('.github/workflows/ci.yml');
  const versions = [...workflow.matchAll(/node-version:\s*(\d+)/g)].map((m) => m[1]);
  assert.ok(versions.length > 0, 'CI 에 node-version 이 없다');
  assert.ok(
    versions.includes(declared[1]),
    `engines.node ${pkg.engines.node} 를 CI 가 검증하지 않는다 (CI: ${versions.join(', ')})`,
  );

  const readme = read('README.md');
  assert.match(readme, new RegExp(`Node\\.js ${declared[1]} 이상`));
});

test('agent session directories stay outside source control', () => {
  assert.match(read('.gitignore'), /^\.senpi\/$/m);
});

