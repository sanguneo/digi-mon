/**
 * 어휘 게이트가 문항에서 '학습 대상 낱말' 을 뽑는 규칙.
 *
 * tools/check-vocabulary.mjs 가 등록된 생성기를 표본 검사할 때 쓰고, AI 작성 문항
 * 파이프라인(src/authoring)이 후보 문항을 코퍼스에 넣기 전에 같은 규칙으로 거른다.
 */
import { isSyllable } from '../engine/hangul.mjs';

/**
 * 어휘 검사에서 뺄 것.
 * 문법 용어와 자모·부호는 학습 어휘가 아니라 메타 언어다.
 */
const META_TERMS = new Set([
  '기역', '쌍기역', '니은', '디귿', '쌍디귿', '리을', '미음', '비읍', '쌍비읍',
  '시옷', '쌍시옷', '이응', '지읒', '쌍지읒', '치읓', '키읔', '티읕', '피읖', '히읗',
  '마침표', '물음표', '느낌표', '쉼표',
  '주어', '서술어', '목적어', '표준어', '방언', '고유어', '한자어', '관용', '표현',
  '아', '애', '야', '얘', '어', '에', '여', '예', '오', '와', '왜', '외',
  '요', '우', '워', '웨', '위', '유', '으', '의', '이',
]);

/**
 * 문항에서 '학습 대상 낱말'만 뽑는다.
 *
 * 어절과 조사는 낱말이 아니다. '고양이가' 는 낱말 '고양이' 에 주격 조사가 붙은
 * 어절이고 '께서' 는 조사 자체다. 이것들을 어휘 목록으로 재면 옳은 문항을 계속
 * 위반으로 보고해 게이트가 무력해진다. 조사를 떼고 남은 낱말을 본다.
 */
const PARTICLES = [
  '께서', '에게', '으로', '이라고', '까지', '부터', '보다', '만큼', '처럼', '에서',
  '에', '은', '는', '이', '가', '을', '를', '과', '와', '도', '만', '의', '께',
];

/** 조사를 떼어 낸 낱말. 조사만으로 된 말은 낱말이 아니므로 null 을 준다. */
function stripParticle(text, allowed) {
  if (allowed.has(text)) return text;
  if (PARTICLES.includes(text)) return null;
  for (const p of [...PARTICLES].sort((a, b) => b.length - a.length)) {
    if (text.endsWith(p) && text.length > p.length) {
      const stem = text.slice(0, -p.length);
      if (allowed.has(stem)) return stem;
    }
  }
  return text;
}

export function learnedWordsOf(item, allowed) {
  const out = new Set();
  const isPlainWord = (t) => typeof t === 'string'
    && t.length > 0
    && [...t].every((ch) => isSyllable(ch))
    && [...t].length <= 4;

  const add = (value) => {
    if (!isPlainWord(value)) return;
    const word = stripParticle(value, allowed);
    if (word !== null) out.add(word);
  };

  for (const value of Object.values(item.params ?? {})) {
    add(value);
    if (Array.isArray(value)) for (const v of value) add(v);
  }
  for (const choice of item.choices ?? []) add(choice.text);
  add(item.stem);
  add(item.answer.value);

  for (const term of META_TERMS) out.delete(term);
  return [...out];
}

/**
 * 영어 문항에서 학습 대상 낱말을 뽑는다.
 * 알파벳 한 글자와 문장은 어휘 목록으로 재지 않는다. 낱말 단위만 본다.
 */
export function englishWordsOf(item) {
  const out = new Set();
  const isWord = (t) => typeof t === 'string' && /^[A-Za-z]{2,}$/.test(t);
  // params 는 내부 메타데이터다('statement', 'question' 같은 문항 종류가 들어 있다).
  // 학습 대상 낱말은 아이가 읽는 문면에만 있으므로 stem·선택지·정답만 본다.
  for (const choice of item.choices ?? []) if (isWord(choice.text)) out.add(choice.text.toLowerCase());
  if (isWord(item.stem)) out.add(item.stem.toLowerCase());
  if (isWord(item.answer.value)) out.add(item.answer.value.toLowerCase());
  return [...out];
}
