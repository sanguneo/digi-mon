#!/usr/bin/env node
/**
 * 문항 한국어 표기 검사.
 *
 * 이번 저장소에서 눈으로 잡은 조사 버그가 셋 있었다.
 *   '27송이을 더 받았습니다'  (송이 -> 를)
 *   '2과 1/3'                (2는 '이'로 읽으니 와)
 *   '무게 한 개의 무게가'      (문구에서 정규식으로 명사를 잘라낸 결과)
 * 셋 다 규칙으로 판정되는 오류였는데 사람이 읽어서 찾았다. 기계가 볼 수 있는
 * 것을 사람이 보고 있으면 못 본 것이 남는다.
 *
 * 이 검사기는 규칙으로 확정되는 것만 본다. 문체·자연스러움은 판정하지 않는다.
 * 그건 자산 텍스트(지문) 쪽 일이고, 문항 발문은 기계가 조립하므로 규칙으로 족하다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';
import { KOREAN_TEXT_CHECKS as CHECKS, checkAppliesTo } from '../src/engine/korean-text-checks.mjs';
import { composeSyllable, decomposeSyllable } from '../src/engine/hangul.mjs';

const SAMPLES = Number(process.env.SAMPLES ?? 60);

const ontology = loadOntology();
const spine = buildSpine(ontology);
const registry = createRegistry();
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

const byCheck = {};
for (const c of CHECKS) byCheck[c.id] = { label: c.label, count: 0, generators: new Set(), examples: [] };
let scanned = 0;

for (const g of registry.all()) {
  const standard = standardByCode.get(g.standardCode);
  for (let n = 0; n < SAMPLES; n += 1) {
    let item;
    try {
      item = generateItem(g, standard, createRng(`${g.id}|ko|${n}`), (n % 3) + 1);
    } catch {
      continue;
    }
    // 사람이 읽는 모든 문면을 검사한다. 정답 표기와 풀이도 학습지에 인쇄된다.
    const texts = [
      item.instruction,
      item.stem,
      item.answer.display,
      ...(item.solution ?? []),
      ...(item.choices ?? []).map((c) => c.text),
      item.figure?.altText,
    ].filter((t) => typeof t === 'string' && t.length > 0);

    for (const text of texts) {
      scanned += 1;
      for (const check of CHECKS) {
        if (!checkAppliesTo(check, standard.subject)) continue;
        for (const hit of check.scan(text)) {
          const bucket = byCheck[check.id];
          bucket.count += 1;
          bucket.generators.add(g.id);
          if (bucket.examples.length < 6) {
            bucket.examples.push({ generatorId: g.id, text: text.slice(0, 90), problem: hit });
          }
        }
      }
    }
  }
}

/**
 * 한글 음절 전량 분해 -> 조합 왕복 검증.
 *
 * REVIEW.md 가 "한글 음절 11,172자 전량 분해→조합 왕복 검증 통과" 를 주장해 왔는데,
 * 그 검증은 일회용 스크립트로 한 번 돌린 것이고 게이트에 없었다. composeSyllable 을
 * 아무도 부르지 않아 죽은 export 로 남아 있었다 — 주장만 있고 근거가 사라진 상태다.
 *
 * 자모 계산이 틀리면 자모 세기·사전 순서·맞춤법 문항이 조용히 어긋난다. 문면 검사보다
 * 아래층 불변식이므로 여기서 함께 본다.
 */
function checkHangulRoundTrip() {
  const FIRST = 0xac00;
  const LAST = 0xd7a3;
  const failures = [];
  for (let code = FIRST; code <= LAST; code += 1) {
    const ch = String.fromCodePoint(code);
    const parts = decomposeSyllable(ch);
    if (!parts) { failures.push({ ch, reason: '분해 실패' }); continue; }
    const back = composeSyllable(parts.initial, parts.medial, parts.final);
    if (back !== ch) failures.push({ ch, reason: `재조합 불일치: ${back}` });
  }
  return { checked: LAST - FIRST + 1, failures };
}

const hangul = checkHangulRoundTrip();

const report = {
  schema: 'digi-mon/korean-check@1',
  samplesPerGenerator: SAMPLES,
  textsScanned: scanned,
  hangulRoundTrip: { checked: hangul.checked, failures: hangul.failures.length },
  checks: Object.fromEntries(
    Object.entries(byCheck).map(([id, v]) => [id, {
      label: v.label,
      count: v.count,
      generatorCount: v.generators.size,
      generators: [...v.generators].sort(),
      examples: v.examples,
    }]),
  ),
};
writeJson(path.join(REPO_ROOT, 'data', 'audit', 'korean-check.json'), report);

const total = Object.values(byCheck).reduce((s, v) => s + v.count, 0);
console.log(`한국어 표기 검사: 문면 ${scanned}건 검사, 위반 ${total}건`);
console.log(`한글 음절 왕복: ${hangul.checked.toLocaleString('en-US')}자 분해→조합, 불일치 ${hangul.failures.length}건`);
for (const [, v] of Object.entries(byCheck)) {
  console.log(`  ${v.label.padEnd(18)} ${String(v.count).padStart(5)}건  생성기 ${v.generators.size}개`);
}

if (hangul.failures.length > 0) {
  console.log('');
  console.log('한글 자모 왕복 실패 — 자모 세기·사전 순서·맞춤법 문항이 어긋난다:');
  for (const f of hangul.failures.slice(0, 10)) console.log(`  ${f.ch}: ${f.reason}`);
  process.exitCode = 1;
}

if (total > 0) {
  console.log('');
  for (const [, v] of Object.entries(byCheck)) {
    if (v.count === 0) continue;
    console.log(`[${v.label}] ${v.count}건`);
    for (const e of v.examples) {
      console.log(`  ${e.generatorId}`);
      console.log(`    "${e.text}"`);
      console.log(`    ${e.problem}`);
    }
    console.log('');
  }
  process.exitCode = 1;
}
