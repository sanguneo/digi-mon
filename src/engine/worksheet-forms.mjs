import { createHash } from 'node:crypto';

import { createRng } from './rng.mjs';
import { stableJson } from './stable-json.mjs';
import {
  buildWorksheet,
  buildWorksheetFingerprint,
  generateItem,
} from './worksheet.mjs';

const FORM_SET_SCHEMA = 'digi-mon/worksheet-form-set@4';
const FORM_PROVENANCE_SCHEMA = 'digi-mon/worksheet-form@1';
const FORM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const BLUEPRINT_ATTEMPTS = 24;
const UNIQUE_ATTEMPTS_PER_SLOT = 200;

/**
 * 한 요청이 태울 수 있는 문항 생성 시도 총량.
 *
 * 상한이 없으면 blueprint 24회 × form 8개 × 슬롯 100개 × 슬롯당 재시도 200회로
 * 한 요청이 300만 번 넘게 generateItem 을 돌 수 있다. 단일 스레드 서버에서는 그
 * 동안 다른 모든 요청이 멈춘다.
 *
 * 값의 근거는 실측이다. 실코퍼스로 subject 3종 × count 10..50 × form 2..4 ×
 * seed 3개(135건)를 돌린 결과, 성공한 요청의 최대 소비는 5,840회였고 실패한
 * 요청의 최소 소비는 6,230회였다. 8,000 은 그 사이의 위쪽 — 성공하는 요청은
 * 건드리지 않고(여유 1.37배), 어차피 409 로 끝날 요청만 CPU 를 덜 태우고 끊는다.
 * 실측: 100문항 8형이 11,469회/734ms 에서 8,000회/약 500ms 로 줄었다.
 */
const MAX_ITEM_ATTEMPTS_PER_REQUEST = 8_000;

export const MAX_WORKSHEET_FORMS = FORM_LABELS.length;

class FormPoolExhaustedError extends Error {}
export class WorksheetFormPoolError extends Error {}

/**
 * 요청 하나가 쓰는 생성 시도 예산. blueprint 재시도를 가로질러 누적한다.
 *
 * 예산을 넘으면 FormPoolExhaustedError 가 아니라 WorksheetFormPoolError 를 던진다.
 * 전자는 다음 blueprint 로 재시도하라는 신호라서, 예산 초과에 쓰면 상한이 무의미해진다.
 */
function createAttemptBudget(limit) {
  let used = 0;
  return {
    used: () => used,
    spend(cost) {
      used += cost;
      if (used > limit) {
        throw new WorksheetFormPoolError(
          `병렬 form 생성 시도가 요청당 상한 ${limit}회를 넘었다(소비 ${used}회). `
          + '문항 수나 form 수를 줄이거나 조건을 넓혀야 한다',
        );
      }
    },
  };
}

function formSeed(seed, label) {
  return `${String(seed)}:form:${label}`;
}

function blueprintSeed(seed, attempt) {
  if (attempt === 0) return String(seed);
  const digest = createHash('sha256')
    .update(stableJson({
      namespace: 'digi-mon/form-blueprint-seed@1',
      seed: String(seed),
      attempt,
    }))
    .digest('hex');
  return `form-blueprint-${digest}`;
}

function blueprintFor(worksheet) {
  return worksheet.items.map((item) => ({
    number: item.number,
    standardCode: item.standardCode,
    generatorId: item.generatorId,
    difficulty: item.difficulty,
  }));
}

function worksheetWithItems(base, seed, items) {
  const numbered = items.map((item, index) => ({ number: index + 1, ...item }));
  const difficultyHistogram = {};
  for (const item of numbered) {
    difficultyHistogram[item.difficulty] = (difficultyHistogram[item.difficulty] ?? 0) + 1;
  }
  const worksheet = {
    ...base,
    seed,
    produced: numbered.length,
    shortfall: base.requested - numbered.length,
    standardsUsed: [...new Set(numbered.map((item) => item.standardCode))].sort(),
    difficultyHistogram,
    items: numbered,
  };
  delete worksheet.fingerprint;
  return {
    ...worksheet,
    fingerprint: buildWorksheetFingerprint(worksheet),
  };
}

