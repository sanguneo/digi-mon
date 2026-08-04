/**
 * 2022 개정 초등 국어 '문법' 영역 문항 생성기.
 *
 * 앵커: 성취기준 레코드의 summary. 수학이 module(소주제)로 앵커를 받는 것과 달리
 * 국어는 summary 가 87/87 전부 고유한 내용 라벨이다(data/audit/ontology-audit.json).
 *   [2국04-01] 한글 자모 이름과 소릿값을 알고 발음·쓰기
 *   [2국04-02] 소리와 표기의 차이를 고려하여 읽고 쓰기
 *   [2국04-03] 문장과 문장 부호를 알맞게 쓰기
 *   [4국04-01] 단어 사이의 의미 관계 파악
 *   [4국04-02] 단어 분류와 국어사전 활용
 *   [4국04-03] 기본 문장 짜임 이해와 사용
 *   [4국04-04] 높임·지시·접속 표현을 상황에 맞게 사용
 *   [4국04-05] 언어를 소통과 관계 형성의 수단으로 이해   <- 태도 기준
 *   [6국04-01] 음성·문자 언어 특성과 매체 표현 효과 평가  <- 평가·태도 기준
 *   [6국04-02] 표준어와 방언 기능 및 언어 공동체 이해
 *   [6국04-03] 고유어와 관용 표현의 가치와 상황별 사용
 *   [6국04-04] 문장 성분과 호응 관계에 맞는 문장 구성
 *   [6국04-05] 시간 표현을 상황에 맞게 이해하고 사용
 *   [6국04-06] 단어·문장·띄어쓰기를 민감하게 살펴 고치기
 *
 * 자모·사전 순서·받침은 유니코드 계산으로 확정되므로 답을 계산으로 검산한다.
 * 어휘는 학년군 목록에서만 고른다. 목록 밖 낱말은 게이트가 잡는다.
 */
import { buildChoices } from '../../engine/item.mjs';
import { josaEul, josaEun, josaI } from '../../engine/korean-number.mjs';
import {
  ASPIRATED_PAIRS,
  BASIC_CONSONANTS,
  BASIC_VOWELS,
  LETTER_NAMES,
  PART_NAMES,
  TENSE_PAIRS,
  compareDictionary,
  decomposeSyllable,
  decomposeWord,
  finalOf,
  firstDifference,
  hasFinal,
  sortDictionary,
} from '../../engine/hangul.mjs';
import {
  ANTONYMS,
  DIALECTS,
  HONORIFICS,
  HYPERNYMS,
  IDIOMS,
  SENTENCE_FRAMES,
  TENSE_CASES,
  plainNouns,
  vocabularyFor,
  wordsOfLength,
  wordsWithFinal,
} from '../../curriculum/korean-vocab.mjs';

const bandOf = { 1: '1-2', 2: '1-2', 3: '1-2' };

