import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';

const registry = createRegistry();

test('[6수01-01] mixed calculations stay focused on calculation order', () => {
  const generator = registry.get('math.g56.no.s01.mixed-ops');
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(`mixed:${difficulty}:${seed}`), { difficulty });
      const operations = item.stem.match(/[+\-×÷]/g) ?? [];
      assert.ok(operations.length <= 2, `overly complex mixed calculation: ${item.stem}`);
    }
  }
});

test('grade 5-6 geometry and measurement generators use the official achievement codes', () => {
  const expectedCodes = {
    'math.g56.rm.s03-04.edge-sum': '[6수03-03]',
    'math.g56.rm.s03-06.prism-name': '[6수03-05]',
    'math.g56.rm.s03-10.cube-block': '[6수03-09]',
    'math.g56.rm.s03-12.area': '[6수03-14]',
    'math.g56.rm.s03-13.area-unit': '[6수03-12]',
    'math.g56.rm.s03-14.composite-area': '[6수03-13]',
    'math.g56.rm.s03-15.circumference': '[6수03-16]',
    'math.g56.rm.s03-18.volume': '[6수03-19]',
    'math.g56.rm.s03-19.volume-unit': '[6수03-18]',
  };

  for (const [id, standardCode] of Object.entries(expectedCodes)) {
    assert.equal(registry.get(id).standardCode, standardCode, id);
  }
});

test('[6수03-14] area items stay within the named non-rectangular figures', () => {
  const generator = registry.get('math.g56.rm.s03-12.area');
  const allowedKinds = new Set(['parallelogram', 'triangle', 'trapezoid', 'rhombus']);
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(`area:${difficulty}:${seed}`), { difficulty });
      assert.ok(allowedKinds.has(item.params.kind), `${item.params.kind} is not in [6수03-14]`);
    }
  }
});

function cubeNetFolds(cells) {
  if (cells.length !== 6 || new Set(cells.map(([x, y]) => `${x},${y}`)).size !== 6) return false;
  const byPosition = new Map(cells.map((cell) => [cell.join(','), cell]));
  const orientations = new Map([[cells[0].join(','), { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }]]);
  const queue = [cells[0]];
  const neg = (vector) => vector.map((value) => -value);
  const same = (a, b) => a.every((value, index) => value === b[index]);
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const orientation = orientations.get(`${x},${y}`);
    const neighbors = [
      [x + 1, y, { n: orientation.u, u: neg(orientation.n), v: orientation.v }],
      [x - 1, y, { n: neg(orientation.u), u: orientation.n, v: orientation.v }],
      [x, y + 1, { n: orientation.v, u: orientation.u, v: neg(orientation.n) }],
      [x, y - 1, { n: neg(orientation.v), u: orientation.u, v: orientation.n }],
    ];
    for (const [nextX, nextY, nextOrientation] of neighbors) {
      const key = `${nextX},${nextY}`;
      if (!byPosition.has(key)) continue;
      const previous = orientations.get(key);
      if (previous && !same(previous.n, nextOrientation.n)) return false;
      if (!previous) {
        orientations.set(key, nextOrientation);
        queue.push([nextX, nextY]);
      }
    }
  }
  return orientations.size === 6
    && new Set([...orientations.values()].map(({ n }) => n.join(','))).size === 6;
}

test('[6수03-04] cuboid-net recognition includes provably valid and invalid nets', () => {
  const generator = registry.get('math.g56.rm.s03-04.cuboid-net');
  const outcomes = new Set();
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(`cuboid-net:${difficulty}:${seed}`), { difficulty });
      const expected = cubeNetFolds(item.params.cells);
      outcomes.add(expected);
      assert.equal(generator.standardCode, '[6수03-04]');
      assert.equal(item.figure.kind, 'data.table');
      assert.deepEqual(item.figure.spec.cells, item.params.cells);
      assert.equal(item.params.isValid, expected);
      assert.equal(item.answer.value, expected ? '전개도가 된다' : '전개도가 되지 않는다');
      assert.equal(generator.verify(item.params, item.answer), true);
    }
  }
  assert.deepEqual(outcomes, new Set([true, false]));
});

test('[6수03-06] triangular-prism net recognition distinguishes opposite and same ends', () => {
  const generator = registry.get('math.g56.rm.s03-06.prism-net');
  const outcomes = new Set();
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(`prism-net:${difficulty}:${seed}`), { difficulty });
      const { panels, bases, isValid } = item.params;
      const expected = panels === 3 && bases.length === 2 && bases[0].side !== bases[1].side;
      outcomes.add(expected);
      assert.equal(generator.standardCode, '[6수03-06]');
      assert.equal(item.figure.kind, 'data.table');
      assert.deepEqual(item.figure.spec.bases, bases);
      assert.equal(isValid, expected);
      assert.equal(item.answer.value, expected ? '전개도가 된다' : '전개도가 되지 않는다');
      assert.equal(generator.verify(item.params, item.answer), true);
    }
  }
  assert.deepEqual(outcomes, new Set([true, false]));
});

test('[6수03-10] stacked-cube orthographic views equal projections of the height map', () => {
  const generator = registry.get('math.g56.rm.s03-10.orthographic-views');
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(`views:${difficulty}:${seed}`), { difficulty });
      const heights = item.params.heightMap;
      const top = heights.map((row) => row.map((height) => Number(height > 0)));
      const front = heights[0].map((_, column) => Math.max(...heights.map((row) => row[column])));
      const side = heights.map((row) => Math.max(...row));
      assert.equal(generator.standardCode, '[6수03-10]');
      assert.deepEqual(item.params.views, { top, front, side });
      assert.deepEqual(item.figure.spec.heightMap, heights);
      assert.equal(item.answer.value, `위: ${top.map((row) => row.join('')).join('/')}; 앞: ${front.join('-')}; 옆: ${side.join('-')}`);
      assert.equal(generator.verify(item.params, item.answer), true);
    }
  }
});

test('[6수03-15] circumference-to-diameter measurements establish the constant 3.14 ratio', () => {
  const generator = registry.get('math.g56.rm.s03-15.pi-ratio');
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generator.generate(createRng(`pi-ratio:${difficulty}:${seed}`), { difficulty });
      assert.equal(generator.standardCode, '[6수03-15]');
      assert.ok(item.params.measurements.length >= 2);
      for (const { diameter, circumferenceHundredths } of item.params.measurements) {
        assert.equal(circumferenceHundredths, diameter * 314);
      }
      assert.equal(item.answer.value, '3.14');
      assert.deepEqual(item.figure.spec.measurements, item.params.measurements);
      assert.equal(generator.verify(item.params, item.answer), true);
    }
  }
});
