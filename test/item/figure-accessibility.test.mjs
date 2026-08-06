import assert from 'node:assert/strict';
import test from 'node:test';

import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';
import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { generateItem } from '../../src/engine/worksheet.mjs';
import { answerLeaksInAltText, learnerFigure } from '../../src/engine/item.mjs';

const SAMPLES = 12;

/**
 * 그림이 값을 그대로 보여 주는 문항.
 *
 * 표·그래프·자 눈금은 '읽는 것'이 곧 과제다. 대체 텍스트가 그 값을 적는 것은
 * 정답 누출이 아니라 그림과 같은 정보를 눈이 아닌 경로로 주는 것이다.
 * 이 목록에 없는 그림 문항은 대체 텍스트가 정답을 말해서는 안 된다.
 */
const DATA_VISIBLE_IN_FIGURE = new Set([
  'math.g12.gm.s12.read-ruler',
  'math.g12.pd.s04-02.read-table',
  'math.g12.pd.s04-03.read-graph',
  'math.g34.gd.s04-02.read-bar',
  'math.g34.gd.s04-03.interpret-bar',
  'math.g56.rm.s04-03.band-graph',
]);

const POSITION_MARKS = new Set(['㉠', '㉡', '㉢', '㉣', '㉤', '①', '②', '③', '④', '⑤']);

function sampleFigureItems() {
  const spine = buildSpine(loadOntology());
  const registry = createRegistry();
  const byCode = new Map(spine.standards.map((s) => [s.code, s]));
  const out = [];

  for (const g of registry.all()) {
    const standard = byCode.get(g.standardCode);
    for (let n = 0; n < SAMPLES; n += 1) {
      let item;
      try {
        item = generateItem(g, standard, createRng(`${g.id}|a11y|${n}`), (n % 3) + 1);
      } catch {
        continue;
      }
      if (item.figure) out.push(item);
    }
  }
  return out;
}

const FIGURE_ITEMS = sampleFigureItems();

test('그림 문항 표본이 실제로 모였다 (빈 표본이 통과로 보이면 안 된다)', () => {
  assert.ok(FIGURE_ITEMS.length > 100, `그림 문항 표본 ${FIGURE_ITEMS.length}개`);
});

test('그림이 값을 보여 주지 않는 문항은 altText 가 정답을 말하지 않는다', () => {
  const leaks = [];
  for (const item of FIGURE_ITEMS) {
    if (item.scoring !== 'auto') continue;
    if (DATA_VISIBLE_IN_FIGURE.has(item.generatorId)) continue;
    const hits = answerLeaksInAltText(item.figure.altText, item.answer.accepts ?? []);
    if (hits.length > 0) {
      leaks.push(`${item.generatorId}: alt="${item.figure.altText}" 가 ${JSON.stringify(hits)} 를 말한다`);
    }
  }
  assert.deepEqual(leaks, []);
});

test('기호가 정답인 그림 문항은 정답을 품은 spec 키를 선언한다', () => {
  const missing = [];
  for (const item of FIGURE_ITEMS) {
    const value = item.answer.value;
    if (typeof value !== 'string' || !POSITION_MARKS.has(value.trim())) continue;
    const keys = item.figure.answerBearingSpecKeys;
    if (!Array.isArray(keys) || keys.length === 0) missing.push(item.generatorId);
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('정답을 품은 spec 키는 학습자용 투영에서 사라진다', () => {
  const kept = [];
  for (const item of FIGURE_ITEMS) {
    const keys = item.figure.answerBearingSpecKeys;
    if (!Array.isArray(keys) || keys.length === 0) continue;
    const projected = learnerFigure(item.figure);
    for (const key of keys) {
      if (Object.hasOwn(projected.spec, key)) kept.push(`${item.generatorId}.${key}`);
    }
    if (Object.hasOwn(projected, 'prompt')) kept.push(`${item.generatorId}.prompt`);
  }
  assert.deepEqual([...new Set(kept)], []);
});

test('그림 없이는 풀 수 없다고 선언한 문항은 무엇이 필요한지 적는다', () => {
  const bad = [];
  for (const item of FIGURE_ITEMS) {
    if (item.figure.access !== 'requires-visual') continue;
    const note = item.figure.accommodation;
    if (typeof note !== 'string' || note.trim().length === 0) bad.push(item.generatorId);
  }
  assert.deepEqual([...new Set(bad)], []);
});

test('시각 대체가 필요한 문항이 실제로 표시되어 있다', () => {
  // 각의 크기·이동 방향처럼 말로 옮기면 곧 정답이 되는 그림이 있다.
  // 그런 문항은 조용히 두지 않고 accommodation 으로 드러낸다.
  const declared = new Set(
    FIGURE_ITEMS
      .filter((it) => it.figure.access === 'requires-visual')
      .map((it) => it.generatorId),
  );
  for (const id of [
    'math.g34.gd.s02.right-angle',
    'math.g34.gd.s04.transform',
    'math.g34.gd.s05.pattern',
    'math.g34.gd.s24.measure',
  ]) {
    assert.ok(declared.has(id), `${id} 는 시각 대체가 필요하다고 선언해야 한다`);
  }
});