function distractors(correct, candidates) {
  const out = [];
  for (const c of candidates) {
    if (c === correct || out.includes(c) || !c) continue;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// [2국04-01] 한글 자모 이름과 소릿값
// ---------------------------------------------------------------------------

const letterName = {
  id: 'korean.g12.gr.s01.letter-name',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 자음, 2는 모음, 3은 이름이 헷갈리는 자음(ㄱㄷㅅ 계열)을 낸다.',
  standardCode: '[2국04-01]',
  skill: '자모의 이름 알기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    // 난이도 1은 자음, 2는 모음, 3은 이름이 헷갈리는 자음(ㄱㄷㅅ 계열)을 낸다.
    const pool = difficulty === 1
      ? BASIC_CONSONANTS
      : difficulty === 2
        ? BASIC_VOWELS
        : ['ㄱ', 'ㄷ', 'ㅅ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const letter = rng.pick(pool);
    const correct = LETTER_NAMES[letter];
    const wrong = rng.shuffle(pool.filter((l) => l !== letter)).slice(0, 3).map((l) => LETTER_NAMES[l]);
    return {
      params: { letter },
      instruction: '자모의 이름을 고르시오.',
      stem: letter,
      choices: buildChoices(rng, correct, wrong),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [`${letter}의 이름은 '${correct}'이다.`],
      dedupeKey: `letter-name:${letter}`,
      difficulty,
    };
  },
  verify({ letter }, answer) {
    // 이름표에서 낱자를 되짚는다.
    const entry = Object.entries(LETTER_NAMES).find(([, name]) => name === answer.value);
    return Boolean(entry) && entry[0] === letter;
  },
};

const countLetters = {
  id: 'korean.g12.gr.s01.count-letters',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 받침 없는 두 글자, 2는 받침 있는 낱말, 3은 세 글자 낱말이다.',
  standardCode: '[2국04-01]',
  skill: '낱말을 자모로 나누어 세기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const band = '1-2';
    const pool = difficulty === 1 ? wordsWithFinal(band, false) : plainNouns(band);
    const word = rng.pick(pool.filter((w) => [...w].length === (difficulty === 3 ? 3 : 2)) .length > 0
      ? pool.filter((w) => [...w].length === (difficulty === 3 ? 3 : 2))
      : pool);
    const letters = decomposeWord(word);
    return {
      params: { word },
      instruction: '낱말을 자모로 나누면 모두 몇 개입니까?',
      stem: word,
      answer: { value: letters.length, display: `${letters.length}개`, accepts: [String(letters.length), `${letters.length}개`] },
      solution: [
        `${word}${josaEul(word)} 자모로 나누면 ${letters.join(', ')}이다.`,
        `모두 ${letters.length}개다.`,
      ],
      dedupeKey: `count-letters:${word}`,
      difficulty,
    };
  },
  verify({ word }, answer) {
    // 음절마다 초성·중성(+종성)을 하나씩 세어 되짚는다.
    let count = 0;
    for (const ch of word) {
      const d = decomposeSyllable(ch);
      count += d.final === '' ? 2 : 3;
    }
    return count === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [2국04-02] 소리와 표기의 차이 — 받침 판정
// ---------------------------------------------------------------------------

const finalConsonant = {
  id: 'korean.g12.gr.s02.final',
  difficultyAxis: 'single',
  difficulties: [1],
  standardCode: '[2국04-02]',
  skill: '낱말의 받침 찾기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const band = '1-2';
    const candidates = plainNouns(band).filter((w) => hasFinal([...w].at(-1)));
    const word = rng.pick(candidates);
    const answer = finalOf(word);
    return {
      params: { word, answer },
      instruction: '낱말의 마지막 글자에 쓰인 받침을 쓰시오.',
      stem: word,
      answer: { value: answer, display: answer, accepts: [answer] },
      solution: [
        `${word}의 마지막 글자는 '${[...word].at(-1)}'이다.`,
        `그 글자의 받침은 '${answer}'이다.`,
      ],
      dedupeKey: `final:${word}`,
      difficulty,
    };
  },
  verify({ word }, answer) {
    // 유니코드 분해로 받침을 다시 뽑는다.
    return decomposeSyllable([...word].at(-1)).final === answer.value;
  },
};

const hasFinalChoice = {
  id: 'korean.g12.gr.s02.has-final',
  difficultyAxis: 'single',
  difficulties: [1],
  standardCode: '[2국04-02]',
  skill: '받침이 있는 낱말 고르기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const band = '1-2';
    const wantFinal = rng.bool();
    const target = rng.pick(wordsWithFinal(band, wantFinal));
    const others = rng.shuffle(wordsWithFinal(band, !wantFinal)).slice(0, 3);
    return {
      params: { target, wantFinal },
      instruction: '알맞은 것을 고르시오.',
      stem: wantFinal
        ? '마지막 글자에 받침이 있는 낱말은 어느 것입니까?'
        : '마지막 글자에 받침이 없는 낱말은 어느 것입니까?',
      choices: buildChoices(rng, target, others),
      answer: { value: target, display: target, accepts: [target] },
      solution: [
        wantFinal
          ? `${target}의 마지막 글자에는 받침 '${finalOf(target)}'이 있다.`
          : `${target}의 마지막 글자에는 받침이 없다.`,
      ],
      dedupeKey: `has-final:${target}:${wantFinal ? 'y' : 'n'}`,
      difficulty,
    };
  },
  verify({ target, wantFinal }, answer) {
    return answer.value === target && hasFinal([...answer.value].at(-1)) === wantFinal;
  },
};

// ---------------------------------------------------------------------------
// [2국04-03] 문장과 문장 부호
// ---------------------------------------------------------------------------

/** 문장 부호와 쓰는 자리. 규칙이므로 목록으로 확정된다. */
const PUNCTUATION = [
  { mark: '.', name: '마침표', use: '설명하는 문장 끝', samples: ['오늘은 날씨가 좋습니다', '나는 학교에 갑니다'] },
  { mark: '?', name: '물음표', use: '묻는 문장 끝', samples: ['이것은 무엇입니까', '어디에 가십니까'] },
  { mark: '!', name: '느낌표', use: '느낌을 나타내는 문장 끝', samples: ['참 잘했구나', '날씨가 정말 좋구나'] },
  { mark: ',', name: '쉼표', use: '여러 가지를 늘어놓을 때', samples: null },
];

const punctuationChoice = {
  id: 'korean.g12.gr.s03.punctuation',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 마침표·물음표만, 2 이상은 느낌표까지 넣는다.',
  standardCode: '[2국04-03]',
  skill: '문장에 알맞은 문장 부호 넣기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const pool = difficulty === 1
      ? PUNCTUATION.filter((p) => p.mark === '.' || p.mark === '?')
      : PUNCTUATION.filter((p) => p.samples !== null);
    const spec = rng.pick(pool);
    const sentence = rng.pick(spec.samples);
    const wrong = PUNCTUATION.filter((p) => p.mark !== spec.mark).map((p) => p.mark);
    return {
      params: { mark: spec.mark },
      instruction: '□에 알맞은 문장 부호를 고르시오.',
      stem: `${sentence} □`,
      choices: buildChoices(rng, spec.mark, wrong),
      answer: { value: spec.mark, display: `${spec.mark} (${spec.name})`, accepts: [spec.mark, spec.name] },
      solution: [`${spec.use}에는 ${spec.name}(${spec.mark})를 쓴다.`],
      dedupeKey: `punctuation:${spec.mark}:${sentence}`,
      difficulty,
    };
  },
  verify({ mark }, answer) {
    // 부호표에 있는 부호인지도 함께 본다.
    return answer.value === mark && PUNCTUATION.some((p) => p.mark === answer.value);
  },
};

