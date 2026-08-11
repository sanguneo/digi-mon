import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import { createRegistry } from '../../src/engine/registry.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';
import { createApp } from '../../src/server/app.mjs';

/**
 * HTTP 응답이 스키마를 지키는지 본다.
 *
 * 엔진 출력은 이미 스키마로 검증되지만(worksheet-forms.test.mjs 등), 실제로
 * 클라이언트가 받는 것은 서버가 투영·가공한 응답이다. 정답 제거 투영이나 새 필드가
 * 계약을 깨도 엔진 테스트는 초록이다. 여기서는 실 코퍼스로 띄운 서버의 응답
 * 페이로드를 그대로 ajv 에 넣는다.
 *
 * ajv 는 devDependency 로만 쓴다 — 런타임 의존성 0개는 이 저장소의 계약이다.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEACHER_TOKEN = 'schema-teacher-token';

function readSchema(name) {
  return JSON.parse(readFileSync(path.join(ROOT, 'schema', name), 'utf8'));
}

/**
 * 응답 스키마는 서로 $ref 로 물려 있다. 한 인스턴스에 전부 올린 뒤 $id 로 꺼낸다 —
 * compile 로 다시 올리면 같은 $id 를 두 번 등록해 ajv 가 거부한다.
 */
const SCHEMA_FILES = [
  ['generator-topic-alignment.schema.json', 'https://example.invalid/digi-mon/generator-topic-alignment.schema.json'],
  ['learning-support.schema.json'],
  ['item.schema.json'],
  ['worksheet.schema.json'],
  ['worksheet-form-set.schema.json'],
  ['grading-result.schema.json'],
  ['learning-gate-recommendation.schema.json'],
];

function validatorFor(name) {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  for (const [file, key] of SCHEMA_FILES) ajv.addSchema(readSchema(file), key);
  const validate = ajv.getSchema(readSchema(name).$id);
  assert.ok(validate, `${name} 을 컴파일하지 못했다`);
  return validate;
}

function assertValid(name, payload) {
  const validate = validatorFor(name);
  assert.equal(
    validate(payload),
    true,
    `${name}: ${JSON.stringify(validate.errors?.slice(0, 5), null, 2)}`,
  );
}

let server;
let baseUrl;

async function request(path_, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path_}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  const spine = buildSpine(loadOntology());
  server = http.createServer(createApp({
    spine,
    registry: createRegistry(),
    teacherToken: TEACHER_TOKEN,
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
});

test('POST /v1/worksheets response validates against worksheet.schema.json', async () => {
  const issued = await request('/v1/worksheets?includeAnswers=true', {
    method: 'POST',
    token: TEACHER_TOKEN,
    body: { subject: 'math', count: 5, seed: 'schema-worksheet' },
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assertValid('worksheet.schema.json', issued.body);

  const validateItem = validatorFor('item.schema.json');
  for (const item of issued.body.items) {
    assert.equal(validateItem(item), true, JSON.stringify(validateItem.errors?.slice(0, 3)));
  }
});

test('POST /v1/worksheet-forms response validates against worksheet-form-set.schema.json', async () => {
  const issued = await request('/v1/worksheet-forms?includeAnswers=true', {
    method: 'POST',
    token: TEACHER_TOKEN,
    body: { subject: 'math', count: 4, formCount: 2, seed: 'schema-forms' },
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assertValid('worksheet-form-set.schema.json', issued.body);
});

test('POST /v1/grade response validates against grading-result.schema.json', async () => {
  const issued = await request('/v1/worksheets?includeAnswers=true', {
    method: 'POST',
    token: TEACHER_TOKEN,
    body: { subject: 'math', count: 5, seed: 'schema-grade' },
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));

  const graded = await request('/v1/grade', {
    method: 'POST',
    body: {
      ...issued.body.options,
      seed: issued.body.seed,
      fingerprint: issued.body.fingerprint,
      responses: Object.fromEntries(
        issued.body.items.map((item) => [item.number, item.answer.display]),
      ),
      records: false,
    },
  });
  assert.equal(graded.status, 200, JSON.stringify(graded.body));
  assertValid('grading-result.schema.json', graded.body);
});

test('formSet provenance runtime check agrees with the schema in both directions', async () => {
  const issued = await request('/v1/worksheet-forms?includeAnswers=true', {
    method: 'POST',
    token: TEACHER_TOKEN,
    body: { subject: 'math', count: 3, formCount: 2, seed: 'schema-provenance' },
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  const form = issued.body.forms[0];
  const valid = form.worksheet.formSet;

  const provenanceSchema = readSchema('worksheet.schema.json').properties.formSet;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schemaAccepts = ajv.compile(provenanceSchema);

  const gradeWith = (formSet) => request('/v1/grade', {
    method: 'POST',
    body: {
      ...form.worksheet.options,
      seed: form.worksheet.seed,
      formSet,
      fingerprint: form.worksheet.fingerprint,
      responses: { 1: form.worksheet.items[0].answer.display },
      records: false,
    },
  });

  // 스키마가 거부하는 모양은 서버도 400 이어야 한다. 하나라도 통과하면 수동 검사가
  // 스키마보다 느슨하다는 뜻이고, 느슨한 쪽으로 새는 입력이 엔진까지 내려가 500 이 된다.
  const rejected = [
    { ...valid, seed: '' },
    { ...valid, formCount: 1 },
    { ...valid, formCount: 99 },
    { ...valid, blueprintAttempt: -1 },
    { ...valid, label: 'Z' },
    { ...valid, schema: 'digi-mon/worksheet-form@2' },
    { ...valid, fingerprint: 'not-a-fingerprint' },
    { ...valid, surprise: true },
  ];
  for (const formSet of rejected) {
    assert.equal(schemaAccepts(formSet), false, `스키마가 받아들였다: ${JSON.stringify(formSet)}`);
    const response = await gradeWith(formSet);
    assert.equal(response.status, 400, `${JSON.stringify(formSet)} → ${response.status}`);
  }

  // 반대 방향: 스키마가 받아들이는 모양을 형식 오류로 거부하면 안 된다.
  // 지문이 안 맞는 것은 형식 문제가 아니라 대조 실패이므로 409 다.
  const otherFingerprint = 'f'.repeat(64);
  assert.equal(schemaAccepts({ ...valid, fingerprint: otherFingerprint }), true);
  const mismatch = await gradeWith({ ...valid, fingerprint: otherFingerprint });
  assert.equal(mismatch.status, 409, JSON.stringify(mismatch.body));

  const accepted = await gradeWith(valid);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
});

test('POST /v1/learning-gate response validates against learning-gate-recommendation.schema.json', async () => {
  const code = '[2수01-06]';
  const recommended = await request('/v1/learning-gate', {
    method: 'POST',
    body: {
      schema: 'digi-mon/learning-gate-request@1',
      policyRevision: 1,
      evidence: {
        source: 'grading-result',
        graded: 10,
        answered: 10,
        total: 10,
        manualScoringCount: 0,
        accuracy: 0.5,
        completionRate: 1,
        byStandard: { [code]: { attempted: 10, correct: 5, accuracy: 0.5 } },
      },
      target: { subject: 'math', codes: [code], modes: [], count: 10 },
    },
  });
  assert.equal(recommended.status, 200, JSON.stringify(recommended.body));
  assertValid('learning-gate-recommendation.schema.json', recommended.body);
});
