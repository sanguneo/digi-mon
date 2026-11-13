import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createWebHost } from '../server/index.ts';

let engine: http.Server;
let host: http.Server;
let hostUrl = '';
let receivedAuthorization: string | undefined;
let receivedBody: Record<string, unknown> = {};
let receivedForwardedFor: string | undefined;
let receivedRealIp: string | undefined;

before(async () => {
  engine = http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    receivedAuthorization = request.headers.authorization;
    receivedForwardedFor = request.headers['x-forwarded-for'] as string | undefined;
    receivedRealIp = request.headers['x-real-ip'] as string | undefined;
    receivedBody = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
  });
  engine.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => engine.once('listening', resolve));
  const engineAddress = engine.address();
  assert(engineAddress && typeof engineAddress !== 'string');

  host = createWebHost({
    engineOrigin: `http://127.0.0.1:${engineAddress.port}`,
    teacherToken: 'server-only-secret',
    staticRoot: fileURLToPath(new URL('../dist', import.meta.url)),
  });
  host.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => host.once('listening', resolve));
  const hostAddress = host.address();
  assert(hostAddress && typeof hostAddress !== 'string');
  hostUrl = `http://127.0.0.1:${hostAddress.port}`;
});

after(async () => {
  await Promise.all([
    new Promise<void>((resolve, reject) => host.close((error) => error ? reject(error) : resolve())),
    new Promise<void>((resolve, reject) => engine.close((error) => error ? reject(error) : resolve())),
  ]);
});

test('learner proxy strips teacher-only fields and never injects teacher token', async () => {
  const response = await fetch(`${hostUrl}/learner/api/v1/grade?includeFeedback=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      includeAnswers: true,
      includeFeedback: true,
      manualEvaluations: { 1: { criteria: [true] } },
      responses: { 1: '3' },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(receivedAuthorization, undefined);
  assert.equal(receivedBody.includeAnswers, undefined);
  assert.equal(receivedBody.includeFeedback, undefined);
  assert.equal(receivedBody.manualEvaluations, undefined);
});

test('teacher proxy injects the server-held credential', async () => {
  const response = await fetch(`${hostUrl}/teacher/api/v1/worksheets`, {
    method: 'POST',
    headers: { origin: hostUrl, 'content-type': 'application/json' },
    body: JSON.stringify({ subject: 'math', count: 1 }),
  });
  assert.equal(response.status, 200);
  assert.equal(receivedAuthorization, 'Bearer server-only-secret');
});

test('teacher proxy refuses cross-site, origin-less and non-JSON writes before adding the token', async () => {
  const cases: [Record<string, string>, number][] = [
    [{ origin: 'http://evil.example', 'content-type': 'text/plain' }, 403],
    [{ origin: 'http://evil.example', 'content-type': 'application/json' }, 403],
    [{ origin: 'http://localhost:5000', 'content-type': 'application/json' }, 403],
    [{ 'content-type': 'application/json' }, 403],
    [{ origin: hostUrl, 'content-type': 'text/plain' }, 415],
  ];
  for (const [headers, status] of cases) {
    receivedAuthorization = 'untouched';
    const response = await fetch(`${hostUrl}/teacher/api/v1/review/verdict`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'x', action: 'reset' }),
    });
    assert.equal(response.status, status, JSON.stringify(headers));
    assert.equal(receivedAuthorization, 'untouched');
  }
});

test('proxy appends the peer address to X-Forwarded-For and keeps X-Real-IP', async () => {
  const post = (headers: Record<string, string>) => fetch(`${hostUrl}/learner/api/v1/grade`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ responses: {} }),
  });

  assert.equal((await post({})).status, 200);
  assert.equal(receivedForwardedFor, '127.0.0.1');
  assert.equal(receivedRealIp, undefined);

  assert.equal((await post({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '203.0.113.7' })).status, 200);
  assert.equal(receivedForwardedFor, '203.0.113.7, 127.0.0.1');
  assert.equal(receivedRealIp, '203.0.113.7');
});

test('host serves the built garden client', async () => {
  const response = await fetch(`${hostUrl}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.match(html, /오늘의 작은 정원/);
});
