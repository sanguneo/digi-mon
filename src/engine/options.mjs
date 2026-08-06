const SUBJECTS = new Set(['math', 'korean', 'english']);
const GRADE_BANDS = new Set(['1-2', '3-4', '5-6']);
const STANDARD_CODE_RE = /^\[[246][국수영]\d{2}-\d{2}\]$/;

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
    difficulty,
    title: source.title,
    followLearningOrder,
  };
}

