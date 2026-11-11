import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuthoredCorpus } from '../../src/generators/authored.mjs';

/**
 * PR #2 리뷰가 코퍼스에서 찾은 국어 규범 오류의 회귀 테스트.
 * 근거는 국립국어원(한글 맞춤법 제47항, 표준 발음) 답변이다.
 */
const ITEMS = loadAuthoredCorpus().flatMap((file) => file.items.map((item) => ({ code: file.standardCode, item })));
const textsOf = (item) => [item.instruction, item.stem, item.answer, ...item.distractors, ...item.solution];

// 한글 맞춤법 제47항: 보조 용언은 띄어 씀이 원칙이고 붙여 씀도 허용한다('도와 가며', '도와가며').
const AUXILIARY = /([가-힣]*[아어와워봐해줘쳐려켜혀]) (가|주|보|오|버리|놓|두|내|드리|있)/g;

test('허용된 보조 용언 붙여쓰기를 원칙을 묻지 않고 오답으로 내지 않는다', () => {
  const offenders = [];
  for (const { code, item } of ITEMS) {
    for (const m of item.answer.matchAll(AUXILIARY)) {
      const joined = item.answer.slice(0, m.index) + m[1] + m[2] + item.answer.slice(m.index + m[0].length);
      if (item.distractors.includes(joined) && !item.instruction.includes('원칙')) offenders.push(`${code} ${item.id} ${joined}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("곤충 '잠자리'를 [잠짜리]로 소리 난다고 가르치지 않는다", () => {
  // 곤충 '잠자리'는 [잠자리]로 소리 난다. [잠짜리]는 '잠을 자는 곳'의 발음이다.
  const offenders = ITEMS.filter(({ item }) => textsOf(item).some((t) => t.includes('잠짜리')));
  assert.deepEqual(offenders.map(({ code, item }) => `${code} ${item.id}`), []);
});

// 뜻에 따라 반대말이 둘 이상인 낱말. 맥락 없이 반대말을 물으면 둘 다 정답이 된다.
const MULTI_ANTONYMS = { 빠르다: ['느리다', '늦다'] };

test('맥락 없는 반대말 문항이 다른 뜻의 반대말을 오답으로 두지 않는다', () => {
  const offenders = [];
  for (const { code, item } of ITEMS) {
    if (!item.instruction.includes('반대')) continue;
    const word = /^'([^']+)'$/.exec(item.stem)?.[1];
    const antonyms = MULTI_ANTONYMS[word];
    if (!antonyms) continue;
    const both = [item.answer, ...item.distractors].filter((c) => antonyms.includes(c));
    if (both.length > 1) offenders.push(`${code} ${item.id} ${both.join('/')}`);
  }
  assert.deepEqual(offenders, []);
});
