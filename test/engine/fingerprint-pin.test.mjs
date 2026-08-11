/**
 * 지문값 고정 회귀 테스트.
 *
 * fingerprint 가 바뀌면 이미 발급된 학습지의 채점이 전부 깨진다. 아래 해시는
 * 리팩터링 전에 실측해 박아 둔 값이다. stableJson 추출처럼 지문 계산 경로를
 * 건드리는 작업은 이 테스트가 통과해야 옳은 리팩터링이다.
 *
 * 이 값이 바뀌어야 하는 변경(엔진 버전 올림 등)이라면, 바꾸는 이유를 커밋
 * 메시지에 남기고 새 값을 실측해 갱신한다. 이유 없이 갱신하지 말 것.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorksheet, buildWorksheetFingerprint } from '../../src/engine/worksheet.mjs';
import { buildWorksheetFormSet } from '../../src/engine/worksheet-forms.mjs';

const PRIMITIVE_PAYLOAD = {
  schema: 'digi-mon/worksheet@5',
  seed: 'pinned-seed',
  options: {
    subject: 'math',
    gradeBands: null,
    domains: null,
    codes: null,
    count: 2,
    difficulty: 1,
    difficultyMix: { 1: 0.3, 2: 0.5, 3: 0.2 },
    modes: [],
    followLearningOrder: false,
    excludeItemIds: [],
  },
  modeSelection: null,
  items: [
    { number: 1, id: 'a', stem: '1을 쓰시오.' },
    { number: 2, id: 'b', stem: '2를 쓰시오.' },
  ],
  corpus: {
    taxonomyVersion: 'digi-mon/curriculum-corpus@1',
    integrity: [{ file: 'data/spine/standards.json', sha256: 'abc' }],
  },
};

function standard(code) {
  return {
    code,
    specId: `spec:${code}`,
    subject: 'math',
    subjectKorean: '수학',
    gradeBand: '1-2',
    domain: '수와 연산',
    module: '수',
  };
}

function generator(id, standardCode) {
  return {
    id,
    standardCode,
    skill: id,
    format: 'short-answer',
    difficulties: [1],
    generate(rng) {
      const value = rng.int(1, 1_000_000);
      return {
        params: { value },
        stem: `${value}를 쓰시오.`,
        answer: { value, display: String(value), accepts: [String(value)] },
        solution: [`${value}이다.`],
        dedupeKey: `${id}:${value}`,
        difficulty: 1,
      };
    },
    verify({ value }, answer) {
      return value === answer.value;
    },
  };
}

const CODE_A = '[2수01-01]';
const CODE_B = '[2수01-02]';

function fixture() {
  const generators = new Map([
    [CODE_A, [generator('pinned-a', CODE_A)]],
    [CODE_B, [generator('pinned-b', CODE_B)]],
  ]);
  return {
    spine: {
      corpus: { schema: 'test-corpus', integrity: [] },
      standards: [standard(CODE_A), standard(CODE_B)],
    },
    registry: { forStandard: (code) => generators.get(code) ?? [] },
    options: { seed: 'pinned-seed', subject: 'math', count: 4, difficulty: 1 },
  };
}

test('fingerprint 원시 함수의 지문값이 고정되어 있다', () => {
  assert.equal(
    buildWorksheetFingerprint(PRIMITIVE_PAYLOAD),
    '687bf59e1c48ab3291d2ca6b8ad9b9657a70d67b346861565f7fe600111bead5',
  );
});

test('학습지 지문값이 고정되어 있다', () => {
  const { spine, registry, options } = fixture();
  assert.equal(
    buildWorksheet(spine, registry, options).fingerprint,
    'f2ceef5aa7877194f865f191aad287eed32e965260760c89a18ba174f39df5c1',
  );
});

test('form set 과 각 form 의 지문값이 고정되어 있다', () => {
  const { spine, registry, options } = fixture();
  const set = buildWorksheetFormSet(spine, registry, { ...options, formCount: 2 });
  assert.equal(
    set.fingerprint,
    '87dd0ea3cd22d08e87ac62b5e85c2deecabacef6bad917bda1af4fb32dadb3ec',
  );
  assert.deepEqual(
    set.forms.map((form) => form.worksheet.fingerprint),
    [
      'e069246580f74a0d5e24908f86ee44d5d84ee7be0bcfb21751248ba503aa57a0',
      '5d67bc1efbf60be252f5c2f27cba9d49b58cf98341f934083a2072d33e53b064',
    ],
  );
});
