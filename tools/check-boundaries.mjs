/**
 * 경계 검사. 목표 불변조건 (4) 온톨로지는 성취기준 코드 인덱스로만 쓴다.
 * 생성기가 온톨로지 주제 텍스트(보일러플레이트)에 손대면 실패로 보고한다.
 */
import fs from 'node:fs';
import path from 'node:path';

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.mjs')) files.push(p.replace(/\\/g, '/'));
  }
};
walk('src');
walk('bin');
walk('tools');

const FORBIDDEN_IN_GENERATORS = ['assessmentPrompt', 'generationBasis', 'topics.json', 'provenanceEvidence'];
const violations = [];
for (const f of files.filter((x) => x.includes('/generators/'))) {
  const text = fs.readFileSync(f, 'utf8');
  for (const token of FORBIDDEN_IN_GENERATORS) {
    if (text.includes(token)) violations.push(`${f}: 온톨로지 주제 필드 '${token}' 사용`);
  }
}

const ontologyReaders = files.filter((f) => {
  const t = fs.readFileSync(f, 'utf8');
  return t.includes("ontology/source.mjs") || t.includes("ontology/spine.mjs") || t.includes("ontology/audit.mjs");
});

console.log('온톨로지를 읽는 파일 (스파인·감사 경로만이어야 한다):');
for (const f of ontologyReaders) console.log(`  ${f}`);
console.log('');
console.log(`생성기 파일 ${files.filter((x) => x.includes('/generators/')).length}개 중 주제 텍스트 사용: ${violations.length}건`);
for (const v of violations) console.log(`  ${v}`);
if (violations.length > 0) process.exitCode = 1;
