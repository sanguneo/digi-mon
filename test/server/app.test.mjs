import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { after, before, test } from 'node:test';

import { buildWorksheetFormSet } from '../../src/engine/worksheet-forms.mjs';
import { createApp } from '../../src/server/app.mjs';

const CODE = '[2수01-06]';
const STANDARD = {
  code: CODE,
  specId: 'math.g1-2.d01.s06',
  subject: 'math',
  subjectKorean: '수학',
  gradeBand: '1-2',
  gradeStart: 1,
  gradeEnd: 2,
  domain: '수와 연산',
  module: '덧셈과 뺄셈',
  source: {},
};
const GENERATOR = {
  id: 'test.math.add',
  standardCode: CODE,
  skill: '덧셈',
  format: 'short-answer',
  learningGuide: {
    revision: 1,
    materials: [
      {
        kind: 'principle',
        text: '덧셈은 두 양을 합한 전체를 구하는 계산이다.',
      },
    ],
    hints: [
      {
        level: 1,
        kind: 'concept-recall',
        text: '두 수가 나타내는 양을 차례로 확인하세요.',
      },
      {
        level: 2,
        kind: 'strategy',
        text: '큰 수에서 작은 수만큼 이어 세어 보세요.',
      },
    ],
    teacher: {
      lookFor: ['두 양을 빠뜨리지 않고 합하는가'],
      intervention: '구체물을 두 묶음으로 놓고 하나의 묶음으로 합쳐 보게 한다.',
    },
  },
  difficultyAxis: 'single',
  difficulties: [1],
  generate(rng) {
    const left = rng.int(1, 9);
    const right = rng.int(1, 9);
    const value = left + right;
    return {
      params: { left, right },
      stem: `${left} + ${right} = ?`,
      answer: {
        value,
        display: String(value),
        accepts: [String(value)],
      },
      solution: [`${left} + ${right} = ${value}`],
      dedupeKey: `${left}:${right}`,
      difficulty: 1,
    };
  },
  verify({ left, right }, answer) {
    return left + right === answer.value;
  },
};
const SPINE = {
  upstream: {
    taxonomyVersion: 'test-v1',
    integrity: [{ file: 'topics.json', sha256: 'abc' }],
  },
  standardCount: 1,
  standards: [STANDARD],
};
const REGISTRY = {
  size: 1,
  forStandard(code) {
    return code === CODE ? [GENERATOR] : [];
  },
  all() {
    return [GENERATOR];
  },
};

let server;
let baseUrl;

