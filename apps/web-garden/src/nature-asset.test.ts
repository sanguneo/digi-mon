import { Box3, BufferGeometry, Mesh, MeshStandardMaterial, Object3D, Quaternion, Texture, Vector3 } from 'three';
import { expect, test, vi } from 'vitest';
import { cloneTreeAsset, TREE_ASSET_URL } from './tree-asset.ts';
import { cloneFishAsset, FISH_ASSET_URL } from './fish-asset.ts';
import { buildWorldModel, readShippedAssetBytes, shippedAssets } from './puppy-asset.test-fixture.ts';
import { CARE_DURATION, disposeModel } from './garden-models.ts';
import { EMPTY_GAME_STATE } from './game-state.ts';

function meshes(root: Object3D) {
  const result: Mesh[] = [];
  root.traverse((object) => { if (object instanceof Mesh) result.push(object); });
  return result;
}
function triangles(root: Object3D) {
  return meshes(root).reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3, 0);
}
function identity(root: Object3D) {
  expect(root.position.toArray()).toEqual([0, 0, 0]);
  expect(root.scale.toArray()).toEqual([1, 1, 1]);
  expect(root.quaternion.toArray()).toEqual([0, 0, 0, 1]);
}
function geometryData(geometry: BufferGeometry) {
  return JSON.stringify({ ...geometry.toJSON(), uuid: '' });
}

for (const name of ['tree', 'fish'] as const) {
  test(`shipped ${name} uses bounded authored geometry, linear vertex colors, normals/UVs, and no textures`, async () => {
    const data = await readShippedAssetBytes(name);
    expect(data.byteLength).toBeLessThanOrEqual(name === 'tree' ? 5_000_000 : 3_000_000);
    const jsonLength = new DataView(data).getUint32(12, true);
    const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, jsonLength)));
    expect(gltf.textures ?? []).toHaveLength(0);
    expect(gltf.images ?? []).toHaveLength(0);
    expect(gltf.materials.length).toBeLessThanOrEqual(3);
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
      expect(primitive.attributes).toHaveProperty('POSITION');
      expect(primitive.attributes).toHaveProperty('NORMAL');
      expect(primitive.attributes).toHaveProperty('TEXCOORD_0');
      expect(primitive.attributes).toHaveProperty('COLOR_0');
    }
    const template = name === 'tree' ? shippedAssets.treeTemplate! : shippedAssets.fishTemplate!;
    identity(template);
    expect(template.name).toBe(`${name}-asset`);
    expect(triangles(template)).toBeGreaterThan(0);
    expect(triangles(template)).toBeLessThanOrEqual(name === 'tree' ? 100_000 : 35_000);
    const materials = new Set();
    for (const mesh of meshes(template)) {
      const position = mesh.geometry.getAttribute('position');
      const color = mesh.geometry.getAttribute('color');
      expect(color.count).toBe(position.count);
      expect(mesh.geometry.getAttribute('normal').count).toBe(position.count);
      expect(mesh.geometry.getAttribute('uv').count).toBe(position.count);
      let min = 1, max = 0;
      for (let i = 0; i < color.count; i++) {
        min = Math.min(min, color.getX(i), color.getY(i), color.getZ(i));
        max = Math.max(max, color.getX(i), color.getY(i), color.getZ(i));
      }
      expect(min).toBeGreaterThanOrEqual(0); expect(max).toBeLessThanOrEqual(1);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        expect(material).toBeInstanceOf(MeshStandardMaterial);
        expect((material as MeshStandardMaterial).vertexColors).toBe(true);
        expect((material as MeshStandardMaterial).color.toArray()).toEqual([1, 1, 1]);
        expect(Object.values(material).some((value) => value instanceof Texture)).toBe(false);
      }
    }
    expect(materials.size).toBeLessThanOrEqual(3);
    if (name === 'fish') expect(meshes(template).length).toBeLessThanOrEqual(7);
  });
}

