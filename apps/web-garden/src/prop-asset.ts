import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Subject } from './api.ts';
import { WORLD_CATALOGS } from './garden-worlds.ts';
import { createModelAssetCloner, createModelAssetLoader } from './model-asset.ts';

export const PROP_ASSET_URLS: Record<Subject, string> = {
  korean: `${import.meta.env.BASE_URL}models/props-korean.glb`,
  english: `${import.meta.env.BASE_URL}models/props-english.glb`,
  math: `${import.meta.env.BASE_URL}models/props-math.glb`,
};
export const PROP_IDS: Record<Subject, readonly string[]> = {
  korean: [...WORLD_CATALOGS.korean.map(item => item.id), 'watering-can', 'sunlight-token'],
  english: [...WORLD_CATALOGS.english.map(item => item.id), 'fish-food', 'bubble-trail'],
  math: [...WORLD_CATALOGS.math.map(item => item.id), 'feeding-bowl', 'grooming-brush', 'dog-food'],
};

// Validate at the external asset boundary, including unused catalog parts: a
// partial library must reach unavailable/retry, not fail later on placement.
function propRoot(subject: Subject, scene: THREE.Object3D) {
  const name = `${subject}-props`;
  const root = scene.name === name ? scene : scene.getObjectByName(name);
  const identity = new THREE.Matrix4();
  if (!root) throw new Error(`${subject} library is missing its required prop root`);
  root.updateMatrix();
  if (!root.matrix.equals(identity)) throw new Error(`${subject} prop root must have an identity transform`);
  for (const id of PROP_IDS[subject]) {
    const parts = root.children.filter(child => child.name === id);
    const part = parts[0];
    if (parts.length !== 1 || !part) throw new Error(`${subject} library is missing required prop ${id}`);
    part.updateMatrix();
    if (!part.matrix.equals(identity)) throw new Error(`${subject} required prop ${id} must have an identity transform`);
    let meshes = 0;
    part.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      const geometry = object.geometry;
      const count = geometry.getAttribute('position')?.count;
      if (!count || ['normal', 'uv', 'color'].some(attribute => geometry.getAttribute(attribute)?.count !== count)) {
        throw new Error(`${subject} required prop ${id} is missing geometry attributes`);
      }
    });
    if (!meshes) throw new Error(`${subject} required prop ${id} is empty`);
  }
  return root;
}

export async function parsePropAsset(subject: Subject, data: ArrayBuffer) {
  return propRoot(subject, (await new GLTFLoader().parseAsync(data, '')).scene);
}
export function createPropAssetLoader(subject: Subject, load = async () => propRoot(subject, (await new GLTFLoader().loadAsync(PROP_ASSET_URLS[subject])).scene)) {
  return createModelAssetLoader(load);
}
const loaders = {
  korean: createPropAssetLoader('korean'),
  english: createPropAssetLoader('english'),
  math: createPropAssetLoader('math'),
};
export function loadPropAsset(subject: Subject) { return loaders[subject](); }

export function createPropInstancer(subject: Subject, template: THREE.Object3D) {
  const clone = createModelAssetCloner(PROP_ASSET_URLS[subject]);
  const parts = new Map(template.children.map(part => [part.name, part]));
  // Clone only used parts, sharing roles and repeated geometry within this world.
  // disposeModel owns their exact-once teardown; the immutable template stays live.
  return (id: string) => clone(parts.get(id)!);
}
