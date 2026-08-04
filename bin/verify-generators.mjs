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
 * XML 정합성을 스택으로 확인한다.
 *
 * 태그 이름을 하드코딩해 세는 방식은 렌더러에 새 태그(path, ellipse 등)를 쓸 때마다
 * 검사기를 따라 고쳐야 하고, 잊으면 멀쩡한 SVG를 실패로 보고한다. 태그 이름을
 * 모르는 채로 여닫힘만 맞춰 보는 쪽이 렌더러 변경에 견딘다.
 */
function assertWellFormedXml(svg, kind) {
  const stack = [];
  // 속성값 안의 따옴표를 건너뛰어 '>' 를 태그 끝으로 오인하지 않게 한다.
  const tagPattern = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let match = tagPattern.exec(svg);
  while (match !== null) {
    const [, closing, name, , selfClosing] = match;
    if (closing) {
      const opened = stack.pop();
      if (opened !== name) {
        throw new Error(`XML 태그 불일치 [${kind}]: </${name}> 앞에 <${opened ?? '없음'}>`);
      }
    } else if (!selfClosing) {
      stack.push(name);
    }
    match = tagPattern.exec(svg);
  }
  if (stack.length > 0) throw new Error(`닫히지 않은 XML 태그 [${kind}]: ${stack.join(' > ')}`);
}

/**
 * figure 가 붙은 문항은 SVG 까지 실제로 그려 본다.
 * 좌표에 NaN/undefined 가 새는 것이 이런 렌더러의 대표적 실패이고,
 * 그건 파일을 열어 봐야 보이는 게 아니라 여기서 잡아야 한다.
 */
function assertRenderableSvg(item) {
  const svg = renderFigureSvg(item.figure);
  const kind = item.figure.kind;
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
    throw new Error(`SVG 루트 요소 오류 [${kind}]`);
  }
  for (const bad of ['NaN', 'undefined', 'Infinity', 'null']) {
    if (svg.includes(bad)) throw new Error(`SVG에 ${bad} 유출 [${kind}] params=${JSON.stringify(item.params)}`);
  }
  assertWellFormedXml(svg, kind);
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
console.log(`커버리지: ${coverage.coveredStandards}/${coverage.autoScorableStandards} 자동채점 가능 성취기준 (${(coverage.coverageRatio * 100).toFixed(1)}%)`);
console.log(`전체 ${coverage.totalStandards}개 중 ${coverage.manualOnlyStandards}개는 자동채점 불가(수행·작도)로 분모에서 제외`);
console.log(`문항이 생성되는 성취기준: ${coverage.standardsWithGenerator}개 (작도 문항은 생성되지만 채점은 사람이 한다)`);

for (const [, b] of Object.entries(coverage.bySubject)) {
  console.log(`\n  ${b.subjectKorean}  ${b.covered}/${b.autoScorable} 자동채점 기준  (수동전용 ${b.manualOnly}개, 생성기 ${b.generators}개)  전략=${b.strategy}`);
  if (b.generatable !== true) {
    // 왜 비어 있는지를 숫자 옆에 붙여 둔다. 0 이라는 숫자만으로는 이유를 알 수 없다.
    console.log(`      ${b.basis}`);
    for (const need of b.blockedBy ?? []) console.log(`      선행 자산: ${need}`);
  }
  for (const [domain, dv] of Object.entries(b.byDomain)) {
    const done = dv.autoScorable > 0 && dv.covered === dv.autoScorable;
    console.log(`      ${domain.padEnd(12)} ${String(dv.covered).padStart(2)}/${String(dv.autoScorable).padStart(2)}${done ? '  완료' : ''}`);
  }
}

// 학년군이 실제 진척 단위다. 한 학년군을 다 채우면 그 학년 학습지를 통째로 뽑을 수 있다.
console.log('\n학년군별 진척 (자동채점 기준):');
const bands = {};
for (const entry of [...coverage.covered, ...coverage.uncovered]) {
  const key = `${entry.subject} ${entry.gradeBand}`;
  bands[key] ??= { covered: 0, total: 0 };
  bands[key].total += 1;
  if (entry.generatorCount > 0) bands[key].covered += 1;
}
for (const [key, v] of Object.entries(bands).sort()) {
  const done = v.covered === v.total;
  console.log(`  ${key.padEnd(14)} ${String(v.covered).padStart(3)}/${String(v.total).padStart(3)}${done ? '   전량 완료' : ''}`);
}

if (coverage.manualOnlyStandards > 0) {
  console.log('\n자동채점 불가 성취기준:');
  for (const m of coverage.manualOnly) {
    console.log(`  ${m.code} ${m.domain} — ${m.manualReason}${m.generatorCount > 0 ? ` [문항 생성기 ${m.generatorCount}개 있음]` : " [생성기 없음]"}`);
  }
}

if (errors.length > 0) {
  console.error('\n오류 표본:');
  for (const e of errors.slice(0, 15)) console.error(`  [${e.generatorId}] d${e.difficulty ?? '-'} ${e.message}`);
  process.exitCode = 1;
}
