import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { gradeItem } from '../../src/server/grade.mjs';

// PR #3 리뷰가 재현한 반례를 그대로 고정한다. seed 와 난이도는 리뷰 원문 그대로다.

const registry = createRegistry();

function make(id, seed, difficulty) {
  const generator = registry.get(id);
  assert.ok(generator, id);
  const raw = generator.generate(createRng(seed), { difficulty });
  return { generator, raw, item: { ...raw, format: generator.format, scoring: generator.scoring } };
}

const correct = (item, response) => gradeItem(item, response).correct;

test('[4수01-08] 어림하는 단위가 다른 곱 어림 문항은 같은 문항으로 세지 않는다', () => {
  const hundreds = make('math.g34.no.s08.estimate-decide', 44832, 2).raw;
  const thousands = make('math.g34.no.s08.estimate-decide', 7, 3).raw;
  assert.equal(hundreds.answer.value, 45600);
  assert.equal(thousands.answer.value, 57000);
  assert.notEqual(hundreds.dedupeKey, thousands.dedupeKey);

  // 같은 키는 언제나 같은 답이어야 한다.
  const valueByKey = new Map();
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 3000; seed += 1) {
      const { raw } = make('math.g34.no.s08.estimate-decide', `estimate-key:${difficulty}:${seed}`, difficulty);
      if (valueByKey.has(raw.dedupeKey)) assert.equal(valueByKey.get(raw.dedupeKey), raw.answer.value, raw.dedupeKey);
      valueByKey.set(raw.dedupeKey, raw.answer.value);
    }
  }
});

test('[4수01-16] 소수 문장제는 끝자리 0을 붙인 같은 값도 정답으로 받는다', () => {
  const { item, raw } = make('math.g34.no.s16.decimal-story', 94, 2);
  assert.match(raw.stem, /6\.55m.*7\.85m/);
  for (const response of ['14.4', '14.4m', '14.40', '14.40m']) assert.equal(correct(item, response), true, response);
  for (const response of ['14.41', '14.04m', '1.44']) assert.equal(correct(item, response), false, response);
});

test('[6수01-03] 소수 첫째 자리까지 반올림한 답은 그 자릿수 표기를 정답으로 낸다', () => {
  const { generator, item, raw } = make('math.g56.no.s03.rounding-story', 'review:38', 3);
  assert.match(raw.stem, /28\.99m/);
  assert.equal(raw.answer.value, '29.0');
  assert.equal(raw.answer.display, '29.0m');
  assert.equal(generator.verify(raw.params, raw.answer), true);
  for (const response of ['29.0', '29.0m', '29', '29m']) assert.equal(correct(item, response), true, response);
  for (const response of ['28.9', '29.1m', '28.99']) assert.equal(correct(item, response), false, response);
  for (const value of ['28.9', '29.1', '28.99']) assert.equal(generator.verify(raw.params, { value }), false, value);
});

test('[6수01-08] 기약분수로 나타내라는 대분수 계산은 기약 가분수도 정답으로 받는다', () => {
  const { generator, item, raw } = make('math.g56.no.s08.mixed-add-sub', 'review:0', 1);
  assert.equal(raw.stem, '2 2/7 + 3 2/21');
  for (const response of ['5 8/21', '113/21']) {
    assert.equal(correct(item, response), true, response);
    assert.equal(generator.verify(raw.params, { value: response }), true, response);
  }
  for (const response of ['226/42', '5 16/42', '112/21']) {
    assert.equal(correct(item, response), false, response);
    assert.equal(generator.verify(raw.params, { value: response }), false, response);
  }
});

test('[6수02-02] 비 문항은 두 양의 수를 그대로 쓰라고 밝히고 그 표기로 채점한다', () => {
  const { item, raw } = make('math.g56.rm.s02-02.ratio-situation', 'review:1', 1);
  assert.match(raw.stem, /빨간 구슬 6개와 파란 구슬 30개/);
  assert.match(raw.instruction, /그대로/);
  assert.equal(correct(item, '6:30'), true);
  assert.equal(correct(item, '1:5'), false);
});

