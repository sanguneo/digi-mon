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
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';
import { normalizeResponse } from '../src/server/grade.mjs';

const SAMPLES = Number(process.env.SAMPLES ?? 40);

/**
 * 정답에서 '틀린 답' 후보를 만든다.
 * 진짜 정답과 같아질 수 있는 변형은 만들지 않는다. 같은 값이면 verify 가
 * 참을 돌려주는 게 맞으므로 약점 판정에 쓸 수 없다.
 */
export function mutantsOf(answer) {
  const out = [];
  const seen = new Set();
  // accepts 는 허용 답안의 정의다. 여기 있는 값은 틀린 답이 아니므로 변형에서 뺀다.
  // 예: '나는 어제 학교에 갔다.' 에서 마침표를 지운 형태는 오답이 아니라 같은 정답이다.
  const accepted = new Set((answer.accepts ?? []).map(normalizeResponse));
  const push = (value) => {
    const key = JSON.stringify(value);
    if (key === JSON.stringify(answer.value) || seen.has(key)) return;
    if ((typeof value === 'string' || typeof value === 'number')
      && accepted.has(normalizeResponse(String(value)))) return;
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

export function evaluateGenerator(g, standard, { samples = SAMPLES } = {}) {
  const row = {
    generatorId: g.id,
    code: g.standardCode,
    skill: g.skill,
    mutants: 0,
    escaped: 0,
    noMutants: 0,
    examples: [],
    scoring: 'auto',
    autoSamples: 0,
    manualSamples: 0,
  };

  for (let n = 0; n < samples; n += 1) {
    const difficulty = (n % 3) + 1;
    let item;
    try {
      item = generateItem(g, standard, createRng(`${g.id}|mut|${n}`), difficulty);
    } catch {
      continue;
    }

    // 작도 문항은 설계상 기계 검산 대상이 아니다. 약점으로 세지 않고 따로 표시한다.
    if (item.scoring === 'manual') {
      row.manualSamples += 1;
      continue;
    }
    row.autoSamples += 1;

    const mutants = mutantsOf(item.answer);
    if (mutants.length === 0) {
      row.noMutants += 1;
      continue;
    }
    for (const mutant of mutants) {
      row.mutants += 1;
      let accepted = false;
      try {
        accepted = g.verify(item.params, mutant) === true;
      } catch {
        accepted = false; // 던지면 거부한 것으로 본다
      }
      if (accepted) {
        row.escaped += 1;
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
  if (row.autoSamples === 0 && row.manualSamples > 0) row.scoring = 'manual';
  row.escapeRatio = row.mutants === 0 ? null : Number((row.escaped / row.mutants).toFixed(4));
  return row;
}

export function mutationGateFailures(rows) {
  return rows.flatMap((row) => {
    if (row.escaped > 0) return [{ generatorId: row.generatorId, reason: 'weak', row }];
    if (row.scoring === 'auto' && row.mutants === 0) {
      return [{ generatorId: row.generatorId, reason: 'no-mutants', row }];
    }
    return [];
  });
}

export function runMutationTest({ samples = SAMPLES } = {}) {
  const ontology = loadOntology();
  const spine = buildSpine(ontology);
  const registry = createRegistry();
  const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));
  const rows = registry.all().map((generator) =>
    evaluateGenerator(generator, standardByCode.get(generator.standardCode), { samples }));
  const totalMutants = rows.reduce((sum, row) => sum + row.mutants, 0);
  const totalEscaped = rows.reduce((sum, row) => sum + row.escaped, 0);
  const manual = rows.filter((row) => row.scoring === 'manual');
  const failures = mutationGateFailures(rows);
  const weak = failures.filter((failure) => failure.reason === 'weak').map((failure) => failure.row);
  const noMutant = failures.filter((failure) => failure.reason === 'no-mutants').map((failure) => failure.row);

  writeJson(path.join(REPO_ROOT, 'data', 'audit', 'mutation-test.json'), {
    schema: 'digi-mon/mutation-test@2',
    samplesPerGenerator: samples,
    generatorCount: registry.size,
    totalMutants,
    totalEscaped,
    weakGeneratorCount: weak.length,
    noMutantGeneratorCount: noMutant.length,
    manualScoringGenerators: manual.map((row) => row.generatorId),
    rows,
  });

  console.log(`검산 뮤테이션 테스트: 생성기 ${registry.size}개, 틀린 답 ${totalMutants}개 주입`);
  console.log(`검산이 놓친 틀린 답: ${totalEscaped}개`);
  console.log(`검산이 무력한 생성기: ${weak.length}개`);
  console.log(`변형을 만들지 못한 자동 생성기: ${noMutant.length}개`);
  console.log(`기계 검산 대상 아님(작도): ${manual.length}개`);

  if (weak.length > 0) {
    console.log('');
    console.log('약한 검산 (틀린 답을 정답으로 받는다):');
    for (const row of weak.sort((a, b) => b.escapeRatio - a.escapeRatio)) {
      console.log(`\n  ${row.generatorId}  ${row.code}  ${row.escaped}/${row.mutants} 통과 (${(row.escapeRatio * 100).toFixed(0)}%)`);
      for (const example of row.examples) {
        console.log(`    "${example.stem}"`);
        console.log(`      정답 ${example.correct} 인데 ${example.accepted} 도 참으로 받음`);
      }
    }
  }
  if (noMutant.length > 0) {
    console.log(`변형 생성 불가: ${noMutant.map((row) => row.generatorId).join(', ')}`);
  }
  if (failures.length > 0) process.exitCode = 1;
  return { rows, failures, totalMutants, totalEscaped };
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runMutationTest();
}
