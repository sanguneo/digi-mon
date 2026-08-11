import { createHash } from 'node:crypto';

import {
  PRACTICE_MODE_IDS,
  generatorSupportsModes,
  resolveModeSelection,
} from '../curriculum/practice-modes.mjs';
import { learningOrder } from '../curriculum/prerequisites.mjs';
import { assessmentMappingsFor } from '../ontology/alignment.mjs';
import { buildLearningSupport } from '../curriculum/learning-support.mjs';
import { finalizeItem } from './item.mjs';
import { normalizeExcludeItemIds } from './options.mjs';
import { createRng } from './rng.mjs';
import { stableJson } from './stable-json.mjs';

const DEFAULT_DIFFICULTY_MIX = { 1: 0.3, 2: 0.5, 3: 0.2 };
const WORKSHEET_SCHEMA = 'digi-mon/worksheet@5';
const ENGINE_VERSION = 'digi-mon-engine@5';

/**
 * 요청한 조건에 맞는 성취기준이 하나도 없다는 뜻이다.
 *
 * 옵션 형식은 옳지만 가리키는 대상이 없는 경우이므로 서버 잘못이 아니다.
 * 타입이 없으면 일반 Error 로 500 이 나가, 500 을 '검산 실패' 신호로만 쓰기로 한
 * 약속(`src/server/app.mjs` 의 catch 주석)이 깨진다.
 */
export class WorksheetTargetError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'WorksheetTargetError';
    this.detail = detail;
  }
}

export function buildWorksheetFingerprint({
  schema,
  seed,
  options,
  modeSelection,
  items,
  corpus,
}) {
  const payload = {
    schema,
    engineVersion: ENGINE_VERSION,
    seed: String(seed),
    options,
    modeSelection,
    items,
    corpus,
  };
  return createHash('sha256').update(stableJson(payload)).digest('hex');
}

/**
 * 생성기 하나를 돌려 검산까지 통과한 문항 한 개를 만든다.
 * 검산 실패는 삼키지 않는다. 답이 틀린 문항이 학습지에 나가는 게 최악이다.
 */
export function generateItem(generator, standard, rng, difficulty) {
  // 생성기가 지원하지 않는 난이도를 요청하면 지원하는 것 중 가장 가까운 값으로 잠근다.
  // 난이도 구분이 없는 문항에 3을 요구해도 3짜리 문항이 생기지는 않는다.
  const supported = generator.difficulties
    ?? (generator.difficultyAxis === 'single' ? [1] : [1, 2, 3]);
  const level = supported.includes(difficulty)
    ? difficulty
    : supported.reduce((best, d) => (Math.abs(d - difficulty) < Math.abs(best - difficulty) ? d : best), supported[0]);

  const raw = generator.generate(rng, { difficulty: level, standard });
  const withMeta = {
    ...raw,
    generatorId: generator.id,
    assessmentMappings: assessmentMappingsFor(standard, generator),
    curriculum: {
      standardKey: standard.key,
      source: standard.source,
      topicMappings: standard.alignment?.topicMappings ?? [],
    },
    skill: raw.skill ?? generator.skill,
    learningSupport: buildLearningSupport(generator),
    format: raw.format ?? generator.format,
    difficulty: raw.difficulty ?? level,
  };
  const item = finalizeItem(withMeta, { standard });

  if (generator.verify(item.params, item.answer) !== true) {
    throw new Error(
      `검산 실패 [${generator.id}] stem="${item.stem}" answer=${JSON.stringify(item.answer.value)} params=${JSON.stringify(item.params)}`,
    );
  }
  return item;
}

function eligibleGenerators(registry, code, modes) {
  return registry.forStandard(code).filter((generator) =>
    generatorSupportsModes(generator, modes));
}

function resolveTargets(spine, registry, {
  subject,
  gradeBands,
  domains,
  codes,
  modes,
}) {
  return spine.standards.filter((std) => {
    if (subject && std.subject !== subject) return false;
    if (gradeBands?.length && !gradeBands.includes(std.gradeBand)) return false;
    if (domains?.length && !domains.includes(std.domain)) return false;
    if (codes?.length && !codes.includes(std.code)) return false;
    return eligibleGenerators(registry, std.code, modes).length > 0;
  });
}

/**
 * 학습지 한 장을 조립한다.
 *
 * 같은 seed + 같은 옵션 -> 완전히 동일한 학습지가 나온다(재발급 가능).
 * dedupeKey 로 한 장 안에서의 중복을 막는다. 파라미터 공간이 고갈되면
 * 조용히 중복을 넣지 않고 만든 만큼만 돌려주고 부족분을 보고한다.
 */
