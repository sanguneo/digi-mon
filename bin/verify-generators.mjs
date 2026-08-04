#!/usr/bin/env node
/**
 * 생성기 전량 스트레스 검증.
 * 생성기 × 난이도 × 시드로 대량 생성해 검산 통과율과 파라미터 공간 크기를 실측한다.
 * '무한 생성'은 주장이 아니라 여기서 나온 고유 문항 수로만 말할 수 있다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry, buildCoverage } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';
import { renderFigureSvg } from '../src/render/figure-svg.mjs';

/**
 * figure 가 붙은 문항은 SVG 까지 실제로 그려 본다.
 * 좌표에 NaN/undefined 가 새는 것이 이런 렌더러의 대표적 실패이고,
 * 그건 파일을 열어 봐야 보이는 게 아니라 여기서 잡아야 한다.
 */
function assertRenderableSvg(item) {
  const svg = renderFigureSvg(item.figure);
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
    throw new Error(`SVG 형식 오류 [${item.figure.kind}]`);
  }
  for (const bad of ['NaN', 'undefined', 'Infinity', 'null']) {
    if (svg.includes(bad)) throw new Error(`SVG에 ${bad} 유출 [${item.figure.kind}] params=${JSON.stringify(item.params)}`);
  }
  // 여는 태그와 닫는 태그 수가 맞아야 파서가 읽을 수 있다.
  const opens = (svg.match(/<(svg|g|text|circle|line|rect|polygon)\b/g) ?? []).length;
  const selfClosing = (svg.match(/\/>/g) ?? []).length;
  const closes = (svg.match(/<\/(svg|g|text)>/g) ?? []).length;
  if (opens !== selfClosing + closes) {
    throw new Error(`SVG 태그 짝이 맞지 않는다 [${item.figure.kind}] open=${opens} self=${selfClosing} close=${closes}`);
  }
}

const PER_COMBINATION = Number(process.env.SAMPLES ?? 400);

const ontology = loadOntology();
const spine = buildSpine(ontology);
const registry = createRegistry();
const coverage = buildCoverage(spine, registry);
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

const results = [];
const errors = [];
let totalGenerated = 0;
let figureCount = 0;

for (const g of registry.all()) {
  const standard = standardByCode.get(g.standardCode);
  if (!standard) {
    errors.push({ generatorId: g.id, kind: 'spine-miss', message: `스파인에 없는 성취기준 코드: ${g.standardCode}` });
    continue;
  }

  const row = { generatorId: g.id, code: g.standardCode, skill: g.skill, byDifficulty: {}, uniqueTotal: 0, generated: 0, failed: 0 };
  const allKeys = new Set();

  for (const difficulty of [1, 2, 3]) {
    const keys = new Set();
    let failed = 0;
    for (let n = 0; n < PER_COMBINATION; n += 1) {
      const rng = createRng(`${g.id}|d${difficulty}|${n}`);
      try {
        const item = generateItem(g, standard, rng, difficulty);
        keys.add(item.dedupeKey);
        allKeys.add(item.dedupeKey);
        totalGenerated += 1;
        if (item.figure) {
          figureCount += 1;
          assertRenderableSvg(item);
        }
      } catch (error) {
        failed += 1;
        if (errors.length < 40) errors.push({ generatorId: g.id, difficulty, sample: n, message: error.message });
      }
    }
    row.byDifficulty[difficulty] = { generated: PER_COMBINATION, unique: keys.size, failed };
    row.generated += PER_COMBINATION;
    row.failed += failed;
  }
  row.uniqueTotal = allKeys.size;
  row.uniqueRatio = Number((row.uniqueTotal / row.generated).toFixed(4));
  results.push(row);
}

const failedGenerators = results.filter((r) => r.failed > 0);
const report = {
  schema: 'digi-mon/generator-verification@1',
  samplesPerCombination: PER_COMBINATION,
  generatorCount: registry.size,
  totalGenerated,
  totalFailed: results.reduce((s, r) => s + r.failed, 0),
  figuresRendered: figureCount,
  coverage: {
    totalStandards: coverage.totalStandards,
    coveredStandards: coverage.coveredStandards,
    coverageRatio: coverage.coverageRatio,
    bySubject: coverage.bySubject,
  },
  results,
  errors,
};

writeJson(path.join(REPO_ROOT, 'data', 'audit', 'generator-verification.json'), report);
writeJson(path.join(REPO_ROOT, 'data', 'coverage', 'coverage.json'), coverage);

console.log(`생성기 ${registry.size}개 × 난이도 3 × 시드 ${PER_COMBINATION} = ${totalGenerated}문항 생성`);
console.log(`검산 실패: ${report.totalFailed}건   그림 문항 SVG 렌더: ${figureCount}건`);
console.log('');
console.log('생성기                                    코드         고유/생성    d1    d2    d3   실패');
for (const r of results) {
  const d = [1, 2, 3].map((k) => String(r.byDifficulty[k].unique).padStart(5)).join(' ');
  console.log(`${r.generatorId.padEnd(40)} ${r.code.padEnd(11)} ${String(r.uniqueTotal).padStart(5)}/${String(r.generated).padStart(4)} ${d} ${String(r.failed).padStart(6)}`);
}

console.log('');
console.log(`커버리지: ${coverage.coveredStandards}/${coverage.totalStandards} 성취기준 (${(coverage.coverageRatio * 100).toFixed(1)}%)`);
for (const [slug, b] of Object.entries(coverage.bySubject)) {
  console.log(`  ${b.subjectKorean.padEnd(3)} ${String(b.covered).padStart(3)}/${String(b.total).padStart(3)} 기준  생성기 ${b.generators}개`);
  for (const [domain, dv] of Object.entries(b.byDomain)) {
    console.log(`      ${domain.padEnd(12)} ${dv.covered}/${dv.total}`);
  }
}

if (errors.length > 0) {
  console.error('\n오류 표본:');
  for (const e of errors.slice(0, 15)) console.error(`  [${e.generatorId}] d${e.difficulty ?? '-'} ${e.message}`);
  process.exitCode = 1;
}
