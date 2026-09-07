import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

// The cache owns the immutable CPU template for the page lifetime, not a world.
// A rejection is not cached: the existing unavailable view can truthfully retry.
export function createPuppyAssetLoader(load = async () => puppyRoot((await new GLTFLoader().loadAsync(PUPPY_ASSET_URL)).scene)) {
  let pending: Promise<THREE.Object3D> | undefined;
  return () => {
    pending ??= load().catch((error: unknown) => { pending = undefined; throw error; });
    return pending;
  };
}
export const loadPuppyAsset = createPuppyAssetLoader();

export function clonePuppyAsset(template: THREE.Object3D) {
  const root = template.clone(true);
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materials = new Map<THREE.Material, THREE.Material>();
  const textures = new Map<THREE.Texture, THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!geometries.has(object.geometry)) geometries.set(object.geometry, object.geometry.clone());
    object.geometry = geometries.get(object.geometry)!;
    const ownMaterial = (source: THREE.Material) => {
      if (!materials.has(source)) {
        const owned = source.clone();
        // Texture GPU handles belong to this clone; immutable decoded images may
        // remain shared with the cached template and must not be closed on teardown.
        for (const [key, value] of Object.entries(owned)) {
          if (!(value instanceof THREE.Texture)) continue;
          if (!textures.has(value)) textures.set(value, value.clone());
          Object.assign(owned, { [key]: textures.get(value)! });
        }
        materials.set(source, owned);
      }
      return materials.get(source)!;
    };
    object.material = Array.isArray(object.material) ? object.material.map(ownMaterial) : ownMaterial(object.material);
    object.castShadow = true;
    object.receiveShadow = true;
  });
  root.userData.assetSource = PUPPY_ASSET_URL;
  return root;
}
