import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateGenerator, mutationGateFailures, mutantsOf } from '../../tools/mutation-test.mjs';

const STANDARD = {
  code: '[2수03-01]',
  specId: 'spec-1',
  subject: 'math',
  subjectKorean: '수학',
  gradeBand: '1-2',
  domain: '도형과 측정',
  module: '입체도형',
};

/** 정답이 boolean 이라 변형을 만들 수 없는 자동 채점 생성기. */
const noViableMutants = {
  id: 'fake.no-mutants',
  standardCode: STANDARD.code,
  skill: '참·거짓 고르기',
  format: 'short-answer',
  difficulties: [1, 2, 3],
  generate(rng, { difficulty }) {
    return {
      params: { truth: true },
      stem: '이 문장은 참입니까?',
      answer: { value: true, display: '참', accepts: ['참'] },
      solution: ['참이다.'],
      dedupeKey: 'no-mutants',
      difficulty,
    };
  },
  verify() {
    return true;
  },
};

/** 난이도 1에서만 작도 문항을 내고 나머지는 자동 채점인데 검산이 무력한 생성기. */
const manualThenWeak = {
  id: 'fake.manual-then-weak',
  standardCode: STANDARD.code,
  skill: '그리고 세기',
  format: 'short-answer',
  difficulties: [1, 2, 3],
  generate(rng, { difficulty }) {
    if (difficulty === 1) {
      return {
        params: { key: 'triangle' },
        format: 'construction',
        stem: '삼각형을 하나 그리시오.',
        answer: { display: '삼각형 1개 (사람 채점)', rubric: ['선분 3개로 닫혔는가', '빈틈이 없는가'] },
        solution: ['특징을 지켜 그렸는지 확인한다.'],
        dedupeKey: 'manual',
        difficulty,
      };
    }
    return {
      params: { n: 5 },
      stem: '5는 얼마입니까?',
      answer: { value: 5, display: '5', accepts: ['5'] },
      solution: ['5이다.'],
      dedupeKey: `weak:${difficulty}`,
      difficulty,
    };
  },
  verify(params, answer) {
    // 사람 채점 문항은 기준만 보고, 자동 채점 문항은 아무 답이나 받는다(무력한 검산).
    if (Array.isArray(answer.rubric)) return true;
    return true;
  },
};

/** 전부 작도 문항인 정당한 사람 채점 생성기. */
const pureManual = {
  id: 'fake.pure-manual',
  standardCode: STANDARD.code,
  skill: '도형 그리기',
  format: 'construction',
  difficulties: [1, 2, 3],
  generate(rng, { difficulty }) {
    return {
      params: { key: 'circle' },
      format: 'construction',
      stem: '원을 하나 그리시오.',
      answer: { display: '원 1개 (사람 채점)', rubric: ['굽은 선으로 닫혔는가', '뾰족한 곳이 없는가'] },
      solution: ['특징을 지켜 그렸는지 확인한다.'],
      dedupeKey: `pure-manual:${difficulty}`,
      difficulty,
    };
  },
  verify(params, answer) {
    return Array.isArray(answer.rubric) && answer.rubric.length >= 2;
  },
};

/** 정상 생성기. 검산이 틀린 답을 거부한다. */
const healthy = {
  id: 'fake.healthy',
  standardCode: STANDARD.code,
  skill: '더하기',
  format: 'short-answer',
  difficulties: [1, 2, 3],
  generate(rng, { difficulty }) {
    return {
      params: { a: 3, b: 4 },
      stem: '3 + 4는 얼마입니까?',
      answer: { value: 7, display: '7', accepts: ['7'] },
      solution: ['3 + 4 = 7'],
      dedupeKey: 'healthy',
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    return answer.value === a + b;
  },
};

test('mutantsOf 는 boolean 정답에서 변형을 만들지 못한다', () => {
  assert.deepEqual(mutantsOf({ value: true, display: '참', accepts: ['참'] }), []);
});

test('변형을 만들지 못한 자동 채점 생성기는 면제가 아니라 게이트 실패다', () => {
  const row = evaluateGenerator(noViableMutants, STANDARD, { samples: 6 });

  assert.equal(row.scoring, 'auto');
  assert.equal(row.mutants, 0);
  assert.ok(row.autoSamples > 0);

  const failures = mutationGateFailures([row]);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].generatorId, 'fake.no-mutants');
  assert.equal(failures[0].reason, 'no-mutants');
});

test('작도 문항 한 개가 자동 채점 문항의 검산을 면제해 주지 않는다', () => {
  const row = evaluateGenerator(manualThenWeak, STANDARD, { samples: 6 });

  // 자동 채점 표본이 하나라도 있으면 그 생성기는 사람 채점으로 분류되지 않는다.
  assert.equal(row.scoring, 'auto');
  assert.ok(row.manualSamples > 0, '작도 표본이 있어야 하는 시나리오다');
  assert.ok(row.autoSamples > 0, '자동 채점 표본도 있어야 하는 시나리오다');
  assert.ok(row.mutants > 0, '자동 채점 표본에는 변형을 주입해야 한다');
  assert.ok(row.escaped > 0, '무력한 검산이 틀린 답을 받아야 한다');

  const failures = mutationGateFailures([row]);
  assert.deepEqual(failures.map((f) => f.reason), ['weak']);
});

test('전부 작도인 생성기는 정당하게 통과한다', () => {
  const row = evaluateGenerator(pureManual, STANDARD, { samples: 6 });

  assert.equal(row.scoring, 'manual');
  assert.equal(row.autoSamples, 0);
  assert.equal(row.mutants, 0);
  assert.deepEqual(mutationGateFailures([row]), []);
});

test('검산이 제대로 된 생성기는 실패를 만들지 않는다', () => {
  const row = evaluateGenerator(healthy, STANDARD, { samples: 6 });

  assert.equal(row.scoring, 'auto');
  assert.ok(row.mutants > 0);
  assert.equal(row.escaped, 0);
  assert.deepEqual(mutationGateFailures([row]), []);
});

test('mutationGateFailures 는 약한 검산과 변형 없음을 함께 모은다', () => {
  const rows = [
    evaluateGenerator(healthy, STANDARD, { samples: 3 }),
    evaluateGenerator(noViableMutants, STANDARD, { samples: 3 }),
    evaluateGenerator(manualThenWeak, STANDARD, { samples: 3 }),
    evaluateGenerator(pureManual, STANDARD, { samples: 3 }),
  ];
  const failures = mutationGateFailures(rows);
  assert.deepEqual(
    failures.map((f) => [f.generatorId, f.reason]).sort(),
    [['fake.manual-then-weak', 'weak'], ['fake.no-mutants', 'no-mutants']],
  );
});
