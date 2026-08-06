import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gradeItem,
  gradeWorksheet,
  normalizeResponse,
} from '../../src/server/grade.mjs';

function numericChoiceItem() {
  return {
    number: 1,
    id: 'numeric-choice',
    standardCode: '[2수01-01]',
    skill: '수 고르기',
    difficulty: 1,
    format: 'multiple-choice',
    scoring: 'auto',
    choices: [
      { label: '①', text: '14', correct: false },
      { label: '②', text: '13', correct: true },
      { label: '③', text: '2', correct: false },
    ],
    answer: {
      value: 13,
      display: '13',
      accepts: ['13'],
    },
    solution: ['13이 정답이다.'],
  };
}

function shortAnswer(number, expected) {
  return {
    number,
    id: `short-${number}`,
    standardCode: `[2수01-0${number}]`,
    skill: '계산',
    difficulty: 1,
    format: 'short-answer',
    scoring: 'auto',
    answer: {
      value: expected,
      display: String(expected),
      accepts: [String(expected)],
    },
    solution: [`정답은 ${expected}이다.`],
  };
}

test('numeric choice text wins over numeric index interpretation', () => {
  const result = gradeItem(numericChoiceItem(), '2');
  assert.equal(result.correct, false);
});

test('fullwidth learner input is normalized before grading', () => {
  assert.equal(normalizeResponse('１４'), '14');
  assert.equal(normalizeResponse('３＋４＝７'), '3+4=7');
  assert.equal(normalizeResponse('５－２'), '5-2');
});

test('unanswered auto-scored items count toward completion and accuracy', () => {
  const worksheet = {
    seed: 'partial',
    items: [
      shortAnswer(1, 10),
      shortAnswer(2, 20),
      shortAnswer(3, 30),
    ],
  };

  const result = gradeWorksheet(worksheet, { 1: '10' });

  assert.equal(result.schema, 'digi-mon/grading-result@1');
  assert.equal(result.graded, 3);
  assert.equal(result.answered, 1);
  assert.equal(result.total, 3);
  assert.equal(result.correct, 1);
  assert.equal(result.accuracy, 0.3333);
  assert.equal(result.completionRate, 0.3333);
  assert.equal(result.results[1].answered, false);
  assert.equal(result.results[1].correct, false);
});

