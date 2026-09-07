import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { buildWorksheet } from '../../src/engine/worksheet.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';
import { createApp } from '../../src/server/app.mjs';
import { gradeItem } from '../../src/server/grade.mjs';

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const generatorId = 'korean.g56.gr.s06.spacing';
const options = {
  subject: 'korean',
  codes: ['[6국04-06]'],
  seed: 'spacing-defect',
};

for (const [difficulty, count] of [[1, 5], [2, 10], [3, 14]]) {
  test(`spacing practice requires correcting every difficulty ${difficulty} case`, () => {
    const request = { ...options, difficulty, count };
    const worksheet = buildWorksheet(spine, registry, request);
    assert.equal(worksheet.shortfall, 0);
    assert.deepEqual(buildWorksheet(spine, registry, request), worksheet);
    assert.equal(new Set(worksheet.items.map((item) => item.params.right)).size, count);

    for (const item of worksheet.items) {
      assert.equal(item.generatorId, generatorId);
      assert.equal(item.choices, undefined, 'the correctly spaced answer must not be offered for copying');
      assert.equal(item.format, 'short-answer');
      assert.equal(item.scoring, 'auto');
      assert.equal(item.stem.replace(/\s/g, ''), item.answer.display.replace(/\s/g, ''));
      assert.notEqual(item.stem, item.answer.display);
      assert.equal(item.answer.value, `${item.params.right}.`);
      assert.deepEqual(item.answer.accepts, [`${item.params.right}.`, item.params.right]);
      assert.ok(item.solution.length > 0);
      assert.equal(registry.get(generatorId).verify(item.params, item.answer), true);
      for (const accepted of item.answer.accepts) {
        assert.equal(gradeItem(item, accepted).correct, true);
      }
      for (const rejected of ['', item.stem, item.answer.display.replace(/\s/g, '')]) {
        assert.equal(gradeItem(item, rejected).correct, false);
      }
    }
  });
}

test('public spacing worksheet hides the answer and grades the written correction over HTTP', async (t) => {
  const teacherToken = 'spacing-regression-teacher';
  const server = createServer(createApp({ spine, registry, teacherToken }));
  const listening = once(server, 'listening', { signal: AbortSignal.timeout(5_000) });
  server.listen(0, '127.0.0.1');
  await listening;
  t.after(async () => {
    const closed = once(server, 'close', { signal: AbortSignal.timeout(5_000) });
    server.close();
    await closed;
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function post(path, body, teacher = false) {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(teacher ? { authorization: `Bearer ${teacherToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await response.json();
    assert.equal(response.status, 200, JSON.stringify(payload));
    return payload;
  }

  const request = { ...options, difficulty: 3, count: 14 };
  const learner = await post('/v1/worksheets', request);
  const teacher = await post('/v1/worksheets', { ...request, includeAnswers: true }, true);
  assert.deepEqual(await post('/v1/worksheets', request), learner);
  assert.equal(learner.fingerprint, teacher.fingerprint);
  assert.equal(learner.produced, request.count);
  for (const [index, item] of learner.items.entries()) {
    const answer = teacher.items[index].answer;
    assert.equal(item.id, teacher.items[index].id);
    for (const accepted of answer.accepts) {
      assert.equal(JSON.stringify(item).includes(accepted), false, 'learner payload exposes a spaced answer');
    }
    for (const privateKey of ['answer', 'solution', 'params', 'dedupeKey']) {
      assert.equal(Object.hasOwn(item, privateKey), false);
      assert.equal(Object.hasOwn(teacher.items[index], privateKey), true);
    }
    assert.equal(Object.hasOwn(item.learningSupport, 'teacher'), false);
    assert.equal(item.choices, undefined);
    assert.equal(item.format, 'short-answer');
  }

  const gradingRequest = { ...request, fingerprint: learner.fingerprint, records: false };
  const correct = await post('/v1/grade', {
    ...gradingRequest,
    responses: Object.fromEntries(teacher.items.map((item) => [item.number, item.answer.display])),
  });
  assert.equal(correct.correct, request.count);
  const copied = await post('/v1/grade', {
    ...gradingRequest,
    responses: Object.fromEntries(learner.items.map((item) => [item.number, item.stem])),
  });
  assert.equal(copied.answered, request.count);
  assert.equal(copied.correct, 0);

  // Reading pauses are a separate task: word spaces are not the pause marker.
  const reading = await post('/v1/worksheets', {
    ...options, codes: ['[2국02-02]'], count: 1, difficulty: 1,
  });
  assert.equal(reading.items[0].generatorId, 'korean.g12.st.s02-02.reading-break');
  assert.equal(reading.items[0].format, 'multiple-choice');
  assert.equal(reading.items[0].stem.includes('∨'), false);
  assert.ok(reading.items[0].choices.some((choice) => choice.text.includes('∨')));
});