/**
 * 학습지 발급 옵션. HTTP 경계에서는 engine/options.mjs 의 parseWorksheetOptions 가
 * 이 모양으로 정규화해 넘긴다.
 *
 * @typedef {object} WorksheetOptions
 * @property {string} [seed]
 * @property {'math'|'korean'|'english'} [subject]
 * @property {string[]} [gradeBands]
 * @property {string[]} [domains]
 * @property {string[]} [codes]
 * @property {number} [count] 1..100
 * @property {number} [difficulty] 1..3. 주면 difficultyMix 대신 이 값으로 고정한다
 * @property {Record<number, number>} [difficultyMix] 난이도별 양수 가중치
 * @property {string[]} [modes]
 * @property {string} [title]
 * @property {boolean} [followLearningOrder] 선수 관계 순서로 배치. 수학만 지원
 * @property {string[]} [excludeItemIds]
 */

/**
 * 발급된 학습지. fingerprint 는 seed·해석된 옵션·문항·코퍼스로 계산한다 —
 * 채점은 이 지문으로 같은 학습지인지 대조한다.
 *
 * @typedef {object} Worksheet
 * @property {string} schema
 * @property {string} engineVersion
 * @property {string} seed
 * @property {string} title
 * @property {number} requested
 * @property {number} produced
 * @property {number} shortfall 요청분에서 못 채운 수. 0 이 아니면 서버가 409 를 낸다
 * @property {Record<string, any>} options 해석된 옵션(provenance)
 * @property {Record<string, any>} modeSelection
 * @property {Record<string, any>} corpus
 * @property {string[]} standardsUsed
 * @property {Record<number, number>} difficultyHistogram
 * @property {Record<string, any>[]} items
 * @property {string} fingerprint
 */

/**
 * @param {Record<string, any>} spine
 * @param {Record<string, any>} registry
 * @param {WorksheetOptions} [options]
 * @param {() => void} [onItemAttempt] 생성 직전 시도 관찰자. 출력 계약에는 포함하지 않는다
 * @returns {Worksheet}
 */
