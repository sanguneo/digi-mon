/**
 * 영어 문장·대화 자산 기반 생성기.
 *
 * 음성·지문 자산 없이 성립하는 것만 다룬다. 5차 수리에서 저작했다.
 *   [4영01-05] 문장의 뜻 이해     — 문장-뜻 짝이면 성립한다
 *   [4영02-06] 행동 지시          — 상황-지시문 짝 (PARTIAL: 말하기는 사람이 본다)
 *   [6영02-04] 소개·묘사 문장      — 상황-문장 짝 (PARTIAL)
 *   [6영02-07] 세부 정보 묻고 답하기 — 질문-응답 짝 (PARTIAL)
 *   [4영02-08] 묻고 답하기        — 질문-응답 짝 (PARTIAL)
 *   [6영02-08] 예시문 빈칸        — PARTIAL: 글 구성은 사람이 본다
 *
 * 정답이 규칙이 아니라 표의 사실이므로 verify 가 같은 표를 되읽는다. 표의 내용은
 * 사람이 봐야 한다(REVIEW.md §5·§12-B). 오답이 문맥에 들어맞으면 정답이 둘이 되므로
 * 오답을 짝마다 손으로 골랐다 — 자산 표의 주석에 그 제약을 적어 뒀다.
 */
import { buildChoices } from '../../engine/item.mjs';
import {
  COMMANDS,
  EXPRESSIONS,
  QA_PAIRS_G34,
  QA_PAIRS_G56,
  SENTENCE_MEANINGS,
  TEMPLATE_BLANKS,
} from '../../curriculum/english-vocab.mjs';

// ---------------------------------------------------------------------------
// [4영01-05] 문장의 뜻 이해
// ---------------------------------------------------------------------------

const wordCount = (s) => s.split(/\s+/).length;

const sentenceMeaning = {
  id: 'english.g34.st.s01-05.meaning',
  standardCode: '[4영01-05]',
  skill: '문장의 뜻 알기',
  format: 'multiple-choice',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 세 단어 문장, 2 이상은 더 긴 문장까지 낸다.',
  capacityNote: '문장-뜻 짝 8개가 상한이다. 뜻이 겹치지 않는 문장만 담을 수 있어 확장에 검토가 필요하다.',
  generate(rng, { difficulty }) {
    const pool = difficulty === 1
      ? SENTENCE_MEANINGS.filter((s) => wordCount(s.en) <= 3)
      : SENTENCE_MEANINGS;
    const spec = rng.pick(pool.length > 0 ? pool : SENTENCE_MEANINGS);
    const wrong = rng.shuffle(SENTENCE_MEANINGS.filter((s) => s.en !== spec.en))
      .slice(0, 3)
      .map((s) => s.ko);
    return {
      params: { en: spec.en, ko: spec.ko },
      instruction: '문장의 뜻으로 알맞은 것을 고르시오.',
      stem: spec.en,
      choices: buildChoices(rng, spec.ko, wrong),
      answer: { value: spec.ko, display: spec.ko, accepts: [spec.ko] },
      solution: [`'${spec.en}'의 뜻은 '${spec.ko}'이다.`],
      dedupeKey: `en-meaning:${spec.en}`,
      difficulty,
    };
  },
  verify({ en, ko }, answer) {
    const found = SENTENCE_MEANINGS.find((s) => s.en === en);
    if (!found || found.ko !== ko) return false;
    return answer.value === ko;
  },
};

// ---------------------------------------------------------------------------
// 상황-문장 짝 공통 틀: [4영02-06] 행동 지시 · [6영02-04] 소개·묘사
// ---------------------------------------------------------------------------

function situationGenerator({ id, standardCode, skill, table, capacityNote }) {
  return {
    id,
    standardCode,
    skill,
    format: 'multiple-choice',
    difficultyAxis: 'single',
    difficulties: [1],
    capacityNote,
    generate(rng, { difficulty }) {
      const spec = rng.pick(table);
      const wrong = rng.shuffle(table.filter((c) => c.en !== spec.en))
        .slice(0, 3)
        .map((c) => c.en);
      return {
        params: { situation: spec.situation, en: spec.en },
        instruction: '상황에 알맞은 문장을 고르시오.',
        stem: spec.situation,
        choices: buildChoices(rng, spec.en, wrong),
        answer: { value: spec.en, display: spec.en, accepts: [spec.en] },
        solution: [`'${spec.situation}'에는 '${spec.en}'이 알맞다.`],
        dedupeKey: `${id}:${spec.en}`,
        difficulty,
      };
    },
    verify({ situation, en }, answer) {
      const found = table.find((c) => c.situation === situation);
      if (!found || found.en !== en) return false;
      return answer.value === en;
    },
  };
}

