import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';

const registry = createRegistry();

const STANDARD_BY_GENERATOR = {
  'math.g34.gd.s05.pattern': '[4수03-04]',
  'math.g34.gd.s07.radius-diameter': '[4수03-06]',
  'math.g34.gd.s04-02.read-bar': '[4수04-01]',
  'math.g34.mr.s03-16.estimate': '[4수03-15]',
  'math.g34.mr.s03-22.arithmetic': '[4수03-23]',
  'math.g34.mr.s03-23.estimate': '[4수03-20]',
};

test('3-4 math generators use the standard that explicitly contains their content', () => {
  for (const [id, standardCode] of Object.entries(STANDARD_BY_GENERATOR)) {
    assert.equal(registry.get(id)?.standardCode, standardCode, id);
  }
});

test('out-of-scope proxies are not registered as 3-4 geometry or graph standards', () => {
  const disabled = [
    'math.g34.gd.s03.right-figures',
    'math.g34.gd.s12.diagonals',
    'math.g34.gd.s04-01.collect',
  ];
  for (const id of disabled) assert.equal(registry.get(id), undefined, id);
});

test('[4수03-20] weight measurement and estimation stay within g and kg', () => {
  const ids = [
    'math.g34.mr.s03-20.choose-unit',
    'math.g34.mr.s03-23.estimate',
  ];
  for (const id of ids) {
    const generator = registry.get(id);
    assert.ok(generator, id);
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(seed), { difficulty: 3 });
      assert.notEqual(item.params.expected ?? item.params.unit, 't', `${id} seed ${seed}`);
    }
  }
});

test('valid conversion and time generators remain registered under their standards', () => {
  const expected = {
    'math.g34.mr.s03-13.minute-second': '[4수03-13]',
    'math.g34.mr.s03-14.time-arithmetic': '[4수03-14]',
    'math.g34.mr.s03-16.convert-cm-mm': '[4수03-16]',
    'math.g34.mr.s03-16.convert-km-m': '[4수03-16]',
    'math.g34.mr.s03-18.convert-L-mL': '[4수03-18]',
    'math.g34.mr.s03-21.convert-kg-g': '[4수03-21]',
  };
  for (const [id, standardCode] of Object.entries(expected)) {
    assert.equal(registry.get(id)?.standardCode, standardCode, id);
  }
});

const NEW_STANDARD_GENERATORS = {
  'math.g34.gd.s03.line-relations': '[4수03-03]',
  'math.g34.gd.s05.point-movement': '[4수03-05]',
  'math.g34.mr.s03-22.convert-t-kg': '[4수03-22]',
  'math.g34.gd.s04-02.interpret-line': '[4수04-02]',
};

test('new 3-4 generators cover the four previously uncovered standards deterministically', () => {
  for (const [id, standardCode] of Object.entries(NEW_STANDARD_GENERATORS)) {
    const generator = registry.get(id);
    assert.equal(generator?.standardCode, standardCode, id);
    for (const difficulty of [1, 2, 3]) {
      const seed = `${id}:${difficulty}:deterministic`;
      const first = generator.generate(createRng(seed), { difficulty });
      const second = generator.generate(createRng(seed), { difficulty });
      assert.deepEqual(first, second, `${id} difficulty ${difficulty}`);
      assert.equal(generator.verify(first.params, first.answer), true, `${id} difficulty ${difficulty}`);
    }
  }
});

test('[4수03-03] generated line pairs are exactly perpendicular or parallel', () => {
  const generator = registry.get('math.g34.gd.s03.line-relations');
  for (let seed = 0; seed < 100; seed += 1) {
    const item = generator.generate(createRng(seed), { difficulty: 1 });
    const [[ax, ay], [bx, by]] = item.params.directions;
    const dot = ax * bx + ay * by;
    const cross = ax * by - ay * bx;
    assert.equal(item.params.relation, dot === 0 ? 'perpendicular' : 'parallel');
    assert.ok(dot === 0 || cross === 0, item.stem);
  }
});

test('[4수03-05] one point moves cardinally without leaving the grid', () => {
  const generator = registry.get('math.g34.gd.s05.point-movement');
  for (const difficulty of [1, 2, 3]) {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(`${difficulty}:${seed}`), { difficulty });
      const { start, end, gridMax, distance } = item.params;
      assert.ok([start, end].flat().every((coordinate) => coordinate >= 0 && coordinate <= gridMax));
      assert.equal(Math.abs(end[0] - start[0]) + Math.abs(end[1] - start[1]), distance);
      assert.ok(end[0] === start[0] || end[1] === start[1]);
    }
  }
});

test('[4수03-22] t conversion uses only the adjacent 1t = 1000kg relationship', () => {
  const generator = registry.get('math.g34.mr.s03-22.convert-t-kg');
  for (const difficulty of [1, 2, 3]) {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(`${difficulty}:${seed}`), { difficulty });
      assert.equal(item.params.bigSymbol, 't');
      assert.equal(item.params.smallSymbol, 'kg');
      assert.doesNotMatch(`${item.stem} ${item.solution.join(' ')}`, /(^|\d)g\b/);
      assert.equal(item.params.smallValue, item.params.whole * 1000 + item.params.rest);
    }
  }
});

test('[4수04-02] line-graph questions interpret ordered values and adjacent changes', () => {
  const generator = registry.get('math.g34.gd.s04-02.interpret-line');
  for (const difficulty of [1, 2, 3]) {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(`${difficulty}:${seed}`), { difficulty });
      const { categories, values, mode } = item.params;
      assert.equal(categories.length, values.length);
      assert.ok(categories.length >= 4);
      assert.match(item.stem, /꺾은선그래프/);
      if (mode === 'greatest-rise') {
        const rises = values.slice(1).map((value, index) => value - values[index]);
        assert.ok(Math.max(...rises) > 0);
        assert.equal(rises.filter((rise) => rise === Math.max(...rises)).length, 1);
      }
      assert.equal(generator.verify(item.params, item.answer), true);
    }
  }
});
