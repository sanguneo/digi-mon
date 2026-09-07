import { BufferGeometry, Material, Matrix3, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { describe, expect, test, vi } from 'vitest';
import type { Subject } from './api.ts';
import { EMPTY_GAME_STATE, GARDEN_SPOTS, type WorldState } from './game-state.ts';
import { disposeModel } from './garden-models.ts';
import { buildWorldModel } from './puppy-asset.test-fixture.ts';
import { WORLD_CATALOGS, WORLDS } from './garden-worlds.ts';

// Measured by executing garden-models.ts from Git 31c4e1524b4c59a5e1559f4ba0b9179b63578728,
// with empty placements, all four stages, batch=false/true. Counts include hidden
// pooled care geometry, exactly like resources() below; they are not visible-frame estimates.
const PROCEDURAL_MATH_BASELINE = [
  { puppyTriangles: 20_800, puppyMeshes: 50, puppyBatchedMeshes: 4, worldTriangles: 56_416, worldBatchedMeshes: 11 },
  { puppyTriangles: 22_120, puppyMeshes: 52, puppyBatchedMeshes: 4, worldTriangles: 59_056, worldBatchedMeshes: 11 },
  { puppyTriangles: 22_126, puppyMeshes: 53, puppyBatchedMeshes: 4, worldTriangles: 59_062, worldBatchedMeshes: 11 },
  { puppyTriangles: 22_126, puppyMeshes: 53, puppyBatchedMeshes: 4, worldTriangles: 69_510, worldBatchedMeshes: 11 },
] as const;

function worldAt(subject: Subject, stage: number): WorldState {
  return {
    ...EMPTY_GAME_STATE.worlds[subject],
    growthMilestones: ([1, 2, 3] as const).slice(0, stage),
    placements: Object.fromEntries(WORLD_CATALOGS[subject].map((item, i) => [item.id, GARDEN_SPOTS[i % GARDEN_SPOTS.length]!.id])),
  };
}

function resources(root: Object3D) {
  const meshes: Mesh[] = [];
  root.traverse((object) => { if (object instanceof Mesh) meshes.push(object); });
  return {
    meshes,
    triangles: meshes.reduce((sum, object) => sum + (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3, 0),
    geometries: new Set(meshes.map((object) => object.geometry)),
    materials: new Set(meshes.flatMap((object) => Array.isArray(object.material) ? object.material : [object.material])),
  };
}

// Identify animation frames independently of the batching implementation. Retain
// object references before animation so moving balls/particles cannot hide errors.
function motionFrames(root: Object3D) {
  const frames = new Map<Object3D, string>([[root, 'world']]);
  root.traverse((object) => {
    if (['growing-tree', 'fish', 'puppy', 'head', 'tail', 'canopy', 'leaf:left', 'leaf:right', 'mouth', 'pectoral-fin', 'care-tool', 'care-drops', 'care-morsels'].includes(object.name)
      || object.name.startsWith('care:')) {
      frames.set(object, `motion:${frames.size}`);
    }
  });
  return frames;
}

// Compare indexed triangle streams, not just bounds or counts: every position,
// normal, UV, linear color, opacity and shadow flag must survive at every pose.
function triangleStreams(root: Object3D, frames: Map<Object3D, string>) {
  root.updateMatrixWorld(true);
  const streams = new Map<string, number[]>();
  const vertex = new Vector3();
  const normal = new Vector3();
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
    let owner: Object3D = object;
    while (!frames.has(owner)) owner = owner.parent!;
    const geometry = object.geometry;
    const position = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const colors = object.material.vertexColors ? geometry.getAttribute('color') : undefined;
    const normalMatrix = new Matrix3().getNormalMatrix(object.matrixWorld);
    const flags = `${frames.get(owner)}:${object.material.opacity}:${object.material.transparent}:${object.material.roughness}:${object.material.metalness}:${object.castShadow}:${object.receiveShadow}:uv=${!!uv}`;
    let previousColor = '';
    let previousR = -1, previousG = -1, previousB = -1;
    let stream: number[] = [];
    for (let i = 0; i < (geometry.index?.count ?? position.count); i++) {
      const index = geometry.index?.getX(i) ?? i;
      const r = (colors ? colors.getX(index) : 1) * object.material.color.r;
      const g = (colors ? colors.getY(index) : 1) * object.material.color.g;
      const b = (colors ? colors.getZ(index) : 1) * object.material.color.b;
      if (r !== previousR || g !== previousG || b !== previousB) {
        previousR = r; previousG = g; previousB = b;
        previousColor = `${Math.fround(r)},${Math.fround(g)},${Math.fround(b)}`;
        const key = `${flags}:${previousColor}`;
        stream = streams.get(key) ?? [];
        streams.set(key, stream);
      }
      vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      normal.fromBufferAttribute(normals, index).applyNormalMatrix(normalMatrix);
      stream.push(vertex.x, vertex.y, vertex.z, normal.x, normal.y, normal.z, uv?.getX(index) ?? 0, uv?.getY(index) ?? 0,
        colors?.itemSize === 4 ? colors.getW(index) : 1);
    }
  });
  return streams;
}

function expectSameTriangles(original: Map<string, number[]>, batched: Map<string, number[]>) {
  expect([...batched.keys()].sort()).toEqual([...original.keys()].sort());
  for (const [key, expected] of original) {
    const actual = batched.get(key)!;
    expect(actual.length).toBe(expected.length);
    let maxError = 0;
    for (let i = 0; i < expected.length; i++) maxError = Math.max(maxError, Math.abs(expected[i]! - actual[i]!));
    expect(maxError, key).toBeLessThan(0.00001);
  }
}

