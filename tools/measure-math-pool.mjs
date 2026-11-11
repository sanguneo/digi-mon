#!/usr/bin/env node
/**
 * 수학 문항 pool 의 고유 문항 수를 학년군·영역·난이도별로 잰다.
 *
 * check-capacity 는 표본 300 대 600 으로 포화 여부만 본다. 그 방식으로는 생성기 하나가
 * 많아야 1,800개로 잡혀 '얼마나 많은가'를 말할 수 없다. 여기서는 표본을 두 배씩 늘려
 * 새 문항이 거의 안 나올 때(포화)까지 또는 상한 표본까지 센다.
 *
 * 숫자는 관측값이다. 상한 표본에 닿고도 계속 늘던 생성기는 saturated=false 로 남기고,
 * 그 수는 하한(lower bound)으로만 읽는다. 추정치를 더하지 않는다.
 *
 * 사용: node tools/measure-math-pool.mjs [--max 65536] [--json out.json]
 */
import { writeFileSync } from 'node:fs';
import { loadOntology } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const MAX_SAMPLES = Number(argValue('--max', 65536));
const START_SAMPLES = 1024;
/** 표본을 두 배로 늘렸을 때 새 문항이 이 비율 미만이면 포화로 본다. */
const SATURATION_GROWTH = 0.005;
const jsonOut = argValue('--json', null);

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

function measureLevel(generator, standard, difficulty) {
  const keys = new Set();
  let drawn = 0;
  let target = START_SAMPLES;
  let saturated = false;
  while (drawn < MAX_SAMPLES) {
    const before = keys.size;
    for (; drawn < target; drawn += 1) {
      const raw = generator.generate(createRng(`${generator.id}|pool|${difficulty}|${drawn}`), { difficulty, standard });
      keys.add(raw.dedupeKey);
    }
    if (before > 0 && keys.size - before < Math.max(1, before * SATURATION_GROWTH)) {
      saturated = true;
      break;
    }
    target = Math.min(MAX_SAMPLES, target * 2);
  }
  return { keys, drawn, saturated };
}

const rows = [];
for (const g of registry.all()) {
  if (!g.id.startsWith('math.')) continue;
  const standard = standardByCode.get(g.standardCode);
  const levels = g.difficulties ?? (g.difficultyAxis === 'single' ? [1] : [1, 2, 3]);
  const union = new Set();
  const byDifficulty = {};
  let saturated = true;
  for (const d of levels) {
    const m = measureLevel(g, standard, d);
    byDifficulty[d] = m.keys.size;
    for (const k of m.keys) union.add(k);
    saturated &&= m.saturated;
  }
  rows.push({
    generatorId: g.id,
    code: g.standardCode,
    gradeBand: standard.gradeBand,
    domain: standard.domain,
    unique: union.size,
    byDifficulty,
    saturated,
  });
}

const table = {};
for (const r of rows) {
  const key = `${r.gradeBand}|${r.domain}`;
  table[key] ??= { gradeBand: r.gradeBand, domain: r.domain, generators: 0, unique: 0, d1: 0, d2: 0, d3: 0, unsaturated: 0 };
  const t = table[key];
  t.generators += 1;
  t.unique += r.unique;
  t.d1 += r.byDifficulty[1] ?? 0;
  t.d2 += r.byDifficulty[2] ?? 0;
  t.d3 += r.byDifficulty[3] ?? 0;
  if (!r.saturated) t.unsaturated += 1;
}
const cells = Object.values(table).sort((a, b) => (a.gradeBand + a.domain).localeCompare(b.gradeBand + b.domain));
const total = rows.reduce((s, r) => s + r.unique, 0);

const fmt = (n) => n.toLocaleString('en-US');
console.log(`수학 생성기 ${rows.length}개, 난이도별 표본 상한 ${fmt(MAX_SAMPLES)}`);
console.log('| 학년군 | 영역 | 생성기 | 고유 문항 | 난이도1 | 난이도2 | 난이도3 | 미포화 생성기 |');
console.log('|---|---|--:|--:|--:|--:|--:|--:|');
for (const c of cells) {
  console.log(`| ${c.gradeBand} | ${c.domain} | ${c.generators} | ${fmt(c.unique)} | ${fmt(c.d1)} | ${fmt(c.d2)} | ${fmt(c.d3)} | ${c.unsaturated} |`);
}
console.log(`| 합계 | | ${rows.length} | ${fmt(total)} | | | | ${rows.filter((r) => !r.saturated).length} |`);

if (jsonOut) {
  writeFileSync(jsonOut, `${JSON.stringify({ maxSamples: MAX_SAMPLES, total, cells, rows }, null, 2)}\n`);
}