test('[6수02-01] 대응표 규칙은 모든 난이도에서 한 가지 연산이다', () => {
  const generator = registry.get('math.g56.rm.s02-01.rule-table');
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 300; seed += 1) {
      const { xs, ys } = generator.generate(createRng(`rule-table:${difficulty}:${seed}`), { difficulty }).params;
      const sameDifference = new Set(xs.map((x, k) => ys[k] - x)).size === 1;
      const sameRatio = new Set(xs.map((x, k) => ys[k] / x)).size === 1;
      assert.ok(sameDifference || sameRatio, `두 연산 규칙: ${xs} -> ${ys}`);
    }
  }
});

test('맥락 명사만 다른 같은 계산은 같은 문항으로 센다', () => {
  const zero = make('math.g12.no.s09.story-box', 'dedupe-review:0', 2).raw;
  const other = make('math.g12.no.s09.story-box', 'dedupe-review:69', 2).raw;
  assert.notEqual(zero.stem, other.stem);
  assert.equal(zero.dedupeKey, other.dedupeKey);

  // 키에 한글 맥락(명사·단위 이름)이 섞이지 않는다.
  const ids = ['math.g12.no.s09.story-box', 'math.g34.no.s03.story', 'math.g34.no.s04.story-multiply', 'math.g56.no.s10.share-story'];
  for (const id of ids) {
    for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
      for (let seed = 0; seed < 200; seed += 1) {
        const { raw } = make(id, `context-key:${difficulty}:${seed}`, difficulty);
        assert.doesNotMatch(raw.dedupeKey, /[가-힣]|:(m|L|kg)$/, `${id} ${raw.dedupeKey}`);
      }
    }
  }
});

test('기초 생성기도 맥락 명사만 다른 같은 계산은 같은 문항으로 센다', () => {
  const pairs = [
    ['math.g12.no.s01.count-tens-ones', 3, 4],
    ['math.g12.no.s05.story-add', 3, 19],
    ['math.g12.no.s05.story-sub', 9, 11],
    ['math.g12.no.s10.groups', 0, 3],
  ];
  for (const [id, left, right] of pairs) {
    const one = make(id, `dedupe-review:${left}`, 1).raw;
    const two = make(id, `dedupe-review:${right}`, 1).raw;
    assert.notEqual(one.stem, two.stem, id);
    assert.equal(one.answer.value, two.answer.value, id);
    assert.equal(one.dedupeKey, two.dedupeKey, id);
  }

  // 키에 한글 맥락(명사)이 섞이지 않는다. 문제 구조(kind)는 남는다.
  for (const [id] of pairs) {
    for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
      for (let seed = 0; seed < 200; seed += 1) {
        const { raw } = make(id, `context-key:${difficulty}:${seed}`, difficulty);
        assert.doesNotMatch(raw.dedupeKey, /[가-힣]/, `${id} ${raw.dedupeKey}`);
      }
    }
  }
});

// 재리뷰(head 940246d)가 재현한 반례와 같은 계열을 고정한다.

const doubled = (text) => {
  const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(text);
  const d = Number(m[3]);
  return `${(Number(m[1] ?? 0) * d + Number(m[2])) * 2}/${d * 2}`;
};

