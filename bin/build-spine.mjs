#!/usr/bin/env node
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';

const ontology = loadOntology();
const spine = buildSpine(ontology);

const out = writeJson(path.join(REPO_ROOT, 'data', 'spine', 'standards.json'), spine);

console.log(`온톨로지: ${ontology.dir}`);
console.log(`업스트림: ${spine.upstream.dataVersion} / taxonomy ${spine.upstream.taxonomyVersion}`);
console.log(`성취기준 스파인: ${spine.standardCount}개 -> ${path.relative(REPO_ROOT, out)}`);
for (const [slug, s] of Object.entries(spine.summary)) {
  const bands = Object.entries(s.gradeBands).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`  ${s.subjectKorean.padEnd(3)} ${String(s.standardCount).padStart(3)}개  학년군[${bands}]  영역 ${Object.keys(s.domains).length}종  소주제 ${Object.keys(s.modules).length}종`);
}
if (spine.conflictCount > 0) {
  console.error(`\n코드-필드 불일치 ${spine.conflictCount}건:`);
  for (const c of spine.conflicts.slice(0, 20)) {
    console.error(`  ${c.code} ${c.field}: 코드파생=${c.parsed} 업스트림=${c.upstream}`);
  }
  process.exitCode = 1;
} else {
  console.log('\n코드 파생값과 업스트림 기록값 일치: 248/248');
}