const punctuationName = {
  id: 'korean.g12.gr.s03.punctuation-name',
  difficultyAxis: 'single',
  difficulties: [1],
  standardCode: '[2국04-03]',
  skill: '문장 부호의 이름 알기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const spec = rng.pick(PUNCTUATION);
    const wrong = PUNCTUATION.filter((p) => p.name !== spec.name).map((p) => p.name);
    return {
      params: { mark: spec.mark, name: spec.name },
      instruction: '문장 부호의 이름을 고르시오.',
      stem: spec.mark,
      choices: buildChoices(rng, spec.name, wrong),
      answer: { value: spec.name, display: spec.name, accepts: [spec.name] },
      solution: [`${spec.mark}의 이름은 ${spec.name}이고 ${spec.use}에 쓴다.`],
      dedupeKey: `punctuation-name:${spec.mark}`,
      difficulty,
    };
  },
  verify({ mark }, answer) {
    const found = PUNCTUATION.find((p) => p.mark === mark);
    return Boolean(found) && found.name === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [4국04-01] 단어 사이의 의미 관계
// ---------------------------------------------------------------------------


const wordRelation = {
  id: 'korean.g34.gr.s01.relation',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 반대말만, 2 이상은 포함 관계까지 섞는다.',
  standardCode: '[4국04-01]',
  skill: '뜻이 반대인 낱말과 포함 관계 알기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const kind = difficulty === 1 ? 'antonym' : rng.pick(['antonym', 'hypernym']);
    if (kind === 'antonym') {
      const [a, b] = rng.pick(ANTONYMS);
      const flip = rng.bool();
      const [given, correct] = flip ? [b, a] : [a, b];
      const wrong = rng.shuffle(ANTONYMS.flat().filter((w) => w !== given && w !== correct)).slice(0, 3);
      return {
        params: { kind, given, correct },
        instruction: '뜻이 반대인 낱말을 고르시오.',
        stem: given,
        choices: buildChoices(rng, correct, wrong),
        answer: { value: correct, display: correct, accepts: [correct] },
        solution: [`'${given}'와 뜻이 반대인 낱말은 '${correct}'이다.`],
        dedupeKey: `antonym:${given}`,
        difficulty,
      };
    }
    const group = rng.pick(HYPERNYMS);
    const wrong = rng.shuffle(HYPERNYMS.filter((g) => g.general !== group.general)).slice(0, 3).map((g) => g.general);
    const examples = rng.shuffle(group.specific).slice(0, 3);
    return {
      params: { kind, general: group.general, examples },
      instruction: '세 낱말을 모두 포함하는 낱말을 고르시오.',
      stem: examples.join(', '),
      choices: buildChoices(rng, group.general, wrong),
      answer: { value: group.general, display: group.general, accepts: [group.general] },
      solution: [`${examples.join(', ')}${josaEun(examples.at(-1))} 모두 ${group.general}에 속한다.`],
      dedupeKey: `hypernym:${group.general}:${examples.join('-')}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'antonym') {
      // 반대말 목록에서 짝을 되짚는다.
      return ANTONYMS.some(([a, b]) =>
        (a === params.given && b === answer.value) || (b === params.given && a === answer.value));
    }
    const group = HYPERNYMS.find((g) => g.general === answer.value);
    return Boolean(group) && params.examples.every((e) => group.specific.includes(e));
  },
};

// ---------------------------------------------------------------------------
// [4국04-02] 단어 분류와 국어사전 활용
// ---------------------------------------------------------------------------

const dictionaryOrder = {
  id: 'korean.g34.gr.s02.dictionary-order',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 3개, 2는 4개, 3은 첫 글자가 같은 낱말 5개를 준다. 첫 글자가 같으면 모음·받침까지 비교해야 한다.',
  standardCode: '[4국04-02]',
  skill: '국어사전에서 낱말 찾는 순서 알기',
  format: 'ordering',
  generate(rng, { difficulty }) {
    const band = '3-4';
    const count = difficulty === 1 ? 3 : difficulty === 2 ? 4 : 5;
    // 첫 글자가 서로 다르면 쉽고, 같으면 둘째 글자까지 비교해야 한다.
    const pool = difficulty === 3
      ? (() => {
        const byFirst = new Map();
        for (const w of wordsOfLength(band, 2)) {
          const key = [...w][0];
          if (!byFirst.has(key)) byFirst.set(key, []);
          byFirst.get(key).push(w);
        }
        const groups = [...byFirst.values()].filter((g) => g.length >= 2);
        return groups.length > 0 ? rng.pick(groups) : wordsOfLength(band, 2);
      })()
      : plainNouns(band);
    const picked = rng.shuffle([...new Set(pool)]).slice(0, Math.min(count, pool.length));
    if (picked.length < 3) return this.generate(rng, { difficulty: 1 });
    const sorted = sortDictionary(picked);
    const display = sorted.join(', ');
    const diff = firstDifference(sorted[0], sorted[1]);
    return {
      params: { picked, sorted },
      instruction: '국어사전에 실리는 순서대로 쓰시오.',
      stem: picked.join(', '),
      answer: { value: sorted, display, accepts: [display, sorted.join(' ')] },
      solution: [
        '국어사전은 첫 자음, 모음, 받침 순서로 낱말을 싣는다.',
        `${sorted[0]}${josaI(sorted[0])} ${sorted[1]}보다 앞에 오는 까닭은 ${diff.position}번째 글자의 ${PART_NAMES[diff.part]}이 앞서기 때문이다.`,
        `순서대로 쓰면 ${display}이다.`,
      ],
      dedupeKey: `dict-order:${sorted.join('-')}`,
      difficulty,
    };
  },
  verify({ picked }, answer) {
    // 같은 낱말 집합인지, 인접 쌍이 모두 사전 순인지 본다.
    if (answer.value.length !== picked.length) return false;
    if ([...answer.value].sort().join() !== [...picked].sort().join()) return false;
    return answer.value.every((w, i) => i === 0 || compareDictionary(answer.value[i - 1], w) < 0);
  },
};

const dictionaryFirst = {
  id: 'korean.g34.gr.s02.dictionary-first',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 1~2학년 어휘, 2 이상은 3~4학년 어휘에서 고른다.',
  standardCode: '[4국04-02]',
  skill: '사전에서 가장 먼저 나오는 낱말 고르기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const band = difficulty === 1 ? '1-2' : '3-4';
    const picked = rng.shuffle([...new Set(plainNouns(band))]).slice(0, 4);
    const first = sortDictionary(picked)[0];
    return {
      params: { picked, first },
      instruction: '국어사전에서 가장 먼저 나오는 낱말을 고르시오.',
      stem: picked.join(', '),
      choices: buildChoices(rng, first, picked.filter((w) => w !== first)),
      answer: { value: first, display: first, accepts: [first] },
      solution: [
        '첫 자음의 순서를 먼저 본다.',
        `${first}${josaI(first)} 가장 앞에 온다.`,
      ],
      dedupeKey: `dict-first:${sortDictionary(picked).join('-')}`,
      difficulty,
    };
  },
  verify({ picked }, answer) {
    // 답이 나머지 모두보다 사전 순으로 앞서야 한다.
    return picked.includes(answer.value)
      && picked.every((w) => w === answer.value || compareDictionary(answer.value, w) < 0);
  },
};

// ---------------------------------------------------------------------------
// [4국04-03] 기본 문장 짜임
// ---------------------------------------------------------------------------


const sentenceParts = {
  id: 'korean.g34.gr.s03.sentence-parts',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 주어와 서술어만, 2 이상은 앞에 부사어를 붙여 문장을 길게 만든다.',
  standardCode: '[4국04-03]',
  skill: '문장에서 주어와 서술어 찾기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const frame = rng.pick(SENTENCE_FRAMES);
    const askSubject = rng.bool();
    const subjectPhrase = `${frame.subject}${josaI(frame.subject)}`;
    const sentence = difficulty === 1
      ? `${subjectPhrase} ${frame.predicate}`
      : `${rng.pick(['아침에', '운동장에서', '교실에서', '즐겁게'])} ${subjectPhrase} ${frame.predicate}`;
    const answer = askSubject ? subjectPhrase : frame.predicate;
    return {
      params: { subjectPhrase, predicate: frame.predicate, askSubject },
      instruction: askSubject ? '문장에서 주어를 찾아 쓰시오.' : '문장에서 서술어를 찾아 쓰시오.',
      stem: `${sentence}.`,
      answer: { value: answer, display: answer, accepts: [answer, askSubject ? frame.subject : answer] },
      solution: [
        askSubject
          ? `'누가/무엇이'에 해당하는 말이 주어다. 이 문장의 주어는 '${subjectPhrase}'이다.`
          : `'어떠하다/어찌하다'에 해당하는 말이 서술어다. 이 문장의 서술어는 '${frame.predicate}'이다.`,
      ],
      dedupeKey: `sentence-parts:${frame.subject}:${askSubject ? 's' : 'p'}:${difficulty}`,
      difficulty,
    };
  },
  verify({ subjectPhrase, predicate, askSubject }, answer) {
    // 주어는 주격 조사로 끝나고 서술어는 종결 어미로 끝난다.
    if (askSubject) {
      return answer.value === subjectPhrase && /[이가]$/.test(answer.value);
    }
    return answer.value === predicate && /(다|까)$/.test(answer.value);
  },
};

// ---------------------------------------------------------------------------
// [4국04-04] 높임 표현
// ---------------------------------------------------------------------------


const HONORIFIC_PARTICLES = [
  { plain: '이/가', honorific: '께서', use: '주어를 높일 때' },
  { plain: '에게', honorific: '께', use: '대상을 높일 때' },
];

const honorificExpression = {
  id: 'korean.g34.gr.s04.honorific',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1~2는 높임 어휘, 3은 높임 조사(께서·께)까지 섞는다.',
  standardCode: '[4국04-04]',
  skill: '높임 표현 알기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const useParticle = difficulty === 3 ? rng.bool() : false;
    if (useParticle) {
      const spec = rng.pick(HONORIFIC_PARTICLES);
      const wrong = distractors(spec.honorific, [
        ...HONORIFIC_PARTICLES.map((p) => p.honorific),
        '은/는', '을/를',
      ]);
      return {
        params: { kind: 'particle', correct: spec.honorific },
        instruction: '높임을 나타내는 말을 고르시오.',
        stem: `${spec.use} '${spec.plain}' 대신 무엇을 씁니까?`,
        choices: buildChoices(rng, spec.honorific, wrong.slice(0, 3)),
        answer: { value: spec.honorific, display: spec.honorific, accepts: [spec.honorific] },
        solution: [`${spec.use} '${spec.plain}'를 '${spec.honorific}'로 바꾸어 높인다.`],
        dedupeKey: `honorific-particle:${spec.plain}`,
        difficulty,
      };
    }
    const spec = rng.pick(HONORIFICS);
    const wrong = rng.shuffle(HONORIFICS.filter((h) => h.plain !== spec.plain)).slice(0, 3).map((h) => h.honorific);
    return {
      params: { kind: 'word', plain: spec.plain, correct: spec.honorific },
      instruction: '높임 표현을 고르시오.',
      stem: `'${spec.plain}'의 높임 표현은 무엇입니까?`,
      choices: buildChoices(rng, spec.honorific, wrong),
      answer: { value: spec.honorific, display: spec.honorific, accepts: [spec.honorific] },
      solution: [`'${spec.plain}'의 높임 표현은 '${spec.honorific}'이다.`],
      dedupeKey: `honorific-word:${spec.plain}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'particle') {
      return HONORIFIC_PARTICLES.some((p) => p.honorific === answer.value) && answer.value === params.correct;
    }
    // 높임 어휘표에서 짝을 되짚는다.
    const found = HONORIFICS.find((h) => h.plain === params.plain);
    return Boolean(found) && found.honorific === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [6국04-02] 표준어와 방언
// ---------------------------------------------------------------------------


const standardWord = {
  id: 'korean.g56.gr.s02.standard-word',
  difficultyAxis: 'single',
  difficulties: [1],
  standardCode: '[6국04-02]',
  skill: '표준어와 방언 구별하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const spec = rng.pick(DIALECTS);
    const askStandard = rng.bool();
    const correct = askStandard ? spec.standard : spec.dialect;
    const wrong = rng.shuffle(
      DIALECTS.filter((d) => d.standard !== spec.standard).map((d) => (askStandard ? d.standard : d.dialect)),
    ).slice(0, 3);
    return {
      params: { standard: spec.standard, dialect: spec.dialect, askStandard },
      instruction: '알맞은 것을 고르시오.',
      stem: askStandard
        ? `'${spec.dialect}'에 해당하는 표준어는 무엇입니까?`
        : `'${spec.standard}'의 ${spec.region} 지역 방언은 무엇입니까?`,
      choices: buildChoices(rng, correct, wrong),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [
        `'${spec.dialect}'는 ${spec.region} 지역에서 쓰는 방언이고 표준어는 '${spec.standard}'이다.`,
        '방언은 지역의 문화를 담고 있어 표준어와 함께 소중하다.',
      ],
      dedupeKey: `standard-word:${spec.standard}:${askStandard ? 's' : 'd'}`,
      difficulty,
    };
  },
  verify({ standard, dialect, askStandard }, answer) {
    const found = DIALECTS.find((d) => d.standard === standard && d.dialect === dialect);
    return Boolean(found) && answer.value === (askStandard ? found.standard : found.dialect);
  },
};

// ---------------------------------------------------------------------------
// [6국04-03] 고유어와 관용 표현
// ---------------------------------------------------------------------------


const idiomMeaning = {
  id: 'korean.g56.gr.s03.idiom',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 관용 표현에서 뜻을 찾고, 2 이상은 뜻에서 관용 표현을 거꾸로 찾는다.',
  standardCode: '[6국04-03]',
  skill: '관용 표현의 뜻 알기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const spec = rng.pick(IDIOMS);
    const askMeaning = difficulty === 1 ? true : rng.bool();
    const others = rng.shuffle(IDIOMS.filter((i) => i.idiom !== spec.idiom)).slice(0, 3);
    if (askMeaning) {
      return {
        params: { idiom: spec.idiom, askMeaning: true },
        instruction: '관용 표현의 뜻을 고르시오.',
        stem: `'${spec.idiom}'`,
        choices: buildChoices(rng, spec.meaning, others.map((i) => i.meaning)),
        answer: { value: spec.meaning, display: spec.meaning, accepts: [spec.meaning] },
        solution: [`'${spec.idiom}'는 '${spec.meaning}'는 뜻이다.`],
        dedupeKey: `idiom-meaning:${spec.idiom}`,
        difficulty,
      };
    }
    return {
      params: { idiom: spec.idiom, askMeaning: false },
      instruction: '뜻에 알맞은 관용 표현을 고르시오.',
      stem: `'${spec.meaning}'`,
      choices: buildChoices(rng, spec.idiom, others.map((i) => i.idiom)),
      answer: { value: spec.idiom, display: spec.idiom, accepts: [spec.idiom] },
      solution: [`'${spec.meaning}'는 뜻의 관용 표현은 '${spec.idiom}'이다.`],
      dedupeKey: `idiom-expr:${spec.idiom}`,
      difficulty,
    };
  },
  verify({ idiom, askMeaning }, answer) {
    // 관용 표현표에서 짝을 되짚는다.
    const found = IDIOMS.find((i) => i.idiom === idiom);
    return Boolean(found) && answer.value === (askMeaning ? found.meaning : found.idiom);
  },
};

