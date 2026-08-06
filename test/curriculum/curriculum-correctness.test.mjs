import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { ASSET_REQUIREMENTS } from '../../src/curriculum/asset-requirements.mjs';

function scriptedRng(ints, mode) {
  return { pick(values) { return values.includes(mode) ? mode : values[0]; }, int() { assert.notEqual(ints.length, 0, 'scripted RNG exhausted'); return ints.shift(); } };
}

test('tied table and graph extrema accept every valid category', () => {
  const registry = createRegistry();
  const table = registry.get('math.g12.pd.s04-02.read-table').generate(scriptedRng([4, 4, 1], 'most'), { difficulty: 2 });
  const picture = registry.get('math.g12.pd.s04-03.read-graph').generate(scriptedRng([4, 4, 1, 0], 'most'), { difficulty: 2 });
  const barsMost = registry.get('math.g34.gd.s04-03.interpret-bar').generate(scriptedRng([5, 5, 2, 1], 'most'), { difficulty: 2 });
  const barsLeast = registry.get('math.g34.gd.s04-03.interpret-bar').generate(scriptedRng([5, 4, 1, 1], 'least'), { difficulty: 2 });
  assert.deepEqual(table.answer.accepts, ['빨강', '노랑']);
  assert.deepEqual(picture.answer.accepts, ['빨강', '노랑']);
  assert.deepEqual(barsMost.answer.accepts, ['사과', '포도']);
  assert.deepEqual(barsLeast.answer.accepts, ['배', '귤']);
});

test('rock-paper-scissors win-or-lose probability is two thirds', () => {
  const generator = createRegistry().get('math.g56.rm.s04-05.likelihood-number'); let item;
  for (let seed = 0; seed < 500; seed += 1) { const candidate = generator.generate(createRng(seed), { difficulty: 3 }); if (candidate.stem.includes('가위바위보')) { item = candidate; break; } }
  assert.ok(item, 'deterministic seed range must reach the rock-paper-scissors case');
  assert.equal(item.answer.value, '2/3');
  assert.deepEqual(item.params, { n: 2, d: 3, display: '2/3' });
});

test('mind inference belongs to [2국02-04] and center-content reading remains blocked', () => {
  const registry = createRegistry(); const generator = registry.get('korean.g12.st.s02-04.mind');
  assert.equal(generator.standardCode, '[2국02-04]');
  assert.equal(registry.forStandard('[2국02-03]').some((g) => g.skill.includes('마음')), false);
  assert.equal(ASSET_REQUIREMENTS['[2국02-03]'].kind, 'passage');
  assert.equal(ASSET_REQUIREMENTS['[2국02-04]'], undefined);
});

test('[4영02-03] has no translation proxy and declares required audio', () => {
  const registry = createRegistry();
  assert.deepEqual(registry.forStandard('[4영02-03]'), []);
  assert.deepEqual(ASSET_REQUIREMENTS['[4영02-03]'], { kind: 'audio', need: '쉬운 단어 음성과 해당 단어의 철자 정답', note: '우리말 뜻을 영어로 번역하는 문항은 소리와 철자의 관계를 측정하지 않는다.' });
});
