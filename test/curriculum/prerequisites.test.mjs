import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approvedAncestorsOf,
  approvedPrerequisiteAssertions,
  directPrerequisiteAssertions,
  prerequisiteGraphAssertions,
} from '../../src/curriculum/prerequisites.mjs';
import {
  parseWorksheetOptions,
  WorksheetOptionsError,
} from '../../src/engine/options.mjs';

test('operational prerequisite edges expose qualification and review status', () => {
  const assertions = prerequisiteGraphAssertions();
  assert.ok(assertions.length > 0);
  for (const assertion of assertions) {
    assert.equal(assertion.subject, 'math');
    assert.equal(assertion.strength, 'recommended');
    assert.ok(assertion.reason.length > 0);
    assert.ok(assertion.basis.length > 0);
    assert.ok(assertion.source.length > 0);
    assert.equal(assertion.reviewStatus, 'needs-subject-expert-review');
  }

  const direct = directPrerequisiteAssertions('[6수01-11]');
  assert.ok(direct.some((assertion) => assertion.prerequisite === '[4수01-05]'));
});

test('learning-order generation rejects subjects without a reviewed graph', () => {
  assert.throws(
    () => parseWorksheetOptions({
      subject: 'korean',
      followLearningOrder: true,
    }),
    WorksheetOptionsError,
  );
});

test('unreviewed prerequisite candidates are not operational', () => {
  assert.deepEqual(approvedPrerequisiteAssertions(), []);
  assert.deepEqual(approvedAncestorsOf('[6수01-11]'), []);
});

