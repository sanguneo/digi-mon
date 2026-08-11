#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function testFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(resolved);
    return entry.isFile() && entry.name.endsWith('.test.mjs') ? [resolved] : [];
  });
}

const files = testFiles(path.join(ROOT, 'test')).sort();
if (files.length === 0) {
  console.error('test/**/*.test.mjs 파일이 없다');
  process.exitCode = 1;
} else {
  /**
   * 커버리지 수치를 함께 낸다. 문턱 게이트는 아직 없다 — 수치를 보기 전에 문턱부터
   * 정하면 순서가 거꾸로다. 지금은 "어디가 한 번도 안 돌았는지" 보이는 것이 목적이다.
   */
  const result = spawnSync(process.execPath, ['--test', '--experimental-test-coverage', ...files], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
}

