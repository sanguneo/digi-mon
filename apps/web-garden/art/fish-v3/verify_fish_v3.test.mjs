import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Box3, BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloneModelAsset } from '../../src/model-asset.ts';

const report = JSON.parse(await readFile(new URL('./asset-report.json', import.meta.url), 'utf8'));
const bytes = await readFile(new URL('./fish-v3.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const template = gltf.scene.getObjectByName('fish-asset');
assert.ok(template);
template.updateMatrixWorld(true);
const meshes = [];
template.traverse(obj => { if (obj instanceof Mesh) meshes.push(obj); });

// Isolate the actual largest welded component, so fin/marking shells cannot
// masquerade as the enclosing anatomical body in the junction ray checks.
function anatomicalCore(mesh) {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.index.array;
  const ids = new Map(), remap = [], neighbors = [];
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)].join(',');
    if (!ids.has(key)) { ids.set(key, ids.size); neighbors.push(new Set()); }
    remap.push(ids.get(key));
  }
  for (let i = 0; i < index.length; i += 3) {
    const tri = [remap[index[i]], remap[index[i + 1]], remap[index[i + 2]]];
    for (let j = 0; j < 3; j++) {
      neighbors[tri[j]].add(tri[(j + 1) % 3]);
      neighbors[tri[(j + 1) % 3]].add(tri[j]);
    }
  }
  const unseen = new Set(neighbors.map((_, i) => i));
  let largest = new Set();
  while (unseen.size) {
    const first = unseen.values().next().value;
    const stack = [first], component = new Set([first]);
    unseen.delete(first);
    while (stack.length) for (const next of neighbors[stack.pop()]) {
      if (unseen.delete(next)) { component.add(next); stack.push(next); }
    }
    if (component.size > largest.size) largest = component;
  }
  assert.equal(largest.size, report.connected_body.core_vertices);
  const vertices = [], colors = [];
  const sourceColors = mesh.geometry.getAttribute('color');
  for (let i = 0; i < index.length; i += 3) {
    if (!largest.has(remap[index[i]])) continue;
    for (const j of [index[i], index[i + 1], index[i + 2]]) {
      vertices.push(position.getX(j), position.getY(j), position.getZ(j));
      colors.push(sourceColors.getX(j), sourceColors.getY(j), sourceColors.getZ(j));
    }
  }
  return new Mesh(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3)).setAttribute('color', new Float32BufferAttribute(colors, 3)), new MeshStandardMaterial());
}

test('actual Blender GLB has bounded smooth geometry and three deliberately different physical surface roles', async () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.glb_sha256);
  assert.equal(meshes.length, 7);
  assert.ok(bytes.byteLength <= 3_000_000);
  let triangles = 0;
  const materials = new Set();
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    triangles += geometry.index.count / 3;
    for (const key of ['position', 'normal', 'uv', 'color']) {
      const attribute = geometry.getAttribute(key);
      assert.equal(attribute.count, geometry.getAttribute('position').count);
      assert.ok(Array.from(attribute.array).every(Number.isFinite));
    }
    const mat = mesh.material;
    assert.ok(mat instanceof MeshStandardMaterial);
    assert.equal(mat.vertexColors, true);
    assert.equal(mat.flatShading, false);
    assert.equal(mat.metalness, 0);
    assert.equal(mat.opacity, 1);
    assert.deepEqual(mat.color.toArray(), [1, 1, 1]);
    assert.deepEqual(mat.emissive.toArray(), [0, 0, 0]);
    assert.ok(!Object.values(mat).some(value => value instanceof Texture));
    materials.add(mat);
  }
  assert.equal(materials.size, 3);
  assert.equal(triangles, report.triangles);
  assert.ok(triangles <= 35_000);
  assert.ok(template.getObjectByName('eye-detail').material.roughness < template.getObjectByName('body').material.roughness);
  assert.ok(template.getObjectByName('body').material.roughness < template.getObjectByName('tail').material.roughness);
  const bounds = new Box3().setFromObject(template);
  for (const key of ['min', 'max']) bounds[key].toArray().forEach((v, i) => assert.ok(Math.abs(v - report.bounds[key][i]) < 1e-6));
  await writeFile(new URL('./three-report.json', import.meta.url), JSON.stringify({
    status: 'PASS', glb_sha256: report.glb_sha256, triangles, meshes: meshes.length,
    materials: [...materials].map(mat => ({ name: mat.name, roughness: mat.roughness })),
    renderer_or_image_analysis_performed: false,
  }, null, 2) + '\n');
});

