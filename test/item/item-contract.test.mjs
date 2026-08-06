import assert from 'node:assert/strict';
import test from 'node:test';

import {
  answerLeaksInAltText,
  finalizeItem,
  learnerFigure,
  validateItem,
} from '../../src/engine/item.mjs';

const STANDARD = {
  code: '[4수03-10]',
  specId: 'spec-1',
  subject: 'math',
  subjectKorean: '수학',
  gradeBand: '3-4',
  domain: '도형과 측정',
  module: '여러 가지 사각형',
};

function finalize(overrides = {}) {
  return finalizeItem({
    generatorId: 'test.gen',
    skill: '테스트 기능',
    difficulty: 1,
    format: 'short-answer',
    stem: '3 + 4는 얼마입니까?',
    answer: { value: 7, display: '7', accepts: ['7'] },
    solution: ['3 + 4 = 7'],
    params: {},
    dedupeKey: 'k1',
    ...overrides,
  }, { standard: STANDARD });
}

function choices(list) {
  const labels = ['①', '②', '③', '④', '⑤'];
  return list.map((c, idx) => ({ label: labels[idx], ...c }));
}

// ---------------------------------------------------------------------------
// answer.value 계약
// ---------------------------------------------------------------------------

test('자동 채점 문항은 answer.value 가 없으면 거부한다', () => {
  assert.throws(
    () => finalize({ answer: { display: '7', accepts: ['7'] } }),
    /answer\.value/,
  );
});

test('answer.value 가 null 이어도 거부한다', () => {
  assert.throws(
    () => finalize({ answer: { value: null, display: '7', accepts: ['7'] } }),
    /answer\.value/,
  );
});

test('answer.value 가 0 이나 빈 문자열이면 받는다 (값이 있는 것과 참인 것은 다르다)', () => {
  const zero = finalize({ answer: { value: 0, display: '0', accepts: ['0'] } });
  assert.equal(zero.schema, 'digi-mon/item@1');
  assert.equal(zero.answer.value, 0);
});

test('사람 채점 문항은 answer.value 없이 rubric 만으로 통과한다', () => {
  const item = finalize({
    format: 'construction',
    stem: '삼각형을 하나 그리시오.',
    answer: { display: '삼각형 1개를 그린다 (사람 채점)', rubric: ['선분 3개로 닫혔는가', '빈틈이 없는가'] },
    solution: ['삼각형의 특징을 지켜 그렸는지 확인한다.'],
  });
  assert.equal(item.scoring, 'manual');
  assert.equal(item.answer.value, undefined);
});

// ---------------------------------------------------------------------------
// 선택형 라벨·정답 계약
// ---------------------------------------------------------------------------

test('선택지 라벨이 중복이면 거부한다', () => {
  assert.throws(() => finalize({
    format: 'multiple-choice',
    choices: [
      { label: '①', text: '정사각형', correct: true },
      { label: '①', text: '직사각형', correct: false },
      { label: '③', text: '마름모', correct: false },
    ],
    answer: { value: '정사각형', display: '정사각형', accepts: ['정사각형'] },
  }), /라벨/);
});

test('라벨이 비어 있으면 거부한다 (라벨 수와 선택지 수가 맞아야 한다)', () => {
  assert.throws(() => finalize({
    format: 'multiple-choice',
    choices: [
      { label: '①', text: '정사각형', correct: true },
      { label: '②', text: '직사각형', correct: false },
      { text: '마름모', correct: false },
    ],
    answer: { value: '정사각형', display: '정사각형', accepts: ['정사각형'] },
  }), /라벨/);
});

test('라벨을 붙일 수 있는 수보다 선택지가 많으면 거부한다', () => {
  assert.throws(() => finalize({
    format: 'multiple-choice',
    choices: choices([
      { text: 'a', correct: true },
      { text: 'b', correct: false },
      { text: 'c', correct: false },
      { text: 'd', correct: false },
      { text: 'e', correct: false },
    ]).concat([{ label: '⑥', text: 'f', correct: false }]),
    answer: { value: 'a', display: 'a', accepts: ['a'] },
  }), /선택지/);
});

