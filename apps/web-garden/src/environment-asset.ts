import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Subject } from './api.ts';
import { createModelAssetCloner, createModelAssetLoader } from './model-asset.ts';

export const ENVIRONMENT_ASSET_URLS: Record<Subject, string> = {
  korean: `${import.meta.env.BASE_URL}models/environment-korean.glb`,
  english: `${import.meta.env.BASE_URL}models/environment-english.glb`,
  math: `${import.meta.env.BASE_URL}models/environment-math.glb`,
};
export const ENVIRONMENT_IDS: Record<Subject, readonly string[]> = {
  korean: ['static-environment', 'garden-sprig', 'watering-drops'],
  english: ['static-environment', 'aquatic-sprig'],
  math: ['static-environment'],
};
function environmentRoot(subject: Subject, scene: THREE.Object3D) {
  const name = `${subject}-environment`;
  const root = scene.name === name ? scene : scene.getObjectByName(name);
  const identity = new THREE.Matrix4();
  if (!root) throw new Error(`${subject} environment is missing its required root`);
  root.updateMatrix();
  if (!root.matrix.equals(identity)) throw new Error(`${subject} environment root must be identity`);
  for (const id of ENVIRONMENT_IDS[subject]) {
    const matches = root.children.filter(child => child.name === id);
    if (matches.length !== 1) throw new Error(`${subject} environment is missing required part ${id}`);
    const part = matches[0]!; part.updateMatrix();
    if (!part.matrix.equals(identity)) throw new Error(`${id} environment part must be identity`);
    let meshes = 0;
    part.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      const count = object.geometry.getAttribute('position')?.count;
      if (!count || ['normal', 'uv', 'color'].some(attribute => object.geometry.getAttribute(attribute)?.count !== count)) {
        throw new Error(`${id} environment part is missing geometry attributes`);
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        // The imported translucent panes never write depth or cast opaque shadows.
        if (material.transparent) { material.depthWrite = false; material.side = THREE.DoubleSide; }
      }
    });
    if (!meshes) throw new Error(`${id} environment part is empty`);
  }
  return root;
}
export async function parseEnvironmentAsset(subject: Subject, data: ArrayBuffer) {
  return environmentRoot(subject, (await new GLTFLoader().parseAsync(data, '')).scene);
}
export function createEnvironmentAssetLoader(subject: Subject, load = async () => environmentRoot(subject,
  (await new GLTFLoader().loadAsync(ENVIRONMENT_ASSET_URLS[subject])).scene)) {
  return createModelAssetLoader(load);
}
const loaders = { korean: createEnvironmentAssetLoader('korean'), english: createEnvironmentAssetLoader('english'), math: createEnvironmentAssetLoader('math') };
export function loadEnvironmentAsset(subject: Subject) { return loaders[subject](); }
export function createEnvironmentInstancer(subject: Subject, template: THREE.Object3D) {
  const clone = createModelAssetCloner(ENVIRONMENT_ASSET_URLS[subject]);
  const parts = new Map(template.children.map(part => [part.name, part]));
  return (id: string) => {
    const source = parts.get(id);
    if (!source) throw new Error(`${subject} environment has no part ${id}`);
    const result = clone(source);
    result.userData.environmentAsset = true;
    result.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some(material => material.transparent)) { object.castShadow = false; object.receiveShadow = false; object.renderOrder = 1; }
    });
    return result;
  };
}
