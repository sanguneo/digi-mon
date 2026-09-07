import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ids = ['shell-arch', 'ribbon-kelp', 'coral-garden', 'bubble-rock',
  'treasure-chest', 'star-lamp', 'fish-food', 'bubble-trail'];
const baseline = JSON.parse(readFileSync(new URL('./baseline-bounds.json', import.meta.url), 'utf8')) as {
  bounds: Record<string, { min: number[]; max: number[] }>;
};
const report = JSON.parse(readFileSync(new URL('./validation-report.json', import.meta.url), 'utf8')) as {
  sha256: string; triangles: number; glb_bytes: number;
};
const bytes = readFileSync(new URL('../../public/models/props-english.glb', import.meta.url));

function close(actual: number[], expected: number[]) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, i) => expect(Math.abs(value - expected[i]!)).toBeLessThan(2e-6));
}

test('the delivered GLB loads through Three.js as eight vertex-colored identity-local meshes', async () => {
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(report.sha256);
  expect(bytes.byteLength).toBe(report.glb_bytes);
  expect(bytes.byteLength).toBeLessThanOrEqual(3_000_000);
  expect(gltf.animations).toHaveLength(0);
  expect(gltf.scene.children).toHaveLength(1);
  const root = gltf.scene.children[0]!;
  expect(root.name).toBe('english-props');
  expect(root.children.map((child) => child.name).sort()).toEqual([...ids].sort());
  const materials = new Set<THREE.Material>();
  let triangles = 0;
  for (const child of [root, ...root.children]) {
    close(child.position.toArray(), [0, 0, 0]);
    close(child.quaternion.toArray(), [0, 0, 0, 1]);
    close(child.scale.toArray(), [1, 1, 1]);
  }
  for (const child of root.children) {
    expect(child).toBeInstanceOf(THREE.Mesh);
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(mesh.children).toHaveLength(0);
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.material.transparent).toBe(false);
    expect(mesh.material.opacity).toBe(1);
    expect(mesh.material.map).toBeNull();
    expect(mesh.material.side).toBe(THREE.FrontSide);
    close(mesh.material.color.toArray(), [1, 1, 1]);
    materials.add(mesh.material);
    for (const attribute of ['position', 'normal', 'uv', 'color']) {
      expect(mesh.geometry.getAttribute(attribute).count).toBeGreaterThan(0);
    }
    const count = mesh.geometry.getIndex()!.count / 3;
    expect(count).toBeLessThanOrEqual(3500);
    triangles += count;
    const clone = mesh.clone(true);
    const box = new THREE.Box3().setFromObject(clone, true);
    close(box.min.toArray(), baseline.bounds[mesh.name]!.min);
    close(box.max.toArray(), baseline.bounds[mesh.name]!.max);
  }
  expect(materials.size).toBe(3);
  expect(triangles).toBe(report.triangles);
  expect(triangles).toBeLessThanOrEqual(30_000);

  // Exercise the real care whole-group and inventory transform contracts.
  for (const id of ids) {
    const clone = root.getObjectByName(id)!.clone(true);
    const care = id === 'fish-food' || id === 'bubble-trail';
    const scale = care ? 0.63 : 0.78;
    const position = care ? new THREE.Vector3(1.15, 2.55, 0.75) : new THREE.Vector3(-2.4, 0.1, 1.2);
    clone.scale.setScalar(scale);
    clone.position.copy(position);
    const group = new THREE.Group();
    group.add(clone);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group, true);
    close(box.min.toArray(), baseline.bounds[id]!.min.map((value, axis) => value * scale + position.getComponent(axis)));
    close(box.max.toArray(), baseline.bounds[id]!.max.map((value, axis) => value * scale + position.getComponent(axis)));
  }
}, 10_000);
