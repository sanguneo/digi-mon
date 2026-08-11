/**
 * 응답 로그와 난이도 실측.
 *
 * 지금 difficulty 1/2/3 은 내가 손으로 정한 값이다. 파라미터 공간이 넓어지는
 * 방향은 맞지만 실제로 아이들이 더 어려워하는지는 재지 않았다. '난이도 3'이
 * '난이도 1'보다 정답률이 낮다는 증거가 없으면 그 숫자는 장식이다.
 *
 * 이 모듈은 채점 결과를 누적해 생성기·난이도별 정답률을 계산하고, 손으로 정한
 * 난이도와 실측이 어긋나는 곳을 지목한다. 자동으로 값을 바꾸지 않는다.
 * 표본이 적을 때 자동 보정하면 우연을 난이도로 굳혀 버린다.
 *
 * 저장은 엔진 밖의 관심사다. 여기서는 순수 함수로 집계만 하고, 어디에 쌓을지는
 * 호출자가 정한다.
 */
import { isStandardCode } from '../curriculum/standard-code.mjs';

/** 응답 한 건. 채점 결과에서 만든다. */
export function makeResponseRecord({ item, correct, answered, elapsedMs = null, learnerId = null, at = null }) {
  if (typeof correct !== 'boolean' && correct !== null) {
    throw new Error(`correct 는 boolean 또는 null 이어야 한다: ${correct}`);
  }
  return {
    itemId: item.id,
    generatorId: item.generatorId,
    standardCode: item.standardCode,
    subject: item.subject,
    gradeBand: item.gradeBand,
    // 문항이 선언한 난이도. 실측과 비교하는 대상이다.
    declaredDifficulty: item.difficulty,
    format: item.format,
    scoring: item.scoring ?? 'auto',
    dedupeKey: item.dedupeKey,
    answered,
    correct,
    elapsedMs,
    learnerId,
    at: at ?? null,
  };
}

/** 채점 결과 전체를 응답 기록으로 바꾼다. 사람 채점 문항은 제외한다. */
export function recordsFromGrading(worksheet, grading, meta = {}) {
  const byNumber = new Map(worksheet.items.map((it) => [it.number, it]));
  return grading.results
    .map((r) => {
      const item = byNumber.get(r.number);
      if (!item) return null;
      return makeResponseRecord({
        item,
        correct: r.correct,
        answered: r.answered,
        elapsedMs: meta.elapsedMs?.[r.number] ?? null,
        learnerId: meta.learnerId ?? null,
        at: meta.at ?? null,
      });
    })
    .filter((r) => r !== null);
}

const MIN_SAMPLES = 30;

const RESPONSE_RECORD_KEYS = new Set([
  'itemId',
  'generatorId',
  'standardCode',
  'subject',
  'gradeBand',
  'declaredDifficulty',
  'format',
  'scoring',
  'dedupeKey',
  'answered',
  'correct',
  'elapsedMs',
  'learnerId',
  'at',
]);
const REQUIRED_RESPONSE_RECORD_KEYS = [...RESPONSE_RECORD_KEYS]
  .filter((key) => key !== 'dedupeKey');

function isBoundedString(value, maximum = 256) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

function isIsoTimestamp(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || value.length > 35) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

export function validateResponseRecords(records) {
  if (!Array.isArray(records) || records.length > 10_000) {
    throw new Error('records 는 최대 10000개의 응답 기록 배열이어야 한다');
  }
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`records[${index}]는 객체여야 한다`);
    }
    const unknownKeys = Object.keys(record).filter((key) => !RESPONSE_RECORD_KEYS.has(key));
    if (unknownKeys.length > 0) {
      throw new Error(`records[${index}]에 허용하지 않는 필드가 있다: ${unknownKeys.join(', ')}`);
    }
    const missingKeys = REQUIRED_RESPONSE_RECORD_KEYS.filter((key) => !Object.hasOwn(record, key));
    if (missingKeys.length > 0) {
      throw new Error(`records[${index}]에 필수 필드가 없다: ${missingKeys.join(', ')}`);
    }
    if (!isBoundedString(record.itemId)
      || !isBoundedString(record.generatorId)
      || !isStandardCode(record.standardCode)
      || !['math', 'korean', 'english'].includes(record.subject)
      || !['1-2', '3-4', '5-6'].includes(record.gradeBand)
      || ![1, 2, 3].includes(record.declaredDifficulty)
      || !isBoundedString(record.format, 64)
      || !['auto', 'manual'].includes(record.scoring)
      || typeof record.answered !== 'boolean'
      || (typeof record.correct !== 'boolean' && record.correct !== null)
      || (record.elapsedMs !== null
        && (!Number.isFinite(record.elapsedMs) || record.elapsedMs < 0))
      || (record.learnerId !== null
        && (typeof record.learnerId !== 'string'
          || record.learnerId.length > 128
          || !/^[A-Za-z0-9._:-]+$/.test(record.learnerId)))
      || !isIsoTimestamp(record.at)
      || (record.dedupeKey !== undefined && !isBoundedString(record.dedupeKey, 512))) {
      throw new Error(`records[${index}]가 응답 기록 계약과 맞지 않는다`);
    }
  }
  return records;
}

