import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import { LEARNING_GUIDES } from '../../src/curriculum/learning-guides.mjs';
import {
  assertLearningGuide,
  assertLearningSupport,
  buildLearningSupport,
  learnerLearningSupport,
  learningGuideFor,
} from '../../src/curriculum/learning-support.mjs';
import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { buildWorksheet, generateItem } from '../../src/engine/worksheet.mjs';
import { generators } from '../../src/generators/math/g12-number-operations.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';
import { createApp } from '../../src/server/app.mjs';

const IDS = [
  'math.g12.no.s01.read-sino',
  'math.g12.no.s01.write-digit',
  'math.g12.no.s01.count-tens-ones',
  'math.g12.no.s01.count-native',
  'math.g12.no.s02.place-digit',
  'math.g12.no.s02.place-amount',
  'math.g12.no.s02.decompose',
  'math.g12.no.s03.compare',
  'math.g12.no.s03.order',
  'math.g12.no.s03.sequence',
  'math.g12.no.s04.decompose',
  'math.g12.no.s04.compose',
  'math.g12.no.s04.make-ten',
  'math.g12.no.s05.story-add',
  'math.g12.no.s05.story-sub',
  'math.g12.no.s06.add',
  'math.g12.no.s06.sub',
  'math.g12.no.s07.add-to-sub',
  'math.g12.no.s07.fact-family',
  'math.g12.no.s08.add-three',
  'math.g12.no.s08.sub-three',
  'math.g12.no.s09.box',
  'math.g12.no.s10.groups',
  'math.g12.no.s10.add-to-mult',
  'math.g12.no.s11.times-table',
  'math.g12.no.s11.times-blank',
];
const registry = createRegistry();
const spine = buildSpine(loadOntology());
const ajv = new Ajv2020({ allErrors: true, strict: false });
const supportSchema = JSON.parse(readFileSync(
  new URL('../../schema/learning-support.schema.json', import.meta.url), 'utf8',
));
const validateSupport = ajv.compile(supportSchema);
// Validate the delivered guided fields against the committed contract while rejecting
// every extra field, including teacher metadata. No unpublished schema is needed.
const validateLearnerSupport = ajv.compile({
  type: 'object',
  required: ['schema', 'status', 'objective', 'review', 'materials', 'hints'],
  properties: Object.fromEntries(Object.entries(supportSchema.properties)
    .filter(([name]) => name !== 'teacher')),
  additionalProperties: false,
});

function assertGuided(generator, support) {
  assert.equal(support.status, 'guided-candidate', generator.id);
  assertLearningSupport(generator.id, support);
  assert.equal(validateSupport(support), true, JSON.stringify(validateSupport.errors));
  assert.deepEqual(support.objective, { text: generator.skill, source: 'generator-skill' });
  assert.deepEqual(support.review, {
    status: 'candidate', sourceKind: 'repository-authored', revision: 1,
  });
  assert.deepEqual(support.materials.map(({ kind }) => kind), ['principle']);
  assert.deepEqual(support.hints.map(({ level, kind }) => ({ level, kind })), [
    { level: 1, kind: 'concept-recall' },
    { level: 2, kind: 'strategy' },
  ]);
}

test('ordinary grade 1-2 arithmetic resolves principle guides from the curriculum registry', () => {
  assert.deepEqual(generators.map(({ id }) => id).sort(), [...IDS].sort());
  for (const id of IDS) {
    const raw = generators.find((generator) => generator.id === id);
    assert.equal(Object.hasOwn(raw, 'learningGuide'), false, id);
    assert.ok(Object.hasOwn(LEARNING_GUIDES, id), id);
    const generator = registry.get(id);
    assertLearningGuide(id, generator.learningGuide);
    assert.deepEqual(generator.learningGuide, learningGuideFor(id));
    assertGuided(generator, buildLearningSupport(generator));
  }
});

