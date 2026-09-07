import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloneModelAsset, createModelAssetLoader } from './model-asset.ts';

export const TREE_ASSET_URL = `${import.meta.env.BASE_URL}models/tree.glb`;

function treeRoot(scene: THREE.Group) {
  const root = scene.name === 'tree-asset' ? scene : scene.getObjectByName('tree-asset');
  if (!root || [0, 1, 2, 3].some((stage) => {
    const branch = root.getObjectByName(`tree-stage-${stage}`);
    return !branch || (stage === 0
      ? !branch.getObjectByName('sprout-leaf-left') || !branch.getObjectByName('sprout-leaf-right')
      : !branch.getObjectByName(`stage-${stage}-canopy`));
  })) throw new Error('Tree asset is missing its required root, stages, leaves or canopies');
  return root;
}

export async function parseTreeAsset(data: ArrayBuffer) {
  return treeRoot((await new GLTFLoader().parseAsync(data, '')).scene);
}

export function createTreeAssetLoader(load = async () => treeRoot((await new GLTFLoader().loadAsync(TREE_ASSET_URL)).scene)) {
  return createModelAssetLoader(load);
}
export const loadTreeAsset = createTreeAssetLoader();

export function cloneTreeAsset(template: THREE.Object3D, stage: number) {
  // Clone only this stage, not three hidden geometries/materials per live world.
  const root = new THREE.Group();
  root.name = 'tree-asset';
  root.userData.assetSource = TREE_ASSET_URL;
  root.add(cloneModelAsset(template.getObjectByName(`tree-stage-${stage}`)!, TREE_ASSET_URL));
  return root;
}
