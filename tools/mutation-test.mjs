#!/usr/bin/env node
/**
 * 검산을 검산한다 (뮤테이션 테스트).
 *
 * verify() 가 있다는 것과 verify() 가 실제로 무언가를 잡는다는 것은 다르다.
 * 검산이 생성 때 쓴 값을 그대로 되읽으면(answer.value === params.x) 늘 참이 되어
 * 아무것도 검증하지 않는다. 이번 저장소에서 실제로 그런 검산을 두 개 냈고,
 * 176,400문항 검산이 '0실패'로 통과하는 동안 그 검산은 무력했다.
 *
 * 방법: 정답을 의도적으로 틀리게 바꿔 verify() 에 넣는다.
 * 틀린 답을 verify() 가 참으로 받으면 그 검산은 통과 능력이 없다.
 *
 * LLM 에 생성기 저작을 맡기기 전에 이 게이트가 먼저 있어야 한다.
 * generate 와 verify 를 같은 모델이 같은 오해로 쓰면 하네스는 통과하고
 * 문항은 틀린 채로 학습지에 나간다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';

const SAMPLES = Number(process.env.SAMPLES ?? 40);

/**
 * 정답에서 '틀린 답' 후보를 만든다.
 * 진짜 정답과 같아질 수 있는 변형은 만들지 않는다. 같은 값이면 verify 가
 * 참을 돌려주는 게 맞으므로 약점 판정에 쓸 수 없다.
 */
function mutantsOf(answer) {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const key = JSON.stringify(value);
    if (key === JSON.stringify(answer.value) || seen.has(key)) return;
    seen.add(key);
    out.push({ ...answer, value });
  };

  const v = answer.value;

  if (typeof v === 'number') {
    push(v + 1);
    push(v - 1);
    push(v * 2 + 1);
    return out;
  }

  if (Array.isArray(v)) {
    if (v.length > 1) {
      push([...v].reverse());
      push([v[0], ...v.slice(2)]);
    }
    if (v.every((x) => typeof x === 'number')) push(v.map((x) => x + 1));
    return out;
  }

  if (typeof v === 'string') {
    // 대소 비교 기호는 뒤집는다.
    if (v === '>') { push('<'); return out; }
    if (v === '<') { push('>'); return out; }

    // 분수 a/b 는 분자와 분모를 각각 흔든다.
    const frac = /^(\d+)\/(\d+)$/.exec(v);
    if (frac) {
      push(`${Number(frac[1]) + 1}/${frac[2]}`);
      push(`${frac[1]}/${Number(frac[2]) + 1}`);
      push(`${frac[2]}/${frac[1]}`);
      return out;
    }

    // 대분수 'a b/c'
    const mixed = /^(\d+) (\d+)\/(\d+)$/.exec(v);
    if (mixed) {
      push(`${Number(mixed[1]) + 1} ${mixed[2]}/${mixed[3]}`);
      push(`${mixed[1]} ${Number(mixed[2]) + 1}/${mixed[3]}`);
      return out;
    }

    // 소수·정수 문자열은 수치를 흔든다. 자리수 표기는 유지한다.
    const dec = /^-?\d+(\.\d+)?$/.exec(v);
    if (dec) {
      const scale = v.includes('.') ? v.split('.')[1].length : 0;
      const asNumber = Number(v);
      const step = 10 ** -scale;
      push((asNumber + step).toFixed(scale));
      push((asNumber - step).toFixed(scale));
      push((asNumber * 10).toFixed(scale));
      return out;
    }

    // 단위가 붙은 값 '12cm', '30분' 등은 숫자 부분만 흔든다.
    const withUnit = /^(\d+(?:\.\d+)?)(\D+)$/.exec(v);
    if (withUnit) {
      const scale = withUnit[1].includes('.') ? withUnit[1].split('.')[1].length : 0;
      push(`${(Number(withUnit[1]) + 10 ** -scale).toFixed(scale)}${withUnit[2]}`);
      push(`${withUnit[1]}${withUnit[2]}X`);
      return out;
    }

    // 그 밖의 한국어 답(도형 이름·가능성 표현 등)은 문자열을 훼손한다.
    push(`${v}X`);
    if (v.length > 1) push(v.slice(0, -1));
    push('아무말');
    return out;
  }

  return out;
}