for (const stage of [0, 1, 2, 3]) {
  test(`tree stage ${stage} clones only the selected identity stage and preserves authored care rest transforms`, () => {
    const template = shippedAssets.treeTemplate!;
    for (const index of [0, 1, 2, 3]) identity(template.getObjectByName(`tree-stage-${index}`)!);
    const source = template.getObjectByName(`tree-stage-${stage}`)!;
    expect(triangles(source)).toBeLessThanOrEqual(35_000);
    expect(meshes(source).length).toBeLessThanOrEqual(6);
    const cloned = vi.spyOn(BufferGeometry.prototype, 'clone');
    const asset = cloneTreeAsset(template, stage);
    expect(cloned).toHaveBeenCalledTimes(new Set(meshes(source).map((mesh) => mesh.geometry)).size);
    cloned.mockRestore();
    expect(asset.userData.assetSource).toBe(TREE_ASSET_URL);
    expect(asset.children.map((child) => child.name)).toEqual([`tree-stage-${stage}`]);
    expect(triangles(asset)).toBe(triangles(source));
    for (const mesh of meshes(asset)) {
      const original = source.getObjectByName(mesh.name) as Mesh;
      expect(mesh.geometry === original.geometry).toBe(false);
      expect(geometryData(mesh.geometry)).toBe(geometryData(original.geometry));
    }
    disposeModel(asset);
    const model = buildWorldModel('korean', { ...EMPTY_GAME_STATE.worlds.korean, growthMilestones: ([1, 2, 3] as const).slice(0, stage) }, { batch: true });
    const actor = model.root.getObjectByName('growing-tree')!;
    expect(actor.position.z).toBe(stage === 0 ? 0.2 : -0.5);
    const names = stage === 0 ? ['leaf:left', 'leaf:right'] : ['canopy'];
    const pivots = names.map((name) => actor.getObjectByName(name)!);
    const rest = pivots.map((pivot) => ({ rotation: pivot.rotation.clone(), position: pivot.position.clone() }));
    if (stage === 0) {
      expect(rest[0]!.position.toArray()).toEqual([0, 1, 0]);
      expect(rest[1]!.position.toArray()).toEqual([0, expect.closeTo(1.35), expect.closeTo(0.02)]);
      for (const pivot of pivots) expect(pivot.quaternion.equals(new Quaternion())).toBe(true);
    } else expect(rest[0]!.position.y).toBeCloseTo(stage === 1 ? 1.6 : 2.15);
    for (const action of ['water', 'sunlight'] as const) {
      model.startCare(action, 0); model.animate(1.4);
      pivots.forEach((pivot, i) => {
        expect(pivot.rotation.z).toBeCloseTo(rest[i]!.rotation.z + (stage === 0 ? (i === 0 ? -0.38 : 0.38) : 0.045));
        expect(pivot.position.y).toBeCloseTo(rest[i]!.position.y + (stage === 0 ? 0 : 0.1));
      });
      model.animate(CARE_DURATION);
      pivots.forEach((pivot, i) => {
        expect(pivot.rotation.toArray()).toEqual(rest[i]!.rotation.toArray());
        expect(pivot.position.toArray()).toEqual(rest[i]!.position.toArray());
      });
    }
    disposeModel(model.root);
  });

  test(`fish stage ${stage} retains growth, +X food contact, named pivots and independently colored stage-zero friend`, () => {
    const template = shippedAssets.fishTemplate!;
    expect(template.getObjectByName('tail')!.position.toArray()).toEqual([expect.closeTo(-0.65), 0, 0]);
    expect(template.getObjectByName('pectoral-fin')!.position.toArray()).toEqual([0, expect.closeTo(-0.13), expect.closeTo(0.28)]);
    expect(template.getObjectByName('mouth')!.position.toArray()).toEqual([expect.closeTo(0.68), expect.closeTo(-0.05), 0]);
    const model = buildWorldModel('english', { ...EMPTY_GAME_STATE.worlds.english, growthMilestones: ([1, 2, 3] as const).slice(0, stage) }, { batch: true });
    const actors = model.root.children.filter((object) => object.name === 'fish');
    expect(actors).toHaveLength(stage >= 2 ? 2 : 1);
    actors.forEach((actor, index) => {
      const actorStage = index === 0 ? stage : 0;
      expect(actor.scale.x).toBe([0.82, 1.02, 1.27, 1.48][actorStage]);
      const asset = actor.getObjectByName('fish-asset')!;
      expect(asset.userData.assetSource).toBe(FISH_ASSET_URL);
      for (const [name, minimum] of [['growth-markings', 2], ['growth-fin-detail', 3]] as const) {
        const detail = asset.getObjectByName(name);
        if (detail) expect(detail.visible).toBe(actorStage >= minimum);
      }
      expect(actor.getObjectByName('pectoral-fin')!.rotation.z).toBe(-0.6);
    });
    const mouth = actors[0]!.getObjectByName('mouth')!;
    model.startCare('feed', 0); model.animate(1.4); model.root.updateMatrixWorld(true);
    expect(mouth.getWorldPosition(new Vector3()).distanceTo(model.root.getObjectByName('care:feed')!.position)).toBeLessThan(0.1);
    expect(mouth.scale.y).toBeGreaterThan(1);
    model.animate(CARE_DURATION);
    expect(mouth.scale.y).toBe(1);
    expect(model.root.getObjectByName('care:feed')!.visible).toBe(false);
    disposeModel(model.root);
  });
}