function generateForm({
  base,
  blueprint,
  label,
  registry,
  standards,
  seen,
  excludedItemIds,
  budget,
}) {
  const seed = formSeed(base.seed.replace(/:form:A$/, ''), label);
  const rng = createRng(seed);
  const items = blueprint.map((slot) => {
    const standard = standards.get(slot.standardCode);
    const generator = registry
      .forStandard(slot.standardCode)
      .find((candidate) => candidate.id === slot.generatorId);
    if (!standard || !generator) {
      throw new Error(
        `병렬 form blueprint를 해석할 수 없다: ${slot.standardCode} ${slot.generatorId}`,
      );
    }

    for (let attempt = 0; attempt < UNIQUE_ATTEMPTS_PER_SLOT; attempt += 1) {
      budget.spend(1);
      const item = generateItem(generator, standard, rng, slot.difficulty);
      if (item.difficulty !== slot.difficulty) {
        throw new FormPoolExhaustedError(
          `병렬 form blueprint 난이도가 달라졌다: form=${label} `
          + `generator=${slot.generatorId} expected=${slot.difficulty} actual=${item.difficulty}`,
        );
      }
      if (excludedItemIds.has(item.id) || seen.has(item.dedupeKey)) continue;
      seen.add(item.dedupeKey);
      return item;
    }
    throw new FormPoolExhaustedError(
      `병렬 form 고유 문항 pool이 부족하다: form=${label} `
      + `standard=${slot.standardCode} generator=${slot.generatorId}`,
    );
  });
  return worksheetWithItems(base, seed, items);
}

function buildFormSetAttempt({
  spine,
  registry,
  worksheetOptions,
  formCount,
  seed,
  blueprintAttempt,
  budget,
}) {
  const resolvedBlueprintSeed = blueprintSeed(seed, blueprintAttempt);
  const firstLabel = FORM_LABELS[0];
  const first = buildWorksheet(spine, registry, {
    ...worksheetOptions,
    seed: formSeed(resolvedBlueprintSeed, firstLabel),
  });
  // 기준 form 은 슬롯 수만큼 청구한다. buildWorksheet 는 내부 재시도 횟수를
  // 돌려주지 않으므로 최소치로 센다 — blueprint 재시도가 늘어나면 그만큼 쌓인다.
  budget.spend(first.produced);
  if (first.shortfall > 0) {
    throw new FormPoolExhaustedError(
      `병렬 form 기준 문항 수를 채우지 못했다: ${first.produced}/${first.requested}`,
    );
  }
  if (worksheetOptions.difficulty !== undefined
    && first.items.some((item) => item.difficulty !== worksheetOptions.difficulty)) {
    throw new FormPoolExhaustedError(
      `병렬 form 기준 문항 난이도가 요청과 다르다: requested=${worksheetOptions.difficulty}`,
    );
  }

  const blueprint = blueprintFor(first);
  const seen = new Set(first.items.map((item) => item.dedupeKey));
  const excludedItemIds = new Set(first.options.excludeItemIds);
  const standards = new Map(spine.standards.map((standard) => [standard.code, standard]));
  const forms = [{ label: firstLabel, worksheet: first }];

  for (const label of FORM_LABELS.slice(1, formCount)) {
    forms.push({
      label,
      worksheet: generateForm({
        base: first,
        blueprint,
        label,
        registry,
        standards,
        seen,
        excludedItemIds,
        budget,
      }),
    });
  }

  const identity = {
    schema: FORM_SET_SCHEMA,
    engineVersion: first.engineVersion,
    seed: String(seed),
    formCount,
    blueprintAttempt,
    options: first.options,
    blueprint,
    forms: forms.map(({ label, worksheet }) => ({
      label,
      fingerprint: worksheet.fingerprint,
      seed: worksheet.seed,
    })),
  };
  const fingerprint = createHash('sha256').update(stableJson(identity)).digest('hex');
  const issuedForms = forms.map(({ label, worksheet }) => ({
    label,
    worksheet: {
      ...worksheet,
      formSet: {
        schema: FORM_PROVENANCE_SCHEMA,
        seed: String(seed),
        label,
        formCount,
        blueprintAttempt,
        fingerprint,
      },
    },
  }));
  return {
    ...identity,
    forms: issuedForms,
    fingerprint,
  };
}

export function buildWorksheetFormSet(spine, registry, options) {
  const {
    formCount = 3,
    ...worksheetOptions
  } = options ?? {};
  if (!Number.isInteger(formCount) || formCount < 2 || formCount > MAX_WORKSHEET_FORMS) {
    throw new Error(`formCount 는 2..${MAX_WORKSHEET_FORMS} 정수여야 한다: ${formCount}`);
  }

  const seed = worksheetOptions.seed ?? 'digi-mon';
  const budget = createAttemptBudget(MAX_ITEM_ATTEMPTS_PER_REQUEST);
  let lastPoolError;
  for (let blueprintAttempt = 0; blueprintAttempt < BLUEPRINT_ATTEMPTS; blueprintAttempt += 1) {
    try {
      return buildFormSetAttempt({
        spine,
        registry,
        worksheetOptions,
        formCount,
        seed,
        blueprintAttempt,
        budget,
      });
    } catch (error) {
      if (!(error instanceof FormPoolExhaustedError)) throw error;
      lastPoolError = error;
    }
  }
  throw new WorksheetFormPoolError(
    `병렬 form 고유 문항 pool이 ${BLUEPRINT_ATTEMPTS}개 blueprint에서 부족했다`
    + `(생성 시도 ${budget.used()}회): ${lastPoolError.message}`,
  );
}