const ontology = loadOntology();
const spine = buildSpine(ontology);
const registry = createRegistry();
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

const rows = [];
let totalMutants = 0;
let totalEscaped = 0;

for (const g of registry.all()) {
  const standard = standardByCode.get(g.standardCode);
  const row = {
    generatorId: g.id,
    code: g.standardCode,
    skill: g.skill,
    mutants: 0,
    escaped: 0,
    noMutants: 0,
    examples: [],
    scoring: 'auto',
  };

  for (let n = 0; n < SAMPLES; n += 1) {
    const difficulty = (n % 3) + 1;
    let item;
    try {
      item = generateItem(g, standard, createRng(`${g.id}|mut|${n}`), difficulty);
    } catch {
      continue;
    }

    // 작도 문항은 설계상 기계 검산 대상이 아니다. 약점으로 세지 않고 따로 표시한다.
    if (item.scoring === 'manual') {
      row.scoring = 'manual';
      break;
    }

    const mutants = mutantsOf(item.answer);
    if (mutants.length === 0) {
      row.noMutants += 1;
      continue;
    }
    for (const mutant of mutants) {
      row.mutants += 1;
      totalMutants += 1;
      let accepted = false;
      try {
        accepted = g.verify(item.params, mutant) === true;
      } catch {
        accepted = false; // 던지면 거부한 것으로 본다
      }
      if (accepted) {
        row.escaped += 1;
        totalEscaped += 1;
        if (row.examples.length < 3) {
          row.examples.push({
            stem: item.stem.slice(0, 60),
            correct: JSON.stringify(item.answer.value),
            accepted: JSON.stringify(mutant.value),
          });
        }
      }
    }
  }
  row.escapeRatio = row.mutants === 0 ? null : Number((row.escaped / row.mutants).toFixed(4));
  rows.push(row);
}

const weak = rows.filter((r) => r.escaped > 0);
const manual = rows.filter((r) => r.scoring === 'manual');
const noMutant = rows.filter((r) => r.scoring === 'auto' && r.mutants === 0);

writeJson(path.join(REPO_ROOT, 'data', 'audit', 'mutation-test.json'), {
  schema: 'digi-mon/mutation-test@1',
  samplesPerGenerator: SAMPLES,
  generatorCount: registry.size,
  totalMutants,
  totalEscaped,
  weakGeneratorCount: weak.length,
  manualScoringGenerators: manual.map((r) => r.generatorId),
  rows,
});

console.log(`검산 뮤테이션 테스트: 생성기 ${registry.size}개, 틀린 답 ${totalMutants}개 주입`);
console.log(`검산이 놓친 틀린 답: ${totalEscaped}개`);
console.log(`검산이 무력한 생성기: ${weak.length}개`);
console.log(`기계 검산 대상 아님(작도): ${manual.length}개`);
if (noMutant.length > 0) {
  console.log(`변형을 만들지 못한 생성기: ${noMutant.length}개 -> ${noMutant.map((r) => r.generatorId).join(', ')}`);
}

if (weak.length > 0) {
  console.log('');
  console.log('약한 검산 (틀린 답을 정답으로 받는다):');
  for (const r of weak.sort((a, b) => b.escapeRatio - a.escapeRatio)) {
    console.log(`\n  ${r.generatorId}  ${r.code}  ${r.escaped}/${r.mutants} 통과 (${(r.escapeRatio * 100).toFixed(0)}%)`);
    for (const e of r.examples) {
      console.log(`    "${e.stem}"`);
      console.log(`      정답 ${e.correct} 인데 ${e.accepted} 도 참으로 받음`);
    }
  }
  process.exitCode = 1;
}
