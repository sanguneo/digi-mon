import { readFile } from 'node:fs/promises';
import { Box3, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { expect, test, vi } from 'vitest';
import { createPuppyAssetLoader, parsePuppyAsset, clonePuppyAsset, PUPPY_ASSET_URL } from './puppy-asset.ts';
import { buildWorldModel, disposeModel } from './garden-models.ts';
import { EMPTY_GAME_STATE } from './game-state.ts';

test('failed loads retry, concurrent loads share a template, and successful loads are cached', async () => {
  const failure = new Error('asset unavailable');
  const load = vi.fn().mockRejectedValueOnce(failure).mockImplementation(async () => {
    const bytes = await readFile(new URL('../public/models/puppy.glb', import.meta.url));
    return parsePuppyAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  });
  const loader = createPuppyAssetLoader(load);
  await expect(loader()).rejects.toBe(failure);
  const [first, second] = await Promise.all([loader(), loader()]);
  expect(first).toBe(second);
  expect(await loader()).toBe(first);
  expect(load).toHaveBeenCalledTimes(2);
  disposeModel(first);
});

test('shipped GLB preserves its authored nodes, appearance, growth and independently owned resources', async () => {
  const bytes = await readFile(new URL('../public/models/puppy.glb', import.meta.url));
  expect(bytes.byteLength).toBeLessThanOrEqual(3_000_000);
  const template = await parsePuppyAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  expect(template.name).toBe('puppy-asset');
  expect(template.position.toArray()).toEqual([0, 0, 0]);
  expect(template.scale.toArray()).toEqual([1, 1, 1]);
  expect(template.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  expect(template.getObjectByName('head')!.position.toArray()).toEqual([0, expect.closeTo(1.6), expect.closeTo(0.5)]);
  expect(template.getObjectByName('tail')!.position.toArray()).toEqual([0, expect.closeTo(1.03), expect.closeTo(-0.94)]);
  expect(template.getObjectByName('body')).toBeDefined();
  const bounds = new Box3().setFromObject(template);
  const size = bounds.getSize(new Vector3());
  expect(bounds.min.y).toBeCloseTo(0, 2);
  expect(size.x).toBeGreaterThan(1.5); expect(size.x).toBeLessThan(2.2);
  expect(size.y).toBeGreaterThan(2); expect(size.y).toBeLessThan(2.8);
  expect(size.z).toBeGreaterThan(2.3); expect(size.z).toBeLessThan(3.3);
  let triangles = 0;
  const materials = new Set();
  template.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    expect(object.geometry.getAttribute('color').count).toBe(object.geometry.getAttribute('position').count);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      expect(material).toBeInstanceOf(MeshStandardMaterial);
      expect((material as MeshStandardMaterial).vertexColors).toBe(true);
      expect((material as MeshStandardMaterial).color.toArray()).toEqual([1, 1, 1]);
      expect(Object.values(material).some((value) => value instanceof Texture)).toBe(false);
      materials.add(material);
    }
  });
  expect(triangles).toBeGreaterThan(0); expect(triangles).toBeLessThanOrEqual(45_000);
  expect(materials.size).toBeLessThanOrEqual(5);
  for (const stage of [0, 1, 2, 3]) {
    const model = buildWorldModel('math', { ...EMPTY_GAME_STATE.worlds.math, growthMilestones: ([1, 2, 3] as const).slice(0, stage) }, { batch: true, puppyTemplate: template });
    const puppy = model.root.getObjectByName('puppy')!;
    expect(puppy.scale.x).toBe([0.7, 0.9, 1.08, 1.2][stage]);
    const asset = puppy.getObjectByName('puppy-asset')!;
    expect(asset.userData.assetSource).toBe(PUPPY_ASSET_URL);
    for (const [name, visible] of [['growth-collar', stage >= 1], ['growth-bandana', stage >= 2]] as const) {
      const accessory = asset.getObjectByName(name);
      if (accessory) expect(accessory.visible).toBe(visible);
    }
    const other = clonePuppyAsset(template);
    const templateDisposals: ReturnType<typeof vi.spyOn>[] = [];
    const ownedDisposals: ReturnType<typeof vi.spyOn>[] = [];
    asset.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const source = template.getObjectByName(object.name) as Mesh;
      const sibling = other.getObjectByName(object.name) as Mesh;
      // Vitest's negated toBe still deep-compares unequal objects to construct
      // diagnostics. Compare identity explicitly, without traversing GLB buffers.
      expect(object.geometry === source.geometry).toBe(false);
      expect(object.geometry === sibling.geometry).toBe(false);
      expect(object.material === source.material).toBe(false);
      // Compare the complete serialized geometry, but avoid assertion-library
      // traversal of hundreds of thousands of individual numeric properties.
      expect(JSON.stringify(object.geometry.toJSON())).toBe(JSON.stringify({ ...source.geometry.toJSON(), uuid: object.geometry.uuid }));
      const actualMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const sourceMaterials = Array.isArray(source.material) ? source.material : [source.material];
      actualMaterials.forEach((material, index) => {
        expect(material.toJSON()).toEqual({ ...sourceMaterials[index]!.toJSON(), uuid: material.uuid });
        ownedDisposals.push(vi.spyOn(material, 'dispose'));
        templateDisposals.push(vi.spyOn(sourceMaterials[index]!, 'dispose'));
      });
      expect(object.castShadow).toBe(true); expect(object.receiveShadow).toBe(true);
      ownedDisposals.push(vi.spyOn(object.geometry, 'dispose'));
      templateDisposals.push(vi.spyOn(source.geometry, 'dispose'));
    });
    disposeModel(model.root);
    for (const spy of ownedDisposals) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of templateDisposals) expect(spy).not.toHaveBeenCalled();
    disposeModel(other);
    vi.restoreAllMocks();
  }
  disposeModel(template);
});

test('math cannot silently build a primitive substitute without an asset', () => {
  expect(() => buildWorldModel('math', EMPTY_GAME_STATE.worlds.math)).toThrow(/puppy/i);
});

test('a parsed scene missing the animation contract rejects instead of substituting primitives', async () => {
  const data = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }] }));
  await expect(parsePuppyAsset(data.buffer)).rejects.toThrow(/required root, body, head or tail/);
});
