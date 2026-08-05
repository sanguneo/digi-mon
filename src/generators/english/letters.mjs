/**
 * 2022 개정 초등 영어 문자 인식 문항 생성기.
 *
 * 앵커: 성취기준 레코드의 summary (영어는 module 이 없고 summary 가 40/40 고유하다).
 *   [4영01-02] 알파벳 대소문자를 식별하여 읽는 초기 문자 인식 표준
 *   [4영02-02] 알파벳 대소문자를 구별하여 쓰는 초기 쓰기 표준
 *   [6영02-03] 알파벳 대소문자와 문장 부호를 문장에서 바르게 사용하는 표준
 *
 * 왜 이 셋만 되는가:
 * 대소문자 짝·알파벳 순서·문장 첫 글자 대문자·문장 끝 부호는 전부 계산으로
 * 확정된다. 음성 자산도 지문 자산도 필요 없다. 나머지 영어 성취기준은 듣기
 * 음성이나 읽기 지문이 있어야 성립하거나(자산 대기), 태도·음성 산출·창의 수행이라
 * 정답 대조가 원리적으로 안 된다(MANUAL_SCORING 에 분류).
 */
import { buildChoices } from '../../engine/item.mjs';
import {
  ALPHABET,
  CONFUSABLE_LETTERS,
  CONFUSABLE_LOWER,
  END_MARKS,
  SENTENCE_CASES,
  englishWordsFor,
} from '../../curriculum/english-vocab.mjs';

// ---------------------------------------------------------------------------
// [4영01-02] 대소문자를 식별하여 읽기
// ---------------------------------------------------------------------------

const matchCase = {
  id: 'english.g34.lt.s01-02.match-case',
  standardCode: '[4영01-02]',
  skill: '대문자에 맞는 소문자 찾기',
  format: 'multiple-choice',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 모양이 닮지 않은 글자, 2는 전체 알파벳, 3은 모양이 닮아 헷갈리는 글자(B/D, P/Q, M/N)를 낸다.',
  generate(rng, { difficulty }) {
    const easy = ALPHABET.filter((c) => !CONFUSABLE_LETTERS.includes(c));
    const pool = difficulty === 1 ? easy : difficulty === 2 ? ALPHABET : CONFUSABLE_LETTERS;
    const upper = rng.pick(pool);
    const askLower = rng.bool();
    const correct = askLower ? upper.toLowerCase() : upper;
    const given = askLower ? upper : upper.toLowerCase();

    // 오답은 모양이 닮은 글자에서 고른다. 무작위로 고르면 문항이 너무 쉬워진다.
    const nearby = (difficulty === 3 ? CONFUSABLE_LETTERS : ALPHABET).filter((c) => c !== upper);
    const wrong = rng.shuffle(nearby).slice(0, 3).map((c) => (askLower ? c.toLowerCase() : c));

    return {
      params: { upper, askLower },
      instruction: askLower ? '같은 글자의 소문자를 고르시오.' : '같은 글자의 대문자를 고르시오.',
      stem: given,
      choices: buildChoices(rng, correct, wrong),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [
        `${upper}의 대문자는 ${upper}, 소문자는 ${upper.toLowerCase()}이다.`,
      ],
      dedupeKey: `match-case:${upper}:${askLower ? 'lower' : 'upper'}:${difficulty}`,
      difficulty,
    };
  },
  verify({ upper, askLower }, answer) {
    // 대소문자 변환은 유니코드 계산이다. 반대 방향으로 되짚는다.
    const expected = askLower ? upper.toLowerCase() : upper.toUpperCase();
    if (answer.value !== expected) return false;
    // 같은 글자인지도 확인한다.
    return answer.value.toUpperCase() === upper.toUpperCase();
  },
};