test('reference-based compressed clownfish core and rounded fan keep measured proportions without the old fork notch', () => {
  const tail = template.getObjectByName('tail');
  const position = tail.geometry.getAttribute('position');
  let rearCenter = Infinity;
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getY(i)) < .06) rearCenter = Math.min(rearCenter, position.getX(i) + tail.position.x);
  }
  const tailBounds = report.nodes.tail.world_bounds;
  assert.ok(rearCenter < tailBounds.min[0] + .025, 'center of fan regressed into a forked/crescent notch');
  assert.ok(tailBounds.dimensions[1] < .72);
  assert.ok(report.silhouette_checks.body_height_length_ratio > .50);
  assert.ok(report.silhouette_checks.body_height_length_ratio < .58);
  assert.ok(report.silhouette_checks.body_depth_standard_length_ratio >= .53);
  assert.ok(report.silhouette_checks.body_depth_standard_length_ratio <= .58);
  const coreDimensions = report.connected_body.core_bounds.dimensions;
  assert.ok(coreDimensions[2] / coreDimensions[1] < .55);
  assert.ok(report.connected_body.core_bounds.dimensions[1] > tailBounds.dimensions[1] * 1.45);
  assert.equal(report.nodes.tail.topology.components.length, 1);
  assert.equal(report.nodes.tail.topology.boundary_edges, 0);
  assert.equal(report.nodes.tail.topology.nonmanifold_edges, 0);
});

function stripeCoordinate(x, y) {
  let low = -.9, high = .9;
  for (let i = 0; i < 40; i++) {
    const s = (low + high) / 2;
    const warped = s + .080 * Math.exp(-(((s + .12) / .255) ** 4)) * Math.exp(-((y / .235) ** 2));
    if (warped < x) low = s; else high = s;
  }
  return (low + high) / 2;
}

test('three curved band-aligned rings remain continuous and middle white continues onto baby dorsal and anal', () => {
  const body = template.getObjectByName('body');
  const core = anatomicalCore(body);
  const positions = core.geometry.getAttribute('position'), colors = core.geometry.getAttribute('color');
  for (const [center, width] of [[.230, .105], [-.140, .150], [-.585, .080]]) {
    for (const [s, hex] of [[center, '#fff8e8'], [center + width / 2 + .004, '#352723']]) {
      const expected = new Color(hex).toArray();
      let matches = 0, lowX = Infinity, highX = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i);
        if (Math.abs(stripeCoordinate(x, y) - s) > 2e-6) continue;
        matches++; lowX = Math.min(lowX, x); highX = Math.max(highX, x);
        for (const [channel, value] of [colors.getX(i), colors.getY(i), colors.getZ(i)].entries()) {
          assert.ok(Math.abs(value - expected[channel]) < .002, 'curved band boundary has a color jump');
        }
      }
      assert.ok(matches >= 64, 'band edge lost its authored full circumferential ring');
      if (center === -.140) assert.ok(highX - lowX > .04, 'middle band lost its forward flank bulge');
    }
  }
  const p = body.geometry.getAttribute('position'), c = body.geometry.getAttribute('color');
  const white = new Color('#fff8e8').toArray();
  for (const sign of [-1, 1]) {
    let matches = 0;
    for (let i = 0; i < p.count; i++) {
      if (sign * p.getY(i) < .345 || Math.abs(stripeCoordinate(p.getX(i), p.getY(i)) + .140) > .045) continue;
      if ([c.getX(i), c.getY(i), c.getZ(i)].every((v, j) => Math.abs(v - white[j]) < .002)) matches++;
    }
    assert.ok(matches > 8, `${sign > 0 ? 'dorsal' : 'anal'} lost its white-band continuation`);
  }
  assert.equal(body.visible, true, 'anatomical dorsal/anal cannot be mature-only growth nodes');
  core.geometry.dispose(); core.material.dispose();
});

test('continuous dorsal and posterior anal roots are buried inside the connected core at baby stage', () => {
  const position = template.getObjectByName('body').geometry.getAttribute('position');
  const body = anatomicalCore(template.getObjectByName('body'));
  body.updateMatrixWorld(true);
  for (const [anchor, sign] of [
    [new Vector3(-0.5899992792, 0.0650006657, 0), 1],
    [new Vector3(0.3200010668, 0.3610693043, 0), 1],
    [new Vector3(-0.5499788283, -0.0914688962, 0), -1],
  ]) {
    let nearest = Infinity;
    for (let i = 0; i < position.count; i++) nearest = Math.min(nearest, new Vector3().fromBufferAttribute(position, i).distanceTo(anchor));
    assert.ok(nearest < 1e-6, 'exported median fin root anchor changed');
    const hit = new Raycaster(new Vector3(anchor.x, sign * 2, anchor.z), new Vector3(0, -sign, 0)).intersectObject(body)[0];
    assert.ok(hit && sign * (hit.point.y - anchor.y) > .023, 'median fin root no longer buried');
  }
  body.geometry.dispose(); body.material.dispose();
});

