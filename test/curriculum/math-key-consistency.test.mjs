import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';

// dedupeKey 는 '같은 문제인가'의 정의다. 리뷰마다 같은 종류(문제에 안 쓰이는 값이 키에 들어감,
// 계산이 다른 성분이 키에서 빠짐)가 하나씩 더 나와서, 수학 생성기 전부에 대해 두 방향을 함께 본다.
//
// 1) 문제가 같으면 키도 같다. 보이는 문제 = (지시문, 본문, 그림, 정답 집합). 객관식은 보기 순서와
//    오답 보기가 아니라 정답 보기의 내용으로 본다.
//    - seed 표본: 난이도마다 SEEDS 개를 만들어 보이는 문제가 겹치는 쌍의 키를 비교한다.
//    - 난수 하나 바꾸기: 난이도마다 PERTURB_SEEDS 개의 seed 에서 난수 호출을 하나씩만 다른 값으로
//      바꿔 다시 만든다. 문제는 그대로인데 키가 바뀌면 쓰이지 않는 난수가 키에 들어간 것이다.
//      seed 표본만으로는 큰 수 범위에서 같은 문제가 거의 다시 나오지 않아 이 경우를 놓친다.
// 2) 키가 같으면 계산도 같다. 계산 = (지시문, 본문에 나온 수의 종류, 그림 자료의 수, 정답의 수).
//    본문에서 이미 나온 수를 물음에서 다시 말하는 것(예: '23명씩 탈 때')은 말버릇이므로 수의 종류만 본다.
//    이름·물건·단위 같은 맥락 낱말만 다른 문제는 이전 리뷰(맥락 명사 키) 기준대로 같은 문항이므로
//    낱말은 비교하지 않는다. 학년 이름의 숫자(5학년)는 수량이 아니라 이름이다.
//
// 표본 크기: 생성기당 최대 6,000개(난이도 3 × 2,000) + 섭동 기준 seed 900개의 모든 난수 호출.
// 수정 전 코드(9d66dd8)에서 이 크기로 리뷰 2건을 포함한 9개 생성기가 걸렸고, 전 생성기를 한 번에 20초
// 안팎에 끝난다. 드물게 걸리는 경우는 표본을 늘린 일회성 실행(난이도당 seed 20,000개, 섭동 1,500개)으로
// 따로 찾아 고쳤다(docs/math-content-delta-review.md).
const SEEDS = 2000;
const PERTURB_SEEDS = 300;

const spine = buildSpine(loadOntology());
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));
const registry = createRegistry();
const mathGenerators = registry.all().filter((g) => g.id.startsWith('math.'));
const levelsOf = (g) => g.difficulties ?? (g.difficultyAxis === 'single' ? [1] : [1, 2, 3]);

/**
 * createRng 과 같은 수열을 내되 perturbAt 번째 난수 하나만 다른 수열의 값으로 바꾼다.
 * 원래 수열은 그대로 소비하므로 그 뒤의 난수는 바뀌지 않는다. perturbAt < 0 이면 createRng 과 같다.
 * 메서드 모양은 src/engine/rng.mjs 와 같아야 하며, 아래 테스트가 섭동 없는 결과를 createRng 과 맞춰 본다.
 */