// ---------------------------------------------------------------------------
// [6국04-04] 문장 성분과 호응 관계
// ---------------------------------------------------------------------------

/** 호응이 어긋난 문장과 바른 문장. 호응 규칙이 정답을 정한다. */
const AGREEMENT_CASES = [
  { wrong: '나는 어제 학교에 갈 것이다', right: '나는 어제 학교에 갔다', rule: '시간을 나타내는 말과 서술어의 때가 맞아야 한다' },
  { wrong: '내일 비가 왔다', right: '내일 비가 올 것이다', rule: '시간을 나타내는 말과 서술어의 때가 맞아야 한다' },
  { wrong: '나는 결코 그 일을 했다', right: '나는 결코 그 일을 하지 않았다', rule: "'결코'는 부정하는 말과 어울린다" },
  { wrong: '나는 별로 좋아한다', right: '나는 별로 좋아하지 않는다', rule: "'별로'는 부정하는 말과 어울린다" },
  { wrong: '왜냐하면 비가 왔다', right: '왜냐하면 비가 왔기 때문이다', rule: "'왜냐하면'은 '때문이다'와 짝을 이룬다" },
];

const agreementFix = {
  id: 'korean.g56.gr.s04.agreement',
  difficultyAxis: 'single',
  difficulties: [1],
  standardCode: '[6국04-04]',
  skill: '호응 관계가 바른 문장 고르기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const spec = rng.pick(AGREEMENT_CASES);
    const others = rng.shuffle(AGREEMENT_CASES.filter((c) => c.right !== spec.right)).slice(0, 3);
    return {
      params: { right: spec.right },
      instruction: '호응 관계가 바른 문장을 고르시오.',
      stem: '다음 중 앞말과 서술어가 알맞게 어울리는 문장은 어느 것입니까?',
      choices: buildChoices(rng, `${spec.right}.`, [`${spec.wrong}.`, ...others.map((c) => `${c.wrong}.`)].slice(0, 3)),
      answer: { value: `${spec.right}.`, display: `${spec.right}.`, accepts: [`${spec.right}.`, spec.right] },
      solution: [spec.rule, `바른 문장은 '${spec.right}.'이다.`],
      dedupeKey: `agreement:${spec.right}`,
      difficulty,
    };
  },
  verify({ right }, answer) {
    // 정답이 바른 문장 목록에 있고 잘못된 문장 목록에는 없어야 한다.
    const stripped = answer.value.replace(/\.$/, '');
    return stripped === right
      && AGREEMENT_CASES.some((c) => c.right === stripped)
      && !AGREEMENT_CASES.some((c) => c.wrong === stripped);
  },
};