test('both eye caps are visibly outside the body at numeric view rays, not buried inside the cheek', () => {
  for (const side of [-1, 1]) {
    const ray = new Raycaster(new Vector3(.475, .140, side * 2), new Vector3(0, 0, -side));
    const hits = ray.intersectObject(template, true);
    assert.ok(hits.length > 0);
    assert.equal(hits[0].object.name, 'eye-detail');
    assert.ok(Math.abs(hits[0].point.z) < .5);
  }
});

test('tail and pectoral root patches stay buried inside the body over the full care-motion envelope', async () => {
  const clone = cloneModelAsset(template, 'test:fish-v3-junctions');
  const body = anatomicalCore(clone.getObjectByName('body'));
  body.updateMatrixWorld(true);
  const attachments = {};
  const range = (from, to) => Array.from({ length: 17 }, (_, i) => from + (to - from) * i / 16);
  function buriedDepth(point) {
    const positive = new Raycaster(new Vector3(point.x, point.y, 2), new Vector3(0, 0, -1)).intersectObject(body)[0];
    const negative = new Raycaster(new Vector3(point.x, point.y, -2), new Vector3(0, 0, 1)).intersectObject(body)[0];
    assert.ok(positive && negative, 'root has no enclosing body cross-section');
    return Math.min(positive.point.z - point.z, point.z - negative.point.z);
  }
  for (const [name, anchor, angles, axis] of [
    ['tail', new Vector3(.22, .025, 0), range(-.38, .38), 'y'],
    ['pectoral-fin', new Vector3(.24, .095, -.200), range(-.68, -.12), 'z'],
  ]) {
    const node = clone.getObjectByName(name);
    const position = node.geometry.getAttribute('position');
    const unique = new Map();
    for (let i = 0; i < position.count; i++) {
      const p = new Vector3().fromBufferAttribute(position, i);
      unique.set(p.toArray().join(','), p);
    }
    const patch = [...unique.values()].sort((a, b) => a.distanceToSquared(anchor) - b.distanceToSquared(anchor)).slice(0, 9);
    assert.ok(patch[0].distanceTo(anchor) < 1e-5, `${name} exported root anchor changed`);
    let minimumClearance = Infinity;
    for (const angle of angles) {
      node.rotation[axis] = angle;
      clone.updateMatrixWorld(true);
      for (const p of patch) {
        const clearance = buriedDepth(node.localToWorld(p.clone()));
        minimumClearance = Math.min(minimumClearance, clearance);
        assert.ok(clearance > .025, `${name} root exposed at angle ${angle}`);
      }
    }
    attachments[name] = { samples: angles.length, rootPatchVertices: patch.length, minimumClearance };

  }
  await writeFile(new URL('./joint-report.json', import.meta.url), JSON.stringify({
    status: 'PASS', glb_sha256: report.glb_sha256,
    method: 'Actual exported root patches transformed through 17 angles; bidirectional rays against isolated connected body core',
    attachments,
  }, null, 2) + '\n');
  body.geometry.dispose(); body.material.dispose();
});

test('clones preserve pivots, mouth-only opening and independent material ownership', () => {
  const first = cloneModelAsset(template, 'test:fish-v3');
  const second = cloneModelAsset(template, 'test:fish-v3');
  for (const name of ['tail', 'pectoral-fin', 'mouth']) {
    const expected = report.nodes[name].pivot;
    first.getObjectByName(name).position.toArray().forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6));
  }
  const originalBody = new Box3().setFromObject(first.getObjectByName('body'));
  const mouth = first.getObjectByName('mouth');
  const closed = new Box3().setFromObject(mouth).getSize(new Vector3());
  mouth.scale.y = 3.1;
  const opened = new Box3().setFromObject(mouth).getSize(new Vector3());
  assert.ok(Math.abs(opened.y / closed.y - 3.1) < 1e-6);
  assert.ok(Math.abs(opened.x - closed.x) < 1e-6);
  assert.ok(Math.abs(opened.z - closed.z) < 1e-6);
  assert.deepEqual(new Box3().setFromObject(first.getObjectByName('body')), originalBody);
  first.getObjectByName('tail').rotation.y = .35;
  assert.equal(second.getObjectByName('tail').rotation.y, 0);
  assert.equal(template.getObjectByName('mouth').scale.y, 1);
  for (const mesh of meshes) {
    const a = first.getObjectByName(mesh.name), b = second.getObjectByName(mesh.name);
    assert.notEqual(a.geometry, mesh.geometry);
    assert.notEqual(a.geometry, b.geometry);
    assert.notEqual(a.material, mesh.material);
    assert.notEqual(a.material, b.material);
  }
});
