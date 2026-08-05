#!/usr/bin/env node
/**
 * 선언한 난이도가 실제로 어려운지 검사한다.
 *
 * difficulty 1/2/3 은 내가 손으로 정한 값이다. 실제 정답률로 재지 않았으니
 * 지금은 장식일 수도 있다. 아이들 응답 데이터가 없는 상태에서 무엇을 잴 수 있는가.
 *
 * 잴 수 있는 것: 문항이 요구하는 계산의 크기.
 *   - 다루는 수의 크기 (자리수)
 *   - 계산 단계 수 (풀이 단계 개수)
 *   - 선택지에서 정답을 고를 확률(선택지 수)
 * 이 셋은 난이도의 대리 지표이고, 정답률과 같은 것은 아니다. 그래서 이 게이트는
 * '난이도가 오르는데 지표가 전혀 안 움직이는' 생성기만 잡는다. 실제 정답률은
 * engine/response-log.mjs 가 응답 데이터를 받은 뒤에 판정한다.
 *
 * 이 게이트가 통과한다고 난이도가 옳다는 뜻은 아니다. 난이도가 아무 뜻도 없는
 * 경우를 배제할 뿐이다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';

const SAMPLES = Number(process.env.SAMPLES ?? 80);

/** 문항이 요구하는 계산의 크기를 재는 대리 지표. */
function complexityOf(item) {
  // 발문·정답에 나오는 수의 최대 자리수
  const numbers = `${item.stem} ${item.answer.display}`.match(/\d+/g) ?? [];
  const maxMagnitude = numbers.length === 0 ? 0 : Math.max(...numbers.map((n) => n.length));
  // 풀이 단계 수. 여러 단계를 거치는 문항이 더 어렵다.
  const steps = item.solution.length;
  // 파라미터 값의 크기 합. 같은 연산이라도 수가 크면 손이 더 간다.
  const paramMagnitude = Object.values(item.params ?? {})
    .filter((v) => typeof v === 'number' && Number.isFinite(v))
    .reduce((s, v) => s + Math.abs(v), 0);
  return { maxMagnitude, steps, paramMagnitude };
}

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

const rows = [];
const skipped = { single: [], categorical: [] };

for (const g of registry.all()) {
  const standard = standardByCode.get(g.standardCode);
  const axis = g.difficultyAxis ?? 'numeric';

  // 난이도 축을 선언한 생성기는 이 게이트의 판정 대상이 아니다.
  //   single       난이도 구분이 없다고 선언했다.
  //   categorical  범주로 갈린다고 선언하고 무엇이 달라지는지 difficultyNote 에 적었다.
  // 계산 크기로 재는 이 지표는 numeric 축만 판정할 수 있다.
  if (axis !== 'numeric') {
    skipped[axis].push({ generatorId: g.id, code: g.standardCode, note: g.difficultyNote ?? null });
    continue;
  }

  const byDifficulty = {};

  for (const difficulty of [1, 2, 3]) {
    const samples = [];
    for (let n = 0; n < SAMPLES; n += 1) {
      try {
        samples.push(complexityOf(generateItem(g, standard, createRng(`${g.id}|diff|${difficulty}|${n}`), difficulty)));
      } catch {
        // 생성 실패는 verify-generators 가 잡는다. 여기서는 넘어간다.
      }
    }
    if (samples.length === 0) continue;
    const mean = (pick) => Number((samples.reduce((s, x) => s + pick(x), 0) / samples.length).toFixed(3));
    byDifficulty[difficulty] = {
      samples: samples.length,
      maxMagnitude: mean((x) => x.maxMagnitude),
      steps: mean((x) => x.steps),
      paramMagnitude: mean((x) => x.paramMagnitude),
    };
  }

  const levels = Object.keys(byDifficulty).map(Number).sort();
  if (levels.length < 2) continue;

  // 난이도가 오를 때 세 지표 중 하나라도 의미 있게 오르면 난이도가 뜻을 가진다.
  const first = byDifficulty[levels[0]];
  const last = byDifficulty[levels.at(-1)];
  const moved = (a, b) => b > a * 1.05 || b > a + 0.3;
  const meaningful = moved(first.maxMagnitude, last.maxMagnitude)
    || moved(first.steps, last.steps)
    || moved(first.paramMagnitude, last.paramMagnitude);

  rows.push({
    generatorId: g.id,
    code: g.standardCode,
    skill: g.skill,
    byDifficulty,
    meaningful,
  });
}

const flat = rows.filter((r) => !r.meaningful);

writeJson(path.join(REPO_ROOT, 'data', 'audit', 'difficulty-check.json'), {
  schema: 'digi-mon/difficulty-check@1',
  note: '계산 크기 대리 지표다. 실제 정답률이 아니다. 응답 데이터가 쌓이면 response-log 가 판정한다.',
  samplesPerLevel: SAMPLES,
  numericGeneratorCount: rows.length,
  flatCount: flat.length,
  declaredSingle: skipped.single,
  declaredCategorical: skipped.categorical,
  rows,
});

console.log(`난이도 지표 검사: numeric 축 ${rows.length}개 (난이도별 표본 ${SAMPLES})`);
console.log(`난이도 구분 없음(single) 선언: ${skipped.single.length}개`);
console.log(`범주형(categorical) 선언: ${skipped.categorical.length}개 — 무엇이 달라지는지 difficultyNote 에 적혀 있다`);
console.log(`난이도가 올라도 계산 크기가 움직이지 않는 numeric 생성기: ${flat.length}개`);

if (flat.length > 0) {
  console.log('');
  console.log('난이도가 뜻을 갖지 못하는 생성기 (파라미터 범위를 넓히거나 난이도를 없애야 한다):');
  for (const r of flat) {
    const d = Object.entries(r.byDifficulty)
      .map(([k, v]) => `d${k}(자리수 ${v.maxMagnitude}, 단계 ${v.steps}, 크기 ${v.paramMagnitude})`)
      .join(' → ');
    console.log(`  ${r.generatorId}  ${r.code}`);
    console.log(`    ${d}`);
  }
  process.exitCode = 1;
}
