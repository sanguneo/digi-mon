#!/usr/bin/env node
/**
 * REVIEW.md 의 수치가 실제 산출물과 맞는지 대조한다.
 *
 * 이 검사가 필요한 이유: 문서의 수치는 게이트가 갱신해 주지 않는다. 생성기를 하나
 * 추가하면 §2 의 열 몇 개 숫자가 동시에 낡는다. 이 세션에서 §11 의 '게이트 6종'이
 * 낡은 채로 남아 외부 검토자도 못 잡았고, §16 을 붙인 직후 §2 의 13개 수치가 낡았다.
 *
 * 문서를 검토 자료로 쓰려면 문서도 검사 대상이어야 한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../src/ontology/source.mjs';

const rd = (p) => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'));
const doc = fs.readFileSync(path.join(REPO_ROOT, 'REVIEW.md'), 'utf8');

const cov = rd('data/coverage/coverage.json');
const gen = rd('data/audit/generator-verification.json');
const mut = rd('data/audit/mutation-test.json');
const dif = rd('data/audit/difficulty-check.json');
const cap = rd('data/audit/capacity-check.json');
const kor = rd('data/audit/korean-check.json');
const voc = rd('data/audit/vocabulary-check.json');
const pre = rd('data/curriculum/prerequisites.json');

const thousands = (n) => n.toLocaleString('en-US');

/** 문서에 반드시 있어야 하는 문자열. 실제 산출물에서 만든다. */
const expected = [
  ['커버리지', `${cov.coveredStandards}/${cov.autoScorableStandards}`],
  ['문항 생성 가능', `${cov.standardsWithGenerator} 성취기준`],
  ['자동채점 불가', `${cov.manualOnlyStandards} 성취기준`],
  ['생성기 수', `생성기 ${gen.results.length}개`],
  ['SVG 렌더', thousands(gen.figuresRendered)],
  ['뮤테이션 주입', thousands(mut.totalMutants)],
  ['한국어 문면', thousands(kor.textsScanned)],
  ['어휘 문항', thousands(voc.itemsChecked)],
  ['어휘 낱말', thousands(voc.wordsChecked)],
  ['용량 포화', `포화 ${cap.saturatedCount}/${cap.generatorCount}`],
  ['관측 용량', thousands(cap.observedCapacity)],
  ['난이도 축', `numeric ${dif.numericGeneratorCount} / single ${dif.declaredSingle.length} / categorical ${dif.declaredCategorical.length}`],
  ['선수 간선', `간선 ${pre.edgeCount}`],
  ['학년군 넘김', `학년군 넘김 ${pre.crossBandEdges}`],
  ['수학 커버리지', `${cov.bySubject.math.covered}/${cov.bySubject.math.autoScorable}`],
  ['국어 커버리지', `${cov.bySubject.korean.covered}/${cov.bySubject.korean.autoScorable}`],
  ['영어 커버리지', `${cov.bySubject.english.covered}/${cov.bySubject.english.autoScorable}`],
];

/** 문서에 있으면 안 되는 것. 0이어야 하는 값을 0이 아니라고 적으면 잡는다. */
const mustBeZero = [
  ['검산 실패', gen.totalFailed],
  ['뮤테이션 통과', mut.totalEscaped],
  ['난이도 평평', dif.flatCount],
  ['용량 미신고', cap.thinCount],
  ['어휘 위반', voc.violationCount],
  ['한국어 위반', Object.values(kor.checks).reduce((s, x) => s + x.count, 0)],
  ['선수 문제', pre.problems.length],
];

const missing = expected.filter(([, s]) => !doc.includes(s));
const nonZero = mustBeZero.filter(([, n]) => n !== 0);

/**
 * 게이트가 실제로 verify 체인에 등록됐는지 본다.
 *
 * 파일 수만 세면 뚫린다. 체인에서 게이트 하나를 지워도 tools/ 의 파일 수는 그대로라
 * 통과하고, 그 게이트가 돌지 않으니 낡은 data/audit/*.json 이 수치 대조까지 계속
 * 만족시킨다. check-difficulty 를 등록하지 않은 채 '열두 게이트 통과'라고 두 번
 * 커밋한 사고의 재발 경로가 검사기 안에 남아 있었다.
 *
 * 그래서 세 가지를 함께 본다.
 *   1. 게이트 파일 전부가 체인에 있는가
 *   2. 체인에 게이트가 아닌 것이 섞여 있지 않은가
 *   3. 문서의 게이트 총수 주장이 체인 길이와 맞는가
 */