export function buildWorksheet(spine, registry, options, onItemAttempt) {
  const {
    seed = 'digi-mon',
    subject = 'math',
    gradeBands,
    domains,
    codes,
    count = 20,
    difficulty,
    difficultyMix = DEFAULT_DIFFICULTY_MIX,
    modes = [],
    title,
    // true 면 성취기준을 선수 관계 순서로 배치한다. 복습 학습지는 선수부터 풀려야 한다.
    followLearningOrder = false,
    excludeItemIds = [],
  } = options ?? {};

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error(`count 는 1..100 정수여야 한다: ${count}`);
  }
  if (difficulty !== undefined && ![1, 2, 3].includes(difficulty)) {
    throw new Error(`difficulty 는 1, 2, 3 중 하나여야 한다: ${difficulty}`);
  }
  if (!Array.isArray(modes)
    || modes.some((mode) => !PRACTICE_MODE_IDS.includes(mode))
    || new Set(modes).size !== modes.length) {
    throw new Error(`modes 는 지원하는 고유 mode 배열이어야 한다: ${modes}`);
  }
  const resolvedModes = modes.slice().sort();
  const resolvedDifficulty = resolvedModes.includes('advanced') ? 3 : difficulty;
  if (resolvedModes.includes('advanced') && difficulty !== undefined && difficulty !== 3) {
    throw new Error(`advanced mode는 difficulty 3만 지원한다: ${difficulty}`);
  }
  if (followLearningOrder && subject !== 'math') {
    throw new Error(`followLearningOrder 는 수학만 지원한다: ${subject}`);
  }
  const resolvedExcludeItemIds = normalizeExcludeItemIds(excludeItemIds);

  const targets = resolveTargets(spine, registry, {
    subject,
    gradeBands,
    domains,
    codes,
    modes: resolvedModes,
  });
  if (targets.length === 0) {
    throw new WorksheetTargetError(
      `조건과 mode에 맞는 성취기준이 없다: subject=${subject} gradeBands=${gradeBands} domains=${domains} codes=${codes} modes=${resolvedModes}`,
      {
        subject,
        gradeBands: gradeBands ?? null,
        domains: domains ?? null,
        codes: codes ?? null,
        modes: resolvedModes,
      },
    );
  }

  const rng = createRng(seed);
  const mixEntries = Object.entries(difficultyMix).map(([k, v]) => [Number(k), Number(v)]);
  if (mixEntries.length === 0
    || mixEntries.some(([level, weight]) =>
      ![1, 2, 3].includes(level) || !Number.isFinite(weight) || weight <= 0)) {
    throw new Error('difficultyMix 는 난이도 1..3의 양수 가중치여야 한다');
  }

  // 성취기준을 고르게 돌린다. 한 기준에 몰리면 학습지가 아니라 반복 훈련이 된다.
  const pool = targets.map((std) => ({
    std,
    generators: eligibleGenerators(registry, std.code, resolvedModes),
  }));

  // 선수 순서를 따를 때는 학습 순서로 정렬해 앞쪽 기준이 먼저 나오게 한다.
  if (followLearningOrder) {
    const rank = new Map(learningOrder(targets.map((t) => t.code)).map((code, idx) => [code, idx]));
    pool.sort((a, b) => (rank.get(a.std.code) ?? 0) - (rank.get(b.std.code) ?? 0));
  }

  const items = [];
  const excludedItemIdSet = new Set(resolvedExcludeItemIds);
  const seen = new Set();
  const failures = [];
  let cursorPool = followLearningOrder ? pool.slice() : rng.shuffle(pool);
  let cursor = 0;
  let attempts = 0;
  const maxAttempts = count * 40;

  while (items.length < count && attempts < maxAttempts) {
    attempts += 1;
    if (cursor >= cursorPool.length) {
      cursorPool = followLearningOrder ? pool.slice() : rng.shuffle(pool);
      cursor = 0;
    }
    const { std, generators } = cursorPool[cursor];
    const g = rng.pick(generators);
    cursor += 1;

    const d = resolvedDifficulty ?? rng.weighted(mixEntries);
    onItemAttempt?.();
    let item;
    try {
      item = generateItem(g, std, rng, d);
    } catch (error) {
      failures.push({ generatorId: g.id, code: std.code, difficulty: d, message: error.message });
      continue;
    }
    if (resolvedModes.includes('advanced') && item.difficulty !== 3) {
      failures.push({
        generatorId: g.id,
        code: std.code,
        difficulty: d,
        message: `advanced mode 난이도 drift: ${item.difficulty}`,
      });
      continue;
    }
    if (excludedItemIdSet.has(item.id) || seen.has(item.dedupeKey)) continue;
    seen.add(item.dedupeKey);
    items.push(item);
  }

  if (failures.length > 0) {
    // 검산 실패는 데이터 문제가 아니라 생성기 버그다. 학습지를 내보내지 않는다.
    throw new Error(
      `문항 생성 실패 ${failures.length}건:\n${failures.slice(0, 5).map((f) => `  ${f.generatorId} d${f.difficulty} ${f.message}`).join('\n')}`,
    );
  }

  const numbered = items.map((item, idx) => ({ number: idx + 1, ...item }));

  const corpus = {
    taxonomyVersion: spine.corpus.schema,
    integrity: spine.corpus.integrity.map(({ file, sha256 }) => ({ file, sha256 })),
  };
  const resolvedOptions = {
    subject,
    gradeBands: gradeBands ?? null,
    domains: domains ?? null,
    codes: codes ?? null,
    count,
    difficulty: resolvedDifficulty ?? null,
    difficultyMix,
    modes: resolvedModes,
    followLearningOrder,
    excludeItemIds: resolvedExcludeItemIds,
  };
  const difficultyHistogram = {};
  for (const item of numbered) {
    difficultyHistogram[item.difficulty] = (difficultyHistogram[item.difficulty] ?? 0) + 1;
  }
  const worksheet = {
    schema: WORKSHEET_SCHEMA,
    engineVersion: ENGINE_VERSION,
    seed: String(seed),
    title: title ?? defaultTitle(targets, subject),
    requested: count,
    produced: numbered.length,
    shortfall: count - numbered.length,
    options: resolvedOptions,
    modeSelection: resolveModeSelection(resolvedModes),
    corpus,
    standardsUsed: [...new Set(numbered.map((it) => it.standardCode))].sort(),
    difficultyHistogram,
    items: numbered,
  };
  return {
    ...worksheet,
    fingerprint: buildWorksheetFingerprint(worksheet),
  };
}

function defaultTitle(targets, subject) {
  const bands = [...new Set(targets.map((t) => t.gradeBand))].sort();
  const domains = [...new Set(targets.map((t) => t.domain))];
  const subjectKorean = targets[0]?.subjectKorean ?? subject;
  return `${subjectKorean} ${bands.join('·')}학년 ${domains.join('·')}`;
}
