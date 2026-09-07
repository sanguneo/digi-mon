import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloneModelAsset, createModelAssetLoader } from './model-asset.ts';

export const PUPPY_ASSET_URL = `${import.meta.env.BASE_URL}models/puppy.glb`;

function puppyRoot(scene: THREE.Group) {
  const root = scene.name === 'puppy-asset' ? scene : scene.getObjectByName('puppy-asset');
  if (!root || !root.getObjectByName('body') || !root.getObjectByName('head') || !root.getObjectByName('tail')) {
    throw new Error('Puppy asset is missing its required root, body, head or tail');
  }
  return root;
}

export async function parsePuppyAsset(data: ArrayBuffer) {
  return puppyRoot((await new GLTFLoader().parseAsync(data, '')).scene);
}

export function createPuppyAssetLoader(load = async () => puppyRoot((await new GLTFLoader().loadAsync(PUPPY_ASSET_URL)).scene)) {
  return createModelAssetLoader(load);
}
export const loadPuppyAsset = createPuppyAssetLoader();

export function clonePuppyAsset(template: THREE.Object3D) {
  return cloneModelAsset(template, PUPPY_ASSET_URL);
}
