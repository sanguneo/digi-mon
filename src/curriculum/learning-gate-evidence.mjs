import { PRACTICE_MODE_IDS } from './practice-modes.mjs';
import {
  aggregateByStandard,
  validateResponseRecords,
} from '../engine/response-log.mjs';
import { STANDARD_CODE_RE } from './standard-code.mjs';

const SUBJECTS = new Set(['math', 'korean', 'english']);
const WEAK_ACCURACY_BELOW = 0.6;

export class LearningGateRequestError extends Error {
  constructor(field, message, received) {
    super(message);
    this.name = 'LearningGateRequestError';
    this.field = field;
    this.received = received;
  }
}

export function failLearningGateRequest(field, message, received) {
  throw new LearningGateRequestError(field, message, received);
}

export function exactObject(value, field, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    failLearningGateRequest(field, `${field} 는 객체여야 한다`, value);
  }
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length > 0) {
    failLearningGateRequest(
      field,
      `${field} 에 허용하지 않는 필드가 있다: ${unknown.join(', ')}`,
      unknown,
    );
  }
  return value;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(4));
}

function standardCodes(value, field, { required = true } = {}) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length === 0
    || value.some((code) => typeof code !== 'string' || !STANDARD_CODE_RE.test(code))
    || new Set(value).size !== value.length) {
    failLearningGateRequest(
      field,
      `${field} 는 고유한 성취기준 코드 배열이어야 한다`,
      value,
    );
  }
  return [...value];
}

export function validateLearningTarget(value) {
  const target = exactObject(value, 'target', [
    'subject',
    'codes',
    'modes',
    'count',
    'advanceToCodes',
  ]);
  if (!SUBJECTS.has(target.subject)) {
    failLearningGateRequest(
      'target.subject',
      'target.subject 는 math, korean, english 중 하나여야 한다',
      target.subject,
    );
  }
  const codes = standardCodes(target.codes, 'target.codes');
  const modes = target.modes;
  if (!Array.isArray(modes)
    || modes.some((mode) => !PRACTICE_MODE_IDS.includes(mode))
    || new Set(modes).size !== modes.length) {
    failLearningGateRequest(
      'target.modes',
      'target.modes 는 지원하는 고유 mode 배열이어야 한다',
      modes,
    );
  }
  const count = target.count;
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    failLearningGateRequest('target.count', 'target.count 는 1..100 정수여야 한다', count);
  }
  return {
    subject: target.subject,
    codes,
    modes: [...modes].sort(),
    count,
    advanceToCodes: standardCodes(
      target.advanceToCodes,
      'target.advanceToCodes',
      { required: false },
    ),
  };
}

function validateRate(value, field, expected) {
  if (value !== expected) {
    failLearningGateRequest(field, `${field} 값이 집계와 일치하지 않는다`, value);
  }
}

