import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { normalizeResponse } from '../../src/server/grade.mjs';
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
//    - 관찰 순서만 바꾸기: 쉼표로 늘어놓은 자료(조사 결과, 평균을 낼 기록, 후보 수)는 순서를 바꿔도
//      같은 문제다. seed 표본에서 항목 자리만 다른 문제끼리 키를 비교하고, ORDER_SEEDS 개의 seed 에서
//      이웃한 난수 한두 개씩을 서로 맞바꿔(섞기 순서가 바뀐다) 다시 만든 변형도 비교한다.
//      늘어놓은 순서가 곧 문제인 수열(□나 ...가 항목인 줄)은 뺀다.
// 2) 키가 같으면 계산도 같다. 계산 = (지시문, 본문에 나온 수의 종류, 그림 자료의 수, 정답의 수).
//    본문에서 이미 나온 수를 물음에서 다시 말하는 것(예: '23명씩 탈 때')은 말버릇이므로 수의 종류만 본다.
//    이름·물건·단위 같은 맥락 낱말만 다른 문제는 이전 리뷰(맥락 명사 키) 기준대로 같은 문항이므로
//    낱말은 비교하지 않는다. 학년 이름의 숫자(5학년)는 수량이 아니라 이름이다.
//
// 표본 크기: 생성기당 최대 6,000개(난이도 3 × 2,000) + 섭동 기준 seed 900개의 모든 난수 호출
// + 관찰 순서 섭동 기준 seed 300개의 이웃 난수 맞바꿈. 수정 전 코드(9d66dd8)에서 리뷰 2건을 포함한
// 9개 생성기가, 관찰 순서 비교를 더한 뒤 수정 전 코드(8ab28c5)에서 리뷰 2건을 포함한 11개 생성기가
// 걸렸다. 전 생성기를 한 번에 40초 안팎에 끝난다. 드물게 걸리는 경우는 표본을 늘린 일회성 실행(난이도당 seed 20,000개, 섭동 1,500개)으로
// 따로 찾아 고쳤다(docs/math-content-delta-review.md).
const SEEDS = 2000;
const PERTURB_SEEDS = 300;
const ORDER_SEEDS = 100;

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
  return rngFrom(seed, (call) => {
    const original = base.float();
    const other = alt.float();
    return call === perturbAt ? other : original;
  });
}

/**
 * createRng 과 같은 수열에서 at 번째부터 length 개와 그 바로 뒤 length 개를 맞바꾼 수열.
 * 섞기(shuffle) 안의 난수를 맞바꾸면 늘어놓는 순서만 바뀐 변형이 나온다.
 */
function swappedRng(seed, at, length) {
  const base = createRng(seed);
  const values = [];
  const valueAt = (index) => {
    while (values.length <= index) values.push(base.float());
    return values[index];
  };
  return rngFrom(seed, (call) => {
    if (call >= at && call < at + length) return valueAt(call + length);
    if (call >= at + length && call < at + 2 * length) return valueAt(call - length);
    return valueAt(call);
  });
}