/**
 * 생성기 × 난이도별 정답률.
 * 표본이 MIN_SAMPLES 미만이면 정확도를 계산하지 않는다. 세 번 풀어 두 번 맞은 것을
 * 정답률 0.67 이라고 부르면 숫자가 사실보다 세 보인다.
 */
export function aggregateAccuracy(records) {
  const buckets = new Map();
  for (const r of records) {
    if (r.scoring !== 'auto' || r.correct === null) continue;
    const key = `${r.generatorId}|${r.declaredDifficulty}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        generatorId: r.generatorId,
        standardCode: r.standardCode,
        declaredDifficulty: r.declaredDifficulty,
        attempts: 0,
        correct: 0,
      });
    }
    const b = buckets.get(key);
    b.attempts += 1;
    if (r.correct) b.correct += 1;
  }
  return [...buckets.values()]
    .map((b) => ({
      ...b,
      accuracy: b.attempts >= MIN_SAMPLES ? Number((b.correct / b.attempts).toFixed(4)) : null,
      sufficientSamples: b.attempts >= MIN_SAMPLES,
    }))
    .sort((a, b) => a.generatorId.localeCompare(b.generatorId) || a.declaredDifficulty - b.declaredDifficulty);
}

/**
 * 선언한 난이도와 실측이 어긋난 곳을 찾는다.
 *
 * 기대: 난이도가 오르면 정답률이 내려간다. 오르거나 같으면 뒤집힌 것이다.
 * 값을 자동으로 바꾸지 않고 지목만 한다. 난이도는 파라미터 범위·받아올림 유무 같은
 * 설계 결정이라 숫자만 고쳐서는 문항이 실제로 쉬워지지 않는다.
 */
export function findDifficultyInversions(aggregates, { tolerance = 0.02 } = {}) {
  const byGenerator = new Map();
  for (const a of aggregates) {
    if (!a.sufficientSamples) continue;
    if (!byGenerator.has(a.generatorId)) byGenerator.set(a.generatorId, []);
    byGenerator.get(a.generatorId).push(a);
  }

  const inversions = [];
  for (const [generatorId, list] of byGenerator) {
    const sorted = [...list].sort((x, y) => x.declaredDifficulty - y.declaredDifficulty);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      // 어려운 난이도가 더 잘 맞으면 선언과 실측이 뒤집힌 것이다.
      if (cur.accuracy > prev.accuracy + tolerance) {
        inversions.push({
          generatorId,
          standardCode: cur.standardCode,
          easier: { difficulty: prev.declaredDifficulty, accuracy: prev.accuracy, attempts: prev.attempts },
          harder: { difficulty: cur.declaredDifficulty, accuracy: cur.accuracy, attempts: cur.attempts },
          gap: Number((cur.accuracy - prev.accuracy).toFixed(4)),
        });
      }
    }
  }
  return inversions.sort((a, b) => b.gap - a.gap);
}

/** 성취기준별 정답률. 취약 기준 판정과 복습 학습지의 입력이다. */
export function aggregateByStandard(records) {
  const buckets = new Map();
  for (const r of records) {
    if (r.scoring !== 'auto' || r.correct === null) continue;
    if (!buckets.has(r.standardCode)) {
      buckets.set(r.standardCode, { standardCode: r.standardCode, attempts: 0, correct: 0 });
    }
    const b = buckets.get(r.standardCode);
    b.attempts += 1;
    if (r.correct) b.correct += 1;
  }
  return [...buckets.values()]
    .map((b) => ({
      ...b,
      accuracy: b.attempts >= MIN_SAMPLES ? Number((b.correct / b.attempts).toFixed(4)) : null,
      sufficientSamples: b.attempts >= MIN_SAMPLES,
    }))
    .sort((a, b) => a.standardCode.localeCompare(b.standardCode));
}

export { MIN_SAMPLES };
