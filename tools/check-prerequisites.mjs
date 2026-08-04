#!/usr/bin/env node
/**
 * 선수 관계 그래프 검증.
 * 누락·허깨비 참조·순환·학년군 역행을 잡는다. 하나라도 있으면 실패로 본다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import {
  MATH_PREREQUISITES,
  ancestorsOf,
  dependentsOf,
  learningOrder,
  validatePrerequisites,
} from '../src/curriculum/prerequisites.mjs';

const spine = buildSpine(loadOntology());
const result = validatePrerequisites(spine);
const order = learningOrder();

// 선수가 가장 많이 쌓인 기준. 가장 늦게 배우는 것들이다.
const withAncestorCount = Object.keys(MATH_PREREQUISITES)
  .map((code) => ({ code, ancestors: ancestorsOf(code).length, dependents: dependentsOf(code).length }))
  .sort((a, b) => b.ancestors - a.ancestors);

writeJson(path.join(REPO_ROOT, 'data', 'curriculum', 'prerequisites.json'), {
  schema: 'digi-mon/prerequisites@1',
  note: '이 저장소가 저작한 추천 순서다. 보편 법칙이 아니며 교과 전문가 검토 대상이다.',
  ...result,
  learningOrder: order,
  graph: MATH_PREREQUISITES,
});

console.log(`선수 관계: 성취기준 ${result.listedCount}/${result.standardCount}개, 간선 ${result.edgeCount}개`);
console.log(`학년군을 넘는 간선: ${result.crossBandEdges}개 (온톨로지는 8개였다)`);
console.log(`뿌리 기준: ${result.rootCount}개 -> ${result.roots.join(' ')}`);
console.log('');
console.log('선수가 가장 많이 쌓인 기준 (가장 늦게 배운다):');
for (const r of withAncestorCount.slice(0, 6)) {
  console.log(`  ${r.code}  선수 ${r.ancestors}개 / 이 기준에 의존하는 후속 ${r.dependents}개`);
}
console.log('');
console.log('가장 많은 후속을 막고 있는 기준 (여기서 막히면 크다):');
for (const r of [...withAncestorCount].sort((a, b) => b.dependents - a.dependents).slice(0, 6)) {
  console.log(`  ${r.code}  후속 ${r.dependents}개`);
}

if (result.problems.length > 0) {
  console.error(`\n문제 ${result.problems.length}건:`);
  for (const p of result.problems.slice(0, 25)) console.error(`  [${p.kind}] ${p.code}: ${p.message}`);
  process.exitCode = 1;
} else {
  console.log('\n검증 통과: 누락 0, 허깨비 참조 0, 순환 0, 학년군 역행 0');
}
