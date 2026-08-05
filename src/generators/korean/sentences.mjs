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
import {
  CLAIM_REASONS,
  FACT_OPINION,
  FIGURATIVE,
  FIX_SENTENCES,
  INFERENCE_DIALOGUES,
  MIND_FEELINGS,
  MIND_SENTENCES,
  OPINION_REASON,
  PROCEDURES,
  READING_BREAKS,
  SENSORY,
} from '../../curriculum/korean-sentences.mjs';

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
    /**
     * 오답은 **명백히 틀린 자리**만 쓴다.
     *
     * `alsoAcceptable` 에 적힌 자리는 선언한 세 기준 밖이지만 교육 관행상 허용된다
     * (문두 부사어 뒤 '아침에 ∨', 주어부 뒤 '비가 ∨'). 그것을 오답으로 내면 판정이
     * 갈리는 자리를 틀렸다고 가르치게 된다. 4차 검토가 잡았다.
     */
    const acceptable = new Set([spec.breakAfter, ...(spec.alsoAcceptable ?? [])]);
    const wrong = spec.words
      .slice(0, -1)
      .map((_, i) => i)
      .filter((i) => !acceptable.has(i))
      .map(withBreak);
    // 끊지 않은 표기와 문장 끝에서 끊은 표기는 어느 문장에서도 틀린 자리다.
    wrong.push(spec.words.join(' '));
    wrong.push(`${spec.words.slice(0, -1).join(' ')} ${spec.words.at(-1)} ∨`);
    // 그래도 셋을 못 채우면 두 곳에서 끊은 표기를 쓴다. 한 번 끊으라고 했으므로 틀렸다.
    if ([...new Set(wrong)].length < 3 && spec.words.length >= 3) {
      wrong.push(spec.words.map((w, i) => (i === 0 || i === 1 ? `${w} ∨` : w)).join(' '));
    }

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

// ---------------------------------------------------------------------------
// [4국05-04] 감각적 표현
// ---------------------------------------------------------------------------

const sensoryWord = {
  id: 'korean.g34.st.s05-04.sensory',
  standardCode: '[4국05-04]',
  skill: '감각적 표현 찾기',
  format: 'multiple-choice',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 소리를 흉내 낸 말(의성어), 2 이상은 모양·촉감을 나타낸 말(의태어)까지 낸다.',
  capacityNote: '감각 표현 문장 자산 10개가 상한이다. 문장을 늘리면 함께 늘어난다.',
  generate(rng, { difficulty }) {
    const pool = difficulty === 1 ? SENSORY.filter((s) => s.sense === '소리') : SENSORY;
    const spec = rng.pick(pool);
    return {
      params: { text: spec.text, word: spec.word },
      instruction: '이 문장에서 감각적 표현을 고르시오.',
      stem: spec.text,
      choices: buildChoices(rng, spec.word, spec.others),
      answer: { value: spec.word, display: spec.word, accepts: [spec.word] },
      solution: [spec.basis, `그러므로 감각적 표현은 '${spec.word}'이다.`],
      dedupeKey: `sensory:${spec.text}`,
      difficulty,
    };
  },
  verify({ text, word }, answer) {
    // 감각 표현은 문장 안에 실제로 있어야 하고 표와 맞아야 한다.
    const found = SENSORY.find((s) => s.text === text);
    if (!found || found.word !== word) return false;
    return answer.value === word && text.includes(answer.value);
  },
};

// ---------------------------------------------------------------------------
// [2국02-03] 인물의 마음 짐작하기
// ---------------------------------------------------------------------------