// ---------------------------------------------------------------------------
// [6국04-05] 시간 표현
// ---------------------------------------------------------------------------


const tenseAgreement = {
  id: 'korean.g56.gr.s05.tense',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 3은 다른 시간 표현의 서술어를 오답으로 더 섞는다.',
  standardCode: '[6국04-05]',
  skill: '시간 표현에 맞는 서술어 고르기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const spec = rng.pick(TENSE_CASES);
    const extra = difficulty === 3
      ? rng.shuffle(TENSE_CASES.filter((c) => c.form !== spec.form)).slice(0, 1).map((c) => c.form)
      : [];
    return {
      params: { adverb: spec.adverb, form: spec.form, tense: spec.tense },
      instruction: '□에 알맞은 말을 고르시오.',
      stem: `${spec.adverb} 도서관에 □`,
      choices: buildChoices(rng, spec.form, [...spec.wrong, ...extra].slice(0, 3)),
      answer: { value: spec.form, display: spec.form, accepts: [spec.form] },
      solution: [
        `'${spec.adverb}'는 ${spec.tense}를 나타내는 말이다.`,
        `${spec.tense} 표현인 '${spec.form}'이 알맞다.`,
      ],
      dedupeKey: `tense:${spec.adverb}`,
      difficulty,
    };
  },
  verify({ adverb, form }, answer) {
    // 시간 부사와 서술어 짝을 표에서 되짚는다.
    const found = TENSE_CASES.find((c) => c.adverb === adverb);
    return Boolean(found) && found.form === answer.value && !found.wrong.includes(answer.value);
  },
};

