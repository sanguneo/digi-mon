import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloneModelAsset } from '../../src/model-asset.ts';

const ids = ['shell-arch', 'ribbon-kelp', 'coral-garden', 'bubble-rock', 'treasure-chest', 'star-lamp', 'fish-food', 'bubble-trail'];
const baseline = JSON.parse(readFileSync(new URL('./baseline-bounds.json', import.meta.url), 'utf8'));
const report = JSON.parse(readFileSync(new URL('./validation-report.json', import.meta.url), 'utf8'));
const bytes = readFileSync(new URL('../../public/models/props-english.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const root = gltf.scene.children[0];
function close(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 2e-6));
}
function meshes(part) {
  const result = [];
  part.traverse(obj => { if (obj instanceof THREE.Mesh) result.push(obj); });
  return result;
}

test('actual GLB retains all eight identity parts, finite PBR attributes and independently bounded primitives', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.sha256);
  assert.equal(bytes.byteLength, report.glb_bytes);
  assert.ok(bytes.byteLength <= 3_000_000);
  assert.equal(gltf.animations.length, 0);
  assert.equal(gltf.scene.children.length, 1);
  assert.equal(root.name, 'english-props');
  assert.deepEqual(root.children.map(x => x.name).sort(), [...ids].sort());
  const materials = new Set(); let triangles = 0;
  for (const part of [root, ...root.children]) {
    close(part.position.toArray(), [0, 0, 0]); close(part.quaternion.toArray(), [0, 0, 0, 1]); close(part.scale.toArray(), [1, 1, 1]);
  }
  for (const part of root.children) {
    const draws = meshes(part); assert.ok(draws.length >= 1 && draws.length <= 3);
    let partTriangles = 0;
    for (const mesh of draws) {
      const mat = mesh.material;
      assert.ok(mat instanceof THREE.MeshStandardMaterial);
      assert.equal(mat.vertexColors, true); assert.equal(mat.transparent, false); assert.equal(mat.opacity, 1);
      assert.equal(mat.map, null); assert.equal(mat.side, THREE.FrontSide); close(mat.color.toArray(), [1, 1, 1]);
      materials.add(mat);
      for (const name of ['position', 'normal', 'uv', 'color']) {
        const a = mesh.geometry.getAttribute(name);
        assert.equal(a.count, mesh.geometry.getAttribute('position').count);
        assert.ok(Array.from(a.array).every(Number.isFinite));
      }
      partTriangles += mesh.geometry.index.count / 3;
    }
    assert.ok(partTriangles <= 3500); triangles += partTriangles;
    const box = new THREE.Box3().setFromObject(part, true);
    close(box.min.toArray(), baseline.bounds[part.name].min); close(box.max.toArray(), baseline.bounds[part.name].max);
  }
  assert.equal(materials.size, 3); assert.equal(triangles, report.triangles); assert.ok(triangles <= 30_000);
});

test('matte stone and dry wood retain separate satin hardware/bubble roles', () => {
  for (const [id, expected] of [['bubble-rock', ['english-matte', 'english-satin']], ['treasure-chest', ['english-satin', 'english-wood']]]) {
    const roles = meshes(root.getObjectByName(id)).map(m => m.material.name).sort();
    assert.deepEqual(roles, expected);
  }
});

test('the shell has a true recessed upper-valve cavity rather than a flat fan', () => {
  root.updateMatrixWorld(true);
  const shell = root.getObjectByName('shell-arch');
  const hit = x => new THREE.Raycaster(new THREE.Vector3(x, .50, 2), new THREE.Vector3(0, 0, -1)).intersectObject(shell, true)[0];
  const interior = hit(0), flank = hit(.47);
  assert.ok(interior && flank, 'shell surface missing at cavity sample');
  assert.ok(flank.point.z - interior.point.z > .065, 'cavity depth regressed toward a flat panel');
});

test('real cloner preserves care/catalog transforms and owns resources separately from the template', () => {
  for (const id of ids) {
    const source = root.getObjectByName(id), a = cloneModelAsset(source, 'test:english-props'), b = cloneModelAsset(source, 'test:english-props');
    const care = id === 'fish-food' || id === 'bubble-trail';
    const scale = care ? .63 : .78;
    const position = care ? new THREE.Vector3(1.15, 2.55, .75) : new THREE.Vector3(-2.4, .1, 1.2);
    a.scale.setScalar(scale); a.position.copy(position);
    const box = new THREE.Box3().setFromObject(a, true);
    close(box.min.toArray(), baseline.bounds[id].min.map((v, i) => v * scale + position.getComponent(i)));
    close(box.max.toArray(), baseline.bounds[id].max.map((v, i) => v * scale + position.getComponent(i)));
    close(source.position.toArray(), [0, 0, 0]); close(b.scale.toArray(), [1, 1, 1]);
    const original = meshes(source), first = meshes(a), second = meshes(b);
    for (let i = 0; i < original.length; i++) {
      assert.notEqual(first[i].geometry, original[i].geometry); assert.notEqual(first[i].material, original[i].material);
      assert.notEqual(first[i].geometry, second[i].geometry); assert.notEqual(first[i].material, second[i].material);
    }
  }
});
