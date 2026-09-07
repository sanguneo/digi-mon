/** Code-only local-space reference measurement; never starts the garden app. */
import * as THREE from 'three';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const source = execFileSync('git', ['show', '214416e:apps/web-garden/src/garden-models.ts'], { encoding: 'utf8' });
const helpers = source.slice(source.indexOf('type Point ='), source.indexOf('function tree('));
const decorations = source.slice(source.indexOf('function decoration('), source.indexOf('export const CARE_DURATION'));
const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(helpers + decorations);
const { decoration, cylinder, ring, orb, stroke } = new Function('THREE', `${code}; return { decoration, cylinder, ring, orb, stroke };`)(THREE);
const ids = ['moon-chair', 'dandelion-pot', 'tiny-pond', 'cloud-balloon', 'reading-cat', 'rainbow-flag', 'picnic-basket', 'strawberry-patch', 'mushroom-home', 'bird-bath', 'pebble-fountain', 'firefly-lantern', 'watering-can', 'sunlight-token'];
const bounds: Record<string, { min: number[]; max: number[]; size: number[] }> = {};
for (const id of ids) {
  const root = new THREE.Group();
  if (id === 'watering-can') {
    cylinder(root, '#699eae', [0, 0, 0], 0.25, 0.43);
    cylinder(root, '#699eae', [0.34, 0.1, 0], 0.055, 0.65).rotation.z = -0.85;
    ring(root, '#699eae', [-0.25, 0.08, 0], 0.2, 0.04);
  } else if (id === 'sunlight-token') {
    orb(root, '#edbf56', [0, 0, 0], [0.32, 0.32, 0.14]);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      stroke(root, '#e5b34d', [[Math.cos(angle) * 0.43, Math.sin(angle) * 0.43, 0], [Math.cos(angle) * 0.58, Math.sin(angle) * 0.58, 0]], 0.035);
    }
  } else decoration(root, id);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  bounds[id] = { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() };
}
writeFileSync(join(import.meta.dir, 'baseline-bounds.json'), JSON.stringify({ revision: '214416e', coordinates: 'Y-up; local geometry before placement, care motion, or inventory scale', bounds }, null, 2) + '\n');
console.log(JSON.stringify(bounds, null, 2));