function replayRng(seed, perturbAt, variant = 0) {
  const base = createRng(seed);
  const alt = createRng(`${seed}|alt|${perturbAt}|${variant}`);
  let calls = 0;
  const next = () => {
    const original = base.float();
    const other = alt.float();
    const value = calls === perturbAt ? other : original;
    calls += 1;
    return value;
  };
  const rng = {
    seed: String(seed),
    float: next,
    int(min, max) {
      if (max < min) throw new Error(`int 범위 오류: ${min}..${max}`);
      return min + Math.floor(next() * (max - min + 1));
    },
    bool(p = 0.5) {
      return next() < p;
    },
    pick(arr) {
      if (!Array.isArray(arr) || arr.length === 0) throw new Error('pick: 빈 배열');
      return arr[Math.floor(next() * arr.length)];
    },
    weighted(entries) {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [value, w] of entries) {
        r -= w;
        if (r <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    until(produce, predicate, tries = 200) {
      for (let i = 0; i < tries; i += 1) {
        const v = produce();
        if (predicate(v)) return v;
      }
      throw new Error(`until: ${tries}회 내에 조건을 만족하는 값을 만들지 못했다`);
    },
  };
  return { rng, calls: () => calls };
}

const correctChoices = (raw) => raw.choices.filter((c) => c.correct).map((c) => c.text);
const answerSet = (raw) => (raw.choices ? correctChoices(raw) : (raw.answer?.accepts ?? [raw.answer?.value]).map(String)).sort();
const shownProblem = (raw) => JSON.stringify([raw.instruction, raw.stem, raw.figure ?? null, answerSet(raw)]);

const numbersIn = (value) => (JSON.stringify(value ?? '').replace(/\d+(?=학년)/g, '').match(/\d+(?:\.\d+)?/g) ?? [])
  .map(Number)
  .sort((p, q) => p - q);
const answerCore = (raw) => {
  const text = raw.choices ? correctChoices(raw).join('|') : String(raw.answer?.value);
  return /\d/.test(text) ? numbersIn(text) : text;
};
const computation = (raw) => JSON.stringify([
  raw.instruction, [...new Set(numbersIn(raw.stem))], numbersIn(raw.figure?.spec), answerCore(raw),
]);

function generate(generator, rng, difficulty) {
  return generator.generate(rng, { difficulty, standard: standardByCode.get(generator.standardCode) });
}

/** 난수 하나만 바꾼 변형 중 보이는 문제가 같은데 키가 다른 것을 모은다. */
function perturbedKeySplits(generator, seed, difficulty, variants = 1) {
  const plain = replayRng(seed, -1);
  const raw = generate(generator, plain.rng, difficulty);
  const shown = shownProblem(raw);
  const splits = [];
  let sameProblem = 0;
  const sameProblemParams = [];
  for (let at = 0; at < plain.calls(); at += 1) {
    for (let variant = 0; variant < variants; variant += 1) {
      let other;
      try {
        other = generate(generator, replayRng(seed, at, variant).rng, difficulty);
      } catch {
        continue; // 바꾼 난수로 조건을 못 맞춘 변형은 문제가 없으므로 비교하지 않는다.
      }
      if (shownProblem(other) !== shown) continue;
      sameProblemParams.push(other.params);
      if (other.dedupeKey !== raw.dedupeKey) splits.push({ at, from: raw.dedupeKey, to: other.dedupeKey });
    }
  }
  return { raw, splits, sameProblemParams };
}

test('섭동 rng 는 바꾸지 않으면 createRng 과 같은 문항을 만든다', () => {
  for (const generator of mathGenerators) {
    for (const difficulty of levelsOf(generator)) {
      const seed = `replay:${difficulty}`;
      const expected = generate(generator, createRng(seed), difficulty);
      const actual = generate(generator, replayRng(seed, -1).rng, difficulty);
      assert.deepEqual(actual, expected, generator.id);
    }
  }
});

test('[4수04-03] 합계의 차를 묻는 두 자료 문항은 쓰지 않는 때 번호로 다른 문항이 되지 않는다', () => {
  const generator = registry.get('math.g34.gd.s04-03.two-series');
  const { raw, splits, sameProblemParams } = perturbedKeySplits(generator, 0, 2, 10);
  assert.equal(raw.params.kind, 'total-diff');
  assert.equal(raw.params.t, 4);
  // t 를 뽑는 난수를 바꾼 변형(리뷰 반례는 t = 0)도 같은 문제로 나온다.
  assert.ok(sameProblemParams.some((params) => params.t !== 4));
  assert.deepEqual(splits, []);
});

test('수학 생성기 키 일관성: 보이는 문제가 같으면 키가 같고, 키가 같으면 계산이 같다', () => {
  assert.equal(mathGenerators.length, 265);
  const failures = [];
  for (const generator of mathGenerators) {
    const keyByShown = new Map();
    const computationByKey = new Map();
    for (const difficulty of levelsOf(generator)) {
      for (let s = 0; s < SEEDS; s += 1) {
        const raw = generate(generator, createRng(`keyprop:${difficulty}:${s}`), difficulty);
        const shown = shownProblem(raw);
        const knownKey = keyByShown.get(shown);
        if (knownKey === undefined) keyByShown.set(shown, raw.dedupeKey);
        else if (knownKey !== raw.dedupeKey) failures.push(`${generator.id} 같은 문제 다른 키: ${knownKey} | ${raw.dedupeKey}`);
        const comp = computation(raw);
        const knownComp = computationByKey.get(raw.dedupeKey);
        if (knownComp === undefined) computationByKey.set(raw.dedupeKey, comp);
        else if (knownComp !== comp) failures.push(`${generator.id} 같은 키 다른 계산: ${raw.dedupeKey} | ${knownComp} | ${comp}`);
      }
      for (let s = 0; s < PERTURB_SEEDS; s += 1) {
        const { splits } = perturbedKeySplits(generator, `keyprop-perturb:${difficulty}:${s}`, difficulty);
        for (const split of splits) failures.push(`${generator.id} 쓰지 않는 난수가 키를 바꿈: ${split.from} | ${split.to}`);
      }
    }
  }
  const byGenerator = new Map();
  for (const line of failures) {
    const id = line.split(' ')[0];
    if (!byGenerator.has(id)) byGenerator.set(id, line);
  }
  assert.deepEqual([...byGenerator.values()], []);
});
