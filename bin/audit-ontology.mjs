#!/usr/bin/env node
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { auditOntology } from '../src/ontology/audit.mjs';

const corpus = loadOntology();
const audit = auditOntology(corpus);
const out = writeJson(path.join(REPO_ROOT, 'data', 'audit', 'ontology-audit.json'), audit);

console.log(`내부 코퍼스 무결성: ${audit.corpus.integrity.every((entry) => entry.matchesPin) ? '고정 해시 일치' : '불일치'}`);
console.log(`공식 별책 성취기준 코드: ${audit.officialCodeInventory.standardCount}개 일치`);
console.log('\n교과별 내부 스파인:');
for (const [slug, s] of Object.entries(audit.subjects)) {
  console.log(`  ${slug.padEnd(7)} ${s.subjectKorean} ${s.standardCount}개`);
  console.log(`    학년군 ${Object.entries(s.gradeBands).map(([band, count]) => `${band}:${count}`).join(' ')}`);
  console.log(`    내용 앵커 module:${s.contentAnchors.module} summary:${s.contentAnchors.summary} none:${s.contentAnchors.none}`);
}
console.log(`\n-> ${path.relative(REPO_ROOT, out)}`);
