import { createHash } from 'node:crypto';

import { createRng } from './rng.mjs';
import {
  buildWorksheet,
  buildWorksheetFingerprint,
  generateItem,
} from './worksheet.mjs';

const FORM_SET_SCHEMA = 'digi-mon/worksheet-form-set@1';
const FORM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const BLUEPRINT_ATTEMPTS = 24;
const UNIQUE_ATTEMPTS_PER_SLOT = 200;

class FormPoolExhaustedError extends Error {}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function formSeed(seed, label) {
  return `${String(seed)}:form:${label}`;
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
      const item = generateItem(generator, standard, rng, slot.difficulty);
      if (item.difficulty !== slot.difficulty) {
        throw new Error(
          `병렬 form blueprint 난이도가 달라졌다: form=${label} `
          + `generator=${slot.generatorId} expected=${slot.difficulty} actual=${item.difficulty}`,
        );
      }
      if (seen.has(item.dedupeKey)) continue;
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
}) {
  const blueprintSeed = blueprintAttempt === 0
    ? String(seed)
    : `${String(seed)}:blueprint:${blueprintAttempt}`;
  const firstLabel = FORM_LABELS[0];
  const first = buildWorksheet(spine, registry, {
    ...worksheetOptions,
    seed: formSeed(blueprintSeed, firstLabel),
  });
  if (first.shortfall > 0) {
    throw new FormPoolExhaustedError(
      `병렬 form 기준 문항 수를 채우지 못했다: ${first.produced}/${first.requested}`,
    );
  }

  const blueprint = blueprintFor(first);
  const seen = new Set(first.items.map((item) => item.dedupeKey));
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
  return {
    ...identity,
    forms,
    fingerprint: createHash('sha256').update(stableJson(identity)).digest('hex'),
  };
}

export function buildWorksheetFormSet(spine, registry, options) {
  const {
    formCount = 3,
    ...worksheetOptions
  } = options ?? {};
  if (!Number.isInteger(formCount) || formCount < 2 || formCount > FORM_LABELS.length) {
    throw new Error(`formCount 는 2..${FORM_LABELS.length} 정수여야 한다: ${formCount}`);
  }

  const seed = worksheetOptions.seed ?? 'digi-mon';
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
      });
    } catch (error) {
      if (!(error instanceof FormPoolExhaustedError)) throw error;
      lastPoolError = error;
    }
  }
  throw new Error(
    `병렬 form 고유 문항 pool이 ${BLUEPRINT_ATTEMPTS}개 blueprint에서 부족했다: `
    + lastPoolError.message,
  );
}
