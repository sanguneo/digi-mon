import { createHash } from 'node:crypto';
import {
  assertLearningSupport,
  buildLearningSupport,
} from '../curriculum/learning-support.mjs';

export const ITEM_FORMATS = new Set([
  'short-answer', // 답을 직접 쓴다
  'fill-blank', // 식의 빈칸을 채운다
  'multiple-choice', // 선택지에서 고른다
  'compare', // >, <, = 를 넣는다
  'ordering', // 순서대로 늘어놓는다
  'write-expression', // 식을 세운다
  // 도형을 직접 그린다. 정답 문자열 대조로 채점할 수 없어 사람이 본다.
  // 문항을 못 내는 것과 자동 채점을 못 하는 것은 다르므로 형식으로 남긴다.
  'construction',
]);

/**
 * 도형·각도·측정처럼 그림이 없으면 성립하지 않는 문항을 위한 자리.
 * 그림 픽셀은 이 저장소가 만들지 않는다. 대신 다시 그릴 수 있는 결정적 spec 과
 * 이미지 생성기에 넘길 프롬프트를 문항에 실어 보낸다.
 *
 *  kind    : 그림 종류
 *  spec    : 좌표·변·각도 등 동일한 그림을 재현할 수 있는 구조화 파라미터
 *  prompt  : 이미지 생성 프롬프트 (ko 필수)
 *  altText : 그림을 못 봐도 문항 맥락이 전달되는 대체 텍스트 (필수)
 */
export const FIGURE_KINDS = new Set([
  'geometry.plane-shape',
  'geometry.solid-shape',
  'geometry.angle',
  'geometry.line',
  'geometry.circle',
  'geometry.triangle',
  'geometry.symmetry',
  'geometry.quadrilateral',
  'geometry.grid-area',
  'measure.length',
  'measure.clock',
  'measure.container',
  'array.dots',
  'array.bundles',
  'data.table',
  'data.picture-graph',
  'data.bar-graph',
]);