const alphabetOrder = {
  id: 'english.g34.lt.s01-02.alphabet-order',
  standardCode: '[4영01-02]',
  skill: '알파벳 순서 알기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // 난이도가 오를수록 뒤쪽 글자와 여러 칸 건너뛰기를 낸다.
    const span = difficulty === 1 ? 1 : difficulty === 2 ? rng.int(1, 2) : rng.int(2, 3);
    const maxIndex = ALPHABET.length - 1 - span;
    const start = difficulty === 1 ? rng.int(0, Math.min(12, maxIndex)) : rng.int(0, maxIndex);
    const before = ALPHABET[start];
    const after = ALPHABET[start + span];
    const askAfter = rng.bool();
    const target = askAfter ? after : before;

    return {
      params: { start, span, askAfter },
      instruction: '□에 알맞은 알파벳 대문자를 쓰시오.',
      stem: askAfter
        ? `${before} ${span === 1 ? '' : '... '}□`.trim()
        : `□ ${span === 1 ? '' : '... '}${after}`.trim(),
      answer: { value: target, display: target, accepts: [target, target.toLowerCase()] },
      solution: [
        span === 1
          ? `알파벳 순서에서 ${before} 다음은 ${after}이다.`
          : `알파벳 순서에서 ${before}부터 ${span}칸 뒤는 ${after}이다.`,
      ],
      dedupeKey: `alphabet-order:${start}:${span}:${askAfter ? 'after' : 'before'}`,
      difficulty,
    };
  },
  verify({ start, span, askAfter }, answer) {
    // 코드포인트 차이로 되짚는다. 목록 인덱스를 다시 읽지 않는다.
    const value = answer.value.toUpperCase();
    if (value.length !== 1) return false;
    const offset = value.codePointAt(0) - 'A'.codePointAt(0);
    if (offset < 0 || offset > 25) return false;
    return offset === (askAfter ? start + span : start);
  },
};

// ---------------------------------------------------------------------------
// [4영02-02] 대소문자를 구별하여 쓰기
// ---------------------------------------------------------------------------

const writeCase = {
  id: 'english.g34.lt.s02-02.write-case',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 네 글자 이하, 2는 여섯 글자 이하, 3은 전체 어휘에서 낸다. 글자가 길수록 바꿔 쓸 곳이 늘어난다.',
  standardCode: '[4영02-02]',
  skill: '낱말을 대문자로 또는 소문자로 바꿔 쓰기',
  format: 'short-answer',
  generate(rng, { difficulty, standard }) {
    const words = englishWordsFor(standard.gradeBand);
    const pool = difficulty === 1
      ? words.filter((w) => w.length <= 4)
      : difficulty === 2
        ? words.filter((w) => w.length <= 6)
        : words;
    const word = rng.pick(pool.length > 0 ? pool : words);
    const toUpper = rng.bool();
    const given = toUpper ? word.toLowerCase() : word.toUpperCase();
    const target = toUpper ? word.toUpperCase() : word.toLowerCase();

    return {
      params: { word, toUpper },
      instruction: toUpper ? '모두 대문자로 바꿔 쓰시오.' : '모두 소문자로 바꿔 쓰시오.',
      stem: given,
      answer: { value: target, display: target, accepts: [target] },
      solution: [
        `${given}의 글자를 하나씩 ${toUpper ? '대문자' : '소문자'}로 바꾼다.`,
        `${target}이다.`,
      ],
      dedupeKey: `write-case:${word}:${toUpper ? 'upper' : 'lower'}`,
      difficulty,
    };
  },
  verify({ word, toUpper }, answer) {
    // 글자 수가 같고, 같은 낱말이며, 요구한 대소문자여야 한다.
    if (answer.value.length !== word.length) return false;
    if (answer.value.toLowerCase() !== word.toLowerCase()) return false;
    return toUpper
      ? answer.value === answer.value.toUpperCase()
      : answer.value === answer.value.toLowerCase();
  },
};

const firstLetterCase = {
  id: 'english.g34.lt.s02-02.first-letter',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 네 글자 이하, 2는 여섯 글자 이하, 3은 학년군 어휘 전체에서 낸다.',
  standardCode: '[4영02-02]',
  skill: '낱말의 첫 글자를 대문자로 쓰기',
  format: 'short-answer',
  generate(rng, { difficulty, standard }) {
    /**
     * 성취기준의 학년군 어휘만 쓴다.
     * 난이도를 올리려고 상위 학년군 어휘를 끌어오면 3~4학년 문항에 5~6학년
     * 낱말이 들어간다. 난이도는 낱말 길이로 가른다.
     */
    const words = englishWordsFor(standard.gradeBand);
    const maxLength = difficulty === 1 ? 4 : difficulty === 2 ? 6 : 99;
    const pool = words.filter((w) => w.length <= maxLength);
    const word = rng.pick(pool.length > 0 ? pool : words);
    const target = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

    return {
      params: { word },
      instruction: '첫 글자만 대문자로 바꿔 쓰시오.',
      stem: word.toLowerCase(),
      answer: { value: target, display: target, accepts: [target] },
      solution: [
        `첫 글자 ${word.charAt(0).toLowerCase()}를 대문자 ${word.charAt(0).toUpperCase()}로 바꾼다.`,
        `${target}이다.`,
      ],
      dedupeKey: `first-letter:${word}`,
      difficulty,
    };
  },
  verify({ word }, answer) {
    if (answer.value.toLowerCase() !== word.toLowerCase()) return false;
    const head = answer.value.charAt(0);
    const rest = answer.value.slice(1);
    // 첫 글자만 대문자, 나머지는 소문자여야 한다.
    return head === head.toUpperCase() && head !== head.toLowerCase()
      && rest === rest.toLowerCase();
  },
};

