import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { after, before, test } from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';
import { createApp } from '../../src/server/app.mjs';

/**
 * 실코퍼스 스모크.
 *
 * 다른 서버 테스트는 1기준·1생성기 가짜 스파인을 쓴다. 빠르고 의도를 좁혀 주지만,
 * 실제 248기준·193생성기 코퍼스가 HTTP 경로를 한 번도 지나지 않는다는 뜻이었다.
 * 여기서는 bin/serve.mjs 와 같은 방식으로 부팅해 교과별 발급→채점 왕복을 돈다.
 */

const TEACHER_TOKEN = 'smoke-teacher-token';

let server;
let baseUrl;
let spine;
let registry;

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

before(async () => {
  const ontology = loadOntology();
  spine = buildSpine(ontology);
  registry = createRegistry();
  assert.equal(spine.conflictCount, 0, '스파인 충돌이 있으면 서버가 뜨면 안 된다');

  server = http.createServer(createApp({ spine, registry, teacherToken: TEACHER_TOKEN }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
});

test('real corpus boots and reports itself', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(health.body.standards, spine.standardCount);

  const generators = await request('/v1/generators');
  assert.equal(generators.status, 200);
  assert.equal(generators.body.count, registry.size);

  const coverage = await request('/v1/coverage');
  assert.equal(coverage.status, 200);
  const counted = coverage.body.covered.length
    + coverage.body.uncovered.length
    + coverage.body.manualOnly.length;
  assert.equal(counted, spine.standardCount);
  assert.deepEqual(Object.keys(coverage.body.bySubject).sort(), ['english', 'korean', 'math']);
});

for (const subject of ['math', 'korean', 'english']) {
  test(`${subject} worksheet issues and grades over HTTP with the real corpus`, async () => {
    const options = { subject, count: 5, seed: `smoke-${subject}` };
    const issued = await request('/v1/worksheets?includeAnswers=true', {
      method: 'POST',
      token: TEACHER_TOKEN,
      body: options,
    });
    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    assert.equal(issued.body.produced, 5);
    assert.equal(issued.body.shortfall, 0);

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
    assert.equal(graded.body.total, 5);
    // 사람이 채점하는 문항은 graded 에서 빠진다. 자동 채점분은 전부 맞아야 한다.
    assert.equal(graded.body.correct, graded.body.graded);
  });
}

test('parallel form set issues and grades over HTTP with the real corpus', async () => {
  const options = { subject: 'math', count: 5, formCount: 2, seed: 'smoke-forms' };
  const issued = await request('/v1/worksheet-forms?includeAnswers=true', {
    method: 'POST',
    token: TEACHER_TOKEN,
    body: options,
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assert.equal(issued.body.forms.length, 2);

  for (const form of issued.body.forms) {
    const graded = await request('/v1/grade', {
      method: 'POST',
      body: {
        ...form.worksheet.options,
        seed: form.worksheet.seed,
        formSet: form.worksheet.formSet,
        fingerprint: form.worksheet.fingerprint,
        responses: Object.fromEntries(
          form.worksheet.items.map((item) => [item.number, item.answer.display]),
        ),
        records: false,
      },
    });
    assert.equal(graded.status, 200, `form ${form.label}: ${JSON.stringify(graded.body)}`);
    assert.equal(graded.body.correct, graded.body.graded);
  }
});
