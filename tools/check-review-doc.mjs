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

// 파일 지도의 게이트 수도 대조한다. 이 숫자가 낡아 외부 검토를 통과했다.
const toolFiles = fs.readdirSync(path.join(REPO_ROOT, 'tools')).filter((f) => f.endsWith('.mjs'));
// 자기 자신도 게이트이므로 함께 센다. 검사기가 스스로를 빼면 그 수치가 또 낡는다.
const gateFiles = toolFiles.filter((f) => f.startsWith('check-') || f === 'mutation-test.mjs');
const gateCount = gateFiles.length;
const gateClaim = `게이트 ${gateCount}종`;
const gateStale = !doc.includes(gateClaim);

console.log(`REVIEW.md 대조: 필수 문자열 ${expected.length - missing.length}/${expected.length} 일치`);
console.log(`0이어야 하는 값: ${mustBeZero.length - nonZero.length}/${mustBeZero.length} 정상`);
console.log(`tools/ 게이트 수 주장(${gateClaim}): ${gateStale ? '문서에 없음' : '일치'}`);

if (missing.length > 0) {
  console.log('\n문서에 없는(낡은) 수치:');
  for (const [label, s] of missing) console.log(`  ${label} -> 실제 '${s}'`);
}
if (nonZero.length > 0) {
  console.log('\n0이 아닌 값 (문서의 "위반 0" 주장이 거짓):');
  for (const [label, n] of nonZero) console.log(`  ${label} = ${n}`);
}

if (missing.length > 0 || nonZero.length > 0 || gateStale) process.exitCode = 1;