// ---------------------------------------------------------------------------
// [6영02-03] 문장에서 대소문자와 문장 부호 바르게 쓰기
// ---------------------------------------------------------------------------

const sentenceEndMark = {
  id: 'english.g56.lt.s02-03.end-mark',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 마침표·물음표만, 2 이상은 느낌표까지 구별한다.',
  standardCode: '[6영02-03]',
  skill: '문장 끝에 알맞은 부호 넣기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const pool = difficulty === 1
      ? SENTENCE_CASES.filter((c) => c.kind !== 'exclamation')
      : SENTENCE_CASES;
    const spec = rng.pick(pool);
    const mark = END_MARKS[spec.kind].mark;
    const withoutMark = spec.correct.replace(/[.?!]$/, '');
    const wrong = Object.values(END_MARKS).map((m) => m.mark).filter((m) => m !== mark);

    return {
      params: { kind: spec.kind, sentence: spec.correct },
      instruction: '□에 알맞은 문장 부호를 고르시오.',
      stem: `${withoutMark} □`,
      choices: buildChoices(rng, mark, [...wrong, ',']),
      answer: { value: mark, display: `${mark} (${END_MARKS[spec.kind].name})`, accepts: [mark] },
      solution: [spec.rule],
      dedupeKey: `end-mark:${spec.correct}`,
      difficulty,
    };
  },
  verify({ kind, sentence }, answer) {
    // 원문의 마지막 글자와 같아야 하고, 종류별 부호표와도 맞아야 한다.
    return answer.value === sentence.slice(-1) && answer.value === END_MARKS[kind].mark;
  },
};

const fixSentenceCase = {
  id: 'english.g56.lt.s02-03.fix-case',
  standardCode: '[6영02-03]',
  skill: '문장 첫 글자를 대문자로 바르게 쓰기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 문장 첫 글자만, 2 이상은 문장 부호까지 함께 바로잡는다.',
  generate(rng, { difficulty }) {
    const spec = rng.pick(SENTENCE_CASES);
    const dropMark = difficulty >= 2;
    // 첫 글자를 소문자로 낮추고, 난이도 2 이상은 끝 부호도 지운다.
    const broken = (dropMark ? spec.correct.replace(/[.?!]$/, '') : spec.correct)
      .replace(/^./, (c) => c.toLowerCase());

    return {
      params: { correct: spec.correct, dropMark },
      instruction: dropMark
        ? '첫 글자와 문장 부호를 바르게 고쳐 문장을 다시 쓰시오.'
        : '첫 글자를 바르게 고쳐 문장을 다시 쓰시오.',
      stem: broken,
      answer: { value: spec.correct, display: spec.correct, accepts: [spec.correct] },
      solution: [
        '영어 문장의 첫 글자는 대문자로 쓴다.',
        ...(dropMark ? [spec.rule] : []),
        `${spec.correct}이다.`,
      ],
      dedupeKey: `fix-case:${spec.correct}:${dropMark ? 'mark' : 'head'}`,
      difficulty,
    };
  },
  verify({ correct }, answer) {
    if (answer.value !== correct) return false;
    const head = answer.value.charAt(0);
    // 첫 글자가 대문자이고 문장 끝에 부호가 있어야 한다.
    return head === head.toUpperCase()
      && head !== head.toLowerCase()
      && /[.?!]$/.test(answer.value);
  },
};

export const generators = [
  matchCase,
  alphabetOrder,
  writeCase,
  firstLetterCase,
  sentenceEndMark,
  fixSentenceCase,
];