test('[6수01] 기약분수로 나타내라는 분수 문항은 기약 가분수도 정답으로 받고 약분하지 않은 답은 받지 않는다', () => {
  const { generator, item, raw } = make('math.g56.no.s09.mixed-times', 1, 1);
  assert.equal(raw.stem, '1 3/4 × 9');
  for (const response of ['15 3/4', '63/4']) {
    assert.equal(correct(item, response), true, response);
    assert.equal(generator.verify(raw.params, { value: response }), true, response);
  }
  for (const response of ['126/8', '15 6/8', '64/4']) {
    assert.equal(correct(item, response), false, response);
    assert.equal(generator.verify(raw.params, { value: response }), false, response);
  }

  const ids = [
    'math.g56.no.s09.mixed-times', 'math.g56.no.s10.share-story', 'math.g56.no.s11.mixed-divide',
    'math.g56.no.s12.decimal-to-fraction', 'math.g56.no.s08.fraction-story', 'math.g56.no.s09.fraction-times-story',
    'math.g56.no.s11.fraction-divide-story',
  ];
  for (const id of ids) {
    let checked = 0;
    for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
      for (let seed = 0; seed < 200; seed += 1) {
        const { generator: g, item: it, raw: r } = make(id, `reduced-improper:${difficulty}:${seed}`, difficulty);
        const m = /^(\d+) (\d+)\/(\d+)$/.exec(r.answer.value);
        if (!m) continue;
        const improper = `${Number(m[1]) * Number(m[3]) + Number(m[2])}/${m[3]}`;
        assert.equal(correct(it, improper), true, `${id} ${r.stem} ${improper}`);
        assert.equal(g.verify(r.params, { value: improper }), true, `${id} ${improper}`);
        assert.equal(correct(it, doubled(r.answer.value)), false, `${id} ${doubled(r.answer.value)}`);
        assert.equal(g.verify(r.params, { value: doubled(r.answer.value) }), false, `${id} ${doubled(r.answer.value)}`);
        checked += 1;
      }
    }
    assert.ok(checked > 0, id);
  }
});

test('[4수01-15] 분모를 유지한 답을 보이는 분수 계산도 약분한 같은 값을 정답으로 받는다', () => {
  const { generator, item, raw } = make('math.g34.no.s15.mixed-add-sub', 2, 1);
  assert.equal(raw.stem, '5 4/10 + 8 2/10');
  for (const response of ['13 6/10', '13 3/5', '136/10', '68/5']) {
    assert.equal(correct(item, response), true, response);
    assert.equal(generator.verify(raw.params, { value: response }), true, response);
  }
  for (const response of ['13 3/6', '13 4/10', '67/5']) {
    assert.equal(correct(item, response), false, response);
    assert.equal(generator.verify(raw.params, { value: response }), false, response);
  }

  // 같은 값의 기약 표기(진분수·가분수·대분수)는 받고, 값이 다른 답은 받지 않는다.
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const ids = [
    'math.g34.no.s15.mixed-add-sub', 'math.g34.no.s15.fraction-story', 'math.g34.no.s10.to-improper', 'math.g34.no.s10.to-mixed',
    'math.g34.no.s15.add-sub', 'math.g34.no.s09.part-of-whole',
    'math.g56.no.s08.add-sub', 'math.g56.no.s09.multiply', 'math.g56.no.s10.divide-natural',
  ];
  for (const id of ids) {
    let checked = 0;
    for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
      for (let seed = 0; seed < 200; seed += 1) {
        const { generator: g, item: it, raw: r } = make(id, `reduced-equal:${difficulty}:${seed}`, difficulty);
        const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(r.answer.value);
        if (!m) continue;
        const top = Number(m[1] ?? 0) * Number(m[3]) + Number(m[2]);
        const k = gcd(top, Number(m[3]));
        const [n, d] = [top / k, Number(m[3]) / k];
        if (d === 1) continue;
        const forms = id.endsWith('to-improper') ? [`${n}/${d}`] : id.endsWith('to-mixed') ? [`${Math.floor(n / d)} ${n % d}/${d}`] : n > d ? [`${Math.floor(n / d)} ${n % d}/${d}`, `${n}/${d}`] : [`${n}/${d}`];
        for (const form of forms) {
          assert.equal(correct(it, form), true, `${id} ${r.stem} ${form}`);
          assert.equal(g.verify(r.params, { value: form }), true, `${id} ${r.stem} ${form}`);
        }
        const wrong = `${n + 1}/${d}`;
        assert.equal(correct(it, wrong), false, `${id} ${wrong}`);
        assert.equal(g.verify(r.params, { value: wrong }), false, `${id} ${wrong}`);
        checked += 1;
      }
    }
    assert.ok(checked > 0, id);
  }

  // 대분수·가분수로 바꾸라는 문항은 꼴을 그대로 요구한다.
  const toImproper = make('math.g34.no.s10.to-improper', 'form:0', 1);
  const mixed = toImproper.raw.stem;
  assert.equal(correct(toImproper.item, mixed), false, mixed);
  const toMixed = make('math.g34.no.s10.to-mixed', 'form:0', 1);
  assert.equal(correct(toMixed.item, toMixed.raw.stem), false, toMixed.raw.stem);
});

