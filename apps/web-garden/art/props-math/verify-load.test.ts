/** Real Three.js loader integration, entirely numerical: no canvas or renderer. */
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ids = ['puppy-ball', 'soft-bed', 'puppy-house', 'flower-hoop', 'water-bowl',
  'paw-flag', 'feeding-bowl', 'grooming-brush', 'dog-food'];

test('shipped library loads with all nine independently placeable identity parts', async () => {
  const bytes = readFileSync(new URL('../../public/models/props-math.glb', import.meta.url));
  const report = JSON.parse(readFileSync(new URL('./props-math-report.json', import.meta.url), 'utf8'));
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