const mindGuess = {
  id: 'korean.g12.st.s02-03.mind',
  standardCode: '[2국02-03]',
  skill: '인물의 마음 짐작하기',
  format: 'multiple-choice',
  difficultyAxis: 'single',
  difficulties: [1],
  capacityNote: '마음 문장 자산 8개 × 고정 마음 낱말 4개가 상한이다. 가까운 마음 낱말을 섞으면 판정이 갈려 낱말을 늘리기 어렵다.',
  generate(rng, { difficulty }) {
    const spec = rng.pick(MIND_SENTENCES);
    const wrong = MIND_FEELINGS.filter((f) => f !== spec.feeling);
    return {
      params: { text: spec.text, feeling: spec.feeling },
      instruction: '인물의 마음으로 알맞은 것을 고르시오.',
      stem: spec.text,
      choices: buildChoices(rng, spec.feeling, wrong),
      answer: { value: spec.feeling, display: spec.feeling, accepts: [spec.feeling] },
      solution: [spec.basis, `그러므로 '${spec.feeling}'가 알맞다.`],
      dedupeKey: `mind:${spec.text}`,
      difficulty,
    };
  },
  verify({ text, feeling }, answer) {
    const found = MIND_SENTENCES.find((s) => s.text === text);
    if (!found || found.feeling !== feeling) return false;
    return answer.value === feeling && MIND_FEELINGS.includes(answer.value);
  },
};

// ---------------------------------------------------------------------------
// [4국03-03] 의견에 알맞은 이유 고르기 (PARTIAL — 글쓰기는 사람이 본다)
// ---------------------------------------------------------------------------

const opinionReason = {
  id: 'korean.g34.st.s03-03.reason',
  standardCode: '[4국03-03]',
  skill: '의견에 알맞은 이유 고르기',
  format: 'multiple-choice',
  difficultyAxis: 'single',
  difficulties: [1],
  capacityNote: '의견-이유 짝 6개가 상한이다. 이유끼리 주제가 겹치면 판정이 갈려 짝을 함부로 늘릴 수 없다.',
  generate(rng, { difficulty }) {
    const spec = rng.pick(OPINION_REASON);
    const wrong = rng.shuffle(OPINION_REASON.filter((p) => p.opinion !== spec.opinion))
      .slice(0, 3)
      .map((p) => p.reason);
    return {
      params: { opinion: spec.opinion, reason: spec.reason },
      instruction: '의견에 알맞은 이유를 고르시오.',
      stem: `의견: ${spec.opinion}`,
      choices: buildChoices(rng, spec.reason, wrong),
      answer: { value: spec.reason, display: spec.reason, accepts: [spec.reason] },
      solution: [`'${spec.opinion}'를 뒷받침하는 이유는 '${spec.reason}'이다.`, '나머지는 다른 의견의 이유다.'],
      dedupeKey: `opinion-reason:${spec.opinion}`,
      difficulty,
    };
  },
  verify({ opinion, reason }, answer) {
    // 의견-이유 짝을 표에서 되짚는다. 답이 다른 짝의 이유면 실패다.
    const found = OPINION_REASON.find((p) => p.opinion === opinion);
    if (!found || found.reason !== reason) return false;
    return answer.value === reason;
  },
};

// ---------------------------------------------------------------------------
// [6국03-05] 바르게 쓴 문장 고르기 (PARTIAL — 글 전체 고쳐쓰기는 사람이 본다)
// ---------------------------------------------------------------------------

