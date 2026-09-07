/** Numerical measurement only: no app startup or image operations. */
import * as THREE from 'three';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const source = execFileSync('git', ['show', '214416e:apps/web-garden/src/garden-models.ts'], { encoding: 'utf8' });
const helpers = source.slice(source.indexOf('type Point ='), source.indexOf('function tree('));
const props = source.slice(source.indexOf('function bowl('), source.indexOf('export const CARE_DURATION'));
const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(helpers + props);
const { decoration, bowl, box, cylinder, orb } = new Function('THREE', `${code}; return { decoration, bowl, box, cylinder, orb };`)(THREE);
const ids = ['puppy-ball', 'soft-bed', 'puppy-house', 'flower-hoop', 'water-bowl', 'paw-flag', 'feeding-bowl', 'grooming-brush', 'dog-food'];
const bounds: Record<string, { min: number[]; max: number[]; center: number[]; size: number[] }> = {};
for (const id of ids) {
  const root = new THREE.Group();
  if (id === 'feeding-bowl') bowl(root, [0, 0, 0], false);
  else if (id === 'grooming-brush') {
    box(root, '#ac7953', [0, 0, 0], [0.38, 0.14, 0.52], 'wood');
    cylinder(root, '#ac7953', [0, 0.03, -0.43], 0.065, 0.44, 0.065, 'wood').rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) cylinder(root, '#f0ddbd', [-0.12 + i % 3 * 0.12, -0.13, -0.17 + Math.floor(i / 3) * 0.11], 0.013, 0.16);
  } else if (id === 'dog-food') {
    for (let i = 0; i < 9; i++) orb(root, '#a87340', [Math.cos(i * 2.4) * 0.25, i % 2 * 0.04, Math.sin(i * 2.4) * 0.25], [0.07, 0.055, 0.07], 'wood');
  } else decoration(root, id);
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root, true);
  bounds[id] = { min: b.min.toArray(), max: b.max.toArray(), center: b.getCenter(new THREE.Vector3()).toArray(), size: b.getSize(new THREE.Vector3()).toArray() };
}
writeFileSync(join(import.meta.dir, 'baseline-bounds.json'), JSON.stringify({ revision: '214416e', coordinates: 'Y-up local, before placement/care motion/inventory scaling', bounds }, null, 2) + '\n');
console.log(JSON.stringify(bounds, null, 2));
