import { PRACTICE_MODE_IDS } from '../curriculum/practice-modes.mjs';
import { STANDARD_CODE_RE } from '../curriculum/standard-code.mjs';

const SUBJECTS = new Set(['math', 'korean', 'english']);
const GRADE_BANDS = new Set(['1-2', '3-4', '5-6']);
const ITEM_ID_RE = /^[a-f0-9]{12}$/;
const MAX_EXCLUDED_ITEM_IDS = 10_000;
const DIFFICULTY_LEVELS = [1, 2, 3];

export class WorksheetOptionsError extends Error {
  constructor(field, message, received) {
    super(message);
    this.name = 'WorksheetOptionsError';
    this.field = field;
    this.received = received;
  }
}

function list(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const values = Array.isArray(value)
    ? value
    : String(value).split(',');
  return values.map((entry) => String(entry).trim()).filter(Boolean);
}

function boolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new WorksheetOptionsError('boolean', 'boolean 옵션은 true 또는 false여야 한다', value);
}

/**
 * difficultyMix 를 엔진이 받는 모양({난이도: 가중치})으로 정규화한다.
 *
 * 엔진은 처음부터 이 옵션을 지원했는데(`worksheet.mjs` 의 difficultyMix) 파서가
 * 통과시키지 않아, HTTP 로 보낸 클라이언트는 200 을 받고도 조용히 무시당했다.
 * 조용한 무시 대신 배선하거나 명시적으로 거부한다.
 *
 * 쿼리스트링으로도 보낼 수 있게 "1:3,2:1" 형태의 문자열을 함께 받는다.
 * 검증 규칙은 엔진(`worksheet.mjs` 의 mixEntries 검사)과 같다 — 난이도 1..3 키,
 * 유한한 양수 가중치.
 */
export function normalizeDifficultyMix(value) {
  if (value === undefined || value === null || value === '') return undefined;

  const reject = () => {
    throw new WorksheetOptionsError(
      'difficultyMix',
      'difficultyMix 는 난이도 1..3 키에 양수 가중치를 붙인 객체여야 한다',
      value,
    );
  };

  let entries;
  if (typeof value === 'string') {
    entries = value.split(',').map((pair) => pair.split(':').map((part) => part.trim()));
    if (entries.some((pair) => pair.length !== 2)) reject();
  } else if (typeof value === 'object' && !Array.isArray(value)) {
    entries = Object.entries(value);
  } else {
    reject();
  }
  if (entries.length === 0) reject();

  const mix = {};
  for (const [rawLevel, rawWeight] of entries) {
    const level = Number(rawLevel);
    const weight = Number(rawWeight);
    if (!DIFFICULTY_LEVELS.includes(level)) reject();
    if (!Number.isFinite(weight) || weight <= 0) reject();
    if (mix[level] !== undefined) reject();
    mix[level] = weight;
  }
  return mix;
}

export function normalizeExcludeItemIds(value) {
  if (value === undefined || value === null || value === '') return [];
  const entries = Array.isArray(value)
    ? value
    : String(value).split(',');
  if (entries.length > MAX_EXCLUDED_ITEM_IDS
    || entries.some((entry) => typeof entry !== 'string')) {
    throw new WorksheetOptionsError(
      'excludeItemIds',
      `excludeItemIds 는 최대 ${MAX_EXCLUDED_ITEM_IDS}개의 item id 배열이어야 한다`,
      value,
    );
  }
  const normalized = entries.map((entry) => entry.trim());
  if (normalized.some((id) => !ITEM_ID_RE.test(id))) {
    throw new WorksheetOptionsError(
      'excludeItemIds',
      'excludeItemIds 는 12자리 소문자 16진수 item id 배열이어야 한다',
      value,
    );
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new WorksheetOptionsError(
      'excludeItemIds',
      'excludeItemIds 에 중복이 없어야 한다',
      value,
    );
  }
  return normalized.sort();
}

export function parseWorksheetOptions(source, { maxCount = 100 } = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new WorksheetOptionsError('options', '학습지 옵션은 객체여야 한다', source);
  }

  const count = source.count === undefined ? 20 : Number(source.count);
  if (!Number.isInteger(count) || count < 1 || count > maxCount) {
    throw new WorksheetOptionsError('count', `count 는 1..${maxCount} 정수여야 한다`, source.count);
  }

  const difficulty = source.difficulty === undefined
    || source.difficulty === null
    || source.difficulty === ''
    ? undefined
    : Number(source.difficulty);
  if (difficulty !== undefined && ![1, 2, 3].includes(difficulty)) {
    throw new WorksheetOptionsError('difficulty', 'difficulty 는 1, 2, 3 중 하나여야 한다', source.difficulty);
  }

  const modes = list(source.mode ?? source.modes) ?? [];
  const duplicateModes = modes.filter((mode, index) => modes.indexOf(mode) !== index);
  if (duplicateModes.length > 0) {
    throw new WorksheetOptionsError('modes', `mode 중복: ${duplicateModes.join(', ')}`, modes);
  }
  const invalidModes = modes.filter((mode) => !PRACTICE_MODE_IDS.includes(mode));
  if (invalidModes.length > 0) {
    throw new WorksheetOptionsError('modes', `지원하지 않는 mode: ${invalidModes.join(', ')}`, invalidModes);
  }
  modes.sort();
  if (modes.includes('advanced') && difficulty !== undefined && difficulty !== 3) {
    throw new WorksheetOptionsError(
      'difficulty',
      'advanced mode는 difficulty 3만 지원한다',
      difficulty,
    );
  }

  const subject = source.subject ?? 'math';
  if (!SUBJECTS.has(subject)) {
    throw new WorksheetOptionsError('subject', 'subject 는 math, korean, english 중 하나여야 한다', subject);
  }

  const gradeBands = list(source.grade ?? source.gradeBands);
  const invalidGrades = gradeBands?.filter((band) => !GRADE_BANDS.has(band)) ?? [];
  if (invalidGrades.length > 0) {
    throw new WorksheetOptionsError('gradeBands', `지원하지 않는 학년군: ${invalidGrades.join(', ')}`, invalidGrades);
  }

  const codes = list(source.code ?? source.codes);
  const invalidCodes = codes?.filter((code) => !STANDARD_CODE_RE.test(code)) ?? [];
  if (invalidCodes.length > 0) {
    throw new WorksheetOptionsError('codes', `성취기준 코드 형식 오류: ${invalidCodes.join(', ')}`, invalidCodes);
  }

  const followLearningOrder = boolean(source.followLearningOrder, false);
  if (followLearningOrder && subject !== 'math') {
    throw new WorksheetOptionsError(
      'followLearningOrder',
      '학습 순서 기반 생성은 검토된 선수 그래프가 있는 수학만 지원한다',
      subject,
    );
  }

  if (source.title !== undefined && typeof source.title !== 'string') {
    throw new WorksheetOptionsError('title', 'title 은 문자열이어야 한다', source.title);
  }

  return {
    seed: source.seed === undefined ? undefined : String(source.seed),
    subject,
    gradeBands,
    domains: list(source.domain ?? source.domains),
    codes,
    count,
    difficulty: modes.includes('advanced') ? 3 : difficulty,
    difficultyMix: normalizeDifficultyMix(source.difficultyMix),
    modes,
    title: source.title,
    followLearningOrder,
    excludeItemIds: normalizeExcludeItemIds(source.excludeItemIds),
  };
}

