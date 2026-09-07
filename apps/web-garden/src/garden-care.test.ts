import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { buildWorldModel, CARE_DURATION, disposeModel } from './garden-models.ts';
import { EMPTY_GAME_STATE } from './game-state.ts';
import { WORLDS } from './garden-worlds.ts';
import { worldFraming } from './garden-renderer.ts';

for (const subject of ['korean', 'english', 'math'] as const) {
  describe(`${subject} reciprocal care`, () => {
    for (const { id: action } of WORLDS[subject].care) {
      test(`${action} has finite beats, is retriggerable, and never replays persisted history`, () => {
        const world = { ...EMPTY_GAME_STATE.worlds[subject], lastCare: action, growthMilestones: [1] as [1] };
        const model = buildWorldModel(subject, world, { batch: true });
        const actor = model.root.getObjectByName(subject === 'korean' ? 'growing-tree' : subject === 'english' ? 'fish' : 'puppy')!;
        const props = model.root.getObjectByName(`care:${action}`)!;
        expect(props).toBeDefined();
        expect(model.animate(40)).toBe('idle');
        expect(props.visible).toBe(false);
        model.startCare(action, 40);
        expect(model.animate(40)).toBe('approach');
        expect(props.visible).toBe(true);
        const start = actor.position.clone();
        expect(model.animate(41.4)).toBe('respond');
        if (subject !== 'korean' && action !== 'brush') expect(actor.position.distanceTo(start)).toBeGreaterThan(0.1);
        if (action === 'brush') expect(model.root.getObjectByName('head')!.rotation.z).toBeLessThan(-0.1);
        if (subject === 'math' && action === 'feed') {
          expect(model.root.getObjectByName('head')!.rotation.x).toBeGreaterThan(0.5);
          expect(model.root.getObjectByName('head')!.position.y).toBeLessThan(1.1);
        }
        if (subject === 'korean') expect(model.root.getObjectByName('canopy')!.rotation.z).not.toBe(0);
        expect(model.animate(42.8)).toBe('settle');
        expect(model.animate(40 + CARE_DURATION)).toBe('idle');
        expect(props.visible).toBe(false);
        model.startCare(action, 50);
        expect(model.animate(50)).toBe('approach');
        expect(props.visible).toBe(true);
        model.startCare(action, 50.5);
        expect(model.animate(50.5)).toBe('approach');
        expect(model.animate(50.5 + CARE_DURATION)).toBe('idle');
        const ambient = buildWorldModel(subject, world, { batch: true });
        ambient.animate(50.5 + CARE_DURATION);
        ambient.root.updateMatrixWorld(true); model.root.updateMatrixWorld(true);
        for (const name of [actor.name, 'head', 'tail', 'canopy', 'leaf:left', 'leaf:right', 'mouth', 'pectoral-fin']) {
          const expected = ambient.root.getObjectByName(name);
          if (expected) expect(model.root.getObjectByName(name)!.matrixWorld.elements).toEqual(expected.matrixWorld.elements);
        }
        model.startCare(action, 60, true);
        expect(props.visible).toBe(false);
        expect(model.animate(60 + CARE_DURATION)).toBe('idle');
        disposeModel(model.root); disposeModel(ambient.root);
      });
    }
  });
}

test('thrown ball stays above the lawn throughout its finite flight and reaches the front play space', () => {
  const model = buildWorldModel('math', { ...EMPTY_GAME_STATE.worlds.math, growthMilestones: [1] }, { batch: true });
  const ball = model.root.getObjectByName('care:play')!;
  model.startCare('play', 0);
  for (const time of [0, 0.25, 0.55, 0.9, 1.1, 1.4, 2.2, 2.8, 3.4]) {
    model.animate(time);
    // WebGLRenderer updates the graph before drawing; measure that rendered pose.
    model.root.updateMatrixWorld(true);
    expect(new Box3().setFromObject(ball).min.y).toBeGreaterThan(0.04);
  }
  model.animate(1.4);
  expect(ball.position.z).toBeGreaterThan(2.5);
  disposeModel(model.root);
});

test('puppy house has an upright centered gable ridge and level overhanging eaves', () => {
  const model = buildWorldModel('math', { ...EMPTY_GAME_STATE.worlds.math, placements: { 'puppy-house': 'front-garden' } });
  const roof = model.root.getObjectByName('gable-roof') as Mesh;
  expect(roof).toBeInstanceOf(Mesh);
  const positions = roof.geometry.getAttribute('position');
  const points = Array.from({ length: positions.count }, (_, i) => new Vector3().fromBufferAttribute(positions, i));
  const maxY = Math.max(...points.map((p) => p.y));
  const minY = Math.min(...points.map((p) => p.y));
  expect(maxY - minY).toBeGreaterThan(0.4);
  expect(points.filter((p) => Math.abs(p.y - maxY) < 0.001).every((p) => Math.abs(p.x) < 0.05)).toBe(true);
  expect(Math.max(...points.filter((p) => p.y === minY).map((p) => Math.abs(p.x)))).toBeGreaterThan(0.525);
  expect(new Box3().setFromObject(roof).getSize(new Vector3()).z).toBeGreaterThan(0.7);
  disposeModel(model.root);
});

test('aquarium viewing face has no upper crossbar and preserves separate glass and opaque surfaces', () => {
  const model = buildWorldModel('english', EMPTY_GAME_STATE.worlds.english);
  const surfaces = new Set<number>();
  model.root.traverse((object) => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
    surfaces.add(object.material.roughness);
    if (object.geometry.type === 'BoxGeometry' && object.position.z > 3 && object.position.y > 3) {
      expect(object.scale.x).toBeLessThan(1);
    }
  });
  expect(surfaces.size).toBeGreaterThanOrEqual(3);
  disposeModel(model.root);
});

test.each(['korean', 'english', 'math'] as const)('%s initial framing is closer but mature projected actor size still grows', (subject) => {
  for (const aspect of [1.16, 1.7, 0.8]) {
    const baby = worldFraming(subject, 0, aspect);
    const grown = worldFraming(subject, 3, aspect);
    expect(baby.distance).toBeLessThan(grown.distance);
    expect(baby.distance).toBeLessThan(14.5);
    expect(grown.distance / baby.distance).toBeLessThan(1.4);
  }
});
