/**
 * 국어 문장 단위 자산 기반 생성기.
 *
 * 지문 자산 없이 성립하는 성취기준만 다룬다. 3차 검토가 제시한 착수 순서를 따랐다.
 *   [4국02-04] 사실과 의견 구분 — 문장 하나로 성립한다
 *   [6국05-02] 비유적 표현     — 비유가 쓰인 문장을 고르는 형태로 성립한다
 *   [2국02-02] 알맞게 띄어 읽기 — 띄어 읽을 자리를 문장 구조로 판정한다
 *
 * 정답이 규칙이 아니라 사실(문장의 분류)인 문항이므로 verify 가 같은 표를 되읽는다.
 * 그 한계는 check-fact-tables 와 같고 REVIEW.md §5 에 적혀 있다. 표의 각 항목에
 * 판정 근거(basis)를 함께 두어 사람이 검토할 수 있게 했다.
 */
import { buildChoices } from '../../engine/item.mjs';
import { josaEun, josaI } from '../../engine/korean-number.mjs';
import { FACT_OPINION, FIGURATIVE, READING_BREAKS } from '../../curriculum/korean-sentences.mjs';

// ---------------------------------------------------------------------------
// [4국02-04] 사실과 의견 구분
// ---------------------------------------------------------------------------

const factOrOpinion = {
  id: 'korean.g34.st.s02-04.fact-opinion',
  standardCode: '[4국02-04]',
  skill: '사실과 의견 구별하기',
  format: 'multiple-choice',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 수를 세거나 재어 확인하는 사실과 느낌을 나타내는 의견처럼 판정이 뚜렷한 문장을 낸다. 2 이상은 주장·비교가 섞인 문장까지 낸다.',
  generate(rng, { difficulty }) {
    // 앞쪽이 판정이 뚜렷한 문장이다. 난이도가 오르면 뒤쪽까지 넓힌다.
    const facts = FACT_OPINION.filter((s) => s.kind === 'fact');
    const opinions = FACT_OPINION.filter((s) => s.kind === 'opinion');
    const cut = difficulty === 1 ? 5 : difficulty === 2 ? 6 : 8;
    const pool = [...facts.slice(0, cut), ...opinions.slice(0, cut)];
    const spec = rng.pick(pool);
    const correct = spec.kind === 'fact' ? '사실' : '의견';

    return {
      params: { text: spec.text, kind: spec.kind },
      instruction: '다음 문장이 사실인지 의견인지 고르시오.',
      stem: spec.text,
      choices: buildChoices(rng, correct, [correct === '사실' ? '의견' : '사실', '질문', '명령']),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [spec.basis, `그러므로 ${correct}을 나타내는 문장이다.`],
      dedupeKey: `fact-opinion:${spec.text}`,
      difficulty,
    };
  },
  verify({ text, kind }, answer) {
    // 문장 표에서 되짚는다. 표에 없는 문장이면 실패다.
    const found = FACT_OPINION.find((s) => s.text === text);
    if (!found || found.kind !== kind) return false;
    return answer.value === (kind === 'fact' ? '사실' : '의견');
  },
};

const findOpinionWord = {
  id: 'korean.g34.st.s02-04.opinion-word',
  standardCode: '[4국02-04]',
  skill: '의견을 나타내는 말 고르기',
  format: 'multiple-choice',
  difficultyAxis: 'single',
  difficulties: [1],
  capacityNote: '의견 문장 8개에서 판단을 나타내는 말을 고르는 문항이라 문장 수가 상한이다.',
  /**
   * 처음에는 판단을 나타내는 말을 직접 쓰게 했다. 그런데 정답 '착하다' 의 어간을
   * 잘라 문장에 들어 있는지 확인하려다 검산이 실패했다 — 문장은 '착합니다' 로
   * 활용되어 있어 어간 매칭이 성립하지 않는다. 한국어 활용을 문자열 포함으로
   * 되짚는 것은 부실하다. 그래서 고르는 형태로 바꿨다.
   */
  generate(rng, { difficulty }) {
    const pool = FACT_OPINION.filter((s) => s.kind === 'opinion' && /'([^']+)'/.test(s.basis));
    const spec = rng.pick(pool);
    const word = /'([^']+)'/.exec(spec.basis)[1];
    const others = [...new Set(pool
      .filter((s) => s.text !== spec.text)
      .map((s) => /'([^']+)'/.exec(s.basis)[1])
      .filter((w) => w !== word))];

    return {
      params: { text: spec.text, word },
      instruction: '이 문장을 의견으로 만드는 말을 고르시오.',
      stem: spec.text,
      choices: buildChoices(rng, word, rng.shuffle(others).slice(0, 3)),
      answer: { value: word, display: word, accepts: [word] },
      solution: [`${spec.basis}.`, `그 말이 '${word}' 이다.`],
      dedupeKey: `opinion-word:${spec.text}`,
      difficulty,
    };
  },
  verify({ text, word }, answer) {
    // 문장 표의 판정 근거에서 낱말을 다시 뽑아 대조한다. 활용형 매칭은 하지 않는다.
    const found = FACT_OPINION.find((s) => s.text === text);
    if (!found || found.kind !== 'opinion') return false;
    const fromBasis = /'([^']+)'/.exec(found.basis)?.[1];
    return answer.value === word && fromBasis === word;
  },
};

