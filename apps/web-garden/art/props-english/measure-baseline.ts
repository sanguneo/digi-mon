/** Numerical local-space reference. No app, browser, or image operations. */
import * as THREE from 'three';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const source = execFileSync('git', ['show', '214416e:apps/web-garden/src/garden-models.ts'], { encoding: 'utf8' });
const helpers = source.slice(source.indexOf('type Point ='), source.indexOf('function tree('));
const decorations = source.slice(source.indexOf('function decoration('), source.indexOf('export const CARE_DURATION'));
const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(helpers + decorations);
const { decoration, orb, ring } = new Function('THREE', code + '; return { decoration, orb, ring };')(THREE);
const ids = ['shell-arch', 'ribbon-kelp', 'coral-garden', 'bubble-rock', 'treasure-chest', 'star-lamp', 'fish-food', 'bubble-trail'];
const bounds: Record<string, { min: number[]; max: number[]; size: number[]; center: number[] }> = {};
for (const id of ids) {
  const root = new THREE.Group();
  if (id === 'fish-food') {
    for (let i = 0; i < 5; i++) orb(root, '#9b643c', [(i % 2 - 0.5) * 0.11, i * 0.085, 0], [0.055, 0.055, 0.055], 'wood');
  } else if (id === 'bubble-trail') {
    for (let i = 0; i < 5; i++) {
      ring(root, '#c6f3ed', [Math.sin(i * 1.6) * 0.3, i * 0.3, 0], 0.12 + i % 2 * 0.07, 0.014);
      orb(root, '#e5fff4', [Math.sin(i * 1.6) * 0.3 - 0.055, i * 0.3 + 0.07, 0.02], [0.026, 0.04, 0.02]);
    }
  } else decoration(root, id);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  bounds[id] = { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray(), center: box.getCenter(new THREE.Vector3()).toArray() };
}
writeFileSync(join(import.meta.dir, 'baseline-bounds.json'), JSON.stringify({ revision: '214416e', coordinates: 'Y-up; before inventory scale .78 or care transforms', bounds }, null, 2) + '\n');
console.log(JSON.stringify(bounds, null, 2));