test('[6수01-15] 끝자리 0을 붙인 소수 답도 같은 값으로 받고 단위와 자릿수 요구는 그대로 둔다', () => {
  const { generator, item, raw } = make('math.g56.no.s15.decimal-divide-story', 0, 1);
  assert.match(raw.stem, /86\.8L.*14/);
  for (const response of ['6.2', '6.2L', '6.20', '6.20L']) assert.equal(correct(item, response), true, response);
  for (const response of ['6.21', '6.2kg', '6.20kg', '62', '6']) assert.equal(correct(item, response), false, response);
  for (const value of ['6.2', '6.20']) assert.equal(generator.verify(raw.params, { value }), true, value);
  assert.equal(generator.verify(raw.params, { value: '6.21' }), false);

  // 채점 규칙: 정답에 소수점이 있는 수에만 0을 더 붙일 수 있다.
  const shortAnswer = (accepts) => ({ format: 'short-answer', scoring: 'auto', answer: { value: accepts[0], display: accepts[0], accepts } });
  assert.equal(correct(shortAnswer(['3.10']), '3.1'), false);
  assert.equal(correct(shortAnswer(['3.10']), '3.100'), true);
  assert.equal(correct(shortAnswer(['6']), '6.0'), false);
  assert.equal(correct(shortAnswer(['86.8 ÷ 14 = 6.2']), '86.80 ÷ 14 = 6.20'), true);
  assert.equal(correct(shortAnswer(['86.8 ÷ 14 = 6.2']), '86.8 ÷ 140 = 6.2'), false);
});

test('[2수04-02] 모두 몇 명인지 묻는 자료 세기 문항은 쓰지 않는 범주로 다른 문항이 되지 않는다', () => {
  const left = make('math.g12.pd.s04-02.tally', 4879, 2).raw;
  const right = make('math.g12.pd.s04-02.tally', 27709, 2).raw;
  assert.equal(left.stem, right.stem);
  assert.equal(left.instruction, right.instruction);
  assert.equal(left.answer.value, 5);
  assert.equal(left.dedupeKey, right.dedupeKey);
});

test('보이는 문제가 같으면 같은 문항으로 센다', () => {
  const ids = [
    'math.g12.pd.s04-02.tally', 'math.g12.no.s07.add-to-sub', 'math.g12.no.s07.fact-family',
    'math.g34.mr.s03-14.time-arithmetic', 'math.g56.no.s12.relation',
  ];
  for (const id of ids) {
    const keyByProblem = new Map();
    for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
      for (let seed = 0; seed < 600; seed += 1) {
        const { raw } = make(id, `same-problem:${difficulty}:${seed}`, difficulty);
        const shown = JSON.stringify([raw.instruction, raw.stem, raw.figure ?? null]);
        if (keyByProblem.has(shown)) assert.equal(raw.dedupeKey, keyByProblem.get(shown), `${id} ${raw.stem}`);
        else keyByProblem.set(shown, raw.dedupeKey);
      }
    }
  }
});

test('[4수03-14] 시간의 덧셈과 뺄셈은 보이는 식으로 다시 계산한 값이 답이다', () => {
  const seconds = (text) => {
    const part = (unit) => Number(new RegExp(`(\\d+)${unit}`).exec(text)?.[1] ?? 0);
    return part('시간') * 3600 + part('분') * 60 + part('초');
  };
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 300; seed += 1) {
      const { raw } = make('math.g34.mr.s03-14.time-arithmetic', `time-shown:${difficulty}:${seed}`, difficulty);
      const [left, op, right] = raw.stem.split(/ ([+-]) /);
      const expected = op === '+' ? seconds(left) + seconds(right) : seconds(left) - seconds(right);
      assert.equal(seconds(raw.answer.value), expected, `${raw.stem} = ${raw.answer.value}`);
    }
  }
});
