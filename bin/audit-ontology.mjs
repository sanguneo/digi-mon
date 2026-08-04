#!/usr/bin/env node
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { auditOntology } from '../src/ontology/audit.mjs';

const ontology = loadOntology();
const audit = auditOntology(ontology);
const out = writeJson(path.join(REPO_ROOT, 'data', 'audit', 'ontology-audit.json'), audit);

console.log(`업스트림 무결성: ${audit.integrity.every((f) => f.matchesManifest) ? 'manifest 해시 일치 (LF 기준)' : '불일치'}`);
console.log(`\n교과별 판정  (문장틀 = 자기 식별 문자열을 치환한 뒤 남는 고유 문장 골격 수)`);
for (const [slug, s] of Object.entries(audit.subjects)) {
  const f = s.topics.fields;
  console.log(`\n■ ${s.subjectKorean}  주제 ${s.topics.topicCount}개 / 성취기준 ${s.topics.standardsCovered}개`);
  console.log(`  팬아웃: ${Object.entries(s.topics.fanoutPerStandard).map(([k, v]) => `${k}개×${v}기준`).join(', ')}${s.topics.fanoutIsUniform ? '  (전 기준 균일 = 기계 생성)' : ''}`);
  for (const [name, v] of Object.entries(f)) {
    console.log(`  ${name.padEnd(17)} ${String(v.uniqueShapes).padStart(4)}틀 / ${String(v.total).padStart(4)}건  비율 ${String(v.uniqueRatio).padEnd(6)} -> ${v.verdict}`);
  }
  const d = s.dependencies;
  console.log(`  선수관계 ${d.edgeCount}간선: 기준내부 ${d.intraStandardEdges}(${((d.intraStandardRatio ?? 0) * 100).toFixed(0)}%) / 영역넘김 ${d.crossDomainEdges} / 학년군넘김 ${d.crossGradeBandEdges} -> 실위계 ${d.carriesRealHierarchy ? '있음' : '없음'}`);
  console.log(`  문항 생성에 없는 축: ${s.topics.missingGenerationAxes.map((a) => a.label).join(', ') || '없음'}`);
  console.log(`  성취기준 앵커: module ${s.standards.moduleCount}/${s.standards.standardCount}, summary 고유 ${s.standards.summaryUniqueShapes}/${s.standards.standardCount} (${s.standards.summaryVerdict}) -> 사용 가능 앵커 ${s.standards.usableAnchor}`);
  console.log(`  ▶ 활용: 코드인벤토리=${s.usage.codeInventory} / 주제내용=${s.usage.topicContent} / 성취기준앵커=${s.usage.standardAnchor} / 선수그래프=${s.usage.prerequisiteGraph}`);
}
console.log(`\n-> ${path.relative(REPO_ROOT, out)}`);
