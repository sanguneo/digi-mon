import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { test } from 'node:test';

import { createApp } from '../../src/server/app.mjs';

/**
 * 비용 가중 리밋과 요청당 생성 시도 상한.
 *
 * 요청 수만 세면 20문항 1형과 100문항 8형이 같은 한 건이다. 단일 스레드 서버에서
 * 그 차이는 CPU 점유 수십 배다. 여기서는 429 가 실제로 나오는지, 그리고 정상 크기
 * 요청은 429 에 걸리지 않는지를 본다.
 */

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

/** dedupeKey 공간을 pool 크기로 조절할 수 있는 생성기. */
function generatorWithPool(poolSize) {
  return {
    id: 'test.math.add.pool',
    standardCode: CODE,
    skill: '덧셈',
    format: 'short-answer',
    difficultyAxis: 'single',
    difficulties: [1],
    generate(rng) {
      const left = rng.int(1, poolSize);
      const value = left + 1;
      return {
        params: { left, right: 1 },
        stem: `${left} + 1 = ?`,
        answer: { value, display: String(value), accepts: [String(value)] },
        solution: [`${left} + 1 = ${value}`],
        dedupeKey: `${left}`,
        difficulty: 1,
      };
    },
    verify({ left, right }, answer) {
      return left + right === answer.value;
    },
  };
}

const SPINE = {
  corpus: { schema: 'test-corpus', integrity: [{ file: 'data/spine/standards.json', sha256: 'abc' }] },
  standardCount: 1,
  standards: [STANDARD],
};

function registryWith(generator) {
  return {
    size: 1,
    forStandard: (code) => (code === CODE ? [generator] : []),
    all: () => [generator],
  };
}

async function withServer(generator, body) {
  const server = http.createServer(createApp({
    spine: SPINE,
    registry: registryWith(generator),
    teacherToken: 'teacher-secret',
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    return await body(async (path, payload) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return { status: response.status, headers: response.headers, body: await response.json() };
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('expensive requests exhaust the cost budget and get 429 with retry-after', async () => {
  await withServer(generatorWithPool(9), async (post) => {
    // 비용 = count × max(1, formCount). 100문항 8형이면 한 건에 800 이라
    // 윈도 상한 3,000 을 네 건이면 넘긴다.
    const statuses = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await post('/v1/worksheet-forms', {
        subject: 'math',
        code: CODE,
        count: 100,
        formCount: 8,
        seed: `cost-${attempt}`,
      });
      statuses.push(response.status);
      if (response.status === 429) {
        assert.equal(response.headers.get('retry-after'), '60');
        assert.match(response.body.error, /요청이 너무 많다/);
        break;
      }
    }
    assert.ok(statuses.includes(429), `429 가 나오지 않았다: ${statuses.join(',')}`);
    assert.ok(statuses.indexOf(429) >= 4, `정상 범위에서 너무 일찍 끊겼다: ${statuses.join(',')}`);
  });
});

test('normal sized requests stay well inside the cost budget', async () => {
  await withServer(generatorWithPool(500), async (post) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await post('/v1/worksheets', {
        subject: 'math',
        code: CODE,
        count: 20,
        seed: `normal-${attempt}`,
      });
      assert.equal(response.status, 200, `${attempt}번째 요청이 ${response.status}`);
    }
  });
});

test('a request cannot burn unbounded generation attempts', async () => {
  // pool 이 형 전체를 채우기에 모자라 슬롯마다 최대 재시도를 태운다.
  // 상한이 없으면 blueprint 24회 × form 8개 × 슬롯 100개 × 재시도 200회다.
  await withServer(generatorWithPool(150), async (post) => {
    const started = process.cpuUsage();
    const response = await post('/v1/worksheet-forms', {
      subject: 'math',
      code: CODE,
      count: 100,
      formCount: 8,
      seed: 'attempt-budget',
    });
    const cpuMs = (process.cpuUsage(started).user + process.cpuUsage(started).system) / 1000;
    assert.equal(response.status, 409, JSON.stringify(response.body));
    assert.match(response.body.error, /상한 8000회를 넘었다/);
    assert.ok(cpuMs < 5_000, `요청 하나가 CPU 를 ${Math.round(cpuMs)}ms 점유했다`);
  });
});
