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
  const result = spawnSync(process.execPath, ['--test', ...files], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
}

