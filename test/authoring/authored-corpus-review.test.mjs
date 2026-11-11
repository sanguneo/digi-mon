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

// PR #2 2차 리뷰. 주체 높임 '-시-'는 문장의 주어를 높인다. '형은 나에게 책을 주셨다'는 형을 높인 바른 문장이다.
// 근거: https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=314778
const ELDER_SUBJECT = /^(형|누나|언니|오빠|선생님|할머니|할아버지|어머니|아버지)(은|는|이|가|께서) /;

test('손윗사람 주어에 붙은 주체 높임 -시-를 고쳐야 할 오류로 내지 않는다', () => {
  const offenders = ITEMS.filter(({ item }) => /고친|고쳐/.test(item.instruction)
    && ELDER_SUBJECT.test(item.stem) && /(시|셨|신)[다어습]/.test(item.stem)
    && ELDER_SUBJECT.test(item.answer) && !/(시|셨|신)[다어습]/.test(item.answer));
  assert.deepEqual(offenders.map(({ code, item }) => `${code} ${item.id} ${item.stem}`), []);
});

// '먹다'는 우유·물처럼 마시는 것에도 쓴다(표준국어대사전 '먹다' 1「1」). k6-04-04 577ccff98fb4 도 '우유와 빵을 먹었다'를 정답으로 둔다.
const MILK_EAT = /(밥|빵|피자)(과|와) (우유|주스)를 먹|(우유|주스)(와|랑) (밥|빵|피자)[을를] 먹/;

test("'밥과 우유를 먹었다'를 호응 오류로 내지 않는다", () => {
  const offenders = ITEMS.filter(({ item }) => item.distractors.some((d) => MILK_EAT.test(d))
    || (/어색|고친|고쳐/.test(item.instruction) && MILK_EAT.test(item.stem)));
  assert.deepEqual(offenders.map(({ code, item }) => `${code} ${item.id} ${item.stem}`), []);
});

// '소리 나는 대로' 쓴 지문은 실제 표준 발음이어야 한다. 숲에[수페], 작은[자근], 부엌에서[부어케서],
// 떡볶이[떡뽀끼], 붙여요[부처요], 나뭇잎이[나문니피]. '주섰다'는 '주웠다'의 어느 발음도 아니다.
// 근거: https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=331304 (표준 발음법 제13항)
const FALSE_PRONUNCIATIONS = ['숩에', '저근', '부어게서', '주섰', '떡볶끼', '부텨요', '나뭇니피'];

test("'소리 나는 대로' 쓴 지문이 실제 발음과 다른 표기를 발음이라고 하지 않는다", () => {
  const offenders = ITEMS.filter(({ item }) => item.instruction.includes('소리 나는 대로')
    && FALSE_PRONUNCIATIONS.some((w) => item.stem.includes(w)));
  assert.deepEqual(offenders.map(({ code, item }) => `${code} ${item.id} ${item.stem}`), []);
});

// 국어 전수 훑기(docs/korean-audit-2026-11-11.md)에서 고친 오류 가운데 다시 생기기 쉬운 것.
// '강냉이'는 '옥수수'와 같은 뜻의 표준어다(https://krdict.korean.go.kr/kor/dicSearch/SearchView?ParaWordNo=17535).
// '어제저녁'은 한 낱말이다(https://stdict.korean.go.kr/search/searchView.do?word_no=232428&searchKeywordTo=3).
test("표준어 '강냉이'를 방언으로 가르치지 않고 '어제저녁'을 띄어 쓰지 않는다", () => {
  const offenders = ITEMS.filter(({ item }) => item.solution.some((s) => s.includes('강냉이') && /방언|지역/.test(s))
    || textsOf(item).some((t) => t.includes('어제 저녁')));
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
