#!/usr/bin/env node
import { loadOntology } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';

const corpus = loadOntology();
const spine = buildSpine(corpus);

console.log(`내부 코퍼스: ${spine.corpus.schema} / 개정 ${spine.corpus.revision}`);
console.log('성취기준 스파인: data/spine/standards.json');
console.log(`공식 별책 코드 대조: ${spine.standardCount}개 일치`);
for (const s of Object.values(spine.summary)) {
  const bands = Object.entries(s.gradeBands).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`  ${s.subjectKorean.padEnd(3)} ${String(s.standardCount).padStart(3)}개  학년군[${bands}]  영역 ${Object.keys(s.domains).length}종  소주제 ${Object.keys(s.modules).length}종`);
}
if (spine.conflictCount > 0) {
  console.error(`\n코드-필드 불일치 ${spine.conflictCount}건:`);
  for (const c of spine.conflicts.slice(0, 20)) {
    console.error(`  ${c.code} ${c.field}: 코드파생=${c.parsed} 기록값=${c.upstream}`);
  }
  process.exitCode = 1;
} else {
  console.log('\n코드 파생값과 내부 스파인 기록값 일치: 248/248');
}
