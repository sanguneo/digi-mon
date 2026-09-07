import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { after, before, test } from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';
import { createApp } from '../../src/server/app.mjs';

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const ADD = 'math.g12.no.s06.add';
const SUB = 'math.g12.no.s06.sub';
const SINGLE = 'math.g12.gm.s10.choose-unit';
const TOKEN = 'generator-filter-test';
let server;
let baseUrl;

before(async () => {
  server = http.createServer(createApp({ spine, registry, teacherToken: TOKEN }));
  const listening = once(server, 'listening', { signal: AbortSignal.timeout(5_000) });
  server.listen(0, '127.0.0.1');
  await listening;
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  const closed = once(server, 'close', { signal: AbortSignal.timeout(5_000) });
  server.close();
  await closed;
});

async function request(path, body, teacher = false) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(teacher ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() };
}

test('generator catalog exposes curriculum and effective difficulty metadata from real registry', async () => {
  const result = await request('/v1/generators');
  assert.equal(result.status, 200);
  assert.equal(result.body.count, registry.size);
  assert.equal(result.body.generators.length, registry.size);
  for (const entry of result.body.generators) {
    const generator = registry.get(entry.id);
    const standard = spine.standards.find((candidate) => candidate.code === generator.standardCode);
    assert.equal(entry.skill, generator.skill);
    assert.equal(entry.standardCode, generator.standardCode);
    assert.equal(entry.format, generator.format);
    assert.equal(entry.subject, standard.subject);
    assert.equal(entry.gradeBand, standard.gradeBand);
    assert.equal(entry.domain, standard.domain);
    assert.deepEqual(entry.difficulties, generator.difficulties
      ?? (generator.difficultyAxis === 'single' ? [1] : [1, 2, 3]));
  }
});

test('filtered worksheet HTTP issuance is exact, repeatable and grades using returned options', async () => {
  const options = { subject: 'math', grade: '1-2', domain: '수와 연산', count: 17,
    seed: 'http-generator-filter', difficulty: 2, generatorIds: [ADD] };
  const issued = await request('/v1/worksheets?includeAnswers=true', options, true);
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assert.equal(issued.body.produced, options.count);
  assert.deepEqual(issued.body.options.generatorIds, [ADD]);
  assert.ok(issued.body.items.every((item) => item.generatorId === ADD && item.difficulty === 2));
  assert.deepEqual(issued, await request('/v1/worksheets?includeAnswers=true', options, true));
  const learner = await request('/v1/worksheets', options);
  assert.equal(learner.status, 200);
  assert.equal(learner.body.fingerprint, issued.body.fingerprint);
  assert.deepEqual(learner.body.options.generatorIds, [ADD]);
  assert.ok(learner.body.items.every((item) => !Object.hasOwn(item, 'answer')));

  const gradeBody = { ...issued.body.options, seed: issued.body.seed,
    fingerprint: issued.body.fingerprint, records: false,
    responses: Object.fromEntries(issued.body.items.map((item) => [item.number, item.answer.display])) };
  const graded = await request('/v1/grade', gradeBody);
  assert.equal(graded.status, 200, JSON.stringify(graded.body));
  assert.equal(graded.body.correct, options.count);
  assert.deepEqual(graded, await request('/v1/grade', gradeBody));
  assert.equal((await request('/v1/grade', { ...gradeBody, generatorIds: [SUB] })).status, 409);
  const withoutFilter = { ...gradeBody };
  delete withoutFilter.generatorIds;
  assert.equal((await request('/v1/grade', withoutFilter)).status, 409);
});

test('filtered parallel forms roundtrip through issuance and grading without type leakage', async () => {
  const options = { subject: 'math', count: 5, formCount: 2,
    seed: 'http-generator-filter-forms', difficulty: 2, generatorIds: [ADD] };
  const issued = await request('/v1/worksheet-forms?includeAnswers=true', options, true);
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assert.deepEqual(issued.body.options.generatorIds, [ADD]);
  assert.equal(issued.body.forms.length, 2);
  assert.deepEqual(issued, await request('/v1/worksheet-forms?includeAnswers=true', options, true));
  for (const { worksheet } of issued.body.forms) {
    assert.equal(worksheet.produced, 5);
    assert.deepEqual(worksheet.options.generatorIds, [ADD]);
    assert.ok(worksheet.items.every((item) => item.generatorId === ADD));
    const graded = await request('/v1/grade', {
      ...worksheet.options, seed: worksheet.seed, fingerprint: worksheet.fingerprint,
      formSet: worksheet.formSet, records: false,
      responses: Object.fromEntries(worksheet.items.map((item) => [item.number, item.answer.display])),
    });
    assert.equal(graded.status, 200, JSON.stringify(graded.body));
    assert.equal(graded.body.correct, 5);
  }
});

test('HTTP rejects invalid selection shapes and duplicate IDs with field errors', async () => {
  for (const generatorIds of [null, '', ADD, [], {}, [1], [''], [ADD, ADD]]) {
    const result = await request('/v1/worksheets', { generatorIds, count: 1 });
    assert.equal(result.status, 400, JSON.stringify(result.body));
    assert.equal(result.body.detail.field, 'generatorIds');
  }
});

test('HTTP rejects unknown or incompatible types rather than generating other types or levels', async () => {
  for (const options of [
    { generatorIds: ['unknown-generator'] },
    { generatorIds: [ADD, 'unknown-generator'] },
    { generatorIds: [ADD], subject: 'korean' },
    { generatorIds: [ADD], grade: '5-6' },
    { generatorIds: [ADD], domain: '도형과 측정' },
    { generatorIds: [SINGLE], difficulty: 2 },
  ]) {
    const result = await request('/v1/worksheets', { count: 1, ...options });
    assert.equal(result.status, 404, JSON.stringify(result.body));
    assert.ok(Array.isArray(result.body.detail.generatorIds));
  }
});

test('exhausted selected type returns the existing capacity conflict, not unselected filler', async () => {
  const result = await request('/v1/worksheets', {
    count: 100, generatorIds: [SINGLE], difficulty: 1, seed: 'selected-capacity',
  });
  assert.equal(result.status, 409, JSON.stringify(result.body));
  assert.equal(result.body.detail.requested, 100);
  assert.ok(result.body.detail.produced < 100);
});
