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

before(async () => {
  engine = http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    receivedAuthorization = request.headers.authorization;
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
      seed: 'diagnostic',
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
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject: 'math', count: 1 }),
  });

  assert.equal(response.status, 200);
  assert.equal(receivedAuthorization, 'Bearer server-only-secret');
});

test('host serves the built single-page client', async () => {
  const response = await fetch(`${hostUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.match(html, /digi-mon 학습 스튜디오/);
});
