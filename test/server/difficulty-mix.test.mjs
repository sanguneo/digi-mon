import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { after, before, test } from 'node:test';

import { createApp } from '../../src/server/app.mjs';

/**
 * difficultyMix 가 HTTP 경계를 넘어 실제 문항 구성까지 도달하는지 본다.
 *
 * app.test.mjs 의 가짜 생성기는 난이도가 하나뿐이라(difficultyAxis: 'single')
 * 구성 변화가 관찰되지 않는다. 여기서는 1..3 을 모두 내는 생성기를 세워
 * 가중치를 한쪽에 몰면 그 난이도만 나오는 것을 확인한다.
 */

const CODE = '[2수01-06]';
const TEACHER_TOKEN = 'teacher-secret';
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
  id: 'test.math.add.leveled',
  standardCode: CODE,
  skill: '덧셈',
  format: 'short-answer',
  difficultyAxis: 'range',
  difficulties: [1, 2, 3],
  generate(rng, { difficulty }) {
    const bound = difficulty * 100;
    const left = rng.int(1, bound);
    const right = rng.int(1, bound);
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
      dedupeKey: `${difficulty}:${left}:${right}`,
      difficulty,
    };
  },
  verify({ left, right }, answer) {
    return left + right === answer.value;
  },
};
const SPINE = {
  corpus: {
    schema: 'test-corpus',
    integrity: [{ file: 'data/spine/standards.json', sha256: 'abc' }],
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

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function issue(difficultyMix, extra = {}) {
  return request('/v1/worksheets?includeAnswers=true', {
    method: 'POST',
    token: TEACHER_TOKEN,
    body: {
      subject: 'math',
      code: CODE,
      count: 12,
      seed: 'difficulty-mix',
      difficultyMix,
      ...extra,
    },
  });
}

before(async () => {
  server = http.createServer(createApp({
    spine: SPINE,
    registry: REGISTRY,
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

test('difficultyMix sent over HTTP changes the item composition', async () => {
  const easy = await issue({ 1: 1 });
  const hard = await issue({ 3: 1 });
  assert.equal(easy.status, 200, JSON.stringify(easy.body));
  assert.equal(hard.status, 200, JSON.stringify(hard.body));

  assert.deepEqual([...new Set(easy.body.items.map((item) => item.difficulty))], [1]);
  assert.deepEqual([...new Set(hard.body.items.map((item) => item.difficulty))], [3]);
  assert.notEqual(easy.body.fingerprint, hard.body.fingerprint);
  assert.deepEqual(easy.body.options.difficultyMix, { 1: 1 });

  // 쿼리스트링으로도 같은 값을 보낼 수 있어야 한다.
  const viaQuery = await request('/v1/worksheets?difficultyMix=3:1', {
    method: 'POST',
    body: { subject: 'math', code: CODE, count: 12, seed: 'difficulty-mix' },
  });
  assert.equal(viaQuery.status, 200, JSON.stringify(viaQuery.body));
  assert.equal(viaQuery.body.fingerprint, hard.body.fingerprint);
});

test('grading round-trips with the same difficultyMix', async () => {
  const issued = await issue({ 2: 3, 3: 1 });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));

  const responses = Object.fromEntries(
    issued.body.items.map((item) => [item.number, item.answer.display]),
  );
  const graded = await request('/v1/grade', {
    method: 'POST',
    body: {
      ...issued.body.options,
      seed: issued.body.seed,
      fingerprint: issued.body.fingerprint,
      responses,
      records: false,
    },
  });
  assert.equal(graded.status, 200, JSON.stringify(graded.body));
  assert.equal(graded.body.correct, issued.body.items.length);
});

test('grading with a different difficultyMix fails the fingerprint check', async () => {
  const issued = await issue({ 2: 3, 3: 1 });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));

  const graded = await request('/v1/grade', {
    method: 'POST',
    body: {
      ...issued.body.options,
      difficultyMix: { 1: 1 },
      seed: issued.body.seed,
      fingerprint: issued.body.fingerprint,
      responses: { 1: issued.body.items[0].answer.display },
      records: false,
    },
  });
  assert.equal(graded.status, 409, JSON.stringify(graded.body));
});

test('malformed difficultyMix is rejected at the boundary', async () => {
  for (const difficultyMix of [{ 4: 1 }, { 1: 0 }, { 2: -1 }, { 1: 'many' }, {}, [1, 2], 'sure', '1:2:3']) {
    const rejected = await issue(difficultyMix);
    assert.equal(rejected.status, 400, `${JSON.stringify(difficultyMix)} → ${rejected.status}`);
    assert.equal(rejected.body.detail.field, 'difficultyMix');
  }
});
