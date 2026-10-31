/** Real Three.js loader integration, entirely numerical: no canvas or renderer. */
import { expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { parsePropAsset, createPropInstancer } from '../../src/prop-asset.ts';
import { disposeModel } from '../../src/garden-models.ts';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ids = ['puppy-ball', 'soft-bed', 'puppy-house', 'flower-hoop', 'water-bowl',
  'paw-flag', 'feeding-bowl', 'grooming-brush', 'dog-food'];

test('shipped library loads with all nine independently placeable identity parts', async () => {
  const bytes = readFileSync(new URL('../../public/models/props-math.glb', import.meta.url));
  const report = JSON.parse(readFileSync(new URL('./props-math-report.json', import.meta.url), 'utf8'));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(report.sha256);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  expect(gltf.animations).toHaveLength(0);
  expect(gltf.cameras).toHaveLength(0);
  expect(gltf.scene.children).toHaveLength(1);
  const root = gltf.scene.getObjectByName('math-props')!;
  expect(root.children.map(part => part.name).sort()).toEqual([...ids].sort());
  const materials = new Set<THREE.Material>();
  let triangles = 0;
  let meshes = 0;
  for (const id of ids) {
    const part = root.getObjectByName(id)!;
    expect(part.position.toArray()).toEqual([0, 0, 0]);
    expect(part.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(part.scale.toArray()).toEqual([1, 1, 1]);
    const original = new THREE.Box3().setFromObject(part, true);
    for (let axis = 0; axis < 3; axis++) {
      expect(original.min.getComponent(axis)).toBeCloseTo(report.parts[id].bounds.min[axis], 6);
      expect(original.max.getComponent(axis)).toBeCloseTo(report.parts[id].bounds.max[axis], 6);
    }
    const clone = part.clone(true);
    clone.position.set(2, 3, -4);
    const placed = new THREE.Box3().setFromObject(clone, true);
    expect(placed.min.distanceTo(original.min.clone().add(clone.position))).toBeLessThan(1e-6);
    expect(part.position.toArray()).toEqual([0, 0, 0]);
    part.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      expect(object.isSkinnedMesh).toBeUndefined();
      for (const name of ['position', 'normal', 'uv', 'color']) {
        expect(object.geometry.getAttribute(name).count).toBeGreaterThan(0);
      }
      const colors = object.geometry.getAttribute('color');
      if (colors.itemSize === 4) for (let i = 0; i < colors.count; i++) expect(colors.getW(i)).toBe(1);
      triangles += object.geometry.index!.count / 3;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
        const standard = material as THREE.MeshStandardMaterial;
        expect(standard.vertexColors).toBe(true);
        expect(standard.color.toArray()).toEqual([1, 1, 1]);
        expect(standard.map).toBeNull();
        materials.add(material);
      }
    });
  }
  expect(triangles).toBe(report.total_triangles);
  expect(meshes).toBe(report.total_primitives);
  expect(materials.size).toBe(3);
}, 10000);


test('real runtime instancing keeps identities and disposes owned shared resources once', async () => {
  const bytes = readFileSync(new URL('../../public/models/props-math.glb', import.meta.url));
  const template = await parsePropAsset('math', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const own = createPropInstancer('math', template);
  const other = createPropInstancer('math', template);
  const world = new THREE.Group();
  const sibling = new THREE.Group();
  const owned = new Set<THREE.BufferGeometry | THREE.Material>();
  const original = new Set<THREE.BufferGeometry | THREE.Material>();
  for (const id of ids) {
    const instance = own(id), another = other(id);
    world.add(instance); sibling.add(another);
    instance.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const source = template.getObjectByName(object.name) as THREE.Mesh;
      const independent = another.getObjectByName(object.name) as THREE.Mesh;
      expect(object.geometry === source.geometry).toBe(false);
      expect(object.geometry === independent.geometry).toBe(false);
      expect(object.geometry.getAttribute('position').count).toBe(source.geometry.getAttribute('position').count);
      owned.add(object.geometry); original.add(source.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) owned.add(material);
      for (const material of Array.isArray(source.material) ? source.material : [source.material]) original.add(material);
    });
  }
  const repeated = own('feeding-bowl');
  world.add(repeated);
  const spies = [...owned].map(resource => vi.spyOn(resource, 'dispose'));
  const immutable = [...original].map(resource => vi.spyOn(resource, 'dispose'));
  disposeModel(world);
  for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  for (const spy of immutable) expect(spy).not.toHaveBeenCalled();
  expect(template.children.map(part => part.name).sort()).toEqual([...ids].sort());
  disposeModel(sibling);
  vi.restoreAllMocks();
  disposeModel(template);
});

test('doorway and depressed bowl/bed interiors remain genuine exported geometry', async () => {
  const bytes = readFileSync(new URL('../../public/models/props-math.glb', import.meta.url));
  const root = await parsePropAsset('math', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  root.updateMatrixWorld(true);
  const front = new THREE.Raycaster(new THREE.Vector3(0, .50, .8), new THREE.Vector3(0, 0, -1));
  expect(front.intersectObject(root.getObjectByName('puppy-house')!, true)[0]!.point.z).toBeLessThan(-.35);
  for (const id of ['soft-bed', 'feeding-bowl', 'water-bowl']) {
    const part = root.getObjectByName(id)!;
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(part, true)[0]!;
    const bounds = new THREE.Box3().setFromObject(part);
    expect(bounds.max.y - hit.point.y).toBeGreaterThan(id === 'soft-bed' ? .20 : .07);
  }
  disposeModel(root);
});
