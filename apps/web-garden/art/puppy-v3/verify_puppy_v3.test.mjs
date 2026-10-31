import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloneModelAsset } from '../../src/model-asset.ts';

const report = JSON.parse(await readFile(new URL('./asset-report.json', import.meta.url), 'utf8'));
const bytes = await readFile(new URL(report.glb, import.meta.url));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const template = gltf.scene.getObjectByName('puppy-asset');
assert.ok(template);
template.updateMatrixWorld(true);

test('real Three GLTF loader preserves the reported export, materials, bounds and pivots', async () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.glb_sha256);
  assert.deepEqual(template.position.toArray(), [0, 0, 0]);
  assert.deepEqual(template.quaternion.toArray(), [0, 0, 0, 1]);
  assert.deepEqual(template.scale.toArray(), [1, 1, 1]);
  for (const [name, pivot] of Object.entries(report.pivots_y_up)) {
    const node = template.getObjectByName(name);
    assert.ok(node);
    assert.equal(node.parent, template);
    node.position.toArray().forEach((value, i) => assert.ok(Math.abs(value - pivot[i]) < 1e-6));
  }
  let triangles = 0, meshes = 0;
  const materials = new Set();
  template.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    meshes++;
    const geometry = obj.geometry;
    triangles += geometry.index.count / 3;
    for (const key of ['position', 'normal', 'uv', 'color']) {
      const attr = geometry.getAttribute(key);
      assert.equal(attr.count, geometry.getAttribute('position').count);
      assert.ok(Array.from(attr.array).every(Number.isFinite));
    }
    const mat = obj.material;
    assert.ok(mat instanceof MeshStandardMaterial);
    assert.equal(mat.vertexColors, true);
    assert.equal(mat.flatShading, false);
    assert.equal(mat.metalness, 0);
    assert.ok(mat.roughness >= .25 && mat.roughness <= 1);
    assert.ok(report.materials.some(role => role.name === mat.name && Math.abs(role.roughness - mat.roughness) < 1e-6));
    assert.deepEqual(mat.color.toArray(), [1, 1, 1]);
    assert.deepEqual(mat.emissive.toArray(), [0, 0, 0]);
    assert.ok(!Object.values(mat).some(value => value instanceof Texture));
    materials.add(mat);
  });
  const bounds = new Box3().setFromObject(template);
  bounds.min.toArray().forEach((v, i) => assert.ok(Math.abs(v - report.bounds_y_up.min[i]) < 1e-6));
  bounds.max.toArray().forEach((v, i) => assert.ok(Math.abs(v - report.bounds_y_up.max[i]) < 1e-6));
  assert.equal(triangles, report.triangles);
  assert.equal(meshes, 6);
  assert.equal(materials.size, 4);
  assert.equal(gltf.animations.length, 0);
  await writeFile(new URL('./three-report.json', import.meta.url), JSON.stringify({
    status: 'PASS', glb_sha256: report.glb_sha256, loader: 'Three GLTFLoader.parseAsync',
    triangles, meshes, standard_vertex_color_materials: materials.size,
    bounds_y_up: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    rendering_performed: false,
  }, null, 2) + '\n');
});

test('all exported surface components are closed after UV-seam welding, with connected body/head/tail', () => {
  for (const name of Object.keys(report.source_topology)) {
    const geometry = template.getObjectByName(name).geometry;
    const position = geometry.getAttribute('position');
    const ids = new Map(), remap = [], adjacent = [], edgeUses = new Map();
    for (let i = 0; i < position.count; i++) {
      const key = [position.getX(i), position.getY(i), position.getZ(i)].join(',');
      if (!ids.has(key)) { ids.set(key, ids.size); adjacent.push(new Set()); }
      remap.push(ids.get(key));
    }
    const index = geometry.index.array;
    for (let i = 0; i < index.length; i += 3) {
      const triangle = [remap[index[i]], remap[index[i + 1]], remap[index[i + 2]]];
      for (let j = 0; j < 3; j++) {
        const a = triangle[j], b = triangle[(j + 1) % 3];
        assert.notEqual(a, b);
        adjacent[a].add(b); adjacent[b].add(a);
        const key = [Math.min(a, b), Math.max(a, b)].join(',');
        edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
      }
    }
    assert.ok([...edgeUses.values()].every(count => count === 2), name);
    const unseen = new Set(adjacent.map((_, i) => i));
    let components = 0;
    while (unseen.size) {
      components++;
      const first = unseen.values().next().value, stack = [first];
      unseen.delete(first);
      while (stack.length) {
        for (const next of adjacent[stack.pop()]) {
          if (unseen.delete(next)) stack.push(next);
        }
      }
    }
    assert.equal(components, report.source_topology[name].components, name);
    if (['PuppyV3_Body', 'PuppyV3_Head', 'PuppyV3_Tail'].includes(name)) assert.equal(components, 1);
  }
});

test('actual runtime cloning permits independent pivot motion and accessory visibility', () => {
  const clone = cloneModelAsset(template, 'staging:puppy-v3');
  const sibling = cloneModelAsset(template, 'staging:puppy-v3');
  clone.updateMatrixWorld(true);
  const body = clone.getObjectByName('PuppyV3_Body');
  const tail = clone.getObjectByName('PuppyV3_Tail');
  const bodyBefore = body.matrixWorld.clone(), tailBefore = tail.matrixWorld.clone();
  clone.getObjectByName('head').rotation.set(.15, -.25, .08);
  clone.getObjectByName('growth-bandana').visible = false;
  clone.getObjectByName('growth-collar').visible = false;
  clone.updateMatrixWorld(true);
  assert.deepEqual(body.matrixWorld.elements, bodyBefore.elements);
  assert.deepEqual(tail.matrixWorld.elements, tailBefore.elements);
  assert.equal(sibling.getObjectByName('head').rotation.y, 0);
  assert.equal(sibling.getObjectByName('growth-bandana').visible, true);
  assert.equal(template.getObjectByName('growth-collar').visible, true);
  clone.traverse(obj => {
    if (!(obj instanceof Mesh)) return;
    const original = template.getObjectByName(obj.name);
    assert.notEqual(obj.geometry, original.geometry);
    assert.notEqual(obj.material, original.material);
    assert.notEqual(obj.geometry, sibling.getObjectByName(obj.name).geometry);
    assert.equal(obj.castShadow, true);
    assert.equal(obj.receiveShadow, true);
  });
});

test('numeric face ray probes hit visible eyes and nose rather than buried details', () => {
  const head = template.getObjectByName('head');
  const probes = report.features.eye_centers_y_up.map(([x, y]) => [x, y]);
  probes.push([0, report.features.nose_probe_y]);
  for (const [x, y] of probes) {
    const ray = new Raycaster(new Vector3(x, y, 3), new Vector3(0, 0, -1));
    const hits = ray.intersectObject(head, true);
    assert.ok(hits.length > 0);
    assert.equal(hits[0].object.name, 'PuppyV3_Face');
    assert.ok(hits[0].point.z <= 1.5);
  }
});


test('lower front limb stays a slim continuous taper instead of an oversized boot', () => {
  const body = template.getObjectByName('PuppyV3_Body');
  const position = body.geometry.getAttribute('position');
  const xs = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    if (y >= .12 && y <= .32 && z > .05 && x > .05) xs.push(x);
  }
  assert.ok(xs.length > 20);
  const width = Math.max(...xs) - Math.min(...xs);
  assert.ok(width > .20 && width < .40, `lower limb width ${width}`);
  assert.ok(Math.abs(width - report.limb_metrics.front_right_lower_leg_width) < 1e-6);
});
