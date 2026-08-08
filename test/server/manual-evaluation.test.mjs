import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { once } from 'node:events';

import { createApp } from '../../src/server/app.mjs';
import { gradeWorksheet } from '../../src/server/grade.mjs';

const MANUAL_CODE = '[2수02-01]';
const AUTO_CODE = '[2수01-06]';
const RUBRIC = ['선분 3개로 닫혔는가', '세 선분이 모두 이어졌는가'];

function manualItem(number = 1) {
  return {
    number,
    id: `manual-${number}`,
    standardCode: MANUAL_CODE,
    skill: '삼각형 그리기',
    difficulty: 1,
    format: 'construction',
    scoring: 'manual',
    answer: { display: '삼각형 1개', rubric: RUBRIC },
    solution: RUBRIC,
  };
}

function autoItem(number = 2) {
  return {
    number,
    id: `auto-${number}`,
    standardCode: AUTO_CODE,
    skill: '덧셈',
    difficulty: 1,
    format: 'short-answer',
    scoring: 'auto',
    answer: { value: 2, display: '2', accepts: ['2'] },
    solution: ['1 + 1 = 2'],
  };
}

test('manual criterion results are positional and aggregate into criteria met ratio', () => {
  const result = gradeWorksheet(
    { seed: 'manual-unit', items: [manualItem(), autoItem()] },
    { 1: 'drawing-ref', 2: '2' },
    { 1: { criteria: [true, false] } },
  );

  assert.deepEqual(result.manualScoring[0].evaluation, {
    criteria: [{ met: true }, { met: false }],
    criteriaMet: 1,
    criteriaTotal: 2,
    criteriaMetRatio: 0.5,
  });
  assert.deepEqual(result.manualEvaluation, {
    evaluatedItems: 1,
    criteriaMet: 1,
    criteriaTotal: 2,
    criteriaMetRatio: 0.5,
  });
  assert.equal(result.graded, 1, 'grading-result@1 automatic grading meaning is unchanged');
  assert.equal(result.correct, 1);
});

const STANDARDS = [
  {
    code: MANUAL_CODE,
    specId: 'math.g1-2.d02.s01',
    key: 'manual-standard',
    subject: 'math',
    subjectKorean: '수학',
    gradeBand: '1-2',
    gradeStart: 1,
    gradeEnd: 2,
    domain: '도형과 측정',
    module: '평면도형',
    source: {},
  },
  {
    code: AUTO_CODE,
    specId: 'math.g1-2.d01.s06',
    key: 'auto-standard',
    subject: 'math',
    subjectKorean: '수학',
    gradeBand: '1-2',
    gradeStart: 1,
    gradeEnd: 2,
    domain: '수와 연산',
    module: '덧셈과 뺄셈',
    source: {},
  },
];

const MANUAL_GENERATOR = {
  id: 'test.math.construct',
  standardCode: MANUAL_CODE,
  skill: '삼각형 그리기',
  format: 'construction',
  difficultyAxis: 'single',
  difficulties: [1],
  generate(rng) {
    const variant = rng.int(1, 1000);
    return {
      params: { variant },
      stem: '삼각형을 그리시오.',
      answer: { display: '삼각형 1개', rubric: RUBRIC },
      solution: RUBRIC,
      dedupeKey: String(variant),
      difficulty: 1,
    };
  },
  verify(_params, answer) {
    return answer.rubric.length === RUBRIC.length;
  },
};

const AUTO_GENERATOR = {
  id: 'test.math.add',
  standardCode: AUTO_CODE,
  skill: '덧셈',
  format: 'short-answer',
  difficultyAxis: 'single',
  difficulties: [1],
  generate(rng) {
    const left = rng.int(1, 9);
    const right = rng.int(1, 9);
    return {
      params: { left, right },
      stem: `${left} + ${right} = ?`,
      answer: { value: left + right, display: String(left + right), accepts: [String(left + right)] },
      solution: [`${left} + ${right} = ${left + right}`],
      dedupeKey: `${left}:${right}`,
      difficulty: 1,
    };
  },
  verify({ left, right }, answer) {
    return left + right === answer.value;
  },
};

const REGISTRY = {
  size: 2,
  forStandard(code) {
    if (code === MANUAL_CODE) return [MANUAL_GENERATOR];
    if (code === AUTO_CODE) return [AUTO_GENERATOR];
    return [];
  },
  all() {
    return [MANUAL_GENERATOR, AUTO_GENERATOR];
  },
};

const SPINE = {
  upstream: { taxonomyVersion: 'test-v1', integrity: [] },
  standardCount: STANDARDS.length,
  standards: STANDARDS,
};

let server;
let baseUrl;

async function request(path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  server = http.createServer(createApp({
    spine: SPINE,
    registry: REGISTRY,
    teacherToken: 'teacher-secret',
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
});

async function issue(code, seed) {
  return request('/v1/worksheets', {
    subject: 'math', codes: [code], seed, count: 1,
  });
}

function gradeBody(issued, code, seed, manualEvaluations) {
  return {
    subject: 'math',
    codes: [code],
    seed,
    count: 1,
    fingerprint: issued.body.fingerprint,
    responses: {},
    manualEvaluations,
    records: false,
  };
}

test('teacher can submit exact-length manual rubric decisions through /v1/grade', async () => {
  const issued = await issue(MANUAL_CODE, 'manual-api');
  const graded = await request('/v1/grade', gradeBody(
    issued,
    MANUAL_CODE,
    'manual-api',
    { 1: { criteria: [true, false] } },
  ), 'teacher-secret');

  assert.equal(graded.status, 200, JSON.stringify(graded.body));
  assert.equal(graded.body.manualScoring[0].evaluation.criteriaMet, 1);
  assert.equal(Object.hasOwn(graded.body.manualScoring[0], 'submitted'), false);
  assert.equal(graded.body.manualEvaluation.criteriaMetRatio, 0.5);
});

test('manual evaluations require teacher authentication', async () => {
  const issued = await issue(MANUAL_CODE, 'manual-auth');
  const denied = await request('/v1/grade', gradeBody(
    issued,
    MANUAL_CODE,
    'manual-auth',
    { 1: { criteria: [true, true] } },
  ));
  assert.equal(denied.status, 403);
});

test('invalid manual evaluation boundary input returns 400 without accepting free text', async () => {
  const manual = await issue(MANUAL_CODE, 'manual-invalid');
  const automatic = await issue(AUTO_CODE, 'auto-invalid');
  const cases = [
    gradeBody(manual, MANUAL_CODE, 'manual-invalid', []),
    gradeBody(manual, MANUAL_CODE, 'manual-invalid', { 1: { criteria: [true] } }),
    gradeBody(manual, MANUAL_CODE, 'manual-invalid', { 1: { criteria: [true, 'yes'] } }),
    gradeBody(manual, MANUAL_CODE, 'manual-invalid', { 1: { criteria: [true, false], note: 'student name' } }),
    gradeBody(manual, MANUAL_CODE, 'manual-invalid', { 99: { criteria: [true, false] } }),
    gradeBody(automatic, AUTO_CODE, 'auto-invalid', { 1: { criteria: [true] } }),
  ];

  for (const body of cases) {
    const response = await request('/v1/grade', body, 'teacher-secret');
    assert.equal(response.status, 400, JSON.stringify(response.body));
  }

  const malformedWithoutCredentials = await request('/v1/grade', cases[0]);
  assert.equal(malformedWithoutCredentials.status, 400);
});