const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
const chain = pkg.scripts.verify.split('&&').map((c) => c.trim().replace(/^node\s+/, ''));

const toolFiles = fs.readdirSync(path.join(REPO_ROOT, 'tools')).filter((f) => f.endsWith('.mjs'));
const toolGates = toolFiles
  .filter((f) => f.startsWith('check-') || f === 'mutation-test.mjs')
  .map((f) => `tools/${f}`);
const binGates = ['bin/build-spine.mjs', 'bin/audit-ontology.mjs', 'bin/verify-generators.mjs'];
const allGates = [...binGates, ...toolGates];

/**
 * 체인에 있지만 게이트가 아닌 항목.
 * 산출물을 만드는 스크립트는 실패할 수 없으므로 게이트가 아니다. 게이트로 세면
 * 문서의 '열두 게이트' 총수가 어긋난다.
 */
const chainNonGates = [
  'tools/export-review-tables.mjs',
  'tools/export-asset-tables.mjs',
  'tools/export-math-tables.mjs',
];

const notInChain = allGates.filter((g) => !chain.includes(g));
const extraInChain = chain.filter((c) => !allGates.includes(c) && !chainNonGates.includes(c));
const gateChain = chain.filter((c) => allGates.includes(c));

// tools/ 게이트 수 주장 (파일 지도 §11)
const gateClaim = `게이트 ${toolGates.length}종`;
const gateStale = !doc.includes(gateClaim);

/** 게이트 총수는 문서에 한국어 수사로 적혀 있다. */
const COUNT_WORDS = {
  9: '아홉', 10: '열', 11: '열한', 12: '열두', 13: '열세', 14: '열네', 15: '열다섯',
  16: '열여섯', 17: '열일곱', 18: '열여덟', 19: '열아홉', 20: '스무',
};
const totalWord = COUNT_WORDS[gateChain.length];
const totalClaim = totalWord ? `${totalWord} 게이트` : null;
const totalStale = totalClaim === null || !doc.includes(totalClaim);

console.log(`REVIEW.md 대조: 필수 문자열 ${expected.length - missing.length}/${expected.length} 일치`);
console.log(`0이어야 하는 값: ${mustBeZero.length - nonZero.length}/${mustBeZero.length} 정상`);
console.log(`tools/ 게이트 수 주장(${gateClaim}): ${gateStale ? '문서에 없음' : '일치'}`);
console.log(`verify 체인 ${chain.length}단계 (게이트 ${gateChain.length} + 산출물 생성 ${chain.length - gateChain.length}) · 게이트 파일 ${allGates.length}개 · 미등록 ${notInChain.length}개`);
console.log(`문서 게이트 총수 주장(${totalClaim ?? '수사 없음'}): ${totalStale ? '불일치' : '일치'}`);

if (missing.length > 0) {
  console.log('\n문서에 없는(낡은) 수치:');
  for (const [label, s] of missing) console.log(`  ${label} -> 실제 '${s}'`);
}
if (nonZero.length > 0) {
  console.log('\n0이 아닌 값 (문서의 "위반 0" 주장이 거짓):');
  for (const [label, n] of nonZero) console.log(`  ${label} = ${n}`);
}

if (notInChain.length > 0) {
  console.log('\nverify 체인에 등록되지 않은 게이트 (돌지 않으므로 낡은 산출물이 대조를 통과시킨다):');
  for (const g of notInChain) console.log(`  ${g}`);
}
if (extraInChain.length > 0) {
  console.log('\n체인에 있지만 게이트로 인식되지 않는 항목:');
  for (const c of extraInChain) console.log(`  ${c}`);
}
if (totalStale) {
  console.log(`\n문서의 게이트 총수 주장이 체인 안 게이트 수(${gateChain.length})와 맞지 않는다.`);
  console.log(`  문서에 '${totalClaim ?? `${chain.length}개 게이트`}' 가 있어야 한다.`);
}

if (missing.length > 0 || nonZero.length > 0 || gateStale
  || notInChain.length > 0 || extraInChain.length > 0 || totalStale) {
  process.exitCode = 1;
}
