import { createHash } from 'node:crypto';

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
    id: stableId(dedupeKey),
    standardCode: context.standard.code,
    specId: context.standard.specId,
    subject: context.standard.subject,
    subjectKorean: context.standard.subjectKorean,
    gradeBand: context.standard.gradeBand,
    domain: context.standard.domain,
    module: context.standard.module,
    generatorId: raw.generatorId,
    skill: raw.skill,
    difficulty: raw.difficulty,
    format: raw.format,
    // 작도 문항은 문자열 대조로 채점할 수 없다. 채점 주체를 문항에 명시한다.
    scoring: raw.format === 'construction' ? 'manual' : 'auto',
    stem: raw.stem,
    ...(raw.instruction ? { instruction: raw.instruction } : {}),
    ...(raw.choices ? { choices: raw.choices } : {}),
    ...(raw.figure ? { figure: raw.figure } : {}),
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

  if (!ITEM_FORMATS.has(item.format)) fail(`알 수 없는 format: ${item.format}`);
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
    if (!Array.isArray(item.answer.accepts) || item.answer.accepts.length === 0) fail('answer.accepts 가 비었다');
    if (item.answer.accepts.some((a) => typeof a !== 'string' || a.length === 0)) fail('answer.accepts 에 빈 값이 있다');
  }
  if (!Array.isArray(item.solution) || item.solution.length === 0) fail('solution 이 비었다');
  if (item.solution.some((s) => typeof s !== 'string' || s.trim().length === 0)) fail('solution 에 빈 단계가 있다');

  if (item.figure) {
    const f = item.figure;
    if (!FIGURE_KINDS.has(f.kind)) fail(`알 수 없는 figure.kind: ${f.kind}`);
    if (!f.spec || typeof f.spec !== 'object') fail('figure.spec 이 없다');
    if (typeof f.altText !== 'string' || f.altText.trim().length === 0) fail('figure.altText 는 필수다');
    if (!f.prompt || typeof f.prompt.ko !== 'string' || f.prompt.ko.trim().length === 0) fail('figure.prompt.ko 는 필수다');
  }

  if (item.format === 'multiple-choice') {
    const c = item.choices;
    if (!Array.isArray(c) || c.length < 3) fail('선택형은 선택지 3개 이상');
    if (c.filter((x) => x.correct).length !== 1) fail('정답 선택지는 정확히 1개');
    if (new Set(c.map((x) => x.text)).size !== c.length) fail('선택지 텍스트 중복');
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
  return rng.shuffle(unique).map((c, idx) => ({ label: CHOICE_LABELS[idx], ...c }));
}
