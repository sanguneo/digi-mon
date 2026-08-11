#!/usr/bin/env node
/**
 * 스키마 사용 검사.
 *
 * schema/*.json 은 계약이다. 그런데 계약을 아무도 컴파일하지 않으면 그냥 종이다.
 * 점검 시점에 스파인 스키마가 참조 0이었다 — 저장소 어디에서도 읽지 않는 죽은
 * 계약이었고, 스파인 산출물이 그 계약을 어겨도 아무 게이트도 울지 않았다.
 * 죽은 계약을 두는 것이 스키마가 없는 것보다 나쁘다. 있다고 믿게 만들기 때문이다.
 *
 * 각 스키마 파일 이름이 src·bin·tools·test 어딘가에서 참조되는지 본다. 참조가
 * 하나도 없으면 실패한다. 이 게이트는 이름을 하드코딩하지 않고 디렉터리를 읽으므로
 * 스키마를 새로 추가해도 자동으로 대상이 된다.
 *
 * 이 파일 자신은 검색에서 뺀다. 주석에 스키마 이름을 적는 것만으로 통과하면
 * 게이트가 스스로를 만족시킨다 — 실제로 첫 실행에서 그렇게 통과했다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEARCH_DIRS = ['src', 'bin', 'tools', 'test'];

function sourceFiles(dir) {
  const resolved = path.join(ROOT, dir);
  if (!fs.existsSync(resolved)) return [];
  return fs.readdirSync(resolved, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return entry.isFile() && entry.name.endsWith('.mjs') ? [child] : [];
  });
}

const schemaFiles = fs.readdirSync(path.join(ROOT, 'schema'))
  .filter((name) => name.endsWith('.schema.json'))
  .sort();

const SELF = path.relative(ROOT, fileURLToPath(import.meta.url)).replace(/\\/g, '/');
const files = SEARCH_DIRS.flatMap(sourceFiles)
  .filter((file) => file.replace(/\\/g, '/') !== SELF);
const texts = files.map((file) => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]);

const unreferenced = [];
const referenceCounts = [];
for (const schema of schemaFiles) {
  const users = texts.filter(([, text]) => text.includes(schema)).map(([file]) => file);
  referenceCounts.push([schema, users.length]);
  if (users.length === 0) unreferenced.push(schema);
}

console.log(`스키마 사용 검사: ${schemaFiles.length}개`);
for (const [schema, count] of referenceCounts) {
  console.log(`  ${count === 0 ? '✗' : '·'} ${schema}: 참조 ${count}곳`);
}

if (unreferenced.length > 0) {
  console.error('');
  console.error('참조 0인 스키마(아무도 강제하지 않는 계약이다):');
  for (const schema of unreferenced) console.error(`  schema/${schema}`);
  console.error('테스트나 게이트에서 컴파일하도록 배선하거나, 쓸 데가 없으면 지운다.');
  process.exitCode = 1;
}
