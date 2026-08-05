#!/usr/bin/env node
/**
 * 생성기의 문항 용량을 포화 기준으로 잰다.
 *
 * '고유 문항 100개 미만' 같은 고정 문턱은 잘못된 지표다. 개념이 작아서 작은 것과
 * 내가 파라미터를 덜 써서 작은 것을 구분하지 못한다.
 *   diagonals 5개는 4~8각형이 전부다 (상한에 닿음)
 *   write-digit 90개는 '100까지의 수' 범위의 상한이다
 *   times-table 68개는 곱셈구구 81개의 84%다
 * 이런 것을 위반으로 보고하면 게이트가 꺼진다.
 *
 * 대신 포화를 본다. 표본을 두 배로 늘려도 고유 문항이 늘지 않으면 그 생성기는
 * 파라미터 공간을 다 쓴 것이다. 늘어나면 아직 표본이 모자란 것이지 결함이 아니다.
 * 결함은 '포화됐는데 그 상한이 너무 낮은' 경우다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';

const BASE_SAMPLES = Number(process.env.SAMPLES ?? 300);
/**
 * 포화된 생성기의 최소 상한.
 * 한 학습지에 같은 성취기준이 두세 문항 들어가므로, 회전하며 반복 느낌을 주지
 * 않으려면 최소 이 정도는 있어야 한다. single 축은 개념이 하나라고 이미
 * 선언했으므로 이 문턱을 적용하지 않는다.
 */
const MIN_CEILING = 12;

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

function uniqueCount(generator, standard, samples) {
  const keys = new Set();
  const levels = generator.difficulties
    ?? (generator.difficultyAxis === 'single' ? [1] : [1, 2, 3]);
  for (const difficulty of levels) {
    for (let n = 0; n < samples; n += 1) {
      try {
        keys.add(generateItem(generator, standard, createRng(`${generator.id}|cap|${difficulty}|${n}`), difficulty).dedupeKey);
      } catch {
        // 생성 실패는 verify-generators 가 잡는다.
      }
    }
  }
  return keys.size;
}

const rows = [];
for (const g of registry.all()) {
  const standard = standardByCode.get(g.standardCode);
  const atBase = uniqueCount(g, standard, BASE_SAMPLES);
  const atDouble = uniqueCount(g, standard, BASE_SAMPLES * 2);
  // 두 배 표본에서 15% 이상 늘면 아직 포화가 아니다.
  const saturated = atDouble <= Math.ceil(atBase * 1.15);
  rows.push({
    generatorId: g.id,
    code: g.standardCode,
    skill: g.skill,
    axis: g.difficultyAxis ?? 'numeric',
    capacityNote: g.capacityNote ?? null,
    uniqueAtBase: atBase,
    uniqueAtDouble: atDouble,
    saturated,
    ceiling: saturated ? atDouble : null,
  });
}

// 결함: 포화됐는데 상한이 낮고, single 축으로 선언하지도 않은 것.
// 상한이 낮은 것 자체는 결함이 아니다. 왜 낮은지 밝히지 않은 것이 결함이다.
const thin = rows.filter((r) => r.saturated
  && r.ceiling < MIN_CEILING
  && r.axis !== 'single'
  && r.capacityNote === null);
const declaredBounded = rows.filter((r) => r.capacityNote !== null);
const growing = rows.filter((r) => !r.saturated);
const totalCeiling = rows.reduce((s, r) => s + (r.ceiling ?? r.uniqueAtDouble), 0);

writeJson(path.join(REPO_ROOT, 'data', 'audit', 'capacity-check.json'), {
  schema: 'digi-mon/capacity-check@1',
  note: '포화 기준 용량이다. 고정 문턱은 개념이 작은 것과 덜 쓴 것을 구분하지 못해 쓰지 않는다.',
  baseSamples: BASE_SAMPLES,
  minCeiling: MIN_CEILING,
  generatorCount: rows.length,
  saturatedCount: rows.filter((r) => r.saturated).length,
  thinCount: thin.length,
  declaredBounded: declaredBounded.map((r) => ({ generatorId: r.generatorId, ceiling: r.ceiling, capacityNote: r.capacityNote })),
  observedCapacity: totalCeiling,
  rows,
});

console.log(`용량 검사: 생성기 ${rows.length}개 (표본 ${BASE_SAMPLES} vs ${BASE_SAMPLES * 2})`);
console.log(`파라미터 공간을 다 쓴(포화) 생성기: ${rows.filter((r) => r.saturated).length}개`);
console.log(`아직 늘어나는 중(표본 부족, 결함 아님): ${growing.length}개`);
console.log(`관측 문항 용량 합계: ${totalCeiling.toLocaleString()}개`);
console.log(`개념이 유한하다고 밝힌(capacityNote) 생성기: ${declaredBounded.length}개`);
console.log(`상한이 낮은데 이유를 밝히지 않은 생성기: ${thin.length}개`);

if (thin.length > 0) {
  console.log('');
  console.log('상한이 낮은데 이유가 없다 — 파라미터를 넓히거나 capacityNote 에 왜 유한한지 적어야 한다:');
  for (const r of thin.sort((a, b) => a.ceiling - b.ceiling)) {
    console.log(`  ${String(r.ceiling).padStart(3)}개  ${r.generatorId}  [${r.axis}]  ${r.skill}`);
  }
  process.exitCode = 1;
}