describe('world render batching', () => {
  test.each([0, 1, 2, 3])('math stage %i replaces only the puppy and retains the measured scenery budget', (stage) => {
    const model = buildWorldModel('math', { ...EMPTY_GAME_STATE.worlds.math, growthMilestones: ([1, 2, 3] as const).slice(0, stage) }, { batch: true });
    const world = resources(model.root);
    const puppy = resources(model.root.getObjectByName('puppy')!);
    const baseline = PROCEDURAL_MATH_BASELINE[stage]!;
    expect(world.triangles - puppy.triangles).toBe(baseline.worldTriangles - baseline.puppyTriangles);
    expect(world.meshes.length - puppy.meshes.length).toBe(baseline.worldBatchedMeshes - baseline.puppyBatchedMeshes);
    expect(puppy.triangles).toBeLessThanOrEqual(45_000);
    // The Blender file is already consolidated into independently articulated
    // primitives. Keep its authored roles/colors rather than rebaking them.
    expect(puppy.meshes.length).toBeLessThanOrEqual(6);
    expect(puppy.materials.size).toBeLessThanOrEqual(5);
    disposeModel(model.root);
  });

  test.each(['korean', 'english', 'math'] as const)('%s initial world cuts draw submissions and GPU resources without dropping triangles', (subject) => {
    const original = buildWorldModel(subject, EMPTY_GAME_STATE.worlds[subject]);
    const batched = buildWorldModel(subject, EMPTY_GAME_STATE.worlds[subject], { batch: true });
    const before = resources(original.root);
    const after = resources(batched.root);
    expect(after.meshes.length).toBeLessThanOrEqual(before.meshes.length * 0.15);
    expect(after.geometries.size).toBeLessThanOrEqual(before.geometries.size * 0.15);
    // Actual GLB measurement: three authored roles plus the unchanged world's
    // organic/wood/satin roles. Do not destroy authored response to hit the old
    // primitive-only five-material cap; other worlds retain that cap unchanged.
    if (subject === 'math') expect(after.materials.size).toBe(6);
    else expect(after.materials.size).toBeLessThanOrEqual(5);
    expect(after.triangles).toBe(before.triangles);
    for (const mesh of after.meshes.filter((object) => object.name === 'static-batch')) {
      expect(mesh.geometry.groups).toHaveLength(0);
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
      expect([0.92, 0.84, 0.42, 0.16]).toContain((mesh.material as MeshStandardMaterial).roughness);
    }
    disposeModel(original.root); disposeModel(batched.root);
  });

  for (const subject of ['korean', 'english', 'math'] as const) {
    for (const stage of [0, 1, 2, 3]) {
      test(`${subject} stage ${stage} preserves all placed geometry and animated care poses`, () => {
        for (const lastCare of [undefined, ...WORLDS[subject].care.map((care) => care.id)]) {
          const world = { ...worldAt(subject, stage), ...(lastCare ? { lastCare } : {}) };
          const original = buildWorldModel(subject, world);
          const batched = buildWorldModel(subject, world, { batch: true });
          const sourceFrames = motionFrames(original.root);
          const batchFrames = motionFrames(batched.root);
          expect(batchFrames.size).toBe(sourceFrames.size);
          if (lastCare) { original.startCare(lastCare, 0); batched.startCare(lastCare, 0); }
          for (const time of [0, 0.73, 1.4, 2.8, 4.2]) {
            original.animate(time); batched.animate(time);
            expectSameTriangles(triangleStreams(original.root, sourceFrames), triangleStreams(batched.root, batchFrames));
          }
          // Named placed transforms remain available, including deterministic fan-out.
          const placements = (root: Object3D) => root.children.filter((object) => object.scale.x === 0.78)
            .map((object) => [object.name, object.position.toArray(), object.scale.toArray()]);
          expect(placements(batched.root)).toEqual(placements(original.root));
          disposeModel(original.root); disposeModel(batched.root);
        }
      }, 30_000);
    }
  }

  test.each(['english', 'math'] as const)('%s temporary, replaced, shared and live resources are released once and never across worlds', (subject) => {
    const geometryDisposals = new Map<BufferGeometry, number>();
    const materialDisposals = new Map<Material, number>();
    const geometryDispose = BufferGeometry.prototype.dispose;
    const materialDispose = Material.prototype.dispose;
    const geometrySpy = vi.spyOn(BufferGeometry.prototype, 'dispose').mockImplementation(function (this: BufferGeometry) {
      geometryDisposals.set(this, (geometryDisposals.get(this) ?? 0) + 1);
      geometryDispose.call(this);
    });
    const materialSpy = vi.spyOn(Material.prototype, 'dispose').mockImplementation(function (this: Material) {
      materialDisposals.set(this, (materialDisposals.get(this) ?? 0) + 1);
      materialDispose.call(this);
    });
    try {
      const first = buildWorldModel(subject, { ...worldAt(subject, 3), lastCare: 'play' }, { batch: true });
      const second = buildWorldModel(subject, worldAt(subject, 3), { batch: true });
      const live = resources(second.root);
      disposeModel(first.root);
      for (const entry of live.geometries) expect(geometryDisposals.has(entry)).toBe(false);
      for (const entry of live.materials) expect(materialDisposals.has(entry)).toBe(false);
      disposeModel(second.root);
      for (const entry of live.geometries) expect(geometryDisposals.get(entry)).toBe(1);
      for (const entry of live.materials) expect(materialDisposals.get(entry)).toBe(1);
      for (const count of [...geometryDisposals.values(), ...materialDisposals.values()]) expect(count).toBe(1);
      expect(first.root.children).toHaveLength(0);
      expect(second.root.children).toHaveLength(0);
    } finally {
      geometrySpy.mockRestore(); materialSpy.mockRestore();
    }
  });
});