test('정답 선택지 본문이 accepts 에 없으면 거부한다', () => {
  assert.throws(() => finalize({
    format: 'multiple-choice',
    choices: choices([
      { text: '정사각형', correct: true },
      { text: '직사각형', correct: false },
      { text: '마름모', correct: false },
    ]),
    answer: { value: '정사각형', display: '정사각형', accepts: ['네모'] },
  }), /정답 선택지 본문/);
});

test('오답 선택지 본문이 accepts 에 있으면 거부한다 (정확히 하나만 받아야 한다)', () => {
  assert.throws(() => finalize({
    format: 'multiple-choice',
    choices: choices([
      { text: '정사각형', correct: true },
      { text: '직사각형', correct: false },
      { text: '마름모', correct: false },
    ]),
    answer: { value: '정사각형', display: '정사각형', accepts: ['정사각형', '직사각형'] },
  }), /오답 선택지 본문/);
});

test('라벨도 accepts 로 받는 기호 정답은 그대로 통과한다', () => {
  const item = finalize({
    format: 'multiple-choice',
    choices: choices([
      { text: '㉢', correct: true },
      { text: '㉠', correct: false },
      { text: '㉡', correct: false },
    ]),
    answer: { value: '㉢', display: '㉢ (정사각형)', accepts: ['㉢', '정사각형'] },
    figure: {
      kind: 'geometry.quadrilateral',
      spec: { kinds: ['trapezoid', 'rhombus', 'square'] },
      answerBearingSpecKeys: ['kinds'],
      altText: '네 도형이 차례로 놓여 있다.',
      prompt: { ko: '사각형 세 개' },
    },
  });
  assert.equal(item.answer.value, '㉢');
});

// ---------------------------------------------------------------------------
// figure 접근성 계약
// ---------------------------------------------------------------------------

function figureItem(figure, overrides = {}) {
  return finalize({
    stem: '',
    figure,
    answer: { value: 3, display: '3개', accepts: ['3', '3개'] },
    ...overrides,
  });
}

test("access 는 described 또는 requires-visual 만 받는다", () => {
  assert.throws(() => figureItem({
    kind: 'geometry.angle',
    spec: { degrees: 40 },
    access: 'partial',
    altText: '각 하나.',
    prompt: { ko: '각' },
  }), /figure\.access/);
});

test("access 가 requires-visual 이면 accommodation 을 요구한다", () => {
  assert.throws(() => figureItem({
    kind: 'geometry.angle',
    spec: { degrees: 40 },
    access: 'requires-visual',
    altText: '각 하나.',
    prompt: { ko: '각' },
  }), /accommodation/);

  const ok = figureItem({
    kind: 'geometry.angle',
    spec: { degrees: 40 },
    access: 'requires-visual',
    accommodation: '각의 크기는 그림에만 있다. 촉각 도해나 실물 각도기가 필요하다.',
    altText: '한 변이 수평인 각 하나. 크기는 적혀 있지 않다.',
    prompt: { ko: '각' },
  });
  assert.equal(ok.figure.access, 'requires-visual');
});

test('answerBearingSpecKeys 는 spec 에 실제로 있는 키만 받는다', () => {
  assert.throws(() => figureItem({
    kind: 'geometry.angle',
    spec: { degrees: 40 },
    answerBearingSpecKeys: ['angles'],
    altText: '각 하나.',
    prompt: { ko: '각' },
  }), /answerBearingSpecKeys/);
});

test('정답을 품은 spec 을 선언한 그림은 altText 가 정답을 흘리면 거부한다', () => {
  assert.throws(() => finalize({
    format: 'multiple-choice',
    stem: '',
    choices: choices([
      { text: '밀기', correct: true },
      { text: '뒤집기', correct: false },
      { text: '돌리기', correct: false },
    ]),
    answer: { value: '밀기', display: '밀기', accepts: ['밀기'] },
    figure: {
      kind: 'geometry.symmetry',
      spec: { transform: 'slide' },
      answerBearingSpecKeys: ['transform'],
      altText: '왼쪽은 처음 도형, 오른쪽은 밀기를 한 결과다.',
      prompt: { ko: '도형 두 개' },
    },
  }), /altText 가 정답/);
});