const commandChoice = situationGenerator({
  id: 'english.g34.st.s02-06.command',
  standardCode: '[4영02-06]',
  skill: '행동 지시 문장 고르기',
  table: COMMANDS,
  capacityNote: '상황-지시문 짝 8개가 상한이다. 상황이 겹치지 않아야 해서 확장에 검토가 필요하다.',
});

const expressionChoice = situationGenerator({
  id: 'english.g56.st.s02-04.expression',
  standardCode: '[6영02-04]',
  skill: '소개·묘사 문장 고르기',
  table: EXPRESSIONS,
  capacityNote: '상황-문장 짝 8개가 상한이다.',
});

// ---------------------------------------------------------------------------
// [6영02-08] 예시문 빈칸
// ---------------------------------------------------------------------------

const templateBlank = {
  id: 'english.g56.st.s02-08.blank',
  standardCode: '[6영02-08]',
  skill: '예시문의 빈칸 채우기',
  format: 'multiple-choice',
  difficultyAxis: 'single',
  difficulties: [1],
  capacityNote: '빈칸 예시문 6개가 상한이다. 목록 안 낱말 중 문맥에 맞는 것이 정답뿐이어야 해서 확장에 검토가 필요하다.',
  generate(rng, { difficulty }) {
    const spec = rng.pick(TEMPLATE_BLANKS);
    return {
      params: { text: spec.text, word: spec.answer },
      instruction: '빈칸에 알맞은 단어를 고르시오.',
      stem: spec.text,
      choices: buildChoices(rng, spec.answer, spec.wrong),
      answer: { value: spec.answer, display: spec.answer, accepts: [spec.answer] },
      solution: [`빈칸에는 '${spec.answer}'가 알맞다.`],
      dedupeKey: `blank:${spec.text}`,
      difficulty,
    };
  },
  verify({ text, word }, answer) {
    const found = TEMPLATE_BLANKS.find((t) => t.text === text);
    if (!found || found.answer !== word) return false;
    return answer.value === word && !found.wrong.includes(answer.value);
  },
};

// ---------------------------------------------------------------------------
// 질문-응답 짝 공통 틀: [4영02-08] · [6영02-07]
// ---------------------------------------------------------------------------

function qaGenerator({ id, standardCode, skill, table, capacityNote }) {
  return {
    id,
    standardCode,
    skill,
    format: 'multiple-choice',
    difficultyAxis: 'single',
    difficulties: [1],
    capacityNote,
    generate(rng, { difficulty }) {
      const spec = rng.pick(table);
      return {
        params: { q: spec.q, a: spec.a },
        instruction: '물음에 알맞은 대답을 고르시오.',
        stem: spec.q,
        choices: buildChoices(rng, spec.a, spec.wrong),
        answer: { value: spec.a, display: spec.a, accepts: [spec.a] },
        solution: [`'${spec.q}'에는 '${spec.a}'로 답한다.`],
        dedupeKey: `${id}:${spec.q}`,
        difficulty,
      };
    },
    verify({ q, a }, answer) {
      const found = table.find((p) => p.q === q);
      if (!found || found.a !== a) return false;
      return answer.value === a && !found.wrong.includes(answer.value);
    },
  };
}

const qaG34 = qaGenerator({
  id: 'english.g34.st.s02-08.qa',
  standardCode: '[4영02-08]',
  skill: '묻고 답하기',
  table: QA_PAIRS_G34,
  capacityNote: '질문-응답 짝 5개가 상한이다. 오답을 짝마다 손으로 골라야 해서 확장에 검토가 필요하다.',
});

const qaG56 = qaGenerator({
  id: 'english.g56.st.s02-07.qa',
  standardCode: '[6영02-07]',
  skill: '세부 정보를 묻고 답하기',
  table: QA_PAIRS_G56,
  capacityNote: '질문-응답 짝 5개가 상한이다.',
});

export const generators = [
  sentenceMeaning,
  commandChoice,
  expressionChoice,
  templateBlank,
  qaG34,
  qaG56,
];
