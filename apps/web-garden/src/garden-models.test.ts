import { Box3, Mesh, Vector3 } from 'three';
import { describe, expect, test, vi } from 'vitest';
import { disposeModel } from './garden-models.ts';
import { buildWorldModel } from './puppy-asset.test-fixture.ts';
import { EMPTY_GAME_STATE, GARDEN_SPOTS, careForWorld, placeDecoration, recordAnswer, type WorldState } from './game-state.ts';
import { WORLD_CATALOGS } from './garden-worlds.ts';
import type { Subject } from './api.ts';

function matureWorld(subject: Subject): WorldState {
  let state = EMPTY_GAME_STATE;
  for (let i = 0; i < 36; i++) state = recordAnswer(state, 'models', String(i), subject).state;
  for (let i = 0; i < 6; i++) state = careForWorld(state, subject, subject === 'korean' ? 'water' : 'feed');
  return state.worlds[subject];
}

describe('real three-dimensional world geometry', () => {
  test.each(['korean', 'english', 'math'] as const)('%s contains lit volume meshes and substantially larger mature companion geometry', (subject) => {
    const baby = buildWorldModel(subject, EMPTY_GAME_STATE.worlds[subject]);
    const mature = buildWorldModel(subject, matureWorld(subject));
    const companion = subject === 'korean' ? 'growing-tree' : subject === 'english' ? 'fish' : 'puppy';
    const babySize = new Box3().setFromObject(baby.root.getObjectByName(companion)!).getSize(new Vector3());
    const matureSize = new Box3().setFromObject(mature.root.getObjectByName(companion)!).getSize(new Vector3());
    expect(matureSize.y).toBeGreaterThan(babySize.y * 1.5);
    expect(babySize.z).toBeGreaterThan(0.1);
    let meshes = 0;
    mature.root.traverse((object) => {
      if (object instanceof Mesh) {
        meshes++;
        expect(object.geometry.attributes.position!.count).toBeGreaterThan(0);
      }
    });
    expect(meshes).toBeGreaterThan(40);
    if (subject === 'english') {
      expect(mature.root.children.filter((object) => object.name === 'fish')).toHaveLength(2);
      expect(mature.root.getObjectByName('decoration:coral-garden')).toBeDefined();
    }
    if (subject === 'math') expect(mature.root.getObjectByName('decoration:flower-hoop')).toBeDefined();
    disposeModel(baby.root); disposeModel(mature.root);
  });

  test.each(['korean', 'english', 'math'] as const)('%s named placement points produce eight distinct real world transforms', (subject) => {
    const id = WORLD_CATALOGS[subject][0]!.id;
    const world = matureWorld(subject);
    const state = { ...EMPTY_GAME_STATE, worlds: { ...EMPTY_GAME_STATE.worlds, [subject]: world } };
    const positions = GARDEN_SPOTS.map((spot) => {
      const placed = placeDecoration(state, id, spot.id, subject);
      const model = buildWorldModel(subject, placed.worlds[subject]);
      const item = model.root.children.find((child) => child.name === `decoration:${id}` && child.scale.x === 0.78)!;
      expect(item).toBeDefined();
      const point = item.getWorldPosition(new Vector3()).toArray();
      disposeModel(model.root);
      return JSON.stringify(point);
    });
    expect(new Set(positions).size).toBe(8);
  });

  test('every unlocked catalog item has a distinct modeled decoration, not an empty placeholder', () => {
    for (const subject of ['korean', 'english', 'math'] as const) {
      const world = matureWorld(subject);
      world.placements = Object.fromEntries(WORLD_CATALOGS[subject].map((item) => [item.id, 'front-garden']));
      const model = buildWorldModel(subject, world);
      for (const item of WORLD_CATALOGS[subject]) {
        const decoration = model.root.children.find((child) => child.name === `decoration:${item.id}` && child.scale.x === 0.78)!;
        expect(decoration.children.length).toBeGreaterThan(0);
      }
      const placed = model.root.children.filter((child) => child.scale.x === 0.78);
      expect(new Set(placed.map((child) => child.position.toArray().join(','))).size).toBe(WORLD_CATALOGS[subject].length);
      disposeModel(model.root);
    }
  });

  test('model disposal releases shared materials and every geometry exactly once', () => {
    const model = buildWorldModel('english', matureWorld('english'));
    const geometrySpies = new Map();
    const materialSpies = new Map();
    model.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (!geometrySpies.has(object.geometry)) geometrySpies.set(object.geometry, vi.spyOn(object.geometry, 'dispose'));
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!materialSpies.has(material)) materialSpies.set(material, vi.spyOn(material, 'dispose'));
      }
    });
    disposeModel(model.root);
    for (const spy of [...geometrySpies.values(), ...materialSpies.values()]) expect(spy).toHaveBeenCalledTimes(1);
    expect(model.root.children).toHaveLength(0);
  });
});