// ---------------------------------------------------------------------------
// [6국05-02] 비유적 표현
// ---------------------------------------------------------------------------

const FIGURE_NAMES = { simile: '직유', metaphor: '은유', plain: '비유가 아님' };

const figurativeKind = {
  id: 'korean.g56.st.s05-02.figurative',
  standardCode: '[6국05-02]',
  skill: '비유적 표현 가려내기',
  format: 'multiple-choice',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 비유인지 아닌지만 가른다. 2 이상은 직유와 은유까지 구별한다.',
  generate(rng, { difficulty }) {
    const spec = rng.pick(FIGURATIVE);
    if (difficulty === 1) {
      const correct = spec.kind === 'plain' ? '비유가 아님' : '비유';
      return {
        params: { text: spec.text, kind: spec.kind, mode: 'is-figurative' },
        instruction: '다음 문장에 비유가 쓰였는지 고르시오.',
        stem: spec.text,
        choices: buildChoices(rng, correct, [correct === '비유' ? '비유가 아님' : '비유', '질문', '명령']),
        answer: { value: correct, display: correct, accepts: [correct] },
        solution: [spec.basis, `그러므로 ${correct}이다.`],
        dedupeKey: `figurative-is:${spec.text}`,
        difficulty,
      };
    }
    const correct = FIGURE_NAMES[spec.kind];
    const wrong = Object.values(FIGURE_NAMES).filter((v) => v !== correct);
    return {
      params: { text: spec.text, kind: spec.kind, mode: 'which-kind' },
      instruction: '다음 문장에 쓰인 표현을 고르시오.',
      stem: spec.text,
      choices: buildChoices(rng, correct, wrong),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [spec.basis, `그러므로 ${correct}이다.`],
      dedupeKey: `figurative-kind:${spec.text}`,
      difficulty,
    };
  },
  verify({ text, kind, mode }, answer) {
    const found = FIGURATIVE.find((s) => s.text === text);
    if (!found || found.kind !== kind) return false;
    if (mode === 'is-figurative') {
      return answer.value === (kind === 'plain' ? '비유가 아님' : '비유');
    }
    return answer.value === FIGURE_NAMES[kind];
  },
};

const findVehicle = {
  id: 'korean.g56.st.s05-02.vehicle',
  standardCode: '[6국05-02]',
  skill: '무엇에 견주었는지 찾기',
  format: 'short-answer',
  difficultyAxis: 'single',
  difficulties: [1],
  capacityNote: '비유 문장 10개에서 견준 대상을 찾는 문항이라 문장 수가 상한이다.',
  generate(rng, { difficulty }) {
    const pool = FIGURATIVE.filter((s) => s.vehicle !== null && s.text.includes(s.vehicle));
    const spec = rng.pick(pool);
    return {
      params: { text: spec.text, vehicle: spec.vehicle },
      instruction: '무엇에 견주었는지 찾아 쓰시오.',
      stem: spec.text,
      answer: { value: spec.vehicle, display: spec.vehicle, accepts: [spec.vehicle] },
      solution: [spec.basis, `'${spec.vehicle}' 에 견주었다.`],
      dedupeKey: `vehicle:${spec.text}`,
      difficulty,
    };
  },
  verify({ text, vehicle }, answer) {
    // 견준 대상은 문장 안에 실제로 있어야 한다.
    return answer.value === vehicle && text.includes(answer.value);
  },
};

