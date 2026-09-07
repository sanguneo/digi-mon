import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Box3, BufferGeometry, Group, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { expect, test, vi } from 'vitest';
import { createPropAssetLoader, createPropInstancer, parsePropAsset, PROP_ASSET_URLS, PROP_IDS } from './prop-asset.ts';
import { buildWorldModel, readShippedAssetBytes, shippedProps } from './puppy-asset.test-fixture.ts';
import { buildWorldModel as buildRuntime, disposeModel } from './garden-models.ts';
import { EMPTY_GAME_STATE, GARDEN_SPOTS } from './game-state.ts';
import { WORLD_CATALOGS, WORLDS } from './garden-worlds.ts';

function meshes(root: Object3D) {
  const result: Mesh[] = [];
  root.traverse(object => { if (object instanceof Mesh) result.push(object); });
  return result;
}
function resources(objects: Mesh[]) {
  return [...new Set(objects.flatMap(mesh => [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]))];
}
const positions = [
  [-2.8, 0.1, -0.3], [2.7, 0.1, 0.8], [-0.65, 0.1, 2.1], [0, 0.1, -2.2],
  [-2.7, 0.1, 1.8], [2.8, 0.1, -1.7], [0.7, 0.1, 2.55], [2.6, 0.1, 2.25],
];

test('the shipped libraries contain exactly 31 required reusable IDs', () => {
  expect(Object.values(PROP_IDS).flat()).toHaveLength(31);
  for (const subject of ['korean', 'english', 'math'] as const) {
    expect(shippedProps[subject].children.map(object => object.name).sort()).toEqual([...PROP_IDS[subject]].sort());
  }
});