const CHOICE_LABELS = ['①', '②', '③', '④', '⑤'];
const POSITION_MARKS = new Set(['㉠', '㉡', '㉢', '㉣', '㉤', ...CHOICE_LABELS]);
const DATA_VISIBLE_IN_FIGURE = new Set([
  'math.g12.gm.s12.read-ruler',
  'math.g12.pd.s04-02.read-table',
  'math.g12.pd.s04-03.read-graph',
  'math.g34.gd.s04-02.read-bar',
  'math.g34.gd.s04-03.interpret-bar',
  'math.g56.rm.s04-03.band-graph',
]);
const REQUIRES_VISUAL_GENERATORS = new Set([
  'math.g34.gd.s02.right-angle',
  'math.g34.gd.s04.transform',
  'math.g34.gd.s05.pattern',
  'math.g34.gd.s24.measure',
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function answerLeaksInAltText(altText, acceptedAnswers) {
  const text = String(altText ?? '');
  const hits = [];
  for (const raw of acceptedAnswers ?? []) {
    const answer = String(raw).trim();
    if (!answer || POSITION_MARKS.has(answer)) continue;
    const numeric = /^-?\d+(?:\.\d+)?(?:[^\d\s]+)?$/.test(answer);
    const leaked = numeric
      ? new RegExp(`(^|[^\\d])${escapeRegExp(answer)}(?![\\dA-Za-z가-힣])`).test(text)
      : text.includes(answer);
    if (leaked && !hits.includes(answer)) hits.push(answer);
  }
  return hits;
}

function prepareFigure(raw) {
  if (!raw.figure) return undefined;
  const figure = {
    ...raw.figure,
    spec: { ...raw.figure.spec },
  };
  const generated = /^(math|korean|english)\./.test(raw.generatorId ?? '');
  const value = raw.answer?.value;
  if (generated && typeof value === 'string' && POSITION_MARKS.has(value.trim())
    && !Array.isArray(figure.answerBearingSpecKeys)) {
    figure.answerBearingSpecKeys = Object.keys(figure.spec);
  }
  if (generated && !figure.access) figure.access = 'described';
  if (REQUIRES_VISUAL_GENERATORS.has(raw.generatorId)) {
    figure.access = 'requires-visual';
    figure.accommodation ??= '핵심 관계가 그림에만 있다. 촉각 도해나 교사의 동등한 시각 대체 자료가 필요하다.';
  }
  if (generated
    && !DATA_VISIBLE_IN_FIGURE.has(raw.generatorId)
    && answerLeaksInAltText(figure.altText, raw.answer?.accepts).length > 0) {
    figure.altText = '문항에 필요한 도형 또는 시각 자료. 정답이 되는 이름이나 값은 대체 텍스트에 제시하지 않는다.';
    figure.access = 'requires-visual';
    figure.accommodation ??= '정답을 말하지 않는 촉각 도해나 교사의 동등한 시각 대체 자료가 필요하다.';
  }
  return figure;
}

export function learnerFigure(figure) {
  if (!figure) return undefined;
  const redactedSpecKeys = [...(figure.answerBearingSpecKeys ?? [])];
  const spec = { ...(figure.spec ?? {}) };
  for (const key of redactedSpecKeys) delete spec[key];
  return {
    kind: figure.kind,
    spec,
    ...(redactedSpecKeys.length > 0 ? { redactedSpecKeys } : {}),
    ...(figure.access ? { access: figure.access } : {}),
    ...(figure.accommodation ? { accommodation: figure.accommodation } : {}),
    altText: figure.altText,
    ...(figure.svg ? { svg: figure.svg } : {}),
  };
}

function stableId(dedupeKey) {
  return createHash('sha256').update(dedupeKey).digest('hex').slice(0, 12);
}

/**
 * 생성기가 돌려준 원자료를 최종 문항으로 굳힌다.
 * dedupeKey 는 '같은 문제인가'의 정의다. 숫자만 다르면 다른 문항이고,
 * 숫자까지 같으면 표현이 달라도 같은 문항으로 본다.
 */
export function finalizeItem(raw, context) {
  const dedupeKey = `${raw.generatorId}|${raw.dedupeKey}`;
  const item = {
    schema: 'digi-mon/item@2',
    id: stableId(dedupeKey),
    standardCode: context.standard.code,
    specId: context.standard.specId,
    subject: context.standard.subject,
    subjectKorean: context.standard.subjectKorean,
    gradeBand: context.standard.gradeBand,
    domain: context.standard.domain,
    module: context.standard.module,
    generatorId: raw.generatorId,
    assessmentMappings: raw.assessmentMappings ?? [],
    curriculum: raw.curriculum ?? null,
    skill: raw.skill,
    learningSupport: raw.learningSupport ?? buildLearningSupport({
      id: raw.generatorId,
      skill: raw.skill,
    }),
    difficulty: raw.difficulty,
    format: raw.format,
    // 작도 문항은 문자열 대조로 채점할 수 없다. 채점 주체를 문항에 명시한다.
    scoring: raw.format === 'construction' ? 'manual' : 'auto',
    stem: raw.stem,
    ...(raw.instruction ? { instruction: raw.instruction } : {}),
    ...(raw.choices ? { choices: raw.choices } : {}),
    ...(raw.figure ? { figure: prepareFigure(raw) } : {}),
    /**
     * 일부러 틀리게 적은 문자열.
     *
     * 맞춤법·오류찾기 문항의 오답 선택지는 낱말이 아니라 비표기다('꼬치', '조타').
     * 어휘 게이트가 이것을 학습 어휘로 취급하면 목록에 없다고 실패하는데, 목록에
     * 넣으면 틀린 표기를 학년 어휘로 승인하는 셈이 된다. 그래서 문항이 스스로
     * '이건 일부러 틀린 것' 이라고 선언한다.
     */
    ...(raw.nonWords ? { nonWords: raw.nonWords } : {}),
    answer: raw.answer,
    solution: raw.solution,
    params: raw.params,
    dedupeKey,
  };
  validateItem(item);
  return item;
}

/** 형식 계약 위반은 즉시 던진다. 깨진 문항이 학습지에 나가는 것보다 낫다. */
export function validateItem(item) {
  const fail = (msg) => {
    throw new Error(`문항 계약 위반 [${item.generatorId ?? '?'}]: ${msg}`);
  };

  if (item.schema !== undefined && item.schema !== 'digi-mon/item@2') fail(`알 수 없는 item schema: ${item.schema}`);
  if (!ITEM_FORMATS.has(item.format)) fail(`알 수 없는 format: ${item.format}`);
  if (item.assessmentMappings !== undefined && !Array.isArray(item.assessmentMappings)) fail('assessmentMappings 가 배열이 아니다');
  if (item.curriculum !== undefined
    && item.curriculum !== null
    && typeof item.curriculum !== 'object') {
    fail('curriculum provenance 가 객체가 아니다');
  }
  if (typeof item.stem !== 'string') fail('stem 이 문자열이 아니다');
  // 시계 읽기·자로 재기처럼 그림이 곧 문제인 문항은 본문이 없다.
  // 그림도 없고 본문도 없으면 물음이 존재하지 않는다.
  if (item.stem.trim().length === 0 && !item.figure) {
    fail('stem 이 비었다 (그림이 없는 문항은 본문이 필수다)');
  }
  if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 3) fail(`difficulty 는 1..3: ${item.difficulty}`);
  if (!item.answer || typeof item.answer.display !== 'string' || item.answer.display.length === 0) fail('answer.display 가 비었다');
  if (item.scoring === 'manual') {
    // 사람이 채점하는 문항은 정답 문자열 대신 채점 기준을 싣는다.
    if (!Array.isArray(item.answer.rubric) || item.answer.rubric.length === 0) fail('사람 채점 문항은 answer.rubric 이 필요하다');
    if (item.answer.rubric.some((r) => typeof r !== 'string' || r.trim().length === 0)) fail('answer.rubric 에 빈 기준이 있다');
  } else {
    if (!Object.hasOwn(item.answer, 'value') || item.answer.value === null) fail('자동 채점 문항은 answer.value 가 필요하다');
    if (!Array.isArray(item.answer.accepts) || item.answer.accepts.length === 0) fail('answer.accepts 가 비었다');
    if (item.answer.accepts.some((a) => typeof a !== 'string' || a.length === 0)) fail('answer.accepts 에 빈 값이 있다');
  }
  if (!Array.isArray(item.solution) || item.solution.length === 0) fail('solution 이 비었다');
  if (item.solution.some((s) => typeof s !== 'string' || s.trim().length === 0)) fail('solution 에 빈 단계가 있다');
  try {
    assertLearningSupport(item.generatorId, item.learningSupport);
  } catch (error) {
    fail(error.message);
  }

  if (item.nonWords !== undefined) {
    if (!Array.isArray(item.nonWords) || item.nonWords.length === 0) fail('nonWords 가 비었다');
    if (item.nonWords.some((w) => typeof w !== 'string' || w.trim().length === 0)) fail('nonWords 에 빈 값이 있다');
    // 정답이 비표기로 선언되면 문항이 스스로 모순이다.
    if (item.nonWords.includes(item.answer.value)) fail('정답이 nonWords 에 들어 있다');
  }

  if (item.figure) {
    const f = item.figure;
    if (!FIGURE_KINDS.has(f.kind)) fail(`알 수 없는 figure.kind: ${f.kind}`);
    if (!f.spec || typeof f.spec !== 'object') fail('figure.spec 이 없다');
    if (typeof f.altText !== 'string' || f.altText.trim().length === 0) fail('figure.altText 는 필수다');
    if (!f.prompt || typeof f.prompt.ko !== 'string' || f.prompt.ko.trim().length === 0) fail('figure.prompt.ko 는 필수다');
    if (f.access !== undefined && !['described', 'requires-visual'].includes(f.access)) fail('figure.access 는 described 또는 requires-visual');
    if (f.access === 'requires-visual'
      && (typeof f.accommodation !== 'string' || f.accommodation.trim().length === 0)) {
      fail('requires-visual 그림은 accommodation 이 필요하다');
    }
    if (f.answerBearingSpecKeys !== undefined) {
      if (!Array.isArray(f.answerBearingSpecKeys) || f.answerBearingSpecKeys.length === 0) {
        fail('figure.answerBearingSpecKeys 는 비어 있지 않은 배열이어야 한다');
      }
      const missing = f.answerBearingSpecKeys.filter((key) => !Object.hasOwn(f.spec, key));
      if (missing.length > 0) fail(`answerBearingSpecKeys 가 spec 에 없다: ${missing.join(', ')}`);
      const leaks = answerLeaksInAltText(f.altText, item.answer.accepts ?? []);
      if (leaks.length > 0) fail(`figure.altText 가 정답을 말한다: ${leaks.join(', ')}`);
    }
    const value = item.answer?.value;
    if (typeof value === 'string' && POSITION_MARKS.has(value.trim())
      && (!Array.isArray(f.answerBearingSpecKeys) || f.answerBearingSpecKeys.length === 0)) {
      fail('기호 정답 그림은 answerBearingSpecKeys 가 필요하다');
    }
  }

  if (item.format === 'multiple-choice') {
    const c = item.choices;
    if (!Array.isArray(c) || c.length < 3) fail('선택형은 선택지 3개 이상');
    if (c.length > CHOICE_LABELS.length) fail(`선택지는 ${CHOICE_LABELS.length}개 이하여야 한다`);
    if (c.filter((x) => x.correct).length !== 1) fail('정답 선택지는 정확히 1개');
    if (new Set(c.map((x) => x.text)).size !== c.length) fail('선택지 텍스트 중복');
    if (c.some((x) => typeof x.label !== 'string' || x.label.length === 0)) fail('선택지 라벨이 비었다');
    if (new Set(c.map((x) => x.label)).size !== c.length) fail('선택지 라벨 중복');
    const accepted = new Set(item.answer.accepts);
    const correctChoice = c.find((choice) => choice.correct);
    if (!accepted.has(correctChoice.text)) fail('정답 선택지 본문이 answer.accepts 에 없다');
    const acceptedWrong = c.filter((choice) => !choice.correct && accepted.has(choice.text));
    if (acceptedWrong.length > 0) fail('오답 선택지 본문이 answer.accepts 에 있다');
  } else if (item.choices) {
    fail('선택형이 아닌데 choices 가 있다');
  }
  return item;
}

/** 선택지 라벨 부여 + 섞기. 정답 위치가 한쪽에 몰리지 않게 rng 로 섞는다. */
export function buildChoices(rng, correct, distractors) {
  const pool = [{ text: String(correct), correct: true }, ...distractors.map((d) => ({ text: String(d), correct: false }))];
  const unique = [];
  const seen = new Set();
  for (const c of pool) {
    if (seen.has(c.text)) continue;
    seen.add(c.text);
    unique.push(c);
  }
  if (unique.length < 3) throw new Error(`오답이 부족하다: 정답 ${correct}, 오답 ${distractors.join(',')}`);
  if (unique.length > CHOICE_LABELS.length) throw new Error(`선택지는 ${CHOICE_LABELS.length}개 이하여야 한다`);
  return rng.shuffle(unique).map((c, idx) => ({ label: CHOICE_LABELS[idx], ...c }));
}
