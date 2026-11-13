import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { test } from 'node:test';

import { clientAddress, createApp } from '../../src/server/app.mjs';

/**
 * 리밋 키가 되는 클라이언트 주소.
 *
 * 운영에서는 nginx → 앱 호스트 → 엔진이라 소켓 주소가 늘 127.0.0.1 이다.
 * DIGIMON_TRUST_PROXY=1 일 때만, 그리고 루프백 상대일 때만 X-Forwarded-For 첫 주소를 쓴다.
 */

function fakeRequest(remoteAddress, headers = {}) {
  return { socket: { remoteAddress }, headers };
}

test('trust off: the socket address is the client even with X-Forwarded-For', () => {
  const req = fakeRequest('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' });
  assert.equal(clientAddress(req), '127.0.0.1');
  assert.equal(clientAddress(req, false), '127.0.0.1');
});

test('trust on + loopback peer: the first X-Forwarded-For address is the client', () => {
  for (const loopback of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    const req = fakeRequest(loopback, { 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.2, 127.0.0.1' });
    assert.equal(clientAddress(req, true), '203.0.113.7', loopback);
  }
  assert.equal(clientAddress(fakeRequest('127.0.0.1', { 'x-forwarded-for': '2001:db8::1' }), true), '2001:db8::1');
});

test('trust on + non-loopback peer: X-Forwarded-For is ignored so it cannot be spoofed', () => {
  const req = fakeRequest('198.51.100.20', { 'x-forwarded-for': '203.0.113.7' });
  assert.equal(clientAddress(req, true), '198.51.100.20');
});

test('trust on + malformed or missing X-Forwarded-For: falls back to the socket address', () => {
  for (const forwarded of [undefined, '', ' , 203.0.113.7', 'not-an-ip', '203.0.113.7:443', '999.1.1.1']) {
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

test('trust off: X-Forwarded-For clients still share the socket bucket', async () => {
  await withServer(false, async (get) => {
    const first = await exhaust(get, '203.0.113.7');
    assert.equal(first.at(-1), 429);
    assert.equal(await get('203.0.113.8'), 429, 'trust 가 꺼졌는데 XFF 로 버킷이 갈렸다');
  });
});
