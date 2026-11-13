import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { test } from 'node:test';

import { clientAddress, createApp } from '../../src/server/app.mjs';

/**
 * 리밋 키가 되는 클라이언트 주소.
 *
 * 운영에서는 nginx → 앱 호스트 → 엔진이라 소켓 주소가 늘 127.0.0.1 이다.
 * DIGIMON_TRUST_PROXY=1 일 때만, 그리고 루프백 상대일 때만 X-Forwarded-For 를 오른쪽부터 읽어
 * 루프백이 아닌 첫 주소(nginx 가 덧붙인 $remote_addr)를 쓴다.
 */

function fakeRequest(remoteAddress, headers = {}) {
  return { socket: { remoteAddress }, headers };
}

test('trust off: the socket address is the client even with X-Forwarded-For', () => {
  const req = fakeRequest('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' });
  assert.equal(clientAddress(req), '127.0.0.1');
  assert.equal(clientAddress(req, false), '127.0.0.1');
});

test('trust on + loopback peer: the rightmost non-loopback X-Forwarded-For address is the client', () => {
  for (const loopback of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '127.0.0.5']) {
    const req = fakeRequest(loopback, { 'x-forwarded-for': ' 198.51.100.66 , 203.0.113.7 , 127.0.0.1, ::1, ::ffff:127.0.0.9' });
    assert.equal(clientAddress(req, true), '203.0.113.7', loopback);
  }
  // 클라이언트가 적은 왼쪽 항목은 무시한다.
  assert.equal(clientAddress(fakeRequest('127.0.0.1', { 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }), true), '203.0.113.7');
  assert.equal(clientAddress(fakeRequest('127.0.0.1', { 'x-forwarded-for': '2001:db8::1' }), true), '2001:db8::1');
});

test('trust on + non-loopback peer: X-Forwarded-For is ignored so it cannot be spoofed', () => {
  const req = fakeRequest('198.51.100.20', { 'x-forwarded-for': '203.0.113.7' });
  assert.equal(clientAddress(req, true), '198.51.100.20');
});

test('trust on + malformed or missing X-Forwarded-For: falls back to the socket address', () => {
  for (const forwarded of [
    undefined, '', '203.0.113.7, ', 'not-an-ip', '203.0.113.7:443', '999.1.1.1',
    '127.0.0.1, ::1', '203.0.113.7, not-an-ip, 127.0.0.1',
  ]) {
    const headers = forwarded === undefined ? {} : { 'x-forwarded-for': forwarded };
    assert.equal(clientAddress(fakeRequest('127.0.0.1', headers), true), '127.0.0.1', String(forwarded));
  }
});

const SPINE = {
  corpus: { schema: 'test-corpus', integrity: [] },
  standardCount: 0,
  standards: [],
};
const REGISTRY = { size: 0, forStandard: () => [], all: () => [] };

async function withServer(trustProxy, body) {
  const server = http.createServer(createApp({ spine: SPINE, registry: REGISTRY, trustProxy }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    return await body(async (forwardedFor) => {
      const response = await fetch(`${baseUrl}/health`, { headers: { 'x-forwarded-for': forwardedFor } });
      await response.arrayBuffer();
      return response.status;
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
}

/** 리밋은 윈도당 120건이다. 121번째가 429 인지로 버킷이 찼는지 본다. */
async function exhaust(get, forwardedFor) {
  const statuses = [];
  for (let attempt = 0; attempt < 121; attempt += 1) statuses.push(await get(forwardedFor));
  return statuses;
}

test('trust on: two X-Forwarded-For clients get separate limiter buckets', async () => {
  await withServer(true, async (get) => {
    const first = await exhaust(get, '203.0.113.7');
    assert.equal(first.at(-1), 429, '첫 클라이언트 버킷이 차지 않았다');
    assert.equal(await get('203.0.113.8'), 200, '다른 클라이언트가 같은 버킷을 썼다');
    assert.equal(await get('203.0.113.7'), 429);
  });
});

test('default (DIGIMON_TRUST_PROXY unset): X-Forwarded-For is ignored and the socket address is used', async () => {
  const saved = process.env.DIGIMON_TRUST_PROXY;
  delete process.env.DIGIMON_TRUST_PROXY;
  try {
    assert.equal(clientAddress(fakeRequest('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' })), '127.0.0.1');
    // trustProxy 를 넘기지 않으면 createApp 은 환경변수를 본다.
    await withServer(undefined, async (get) => {
      const first = await exhaust(get, '203.0.113.7');
      assert.equal(first.at(-1), 429);
      assert.equal(await get('203.0.113.8'), 429, '기본값인데 XFF 로 버킷이 갈렸다');
    });
  } finally {
    if (saved !== undefined) process.env.DIGIMON_TRUST_PROXY = saved;
  }
});

test('trust off: X-Forwarded-For clients still share the socket bucket', async () => {
  await withServer(false, async (get) => {
    const first = await exhaust(get, '203.0.113.7');
    assert.equal(first.at(-1), 429);
    assert.equal(await get('203.0.113.8'), 429, 'trust 가 꺼졌는데 XFF 로 버킷이 갈렸다');
  });
});

const CODE = '[2수01-06]';
const GEN_SPINE = {
  corpus: { schema: 'test-corpus', integrity: [] },
  standardCount: 1,
  standards: [{
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
  }],
};
/** 고유 문항이 9개뿐이라 큰 요청은 금방 409 로 끝난다. 비용은 그 전에 매겨진다. */
const SMALL_POOL = {
  id: 'test.math.add.pool',
  standardCode: CODE,
  skill: '덧셈',
  format: 'short-answer',
  difficultyAxis: 'single',
  difficulties: [1],
  generate(rng) {
    const left = rng.int(1, 9);
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
const GEN_REGISTRY = {
  size: 1,
  forStandard: (code) => (code === CODE ? [SMALL_POOL] : []),
  all: () => [SMALL_POOL],
};

test('trust on: the generation quota is counted per rightmost client, and a spoofed leftmost entry adds no bucket', async () => {
  const server = http.createServer(createApp({ spine: GEN_SPINE, registry: GEN_REGISTRY, trustProxy: true }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  // 운영 체인: 클라이언트가 적은 값, nginx 가 붙인 $remote_addr, 앱 호스트가 붙인 127.0.0.1.
  const post = async (spoofed, client, attempt) => {
    const response = await fetch(`${baseUrl}/v1/worksheet-forms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `${spoofed}, ${client}, 127.0.0.1` },
      body: JSON.stringify({ subject: 'math', code: CODE, count: 100, formCount: 8, seed: `quota-${attempt}` }),
    });
    await response.arrayBuffer();
    return response.status;
  };
  try {
    // 한 건 비용 800, 윈도 상한 3,000. 네 건을 매기면 다섯째부터 429 다.
    // 매번 왼쪽 값을 바꿔도 같은 버킷이어야 한다.
    const statuses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      statuses.push(await post(`198.51.100.${attempt + 1}`, '203.0.113.7', attempt));
    }
    assert.deepEqual(statuses.slice(0, 4).map((status) => status === 429), [false, false, false, false], statuses.join(','));
    assert.equal(statuses[4], 429, `위조한 왼쪽 값이 새 버킷을 만들었다: ${statuses.join(',')}`);
    assert.notEqual(await post('198.51.100.99', '203.0.113.8', 99), 429, '다른 클라이언트가 같은 생성 쿼터를 썼다');
  } finally {
    server.close();
    await once(server, 'close');
  }
});