test('기호가 정답인 그림 문항은 정답을 품은 spec 을 선언해야 한다', () => {
  assert.throws(() => finalize({
    format: 'multiple-choice',
    stem: '정사각형은 어느 것입니까?',
    choices: choices([
      { text: '㉢', correct: true },
      { text: '㉠', correct: false },
      { text: '㉡', correct: false },
    ]),
    answer: { value: '㉢', display: '㉢ (정사각형)', accepts: ['㉢'] },
    figure: {
      kind: 'geometry.quadrilateral',
      spec: { kinds: ['trapezoid', 'rhombus', 'square'] },
      altText: '사각형 세 개가 차례로 놓여 있다.',
      prompt: { ko: '사각형 세 개' },
    },
  }), /answerBearingSpecKeys/);
});

// ---------------------------------------------------------------------------
// 학습자용 그림 투영
// ---------------------------------------------------------------------------

test('learnerFigure 는 정답을 품은 spec 키를 지우고 무엇을 지웠는지 남긴다', () => {
  const figure = {
    kind: 'geometry.quadrilateral',
    spec: { kinds: ['trapezoid', 'rhombus', 'square'], showLabels: false },
    answerBearingSpecKeys: ['kinds'],
    access: 'described',
    altText: '네 변과 각의 성질이 서로 다른 사각형 세 개가 차례로 놓여 있다.',
    prompt: { ko: '정답이 적힌 프롬프트' },
    svg: '<svg></svg>',
  };

  const projected = learnerFigure(figure);

  assert.equal(Object.hasOwn(projected.spec, 'kinds'), false);
  assert.equal(projected.spec.showLabels, false);
  assert.deepEqual(projected.redactedSpecKeys, ['kinds']);
  assert.equal(projected.altText, figure.altText);
  assert.equal(projected.access, 'described');
  assert.equal(projected.svg, '<svg></svg>');
  // 프롬프트는 정답 문자열을 그대로 담는다. 학습자에게 내려보내지 않는다.
  assert.equal(Object.hasOwn(projected, 'prompt'), false);
  assert.equal(Object.hasOwn(projected, 'answerBearingSpecKeys'), false);
  // 원본은 건드리지 않는다.
  assert.deepEqual(figure.spec.kinds, ['trapezoid', 'rhombus', 'square']);
});

test('learnerFigure 는 접근 편의 정보를 그대로 넘긴다', () => {
  const projected = learnerFigure({
    kind: 'geometry.angle',
    spec: { angles: [33, 90, 153] },
    answerBearingSpecKeys: ['angles'],
    access: 'requires-visual',
    accommodation: '각의 크기가 그림에만 있다.',
    altText: '각 3개가 차례로 놓여 있다.',
    prompt: { ko: 'x' },
  });
  assert.equal(projected.access, 'requires-visual');
  assert.equal(projected.accommodation, '각의 크기가 그림에만 있다.');
  assert.deepEqual(projected.spec, {});
});

// ---------------------------------------------------------------------------
// 정답 누출 판정
// ---------------------------------------------------------------------------

test('숫자 정답은 토큰이 통째로 같을 때만 누출로 본다', () => {
  // '74도'가 다른 각을 가리키는 문장이면 '7'이 들어 있다는 이유로 잡지 않는다.
  assert.deepEqual(answerLeaksInAltText('세 각 중 두 각이 67도, 39도인 삼각형.', ['7', '7도']), []);
  assert.deepEqual(answerLeaksInAltText('한 변이 수평인 150도 각.', ['150', '150도']), ['150도']);
});

test('한글 정답은 부분 문자열로도 누출로 본다', () => {
  assert.deepEqual(answerLeaksInAltText('오른쪽은 밀기를 한 결과다.', ['밀기']), ['밀기']);
  assert.deepEqual(answerLeaksInAltText('도형 두 개가 나란히 있다.', ['밀기']), []);
});

test('기호 정답은 누출 판정에서 뺀다 (기호는 그림을 가리키는 이름표다)', () => {
  assert.deepEqual(answerLeaksInAltText('㉠, ㉡, ㉢이 차례로 놓여 있다.', ['㉢']), []);
});

test('validateItem 은 finalizeItem 없이도 같은 계약을 적용한다', () => {
  assert.throws(() => validateItem({
    generatorId: 'direct',
    format: 'short-answer',
    scoring: 'auto',
    stem: '문항',
    difficulty: 1,
    answer: { display: '7', accepts: ['7'] },
    solution: ['풀이'],
  }), /answer\.value/);
});
