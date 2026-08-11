import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

/**
 * 스파인 산출물이 스파인 스키마를 지키는지 본다.
 *
 * schema/spine.schema.json 은 참조 0인 죽은 계약이었다. 계약이 있는데 아무도
 * 컴파일하지 않으면, 산출물이 계약을 어겨도 조용하다. 여기서 실제 산출물을
 * 물려 계약을 살린다. ajv 는 devDependency 로만 쓴다 — 런타임 의존성 0개는
 * 이 저장소의 계약이다(REVIEW.md §1).
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson(...segments) {
  return JSON.parse(readFileSync(path.join(ROOT, ...segments), 'utf8'));
}

test('spine artifact satisfies schema/spine.schema.json', () => {
  const schema = readJson('schema', 'spine.schema.json');
  const artifact = readJson('data', 'spine', 'standards.json');

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  assert.equal(
    validate(artifact),
    true,
    JSON.stringify(validate.errors?.slice(0, 5), null, 2),
  );
  assert.equal(artifact.standards.length, artifact.standardCount);
});

test('spine schema pins the artifact version it describes', () => {
  const schema = readJson('schema', 'spine.schema.json');
  const artifact = readJson('data', 'spine', 'standards.json');
  // 스키마가 다른 버전의 산출물을 검사하고 있으면 통과해도 의미가 없다.
  assert.equal(schema.properties.schema.const, artifact.schema);
});
