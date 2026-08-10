/**
 * 경계 검사. 내부 교육과정 코퍼스는 성취기준 코드 인덱스로만 쓴다.
 * 생성기가 가져온 주제 텍스트에 손대거나 외부 저장소를 다시 요구하면 실패한다.
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

/**
 * 엔진에서 영구 제외한 클라이언트 관심사.
 *
 * PDF·인쇄 레이아웃·DOM 은 클라이언트 몫이다. 엔진은 문항과 정답, 그리고 다시
 * 그릴 수 있는 SVG spec 까지만 만든다. 결정을 주석으로만 남기면 나중에 누군가
 * (나 포함) 편의를 이유로 다시 끌어온다. 게이트로 막는다.
 *
 * tools/ 는 제외한다. 개발자가 눈으로 확인하는 도구라서 브라우저를 써도 된다.
 * 검증용 스크린샷은 산출물이 아니다.
 */
/**
 * document./window. 는 문자열 포함으로 찾으면 오탐한다 — 영어 예문 'Close the
 * window.' 의 'window.'(마침표가 문장 부호)를 브라우저 전역으로 오인했다(5차).
 * 전역 접근은 반드시 뒤에 속성 이름이 오므로 식별자가 따라올 때만 위반이다.
 */
const CLIENT_CONCERNS = [
  ['page.pdf', 'PDF 생성'],
  ['printToPDF', 'PDF 생성'],
  ['puppeteer', '브라우저 자동화'],
  ['playwright', '브라우저 자동화'],
  ['@media print', '인쇄 레이아웃'],
  [/document\.[A-Za-z_$]/, 'DOM 접근', 'document.'],
  [/window\.[A-Za-z_$]/, '브라우저 전역', 'window.'],
];

const engineFiles = files.filter((f) => f.startsWith('src/') || f.startsWith('bin/'));
for (const f of engineFiles) {
  const text = fs.readFileSync(f, 'utf8');
  for (const token of ['KELM_DIR', 'korean-elementary-learning-map']) {
    if (text.includes(token)) {
      violations.push(`${f}: 금지된 외부 교육과정 저장소 참조 '${token}'`);
    }
  }
  for (const [token, label, display] of CLIENT_CONCERNS) {
    const hit = token instanceof RegExp ? token.test(text) : text.includes(token);
    if (hit) {
      violations.push(`${f}: 엔진에서 영구 제외한 클라이언트 관심사 '${display ?? token}' (${label})`);
    }
  }
}

const corpusReaders = files.filter((f) => {
  const t = fs.readFileSync(f, 'utf8');
  return t.includes("ontology/source.mjs") || t.includes("ontology/spine.mjs") || t.includes("ontology/audit.mjs");
});

console.log('내부 교육과정 코퍼스를 읽는 파일:');
for (const f of corpusReaders) console.log(`  ${f}`);
console.log('');
console.log(`엔진 파일 ${engineFiles.length}개 중 클라이언트 관심사(PDF·DOM·인쇄) 유입: ${violations.filter((v) => v.includes('클라이언트')).length}건`);
console.log(`생성기 파일 ${files.filter((x) => x.includes('/generators/')).length}개 중 주제 텍스트 사용: ${violations.filter((v) => v.includes('주제 필드')).length}건`);
for (const v of violations) console.log(`  ${v}`);
if (violations.length > 0) process.exitCode = 1;
