import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLearningSupport,
  learnerLearningSupport,
} from '../../src/curriculum/learning-support.mjs';
import {
  generatorSupportsModes,
} from '../../src/curriculum/practice-modes.mjs';
import { createRegistry } from '../../src/engine/registry.mjs';

test('thinking and literacy mode generators all have authored learning guides', () => {
  const registry = createRegistry();
  const guided = registry.all().filter((generator) =>
    generatorSupportsModes(generator, ['thinking-skills-v1'])
    || generatorSupportsModes(generator, ['literacy-foundations']));

  assert.equal(guided.length, 18);
  for (const generator of guided) {
    const support = buildLearningSupport(generator);
    assert.equal(support.schema, 'digi-mon/learning-support@1');
    assert.equal(support.status, 'guided-candidate');
    assert.equal(support.objective.text, generator.skill);
    assert.equal(support.review.status, 'candidate');
    assert.equal(support.review.sourceKind, 'repository-authored');
    assert.ok(support.materials.length > 0, generator.id);
    assert.deepEqual(support.hints.map(({ level }) => level), [1, 2]);
    assert.ok(support.teacher.lookFor.length > 0, generator.id);
    assert.ok(support.teacher.intervention.length > 0, generator.id);
  }
});

test('unguided generators disclose objective-only support instead of inventing hints', () => {
  const support = buildLearningSupport({
    id: 'test.objective-only',
    skill: '두 수를 더하기',
  });

  assert.deepEqual(support, {
    schema: 'digi-mon/learning-support@1',
    status: 'objective-only',
    objective: {
      text: '두 수를 더하기',
      source: 'generator-skill',
    },
  });
});

test('learner projection keeps staged guidance but removes teacher-only notes', () => {
  const generator = createRegistry().get('math.g12.pd.s01.number-pattern');
  const support = buildLearningSupport(generator);
  const learner = learnerLearningSupport(support);

  assert.equal(learner.status, 'guided-candidate');
  assert.equal(learner.hints.length, 2);
  assert.equal(Object.hasOwn(learner, 'teacher'), false);
  assert.equal(Object.hasOwn(support, 'teacher'), true);
});