test('generated arithmetic items ship the same authored guidance across seeds and difficulties', () => {
  for (const id of IDS) {
    const generator = registry.get(id);
    const standard = spine.standards.find(({ code }) => code === generator.standardCode);
    const expected = buildLearningSupport(generator);
    assertGuided(generator, expected);
    for (const difficulty of [1, 2, 3]) {
      for (const seed of ['simple-guides-a', 'simple-guides-b']) {
        const item = generateItem(generator, standard, createRng(`${seed}:${id}`), difficulty);
        assert.equal(generator.verify(item.params, item.answer), true, id);
        // Shipped-copy equality: help is registry-authored, not derived from the answer or solution.
        assert.deepEqual(item.learningSupport, expected, `${id} d${difficulty} ${seed}`);
        assert.notEqual(item.learningSupport.hints, generator.learningGuide.hints);
      }
    }
  }
});

test('arithmetic guide lookup, item support and learner projections are isolated copies', () => {
  const id = 'math.g12.no.s06.add';
  const original = structuredClone(LEARNING_GUIDES[id]);
  const guide = learningGuideFor(id);
  assert.ok(guide, id);
  const support = buildLearningSupport({ ...registry.get(id), learningGuide: guide });
  const learner = learnerLearningSupport(support);
  guide.hints[0].text = 'lookup-mutation';
  learner.hints[1].text = 'learner-mutation';
  support.teacher.lookFor.push('teacher-mutation');
  assert.deepEqual(learningGuideFor(id), original);
  assert.deepEqual(support.hints, original.hints);
  assert.equal(Object.hasOwn(learner, 'teacher'), false);
  assert.equal(validateLearnerSupport(learner), true, JSON.stringify(validateLearnerSupport.errors));
  assert.equal(validateLearnerSupport({ ...learner, teacher: support.teacher }), false);
});

test('100-question ordinary worksheets deliver learner hints without teacher notes or answers', { timeout: 30_000 }, async (t) => {
  const options = {
    subject: 'math', gradeBands: ['1-2'], domains: ['수와 연산'],
    count: 100, difficulty: 1, seed: 'simple-math-guides-worksheet',
  };
  const built = buildWorksheet(spine, registry, options);
  assert.equal(built.produced, 100);
  assert.equal(built.shortfall, 0);
  assert.deepEqual(built.options.modes, []);
  assert.equal(new Set(built.items.map(({ id }) => id)).size, 100);
  for (const item of built.items) {
    assert.ok(IDS.includes(item.generatorId));
    assertGuided(registry.get(item.generatorId), item.learningSupport);
  }

  const teacherToken = 'simple-guides-test-teacher';
  const server = http.createServer(createApp({ spine, registry, teacherToken }));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const listening = once(server, 'listening', { signal: AbortSignal.timeout(10_000) });
  server.listen(0, '127.0.0.1');
  await listening;
  const url = `http://127.0.0.1:${server.address().port}/v1/worksheets`;
  for (const includeAnswers of [false, true]) {
    const response = await fetch(`${url}?includeAnswers=${includeAnswers}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(includeAnswers ? { authorization: `Bearer ${teacherToken}` } : {}),
      },
      body: JSON.stringify(options),
      signal: AbortSignal.timeout(10_000),
    });
    const worksheet = await response.json();
    assert.equal(response.status, 200, JSON.stringify(worksheet));
    assert.equal(worksheet.produced, 100);
    assert.equal(worksheet.fingerprint, built.fingerprint);
    for (const [index, item] of worksheet.items.entries()) {
      const original = built.items[index];
      assert.equal(item.id, original.id);
      if (includeAnswers) {
        assert.deepEqual(item.learningSupport, original.learningSupport);
        assert.deepEqual(item.answer, original.answer);
      } else {
        assert.deepEqual(item.learningSupport, learnerLearningSupport(original.learningSupport));
        assert.equal(validateLearnerSupport(item.learningSupport), true,
          JSON.stringify(validateLearnerSupport.errors));
        for (const secret of ['answer', 'solution', 'params', 'dedupeKey']) {
          assert.equal(Object.hasOwn(item, secret), false, `${item.generatorId}: ${secret}`);
        }
        assert.equal(Object.hasOwn(item.learningSupport, 'teacher'), false);
        for (const choice of item.choices ?? []) assert.equal(Object.hasOwn(choice, 'correct'), false);
      }
    }
  }
});