for (const subject of ['korean', 'english', 'math'] as const) {
  test(`${subject} parses shipped identity parts with authored colors, UVs and historic local bounds`, async () => {
    const template = await parsePropAsset(subject, await readShippedAssetBytes(`props-${subject}`));
    const baseline = JSON.parse(await readFile(resolve(dirname(fileURLToPath(import.meta.url)), `../art/props-${subject}/baseline-bounds.json`), 'utf8'));
    const materials = new Set();
    expect(template.name).toBe(`${subject}-props`);
    for (const part of template.children) {
      expect(part.position.toArray()).toEqual([0, 0, 0]);
      expect(part.scale.toArray()).toEqual([1, 1, 1]);
      expect(part.quaternion.toArray()).toEqual([0, 0, 0, 1]);
      const bounds = new Box3().setFromObject(part);
      for (const edge of ['min', 'max'] as const) {
        bounds[edge].toArray().forEach((value, index) => {
          // Math intentionally removed the old ball's protruding .018 seam.
          const tolerance = subject === 'math' && part.name === 'puppy-ball' ? 0.018001 : subject === 'math' ? 0.00637 : 0.000002;
          expect(Math.abs(value - baseline.bounds[part.name][edge][index])).toBeLessThan(tolerance);
        });
      }
      expect(meshes(part).length).toBeGreaterThan(0);
      for (const mesh of meshes(part)) {
        expect(mesh.geometry.getAttribute('uv').count).toBe(mesh.geometry.getAttribute('position').count);
        expect(mesh.geometry.getAttribute('color').count).toBe(mesh.geometry.getAttribute('position').count);
        const material = mesh.material as MeshStandardMaterial;
        materials.add(material);
        expect(material.vertexColors).toBe(true);
        expect(material.color.toArray()).toEqual([1, 1, 1]);
      }
    }
    expect(materials.size).toBeLessThanOrEqual(3);
    disposeModel(template);
  });

  test(`${subject} rejects missing required data instead of substituting primitives`, async () => {
    const bytes = await readShippedAssetBytes(`props-${subject}`);
    const length = new DataView(bytes).getUint32(12, true);
    const json = new TextDecoder().decode(new Uint8Array(bytes, 20, length));
    const id = PROP_IDS[subject][0]!;
    const broken = json.replace(`"name":"${id}"`, `"name":"${'x'.repeat(id.length)}"`);
    expect(broken).not.toBe(json);
    new Uint8Array(bytes, 20, length).set(new TextEncoder().encode(broken));
    await expect(parsePropAsset(subject, bytes)).rejects.toThrow(/required prop/);
    // Empty actor objects test only the missing-library guard, before any actor cloning.
    expect(() => buildRuntime(subject, EMPTY_GAME_STATE.worlds[subject], {
      puppyTemplate: new Group(), treeTemplate: new Group(), fishTemplate: new Group(),
    })).toThrow(/prop/i);
  });

  test(`${subject} shares owned immutable resources within a world, not with another world or the template`, () => {
    const template = shippedProps[subject];
    const id = PROP_IDS[subject][0]!;
    const instantiate = createPropInstancer(subject, template);
    const first = instantiate(id), second = instantiate(id), other = createPropInstancer(subject, template)(id);
    const source = meshes(template.getObjectByName(id)!);
    const a = meshes(first), b = meshes(second), c = meshes(other);
    first.position.x = 5;
    expect(second.position.x).toBe(0);
    a.forEach((mesh, index) => {
      expect(mesh.geometry === b[index]!.geometry).toBe(true);
      expect(mesh.material === b[index]!.material).toBe(true);
      expect(mesh.geometry === c[index]!.geometry).toBe(false);
      expect(mesh.material === c[index]!.material).toBe(false);
      expect(mesh.geometry === source[index]!.geometry).toBe(false);
      expect(mesh.material === source[index]!.material).toBe(false);
    });
    const root = new Group();
    root.add(first, second);
    const owned = resources(a).map(resource => vi.spyOn(resource, 'dispose'));
    const protectedSpies = resources([...source, ...c]).map(resource => vi.spyOn(resource, 'dispose'));
    disposeModel(root);
    for (const spy of owned) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of protectedSpies) expect(spy).not.toHaveBeenCalled();
    disposeModel(other);
    vi.restoreAllMocks();
  });

  test(`${subject} clones only used prop geometry and shares roles across different parts`, () => {
    const templateGeometry = new Set(meshes(shippedProps[subject]).map(mesh => mesh.geometry));
    const clone = vi.spyOn(BufferGeometry.prototype, 'clone');
    const model = buildWorldModel(subject, EMPTY_GAME_STATE.worlds[subject]);
    const parts: Object3D[] = [];
    model.root.traverse(object => { if (object.userData.assetSource === PROP_ASSET_URLS[subject]) parts.push(object); });
    const used = new Set(parts.flatMap(part => meshes(shippedProps[subject].getObjectByName(part.name)!)).map(mesh => mesh.geometry));
    const cloned = clone.mock.contexts.filter(geometry => geometry instanceof BufferGeometry && templateGeometry.has(geometry));
    expect(cloned.length).toBe(used.size);
    expect(new Set(cloned)).toEqual(used);
    const roleOwners = new Map<string, Mesh['material']>();
    for (const part of parts) for (const mesh of meshes(part)) {
      const name = (mesh.material as MeshStandardMaterial).name;
      if (roleOwners.has(name)) expect(mesh.material === roleOwners.get(name)).toBe(true);
      else roleOwners.set(name, mesh.material);
    }
    disposeModel(model.root);
    clone.mockRestore();
  });

  test(`${subject} caches active requests and releases rejections for deterministic retry`, async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<Object3D>((_, no) => { reject = no; });
    const load = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(shippedProps[subject]);
    const loader = createPropAssetLoader(subject, load);
    const first = loader();
    expect(loader()).toBe(first);
    const observed = expect(first).rejects.toThrow('503');
    reject(new Error('503'));
    await observed;
    const retry = loader();
    expect(loader()).toBe(retry);
    expect(await retry).toBe(shippedProps[subject]);
    expect(await loader()).toBe(shippedProps[subject]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test(`${subject} uses every catalog at all eight exact spots with .78 scale and deterministic fan-out`, () => {
    for (const [index, spot] of GARDEN_SPOTS.entries()) {
      const world = { ...EMPTY_GAME_STATE.worlds[subject], placements: Object.fromEntries(WORLD_CATALOGS[subject].map(part => [part.id, spot.id])) };
      const model = buildWorldModel(subject, world, { batch: true });
      WORLD_CATALOGS[subject].forEach((item, slot) => {
        const wrapper = model.root.children.find(object => object.name === `decoration:${item.id}` && object.scale.x === 0.78)!;
        expect(wrapper.position.toArray()).toEqual([
          positions[index]![0]! + (slot % 3 - 1) * 0.42, 0.1, positions[index]![2]! - Math.floor(slot / 3) * 0.5,
        ]);
        expect(wrapper.scale.toArray()).toEqual([0.78, 0.78, 0.78]);
        expect(wrapper.children[0]!.name).toBe(item.id);
        expect(wrapper.children[0]!.userData.assetSource).toBe(PROP_ASSET_URLS[subject]);
      });
      disposeModel(model.root);
    }
  });

  test(`${subject} care retains authored parts, existing pivots, finite completion and no allocation/history replay`, () => {
    const model = buildWorldModel(subject, {
      ...EMPTY_GAME_STATE.worlds[subject], lastCare: WORLDS[subject].care[0]!.id,
    }, { batch: true });
    const required = subject === 'korean'
      ? { 'watering-can': 'care-tool', 'sunlight-token': 'care:sunlight' }
      : subject === 'english'
        ? { 'fish-food': 'care-morsels', 'bubble-trail': 'care:play' }
        : { 'feeding-bowl': 'bowl', 'grooming-brush': 'care:brush', 'dog-food': 'care:feed', 'puppy-ball': 'decoration:puppy-ball' };
    for (const [id, parent] of Object.entries(required)) expect(model.root.getObjectByName(id)!.parent!.name).toBe(parent);
    const geometry = meshes(model.root).map(mesh => mesh.geometry);
    for (const care of WORLDS[subject].care) {
      expect(model.root.getObjectByName(`care:${care.id}`)!.visible).toBe(false);
      model.startCare(care.id, 0); model.animate(1.4);
      expect(model.root.getObjectByName(`care:${care.id}`)!.visible).toBe(true);
      if (subject === 'korean') {
        expect(model.root.getObjectByName('care-tool')!.position.toArray()).toEqual([-1.25, 1.45, 0.55]);
        expect(model.root.getObjectByName('care-tool')!.rotation.z).toBe(-0.7);
        expect(model.root.getObjectByName('care:sunlight')!.position.toArray()).toEqual([1.65, 2.2, 0]);
      }
      if (subject === 'english') {
        expect(model.root.getObjectByName('care:feed')!.position.toArray()).toEqual([1.15, 2.55 - 0.05 * 0.82, 0.75]);
      }
      if (subject === 'math') {
        expect(model.root.getObjectByName('bowl')!.position.toArray()).toEqual([0.9, 0.09, 1.6]);
        expect(model.root.getObjectByName('care:feed')!.position.toArray()).toEqual([0.9, 0.41, 1.6]);
      }
      expect(model.animate(3.6)).toBe('idle');
      expect(model.root.getObjectByName(`care:${care.id}`)!.visible).toBe(false);
    }
    expect(meshes(model.root).map(mesh => mesh.geometry)).toEqual(geometry);
    disposeModel(model.root);
  });
}

test('math reuses one owned ball geometry for placement, growth decoration and care play', () => {
  const model = buildWorldModel('math', {
    ...EMPTY_GAME_STATE.worlds.math, growthMilestones: [1], placements: { 'puppy-ball': GARDEN_SPOTS[0]!.id },
  }, { batch: true });
  const balls: Object3D[] = [];
  model.root.traverse(object => { if (object.name === 'puppy-ball') balls.push(object); });
  expect(balls).toHaveLength(3);
  const geometry = balls.map(ball => meshes(ball)[0]!.geometry);
  expect(new Set(geometry).size).toBe(1);
  expect(balls.map(ball => ball.parent!.scale.x)).toEqual([1, 1, 0.78]);
  disposeModel(model.root);
});
