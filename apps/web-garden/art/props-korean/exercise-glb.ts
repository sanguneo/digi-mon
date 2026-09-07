/** CPU-only exercise through the application's actual Three GLTFLoader. No scene rendering. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const here = import.meta.dir;
const bytes = readFileSync(join(here, '../../public/models/props-korean.glb'));
const baseline = JSON.parse(readFileSync(join(here, 'baseline-bounds.json'), 'utf8')) as {
  bounds: Record<string, { min: number[]; max: number[]; size: number[] }>;
};
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const root = gltf.scene.getObjectByName('korean-props');
assert(root);
assert.equal(root.children.length, 14);
assert.deepEqual(root.children.map((p) => p.name).sort(), Object.keys(baseline.bounds).sort());
const identity = new THREE.Matrix4();
const parts: Record<string, { triangles: number; meshes: number; boundsError: number }> = {};
for (const [id, expected] of Object.entries(baseline.bounds)) {
  const group = root.getObjectByName(id);
  assert(group);
  group.updateMatrix();
  assert(group.matrix.equals(identity));
  const clone = group.clone(true);
  assert.equal(clone.parent, null);
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone, true);
  const actual = [...box.min.toArray(), ...box.max.toArray()];
  const target = [...expected.min, ...expected.max];
  const error = Math.max(...actual.map((v, i) => Math.abs(v - target[i]!)));
  assert(error < 2e-6, `${id}: bounds ${error}`);
  let triangles = 0;
  let meshes = 0;
  clone.traverse((node) => {
    assert(node.position.length() === 0 && node.scale.equals(new THREE.Vector3(1, 1, 1)));
    if (!(node instanceof THREE.Mesh)) return;
    meshes++;
    for (const key of ['position', 'normal', 'uv', 'color']) assert(node.geometry.hasAttribute(key));
    assert(node.geometry.index);
    triangles += node.geometry.index.count / 3;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      assert(material instanceof THREE.MeshStandardMaterial);
      assert(material.vertexColors && material.color.equals(new THREE.Color(1, 1, 1)));
      assert.equal(material.map, null);
    }
  });
  assert(meshes >= 1 && meshes <= 3);
  clone.position.set(2.9, 0.03, 0.15);
  clone.scale.setScalar(1.25);
  clone.updateMatrixWorld(true);
  const placed = new THREE.Box3().setFromObject(clone, true);
  const scaledSize = new THREE.Vector3(...expected.size as [number, number, number]).multiplyScalar(1.25);
  assert(placed.getSize(new THREE.Vector3()).distanceTo(scaledSize) < 5e-6);
  parts[id] = { triangles, meshes, boundsError: error };
}
// Care tools retain a centered local origin while their owning group moves/turns.
for (const angle of [-0.3, -0.7]) {
  const can = root.getObjectByName('watering-can')!.clone(true);
  can.position.set(-1.25, 1.45, 0.55);
  can.rotation.z = angle;
  can.updateMatrixWorld(true);
  assert(can.localToWorld(new THREE.Vector3()).distanceTo(can.position) < 1e-10);
}
for (const height of [2.2, 3.35]) {
  const sun = root.getObjectByName('sunlight-token')!.clone(true);
  sun.position.set(1.65, height, 0);
  sun.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(sun, true).getCenter(new THREE.Vector3());
  assert(center.distanceTo(sun.position) < 1e-6);
}
const result = { status: 'PASS', loader: 'Three GLTFLoader', directGroups: 14,
  triangles: Object.values(parts).reduce((sum, p) => sum + p.triangles, 0),
  careCanAngles: [-0.3, -0.7], careSunHeights: [2.2, 3.35], parts,
  rendering: false, networkRequests: 0 };
writeFileSync(join(here, 'loader-report.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
