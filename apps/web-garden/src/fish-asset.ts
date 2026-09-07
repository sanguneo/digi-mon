import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloneModelAsset, createModelAssetLoader } from './model-asset.ts';

export const FISH_ASSET_URL = `${import.meta.env.BASE_URL}models/fish.glb`;

function fishRoot(scene: THREE.Group) {
  const root = scene.name === 'fish-asset' ? scene : scene.getObjectByName('fish-asset');
  if (!root || ['body', 'tail', 'pectoral-fin', 'mouth'].some((name) => !root.getObjectByName(name))) {
    throw new Error('Fish asset is missing its required root, body, tail, pectoral fin or mouth');
  }
  return root;
}

export async function parseFishAsset(data: ArrayBuffer) {
  return fishRoot((await new GLTFLoader().parseAsync(data, '')).scene);
}

export function createFishAssetLoader(load = async () => fishRoot((await new GLTFLoader().loadAsync(FISH_ASSET_URL)).scene)) {
  return createModelAssetLoader(load);
}
export const loadFishAsset = createFishAssetLoader();

export function cloneFishAsset(template: THREE.Object3D, friend = false) {
  const root = cloneModelAsset(template, FISH_ASSET_URL);
  if (friend) {
    // Rotate warm colors to a muted blue palette in linear COLOR_0. Neutral eye
    // highlights stay neutral; value/shading variation and alpha are retained.
    // Each geometry is owned here, even when reused by several authored meshes.
    const recolored = new Set<THREE.BufferGeometry>();
    const color = new THREE.Color();
    const hsl = { h: 0, s: 0, l: 0 };
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || recolored.has(object.geometry)) return;
      recolored.add(object.geometry);
      const colors = object.geometry.getAttribute('color');
      for (let i = 0; i < colors.count; i++) {
        color.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).getHSL(hsl);
        color.setHSL((hsl.h + 0.5) % 1, hsl.s * 0.55, hsl.l);
        colors.setXYZ(i, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;
    });
  }
  return root;
}