test('fish friend palette is deterministic, blue-biased, and never mutates cached or primary geometry', () => {
  const template = shippedAssets.fishTemplate!;
  const before = meshes(template).map((mesh) => geometryData(mesh.geometry));
  const primary = cloneFishAsset(template);
  const first = cloneFishAsset(template, true);
  const second = cloneFishAsset(template, true);
  let changed = 0, red = 0, blue = 0;
  for (const mesh of meshes(first)) {
    const original = template.getObjectByName(mesh.name) as Mesh;
    const other = second.getObjectByName(mesh.name) as Mesh;
    const normal = primary.getObjectByName(mesh.name) as Mesh;
    expect(geometryData(normal.geometry)).toBe(geometryData(original.geometry));
    expect(geometryData(mesh.geometry)).toBe(geometryData(other.geometry));
    expect(mesh.geometry === original.geometry || mesh.geometry === normal.geometry || mesh.geometry === other.geometry).toBe(false);
    const colors = mesh.geometry.getAttribute('color');
    const source = original.geometry.getAttribute('color');
    for (let i = 0; i < colors.count; i++) {
      if (colors.getX(i) !== source.getX(i) || colors.getZ(i) !== source.getZ(i)) changed++;
      red += colors.getX(i); blue += colors.getZ(i);
      if (colors.itemSize === 4) expect(colors.getW(i)).toBe(source.getW(i));
    }
  }
  expect(changed).toBeGreaterThan(0); expect(blue).toBeGreaterThan(red);
  expect(meshes(template).map((mesh) => geometryData(mesh.geometry))).toEqual(before);
  disposeModel(first); disposeModel(second); disposeModel(primary);
});

for (const name of ['tree', 'fish'] as const) {
  test(`${name} disposal cannot poison cached templates or other scene clones`, () => {
    const template = name === 'tree' ? shippedAssets.treeTemplate! : shippedAssets.fishTemplate!;
    const clone = () => name === 'tree' ? cloneTreeAsset(template, 3) : cloneFishAsset(template);
    const first = clone(), second = clone();
    const protectedResources = new Set(meshes(template).concat(meshes(second)).flatMap((mesh) => [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]));
    const protectedSpies = [...protectedResources].map((resource) => vi.spyOn(resource, 'dispose'));
    const owned = new Set(meshes(first).flatMap((mesh) => [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]));
    const ownedSpies = [...owned].map((resource) => vi.spyOn(resource, 'dispose'));
    for (const resource of owned) expect(protectedResources.has(resource)).toBe(false);
    disposeModel(first);
    for (const spy of ownedSpies) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of protectedSpies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    disposeModel(second);
  });
}

test('tree mature stages remain substantially larger than the sprout without hidden-stage bounds', () => {
  const baby = cloneTreeAsset(shippedAssets.treeTemplate!, 0);
  const mature = cloneTreeAsset(shippedAssets.treeTemplate!, 3);
  const babySize = new Box3().setFromObject(baby).getSize(new Vector3());
  const matureSize = new Box3().setFromObject(mature).getSize(new Vector3());
  expect(matureSize.y).toBeGreaterThan(babySize.y * 1.5);
  expect(babySize.z).toBeGreaterThan(0.1);
  disposeModel(baby); disposeModel(mature);
});