const fixSentence = {
  id: 'korean.g56.st.s03-05.fix',
  standardCode: '[6국03-05]',
  skill: '바르게 쓴 문장 고르기',
  format: 'multiple-choice',
  difficultyAxis: 'single',
  difficulties: [1],
  capacityNote: '고쳐쓰기 문장 짝 6개가 상한이다. 오표기가 실제 낱말이 되지 않게 지어야 해서 확장에 검토가 필요하다.',
  generate(rng, { difficulty }) {
    const spec = rng.pick(FIX_SENTENCES);
    // 틀린 문장 하나를 보여 주고 바르게 고친 것을 고르게 한다. 그대로 둔 것과
    // 다른 방식으로 틀린 것이 오답이다.
    const shown = rng.pick(spec.wrongs);
    return {
      params: { right: spec.right, wrongs: spec.wrongs },
      instruction: '이 문장을 맞춤법과 띄어쓰기가 모두 바르게 고친 것을 고르시오.',
      stem: shown,
      choices: buildChoices(rng, spec.right, spec.wrongs),
      answer: { value: spec.right, display: spec.right, accepts: [spec.right] },
      solution: [spec.rule, `그러므로 '${spec.right}'가 바르다.`],
      // 오표기는 학습 어휘가 아니다 — 어휘 게이트가 틀린 표기를 승인하지 않게 뺀다.
      nonWords: spec.wrongs,
      dedupeKey: `fix:${spec.right}`,
      difficulty,
    };
  },
  verify({ right, wrongs }, answer) {
    const found = FIX_SENTENCES.find((f) => f.right === right);
    if (!found) return false;
    return answer.value === right && !wrongs.includes(answer.value);
  },
};

// ---------------------------------------------------------------------------
// [4국03-02] 절차 배열 (PARTIAL — 보고 글쓰기는 사람이 본다)
// ---------------------------------------------------------------------------

const STEP_LABELS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ'];

const procedureOrder = {
  id: 'korean.g34.st.s03-02.procedure',
  standardCode: '[4국03-02]',
  skill: '절차를 순서대로 배열하기',
  format: 'ordering',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 세 단계 절차, 2 이상은 네 단계 절차를 낸다.',
  capacityNote: '순서가 상식으로 확정되는 절차 4개 × 뒤섞기가 상한이다. 순서가 갈리는 절차는 넣을 수 없다.',
  generate(rng, { difficulty }) {
    const pool = difficulty === 1
      ? PROCEDURES.filter((p) => p.steps.length === 3)
      : PROCEDURES.filter((p) => p.steps.length >= 4);
    const spec = rng.pick(pool.length > 0 ? pool : PROCEDURES);
    // 뒤섞되 원래 순서 그대로면 문항이 성립하지 않으므로 다시 섞는다.
    let shuffled = rng.shuffle(spec.steps.map((_, i) => i));
    if (shuffled.every((v, i) => v === i)) shuffled = [...shuffled.slice(1), shuffled[0]];

    const labeled = shuffled.map((stepIndex, pos) => `${STEP_LABELS[pos]}. ${spec.steps[stepIndex]}`);
    // 정답은 표의 순서대로 기호를 늘어놓은 것이다.
    const orderLabels = spec.steps.map((_, stepIndex) => STEP_LABELS[shuffled.indexOf(stepIndex)]);
    const display = orderLabels.join(', ');

    return {
      params: { title: spec.title, shuffled },
      instruction: '차례에 맞게 기호를 쓰시오.',
      stem: `'${spec.title}'의 차례입니다.\n  ${labeled.join('\n  ')}`,
      answer: {
        value: display,
        display,
        accepts: [display, orderLabels.join(','), orderLabels.join(' '), orderLabels.join('')],
      },
      solution: [
        `순서대로 하면 '${spec.steps.join(' → ')}'이다.`,
        `기호로는 ${display} 차례다.`,
      ],
      dedupeKey: `procedure:${spec.title}:${shuffled.join('')}`,
      difficulty,
    };
  },
  verify({ title, shuffled }, answer) {
    /**
     * 답 기호를 낱낱이 풀어 실제 단계 문장으로 되돌린 뒤, 표의 순서와 대조한다.
     * 기호 개수·중복·범위를 모두 본다 — 자리만 세면 훼손된 답이 통과한다.
     */
    const spec = PROCEDURES.find((p) => p.title === title);
    if (!spec) return false;
    const labels = String(answer.value).split(/[,\s]+/).filter((s) => s.length > 0);
    if (labels.length !== spec.steps.length) return false;
    if (new Set(labels).size !== labels.length) return false;

    const stepAtLabel = (label) => {
      const pos = STEP_LABELS.indexOf(label);
      if (pos < 0 || pos >= shuffled.length) return null;
      return spec.steps[shuffled[pos]];
    };
    return labels.every((label, i) => stepAtLabel(label) === spec.steps[i]);
  },
};