/** valueOf(호출 번호)로 난수를 내는 rng. 메서드 모양은 src/engine/rng.mjs 와 같다. */
function rngFrom(seed, valueOf) {
  let calls = 0;
  const next = () => {
    const value = valueOf(calls);
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
/**
 * 두 줄이 쉼표로 늘어놓은 항목의 자리만 바꾼 것인가. 앞뒤의 같은 부분을 떼고 남은 가운데를 항목으로
 * 나눠 여러 항목의 모음이 같은지 본다. 수 가운데(1/4 의 1/ 과 4)는 자르지 않는다.
 */
const NUMBER_CHAR = /[\d./]/;
const isSequence = (line) => line.split(', ').some((item) => item === '□' || item === '...');
function isReorderedLine(a, b) {
  if (a === b) return true;
  if (isSequence(a) || isSequence(b) || [...a].sort().join('') !== [...b].sort().join('')) return false;
  let prefix = 0;
  while (prefix < a.length && a[prefix] === b[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < a.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1;
  const cuttable = (text, at) => at === 0 || at === text.length || !(NUMBER_CHAR.test(text[at - 1]) && NUMBER_CHAR.test(text[at]));
  // 자르는 자리는 같은 부분의 끝 그대로이거나, 그 안쪽의 띄어쓰기·쉼표 경계와 수·단위와 조사 사이(8cm|인)다.
  const hangul = (ch) => ch !== undefined && /[가-힣]/.test(ch);
  // 같은 부분 안의 온전한 항목은 양쪽에 똑같이 들어가므로, 처음 달라지는 항목 안에서만 자리를 찾는다.
  const before = a.lastIndexOf(', ', prefix - 1);
  const after = a.indexOf(', ', a.length - suffix);
  const starts = [prefix];
  for (let p = prefix - 1; p >= (before < 0 ? 0 : before + 2); p -= 1) {
    if (p === 0 || a[p - 1] === ' ' || (hangul(a[p - 1]) && !hangul(a[p]))) starts.push(p);
  }
  const ends = [suffix];
  for (let s = suffix - 1; s >= (after < 0 ? 0 : a.length - after); s -= 1) {
    const at = a.length - s;
    if (s === 0 || a[at] === ',' || a[at] === ' ' || (!hangul(a[at - 1]) && hangul(a[at]))) ends.push(s);
  }
  for (const p of starts) {
    for (const s of ends) {
      if (![cuttable(a, p), cuttable(b, p), cuttable(a, a.length - s), cuttable(b, b.length - s)].every(Boolean)) continue;
      const left = a.slice(p, a.length - s).split(', ');
      const right = b.slice(p, b.length - s).split(', ');
      if (left.length >= 2 && left.length === right.length && [...left].sort().join('\n') === [...right].sort().join('\n')) return true;
    }
  }
  return false;
}
/** 지시문·그림·정답은 같고 본문이 줄마다 항목 자리만 다른가. */
function isReordered(one, two) {
  const fixed = (raw) => JSON.stringify([raw.instruction, raw.figure ?? null, answerSet(raw)]);
  if (fixed(one) !== fixed(two)) return false;
  const left = String(one.stem).split('\n');
  const right = String(two.stem).split('\n');
  return left.length === right.length && left.every((line, k) => isReorderedLine(line, right[k]));
}
/** 자리만 바꾼 문제끼리 같은 값이 되는 묶음 키. 묶음 안에서만 isReordered 로 짝을 본다. */
const reorderBucket = (raw) => JSON.stringify([
  raw.instruction, raw.figure ?? null, answerSet(raw), String(raw.stem).split('\n').map((line) => [...line].sort().join('')),
]);

const computation = (raw) => JSON.stringify([
  raw.instruction, [...new Set(numbersIn(raw.stem))], numbersIn(raw.figure?.spec), answerCore(raw),
]);

function generate(generator, rng, difficulty) {
  return generator.generate(rng, { difficulty, standard: standardByCode.get(generator.standardCode) });
}

/**
 * 난수 하나만 바꾼 변형 중 보이는 문제가 같은데 키가 다른 것(splits)과, 키는 같은데 답이 다른 것(collisions)을
 * 모은다. 맥락을 고르는 난수 하나만 바꾸면 수는 그대로이고 맥락만 다른 문제가 나오므로, 맥락 낱말이 답인데
 * 키에서 빠진 경우(두 자료의 '5월'과 '셋째 주')가 여기서 걸린다.
 */
function perturbedKeySplits(generator, seed, difficulty, variants = 1) {
  const plain = replayRng(seed, -1);
  const raw = generate(generator, plain.rng, difficulty);
  const shown = shownProblem(raw);
  const splits = [];
  const collisions = [];
  const sameProblemParams = [];
  for (let at = 0; at < plain.calls(); at += 1) {
    for (let variant = 0; variant < variants; variant += 1) {
      let other;
      try {
        other = generate(generator, replayRng(seed, at, variant).rng, difficulty);
      } catch {
        continue; // 바꾼 난수로 조건을 못 맞춘 변형은 문제가 없으므로 비교하지 않는다.
      }
      const answers = [answerCore(raw), answerCore(other)].map((core) => JSON.stringify(core));
      if (other.dedupeKey === raw.dedupeKey && answers[0] !== answers[1]) {
        collisions.push({ at, key: raw.dedupeKey, answers });
      }
      if (shownProblem(other) !== shown) continue;
      sameProblemParams.push(other.params);
      if (other.dedupeKey !== raw.dedupeKey) splits.push({ at, from: raw.dedupeKey, to: other.dedupeKey });
    }
  }
  return { raw, splits, collisions, sameProblemParams };
}

/** 이웃한 난수 한두 개를 맞바꾼 변형 중 관찰 순서만 다른데 키가 다른 것을 모은다. */
function reorderedKeySplits(generator, seed, difficulty) {
  const plain = replayRng(seed, -1);
  const raw = generate(generator, plain.rng, difficulty);
  const splits = [];
  for (const length of [1, 2]) {
    for (let at = 0; at + 2 * length <= plain.calls(); at += 1) {
      let other;
      try {
        other = generate(generator, swappedRng(seed, at, length).rng, difficulty);
      } catch {
        continue;
      }
      if (other.dedupeKey !== raw.dedupeKey && isReordered(raw, other)) splits.push({ from: raw.dedupeKey, to: other.dedupeKey });
    }
  }
  return splits;
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
    const reorderBuckets = new Map();
    for (const difficulty of levelsOf(generator)) {
      for (let s = 0; s < SEEDS; s += 1) {
        const raw = generate(generator, createRng(`keyprop:${difficulty}:${s}`), difficulty);
        if (String(raw.stem).includes(', ')) {
          const bucketKey = reorderBucket(raw);
          const bucket = reorderBuckets.get(bucketKey) ?? [];
          for (const other of bucket) {
            if (other.dedupeKey !== raw.dedupeKey && isReordered(other, raw)) {
              failures.push(`${generator.id} 관찰 순서만 다른 문제 다른 키: ${other.dedupeKey} | ${raw.dedupeKey}`);
            }
          }
          if (bucket.length < 8) reorderBuckets.set(bucketKey, [...bucket, raw]);
        }
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
        const { splits, collisions } = perturbedKeySplits(generator, `keyprop-perturb:${difficulty}:${s}`, difficulty);
        for (const split of splits) failures.push(`${generator.id} 쓰지 않는 난수가 키를 바꿈: ${split.from} | ${split.to}`);
        for (const hit of collisions) failures.push(`${generator.id} 난수 하나를 바꾼 변형이 같은 키로 다른 답: ${hit.key} | ${hit.answers.join(' | ')}`);
      }
      for (let s = 0; s < ORDER_SEEDS; s += 1) {
        for (const split of reorderedKeySplits(generator, `keyprop-order:${difficulty}:${s}`, difficulty)) {
          failures.push(`${generator.id} 관찰 순서를 바꾼 섭동이 키를 바꿈: ${split.from} | ${split.to}`);
        }
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

/** createRng 과 같은 모양이되 int 는 절반, pick 은 30% 확률로 범위의 끝값을 낸다(math-boundary-commutation 과 같다). */
function edgeRng(seed) {
  const rng = createRng(seed);
  const coin = createRng(`${seed}|edge`);
  const { int, pick } = rng;
  rng.int = (min, max) => {
    const c = coin.float();
    if (max >= min && c < 0.25) return min;
    if (max >= min && c < 0.5) return max;
    return int(min, max);
  };
  rng.pick = (arr) => {
    const c = coin.float();
    if (Array.isArray(arr) && arr.length > 0 && c < 0.15) return arr[0];
    if (Array.isArray(arr) && arr.length > 0 && c < 0.3) return arr.at(-1);
    return pick(arr);
  };
  return rng;
}

/** 채점이 같게 보는 정답 집합. 표기 차이(띄어쓰기·전각)와 소수 끝자리 0(7.10 과 7.1)을 걷어 낸다. */
const effectiveAnswers = (raw) => [...new Set(
  (raw.choices ? correctChoices(raw) : (raw.answer?.accepts ?? [raw.answer?.value]).map(String))
    .map((text) => normalizeResponse(text).replace(/(\d\.\d*?)0+(?!\d)/g, '$1').replace(/(\d)\.(?!\d)/g, '$1')),
)].sort();

// 6차 리뷰가 찾은 두 계열을 난이도를 가로질러 본다.
// - 같은 수를 난이도마다 다른 정밀도로 들고 있으면(8.7 을 난이도 1은 87, 2는 870) 같은 문제가 다른 키를 받는다.
//   난이도마다 범위가 달라 고른 seed 로는 겹치는 문제가 거의 안 나오므로, 범위 끝값을 자주 내는 난수로
//   겹치는 문제를 만들고 난이도 구분 없이 보이는 문제(정답 집합은 채점이 같게 보는 꼴)를 키와 맞춰 본다.
// - 키가 같은데 답이 다르면 서로 다른 문항이 한 문항 ID 를 쓴다. 같은 표본에서 키별 답을 맞춰 본다.
const EDGE_SEEDS = 600;

test('수학 생성기 키 일관성(난이도 가로지르기): 끝값 표본에서 같은 문제는 같은 키, 같은 키는 같은 답이다', () => {
  const failures = new Map();
  const fail = (id, message) => {
    if (!failures.has(id)) failures.set(id, `${id} ${message}`);
  };
  for (const generator of mathGenerators) {
    const keyByShown = new Map();
    const answerByKey = new Map();
    for (const difficulty of levelsOf(generator)) {
      for (let s = 0; s < EDGE_SEEDS; s += 1) {
        let raw;
        try {
          raw = generate(generator, edgeRng(`keyprop-edge:${difficulty}:${s}`), difficulty);
        } catch {
          continue; // 끝값에서 생성이 멈추는 경우는 math-boundary-commutation 이 본다.
        }
        const shown = JSON.stringify([raw.instruction, raw.stem, raw.figure ?? null, effectiveAnswers(raw)]);
        const knownKey = keyByShown.get(shown);
        if (knownKey === undefined) keyByShown.set(shown, raw.dedupeKey);
        else if (knownKey !== raw.dedupeKey) fail(generator.id, `같은 문제 다른 키: ${knownKey} | ${raw.dedupeKey}`);
        const answer = answerCore(raw);
        const knownAnswer = answerByKey.get(raw.dedupeKey);
        if (knownAnswer === undefined) answerByKey.set(raw.dedupeKey, answer);
        else if (JSON.stringify(knownAnswer) !== JSON.stringify(answer)) {
          fail(generator.id, `같은 키 다른 답: ${raw.dedupeKey} | ${JSON.stringify(knownAnswer)} | ${JSON.stringify(answer)}`);
        }
      }
    }
  }
  assert.deepEqual([...failures.values()], []);
});