// ---------------------------------------------------------------------------
// [6국04-06] 띄어쓰기 살펴 고치기
// ---------------------------------------------------------------------------

const SPACING_CASES = [
  { wrong: '나는학교에갑니다', right: '나는 학교에 갑니다', rule: '조사는 앞말에 붙이고 단어 사이는 띄어 쓴다' },
  { wrong: '책 을 읽었습니다', right: '책을 읽었습니다', rule: '조사는 앞말에 붙여 쓴다' },
  { wrong: '한 번더 해 봅시다', right: '한 번 더 해 봅시다', rule: '단위를 나타내는 말은 앞말과 띄어 쓴다' },
  { wrong: '사과세개를 샀습니다', right: '사과 세 개를 샀습니다', rule: '수를 나타내는 말과 단위는 띄어 쓴다' },
  { wrong: '함께가면 좋겠습니다', right: '함께 가면 좋겠습니다', rule: '단어 사이는 띄어 쓴다' },
];

const spacingFix = {
  id: 'korean.g56.gr.s06.spacing',
  difficultyAxis: 'single',
  difficulties: [1],
  standardCode: '[6국04-06]',
  skill: '띄어쓰기가 바른 문장 고르기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const spec = rng.pick(SPACING_CASES);
    const others = rng.shuffle(SPACING_CASES.filter((c) => c.right !== spec.right)).slice(0, 3);
    return {
      params: { right: spec.right },
      instruction: '띄어쓰기가 바른 문장을 고르시오.',
      stem: '다음 중 띄어쓰기가 알맞은 문장은 어느 것입니까?',
      choices: buildChoices(rng, `${spec.right}.`, [`${spec.wrong}.`, ...others.map((c) => `${c.wrong}.`)].slice(0, 3)),
      answer: { value: `${spec.right}.`, display: `${spec.right}.`, accepts: [`${spec.right}.`, spec.right] },
      solution: [spec.rule, `바르게 띄어 쓰면 '${spec.right}.'이다.`],
      dedupeKey: `spacing:${spec.right}`,
      difficulty,
    };
  },
  verify({ right }, answer) {
    const stripped = answer.value.replace(/\.$/, '');
    return stripped === right
      && SPACING_CASES.some((c) => c.right === stripped)
      && !SPACING_CASES.some((c) => c.wrong === stripped);
  },
};

export const generators = [
  letterName,
  countLetters,
  finalConsonant,
  hasFinalChoice,
  punctuationChoice,
  punctuationName,
  wordRelation,
  dictionaryOrder,
  dictionaryFirst,
  sentenceParts,
  honorificExpression,
  standardWord,
  idiomMeaning,
  agreementFix,
  tenseAgreement,
  spacingFix,
];