// ---------------------------------------------------------------------------
// [6국01-01] 대화에서 생략된 내용 추론 (PARTIAL — 실제 듣기·발화는 사람이 본다)
// ---------------------------------------------------------------------------

const dialogueInference = {
  id: 'korean.g56.st.s01-01.inference',
  standardCode: '[6국01-01]',
  skill: '대화에서 생략된 내용 추론하기',
  format: 'multiple-choice',
  difficultyAxis: 'single',
  difficulties: [1],
  capacityNote: '추론 대화 4개가 상한이다. 복수 해석이 없는 대화만 담을 수 있어 확장에 검토가 필요하다.',
  generate(rng, { difficulty }) {
    const spec = rng.pick(INFERENCE_DIALOGUES);
    return {
      params: { firstLine: spec.lines[0], answer: spec.answer },
      instruction: spec.question,
      stem: spec.lines.map((l) => `"${l}"`).join('\n'),
      choices: buildChoices(rng, spec.answer, spec.wrong),
      answer: { value: spec.answer, display: spec.answer, accepts: [spec.answer] },
      solution: [spec.basis, `그러므로 '${spec.answer}'가 알맞다.`],
      dedupeKey: `inference:${spec.lines[0]}`,
      difficulty,
    };
  },
  verify({ firstLine, answer: expected }, answer) {
    const found = INFERENCE_DIALOGUES.find((d) => d.lines[0] === firstLine);
    if (!found || found.answer !== expected) return false;
    return answer.value === expected && !found.wrong.includes(answer.value);
  },
};

// ---------------------------------------------------------------------------
// [6국01-02] 주장을 뒷받침하는 타당한 근거 (PARTIAL — 실제 담화 참여는 사람이 본다)
// ---------------------------------------------------------------------------

const claimReason = {
  id: 'korean.g56.st.s01-02.claim-reason',
  standardCode: '[6국01-02]',
  skill: '주장을 뒷받침하는 타당한 근거 고르기',
  format: 'multiple-choice',
  difficultyAxis: 'single',
  difficulties: [1],
  capacityNote: '주장-근거 짝 4개가 상한이다. 무관 진술이 다른 주장을 뒷받침하지 않아야 해서 확장에 검토가 필요하다.',
  generate(rng, { difficulty }) {
    const spec = rng.pick(CLAIM_REASONS);
    // 오답은 자기 짝의 무관 진술 둘에 다른 짝의 무관 진술 하나를 더한다.
    const other = rng.pick(CLAIM_REASONS.filter((c) => c.claim !== spec.claim));
    const wrong = [...spec.invalid, rng.pick(other.invalid)];
    return {
      params: { claim: spec.claim, valid: spec.valid },
      instruction: '주장을 뒷받침하는 타당한 근거를 고르시오.',
      stem: `주장: ${spec.claim}`,
      choices: buildChoices(rng, spec.valid, wrong),
      answer: { value: spec.valid, display: spec.valid, accepts: [spec.valid] },
      solution: [`주장과 이어지는 까닭은 '${spec.valid}'뿐이다.`, '나머지는 주장과 무관한 진술이다.'],
      dedupeKey: `claim-reason:${spec.claim}`,
      difficulty,
    };
  },
  verify({ claim, valid }, answer) {
    const found = CLAIM_REASONS.find((c) => c.claim === claim);
    if (!found || found.valid !== valid) return false;
    return answer.value === valid && !found.invalid.includes(answer.value);
  },
};

export const generators = [
  factOrOpinion,
  findOpinionWord,
  figurativeKind,
  findVehicle,
  readingBreak,
  sensoryWord,
  mindGuess,
  opinionReason,
  fixSentence,
  procedureOrder,
  dialogueInference,
  claimReason,
];