async function request(path, {
  method = 'GET',
  body,
  token,
} = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

before(async () => {
  server = http.createServer(createApp({
    spine: SPINE,
    registry: REGISTRY,
    teacherToken: 'teacher-secret',
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
});

test('learner item exposes guidance without teacher-only notes or answers', async () => {
  const issued = await request('/v1/items', {
    method: 'POST',
    body: {
      code: CODE,
      count: 1,
      difficulty: 1,
      seed: 'learning-support',
    },
  });

  assert.equal(issued.status, 200);
  const [item] = issued.body.items;
  assert.equal(item.learningSupport.schema, 'digi-mon/learning-support@1');
  assert.equal(item.learningSupport.status, 'guided-candidate');
  assert.equal(item.learningSupport.hints.length, 2);
  assert.equal(Object.hasOwn(item.learningSupport, 'teacher'), false);
  assert.equal(Object.hasOwn(item, 'answer'), false);
  assert.equal(Object.hasOwn(item, 'solution'), false);
});

test('every parallel form can be replayed and graded from its provenance', async () => {
  const formSet = buildWorksheetFormSet(SPINE, REGISTRY, {
    seed: 'grade-parallel-forms',
    subject: 'math',
    codes: [CODE],
    count: 1,
    difficulty: 1,
    formCount: 3,
  });

  for (const { worksheet } of formSet.forms) {
    const graded = await request('/v1/grade', {
      method: 'POST',
      body: {
        ...worksheet.options,
        seed: worksheet.seed,
        formSet: worksheet.formSet,
        fingerprint: worksheet.fingerprint,
        responses: { 1: worksheet.items[0].answer.display },
        records: false,
      },
    });
    assert.equal(graded.status, 200, JSON.stringify(graded.body));
    assert.equal(graded.body.correct, 1);
  }
});

test('grading rejects non-object bodies and unsafe response metadata', async () => {
  assert.equal((await request('/v1/grade', { method: 'POST', body: null })).status, 400);

  const options = {
    seed: 'privacy-boundary',
    subject: 'math',
    grade: '1-2',
    count: 1,
    difficulty: 1,
  };
  const issued = await request('/v1/worksheets', { method: 'POST', body: options });
  const invalidAt = await request('/v1/grade', {
    method: 'POST',
    body: {
      ...options,
      fingerprint: issued.body.fingerprint,
      responses: { 1: 'learner name' },
      at: { name: 'learner name' },
    },
  });
  assert.equal(invalidAt.status, 400);
});

test('learner grading hides submitted text and accuracy rejects malformed records', async () => {
  const options = {
    seed: 'privacy-output',
    subject: 'math',
    grade: '1-2',
    count: 1,
    difficulty: 1,
  };
  const issued = await request('/v1/worksheets', { method: 'POST', body: options });
  const graded = await request('/v1/grade', {
    method: 'POST',
    body: {
      ...options,
      fingerprint: issued.body.fingerprint,
      responses: { 1: 'learner name' },
      at: '2026-08-06T00:00:00.000Z',
    },
  });
  assert.equal(graded.status, 200);
  assert.equal(Object.hasOwn(graded.body.results[0], 'submitted'), false);
  assert.equal(graded.body.responseRecords[0].at, '2026-08-06T00:00:00.000Z');

  const deniedAccuracy = await request('/v1/accuracy', {
    method: 'POST',
    body: { records: graded.body.responseRecords },
  });
  assert.equal(deniedAccuracy.status, 403);
  const allowedAccuracy = await request('/v1/accuracy', {
    method: 'POST',
    token: 'teacher-secret',
    body: { records: graded.body.responseRecords },
  });
  assert.equal(allowedAccuracy.status, 200);

  const malformed = await request('/v1/accuracy', {
    method: 'POST',
    body: { records: [{ generatorId: { injected: true } }] },
  });
  assert.equal(malformed.status, 400);
});

test('learner endpoints strip answers and teacher answers require authorization', async () => {
  const learner = await request('/v1/worksheets', {
    method: 'POST',
    body: { subject: 'math', codes: [CODE], seed: 'secure', count: 1 },
  });
  assert.equal(learner.status, 200);
  assert.equal(typeof learner.body.fingerprint, 'string');
  assert.equal(Object.hasOwn(learner.body.items[0], 'answer'), false);
  assert.equal(Object.hasOwn(learner.body.items[0], 'params'), false);

  const denied = await request('/v1/worksheets', {
    method: 'POST',
    body: {
      subject: 'math',
      codes: [CODE],
      seed: 'secure',
      count: 1,
      includeAnswers: true,
    },
  });
  assert.equal(denied.status, 403);

  const teacher = await request('/v1/worksheets', {
    method: 'POST',
    token: 'teacher-secret',
    body: {
      subject: 'math',
      codes: [CODE],
      seed: 'secure',
      count: 1,
      includeAnswers: true,
    },
  });
  assert.equal(teacher.status, 200);
  assert.equal(Object.hasOwn(teacher.body.items[0], 'answer'), true);

  const item = await request('/v1/items', {
    method: 'POST',
    body: { code: CODE, seed: 'item', count: 1 },
  });
  assert.equal(item.status, 200);
  assert.equal(Object.hasOwn(item.body.items[0], 'answer'), false);
});

test('grading requires an exact worksheet fingerprint and counts omissions', async () => {
  const issued = await request('/v1/worksheets', {
    method: 'POST',
    body: { subject: 'math', codes: [CODE], seed: 'grade', count: 3 },
  });
  const teacher = await request('/v1/worksheets', {
    method: 'POST',
    token: 'teacher-secret',
    body: {
      subject: 'math',
      codes: [CODE],
      seed: 'grade',
      count: 3,
      includeAnswers: true,
    },
  });

  const missingFingerprint = await request('/v1/grade', {
    method: 'POST',
    body: {
      subject: 'math',
      codes: [CODE],
      seed: 'grade',
      count: 3,
      responses: {},
    },
  });
  assert.equal(missingFingerprint.status, 400);

  const wrongFingerprint = await request('/v1/grade', {
    method: 'POST',
    body: {
      subject: 'math',
      codes: [CODE],
      seed: 'grade',
      count: 3,
      fingerprint: 'wrong',
      responses: {},
    },
  });
  assert.equal(wrongFingerprint.status, 409);

  const invalidTiming = await request('/v1/grade', {
    method: 'POST',
    body: {
      subject: 'math',
      codes: [CODE],
      seed: 'grade',
      count: 3,
      fingerprint: issued.body.fingerprint,
      responses: {},
      elapsedMs: { 1: -1 },
    },
  });
  assert.equal(invalidTiming.status, 400);

  const invalidLearner = await request('/v1/grade', {
    method: 'POST',
    body: {
      subject: 'math',
      codes: [CODE],
      seed: 'grade',
      count: 3,
      fingerprint: issued.body.fingerprint,
      responses: {},
      learnerId: '홍길동@example.com',
    },
  });
  assert.equal(invalidLearner.status, 400);

  const graded = await request('/v1/grade', {
    method: 'POST',
    body: {
      subject: 'math',
      codes: [CODE],
      seed: 'grade',
      count: 3,
      fingerprint: issued.body.fingerprint,
      responses: { 1: teacher.body.items[0].answer.display },
      elapsedMs: { 1: 1234 },
    },
  });
  assert.equal(graded.status, 200, JSON.stringify(graded.body));
  assert.equal(graded.body.graded, 3);
  assert.equal(graded.body.answered, 1);
  assert.equal(graded.body.correct, 1);
  assert.equal(graded.body.completionRate, 0.3333);
  assert.equal(Object.hasOwn(graded.body.results[1], 'expected'), false);
  assert.equal(Object.hasOwn(graded.body.results[1], 'solution'), false);
  assert.equal(graded.body.responseRecords[0].elapsedMs, 1234);
  assert.equal(graded.body.responseRecords[1].elapsedMs, null);
  const learnerGraded = await request('/v1/grade', {
    method: 'POST',
    body: {
      subject: 'math',
      codes: [CODE],
      seed: 'grade',
      count: 3,
      fingerprint: issued.body.fingerprint,
      responses: {},
    },
  });
  assert.equal(learnerGraded.status, 200);
  assert.equal(
    learnerGraded.body.responseRecords.some((record) => Object.hasOwn(record, 'dedupeKey')),
    false,
  );
  assert.equal(
    graded.body.responseRecords.some((record) => Object.hasOwn(record, 'dedupeKey')),
    false,
  );
});

test('remediation worksheet preserves learning-order options for grading', async () => {
  const remediation = await request('/v1/remediation', {
    method: 'POST',
    body: {
      weakStandards: [CODE],
      seed: 'remediation',
      count: 1,
    },
  });
  assert.equal(remediation.status, 200);
  assert.equal(remediation.body.worksheet.options.followLearningOrder, false);
  assert.equal(remediation.body.prerequisitePolicy, 'approved-only');
  assert.ok(remediation.body.excludedCandidateCount > 0);

  const graded = await request('/v1/grade', {
    method: 'POST',
    body: {
      ...remediation.body.worksheet.options,
      seed: remediation.body.worksheet.seed,
      fingerprint: remediation.body.worksheet.fingerprint,
      responses: {},
    },
  });
  assert.equal(graded.status, 200, JSON.stringify(graded.body));

  const teacherRemediation = await request('/v1/remediation', {
    method: 'POST',
    token: 'teacher-secret',
    body: {
      weakStandards: [CODE],
      seed: 'remediation-teacher',
      count: 1,
      includeAnswers: true,
    },
  });
  assert.equal(teacherRemediation.status, 200);
  assert.equal(
    Object.hasOwn(teacherRemediation.body.worksheet.items[0], 'answer'),
    true,
  );
});

test('invalid input and transport errors return precise status codes', async () => {
  const invalidSubject = await request('/v1/worksheets', {
    method: 'POST',
    body: { subject: 'klingon' },
  });
  assert.equal(invalidSubject.status, 400);

  const wrongMethod = await request('/health', { method: 'POST', body: {} });
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'GET');

  const oversized = await request('/v1/worksheets', {
    method: 'POST',
    body: { padding: 'x'.repeat(300_000) },
  });
  assert.equal(oversized.status, 413);

  const shortfall = await request('/v1/worksheets', {
    method: 'POST',
    body: { subject: 'math', codes: [CODE], seed: 'shortfall', count: 100 },
  });
  assert.equal(shortfall.status, 409);
  assert.ok(shortfall.body.detail.shortfall > 0);
});

