import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// PR #2 3차 리뷰. 활용형('도와 드렸다')까지 보고, 붙여 쓴 정답 + 띄어 쓴 오답지 배치도 막는다.
// '들어가다', '잊어버리다'처럼 사전에 한 낱말로 오른 말은 붙여 써야만 하므로 뺀다.
const AUXILIARY_INFLECTED = /([가-힣]*[아어와워봐해줘쳐려켜혀]) (갔|가|갑|간|갈|줬|줘|주|준|줄|줍|봤|봐|보|본|볼|봅|왔|와|오|온|올|옵|버리|버려|버렸|버린|놓|두|둬|뒀|둔|냈|내|드렸|드려|드리|드린|드릴|드립|있)/g;
const ONE_WORD = /(들어가|들어갔|들어오|들어왔|잊어버|돌아가|돌아갔|돌아오|돌아왔|나아가|올라가|내려가|알아보|살펴보|빌려주)/;

test('보조 용언을 붙여 쓴 것과 띄어 쓴 것을 원칙을 묻지 않고 정답·오답으로 가르지 않는다', () => {
  const offenders = [];
  for (const { code, item } of ITEMS) {
    if (item.instruction.includes('원칙')) continue;
    const options = [item.answer, ...item.distractors];
    for (const spaced of options) {
      for (const m of spaced.matchAll(AUXILIARY_INFLECTED)) {
        if (ONE_WORD.test(m[1] + m[2])) continue;
        const joined = spaced.slice(0, m.index) + m[1] + m[2] + spaced.slice(m.index + m[0].length);
        if (options.includes(joined) && (spaced === item.answer || joined === item.answer)) offenders.push(`${code} ${item.id} ${spaced} / ${joined}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

// PR #2 3차 리뷰. '동생'·'사촌'·'조카'는 성별을 정하지 않는다. 지시문이 성별을 밝히지 않으면
// brother/sister, he/she만 다른 선택지는 둘 다 맞는다.
const GENDER_SWAP = { brother: 'sister', sister: 'brother', he: 'she', she: 'he', his: 'her', her: 'his', him: 'her', boy: 'girl', girl: 'boy', son: 'daughter', daughter: 'son', nephew: 'niece', niece: 'nephew' };
const UNGENDERED_KIN = /(?<![남여])동생|사촌|조카/;
const genderBlind = (s) => s.toLowerCase().replace(/[a-z]+/g, (w) => (GENDER_SWAP[w] ? '#' : w));

test('성별을 정하지 않은 우리말 관계어로 성별만 다른 영어 선택지를 가르지 않는다', () => {
  const offenders = ITEMS.filter(({ code, item }) => code.includes('영')
    && UNGENDERED_KIN.test(`${item.instruction} ${item.stem}`.replace(/[A-Za-z][^가-힣]*/g, ' '))
    && item.distractors.some((d) => d !== item.answer && genderBlind(d) === genderBlind(item.answer)));
  assert.deepEqual(offenders.map(({ code, item }) => `${code} ${item.id} ${item.stem}`), []);
});

// PR #2 3차 리뷰. 띄어 읽기 정답이 하나로 정해져야 한다. 주어(-이/-가/-께서) 뒤, 이어 주는 말(-고/-서/-며/-면/-다가) 뒤,
// 목적어(-을/-를) 뒤의 쉼은 뜻을 살린 읽기로 볼 수 있으므로 '잘못 읽은 것'의 정답이 될 수 없고,
// '알맞게 읽은 것'의 오답지가 될 수 없다. 꾸며 주는 말과 꾸밈을 받는 말 사이, 낱말 가운데의 쉼은 틀린 쉼이다.
// 정할 수 없는 문항은 docs/korean-audit-2026-11-11.md 표에 '사람 검토 필요'로 올라 있어야 한다.
const HUMAN_REVIEW = new Set([...readFileSync(new URL('../../docs/korean-audit-2026-11-11.md', import.meta.url), 'utf8')
  .matchAll(/\| `([0-9a-f]{12})` \|[^\n]*사람 검토 필요/g)].map((m) => m[1]));
const pauseKind = (item, option) => {
  const named = /^'([^']+)' 다음$/.exec(option);
  if (!named && !option.includes(' ∨ ')) return null;
  if (!named && option.replace(' ∨ ', '') === item.stem) return 'inside-word';
  const left = named ? named[1] : option.slice(0, option.indexOf(' ∨ ')).split(' ').pop();
  if (/[을를]$/.test(left)) return 'object';
  if (/(고|서|며|면|다가)$/.test(left)) return 'connective';
  if (left.length > 1 && /(께서|[이가])$/.test(left)) return 'subject';
  return 'other';
};
const ACCEPTABLE_PAUSE = new Set(['object', 'connective', 'subject']);

test('띄어 읽기 문항의 정답이 하나로 정해지거나 사람 검토 목록에 있다', () => {
  const offenders = [];
  for (const { code, item } of ITEMS) {
    if (code !== '[2국02-02]' || HUMAN_REVIEW.has(item.id)) continue;
    if (item.instruction.includes('잘못 띄어 읽은')) {
      if (ACCEPTABLE_PAUSE.has(pauseKind(item, item.answer))) offenders.push(`${item.id} 정답 ${item.answer}`);
    } else if (/알맞게 띄어 읽은|띄어 읽기에 알맞은 곳/.test(item.instruction)) {
      for (const d of item.distractors) if (ACCEPTABLE_PAUSE.has(pauseKind(item, d))) offenders.push(`${item.id} 오답지 ${d}`);
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