// ---------------------------------------------------------------------------
// [2국02-02] 알맞게 띄어 읽기
// ---------------------------------------------------------------------------

const readingBreak = {
  id: 'korean.g12.st.s02-02.reading-break',
  capacityNote: '띄어 읽기 문장 자산 8개가 상한이다. 문장을 늘리면 함께 늘어난다 — 지문 자산이 아니라 짧은 문장 목록이므로 확장이 싸다.',
  standardCode: '[2국02-02]',
  skill: '띄어 읽을 자리 찾기',
  format: 'multiple-choice',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 세 어절 문장, 2 이상은 네 어절 이상 문장을 낸다. 어절이 늘면 끊어 읽을 자리를 고르기 어렵다.',
  /**
   * 어절 번호를 고르게 했더니 세 어절 문장에서 끊을 자리가 둘뿐이라 선택지 3개를
   * 만들 수 없었다(문항 계약이 선택형에 3개 이상을 요구한다). 끊어 읽은 표기
   * 자체를 고르게 바꿨다 — 자리가 둘이어도 표기는 여러 개 만들 수 있다.
   */
  generate(rng, { difficulty }) {
    const pool = difficulty === 1
      ? READING_BREAKS.filter((s) => s.words.length === 3)
      : READING_BREAKS.filter((s) => s.words.length >= 4);
    const spec = rng.pick(pool.length > 0 ? pool : READING_BREAKS);

    /** 주어진 자리에서 한 번 끊어 읽은 표기. 끊는 곳에 ∨ 를 넣는다. */
    const withBreak = (at) => spec.words
      .map((w, i) => (i === at ? `${w} ∨` : w))
      .join(' ');

    const correct = withBreak(spec.breakAfter);
    const wrong = spec.words
      .slice(0, -1)
      .map((_, i) => i)
      .filter((i) => i !== spec.breakAfter)
      .map(withBreak);
    // 자리가 둘뿐이면 끊지 않은 표기와 끝에서 끊은 표기를 오답으로 더 쓴다.
    wrong.push(spec.words.join(' '));
    wrong.push(`${spec.words.slice(0, -1).join(' ')} ${spec.words.at(-1)} ∨`);

    return {
      params: { words: spec.words, breakAfter: spec.breakAfter },
      instruction: '한 번 끊어 읽기에 알맞은 것을 고르시오. (∨ 는 끊어 읽는 자리)',
      stem: spec.words.join(' '),
      choices: buildChoices(rng, correct, [...new Set(wrong)].slice(0, 3)),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [spec.basis, `그러므로 '${spec.words[spec.breakAfter]}' 다음에서 끊어 읽는다.`],
      dedupeKey: `reading-break:${spec.words.join('_')}`,
      difficulty,
    };
  },
  verify({ words, breakAfter }, answer) {
    /**
     * 답 표기에서 ∨ 를 걷어내면 원문 어절과 정확히 같아야 하고, ∨ 자리가 표의
     * 자리와 맞아야 한다.
     *
     * 처음에는 ∨ 바로 앞 어절만 봤는데 뮤테이션이 잡았다 — '갑니다X' 처럼 뒤쪽
     * 어절을 훼손해도 통과했다. 끊는 자리만 보고 문장 자체는 안 본 탓이다.
     */
    const parts = String(answer.value).split(' ');
    const markIndex = parts.indexOf('∨');
    if (markIndex < 1) return false;
    if (parts.filter((p) => p === '∨').length !== 1) return false;

    const restored = parts.filter((p) => p !== '∨');
    if (restored.length !== words.length) return false;
    if (restored.some((w, i) => w !== words[i])) return false;
    // ∨ 는 breakAfter 어절 바로 뒤에 있어야 한다.
    if (markIndex !== breakAfter + 1) return false;

    const found = READING_BREAKS.find((s) => s.words.join('_') === words.join('_'));
    return Boolean(found) && found.breakAfter === breakAfter;
  },
};

export const generators = [
  factOrOpinion,
  findOpinionWord,
  figurativeKind,
  findVehicle,
  readingBreak,
];