function summarizeGradingEvidence(evidence) {
  exactObject(evidence, 'evidence', [
    'source',
    'graded',
    'answered',
    'total',
    'manualScoringCount',
    'accuracy',
    'completionRate',
    'byStandard',
  ]);
  const integerFields = ['graded', 'answered', 'total', 'manualScoringCount'];
  if (integerFields.some((field) =>
    !Number.isInteger(evidence[field]) || evidence[field] < 0)) {
    failLearningGateRequest(
      'evidence',
      '채점 evidence 개수는 0 이상의 정수여야 한다',
      evidence,
    );
  }
  if (evidence.answered > evidence.graded
    || evidence.total !== evidence.graded + evidence.manualScoringCount) {
    failLearningGateRequest('evidence', '채점 evidence 개수 관계가 올바르지 않다', evidence);
  }
  const byStandard = exactObject(
    evidence.byStandard,
    'evidence.byStandard',
    Object.keys(evidence.byStandard ?? {}),
  );
  let attempted = 0;
  let correct = 0;
  const evaluatedStandards = [];
  for (const [code, aggregate] of Object.entries(byStandard)) {
    if (!STANDARD_CODE_RE.test(code)) {
      failLearningGateRequest(
        'evidence.byStandard',
        `성취기준 코드 형식이 올바르지 않다: ${code}`,
        code,
      );
    }
    exactObject(aggregate, `evidence.byStandard.${code}`, [
      'attempted',
      'correct',
      'accuracy',
    ]);
    if (!Number.isInteger(aggregate.attempted) || aggregate.attempted < 1
      || !Number.isInteger(aggregate.correct) || aggregate.correct < 0
      || aggregate.correct > aggregate.attempted) {
      failLearningGateRequest(
        'evidence.byStandard',
        '성취기준 집계 개수가 올바르지 않다',
        aggregate,
      );
    }
    validateRate(
      aggregate.accuracy,
      `evidence.byStandard.${code}.accuracy`,
      ratio(aggregate.correct, aggregate.attempted),
    );
    attempted += aggregate.attempted;
    correct += aggregate.correct;
    evaluatedStandards.push(code);
  }
  if (attempted !== evidence.graded) {
    failLearningGateRequest(
      'evidence.byStandard',
      '성취기준 attempted 합계가 graded 와 다르다',
      attempted,
    );
  }
  validateRate(evidence.accuracy, 'evidence.accuracy', ratio(correct, evidence.graded));
  validateRate(
    evidence.completionRate,
    'evidence.completionRate',
    ratio(evidence.answered, evidence.graded),
  );
  const weakStandards = Object.entries(byStandard)
    .filter(([, aggregate]) => aggregate.accuracy < WEAK_ACCURACY_BELOW)
    .sort((a, b) => a[1].accuracy - b[1].accuracy || a[0].localeCompare(b[0]))
    .map(([code]) => code);
  return {
    source: evidence.source,
    graded: evidence.graded,
    answered: evidence.answered,
    total: evidence.total,
    manualScoringCount: evidence.manualScoringCount,
    accuracy: evidence.accuracy,
    completionRate: evidence.completionRate,
    sufficientStandardCount: evaluatedStandards.length,
    evaluatedStandards: evaluatedStandards.sort(),
    weakStandards,
  };
}

function summarizeResponseRecords(evidence) {
  exactObject(evidence, 'evidence', ['source', 'records']);
  try {
    validateResponseRecords(evidence.records);
  } catch (error) {
    failLearningGateRequest('evidence.records', error.message, evidence.records);
  }
  const automatic = evidence.records.filter((record) =>
    record.scoring === 'auto' && record.correct !== null);
  const aggregates = aggregateByStandard(evidence.records);
  const sufficient = aggregates.filter((aggregate) => aggregate.sufficientSamples);
  const weakStandards = sufficient
    .filter((aggregate) => aggregate.accuracy < WEAK_ACCURACY_BELOW)
    .sort((a, b) => a.accuracy - b.accuracy
      || a.standardCode.localeCompare(b.standardCode))
    .map((aggregate) => aggregate.standardCode);
  const correct = automatic.filter((record) => record.correct).length;
  const answered = automatic.filter((record) => record.answered).length;
  return {
    source: evidence.source,
    graded: automatic.length,
    answered,
    total: evidence.records.length,
    manualScoringCount: evidence.records
      .filter((record) => record.scoring === 'manual').length,
    accuracy: ratio(correct, automatic.length),
    completionRate: ratio(answered, automatic.length),
    sufficientStandardCount: sufficient.length,
    evaluatedStandards: aggregates.map((aggregate) => aggregate.standardCode),
    weakStandards,
  };
}

export function summarizeLearningEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    failLearningGateRequest('evidence', 'evidence 는 객체여야 한다', evidence);
  }
  if (evidence.source === 'grading-result') return summarizeGradingEvidence(evidence);
  if (evidence.source === 'response-records') return summarizeResponseRecords(evidence);
  failLearningGateRequest(
    'evidence.source',
    '지원하지 않는 evidence source다',
    evidence.source,
  );
}
