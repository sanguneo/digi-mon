#!/usr/bin/env node
/**
 * 미충족 성취기준이 무엇 때문에 막혔는지 밝히는지 검사한다.
 *
 * REVIEW.md §14 가 "coverage.json 의 blockedBy 에 무엇이 필요한지 적혀 있다" 고
 * 주장했지만 미충족 55개 전부가 비어 있었다(0/55). registry 에 그 필드가 아예
 * 없었다. 문서가 없는 것을 있다고 한 것이다 — 검토자가 그 지시를 따라가면
 * 아무것도 못 본다.
 *
 * 이 게이트가 그 재발을 막는다. 생성기가 없는 기준은 무엇이 없어서 못 하는지
 * 반드시 밝혀야 한다. §7 의 '선언으로 한계를 드러내는' 패턴과 같다.
 *
 * 잡을 수 없는 것: 적어 둔 자산 요구가 실제로 그 기준을 열기에 충분한지.
 * 그건 자산을 실제로 만들어 봐야 안다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { buildCoverage, createRegistry } from '../src/engine/registry.mjs';
import { ASSET_REQUIREMENTS, assetKindCounts } from '../src/curriculum/asset-requirements.mjs';

const KINDS = new Set(['sentence', 'procedure', 'passage', 'dialogue', 'audio', 'media', 'wordlist']);

const spine = buildSpine(loadOntology());
const coverage = buildCoverage(spine, createRegistry());
const codes = new Set(spine.standards.map((s) => s.code));

const problems = [];

for (const e of coverage.uncovered) {
  const req = e.blockedBy;
  if (!req) {
    problems.push({ code: e.code, kind: 'missing', message: `미충족인데 무엇이 없어서 못 하는지 밝히지 않았다 (${e.subject} ${e.domain})` });
    continue;
  }
  if (!KINDS.has(req.kind)) {
    problems.push({ code: e.code, kind: 'bad-kind', message: `알 수 없는 조달 성격 '${req.kind}'` });
  }
  if (typeof req.need !== 'string' || req.need.trim().length === 0) {
    problems.push({ code: e.code, kind: 'empty-need', message: 'need 가 비었다' });
  }
}

// 표에는 있는데 이미 열린 기준을 가리키는 항목은 낡은 것이다.
// 미충족도 아니고 열린 것도 아니면 자동채점 불가로 분류된 기준이다 — 자산 요구가
// 있으면 분류와 조달 선언이 모순이다. 5차 검토가 이 부류 4건([4국03-05] 등)을
// 잡았다. 앞 루프는 '미충족 → 선언'만 봐서 반대 방향의 과잉 선언을 놓쳤다.
const uncoveredCodes = new Set(coverage.uncovered.map((e) => e.code));
const coveredCodes = new Set(coverage.covered.map((e) => e.code));
for (const code of Object.keys(ASSET_REQUIREMENTS)) {
  if (!codes.has(code)) {
    problems.push({ code, kind: 'unknown-code', message: '스파인에 없는 성취기준이다' });
    continue;
  }
  if (coveredCodes.has(code)) {
    problems.push({ code, kind: 'stale', message: '이미 생성기가 있는데 자산 요구가 남아 있다' });
  } else if (!uncoveredCodes.has(code)) {
    problems.push({ code, kind: 'not-openable', message: '자동채점 불가로 분류된 기준인데 자산 요구가 있다 — 분류와 선언이 모순이다' });
  }
}

const counts = assetKindCounts();
writeJson(path.join(REPO_ROOT, 'data', 'audit', 'asset-requirements-check.json'), {
  schema: 'digi-mon/asset-requirements-check@1',
  note: '적어 둔 자산 요구가 그 기준을 열기에 충분한지는 이 게이트가 판정하지 않는다.',
  uncoveredCount: coverage.uncovered.length,
  declaredCount: Object.keys(ASSET_REQUIREMENTS).length,
  byKind: counts,
  problemCount: problems.length,
  problems,
});

console.log(`자산 요구 검사: 미충족 ${coverage.uncovered.length}개, 선언 ${Object.keys(ASSET_REQUIREMENTS).length}개`);
console.log(`조달 성격별: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`밝히지 않은 기준: ${problems.length}건`);

if (problems.length > 0) {
  console.log('');
  for (const p of problems.slice(0, 20)) console.log(`  [${p.kind}] ${p.code}: ${p.message}`);
  process.exitCode = 1;
}
