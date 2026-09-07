import * as THREE from 'three';

// A page-lifetime immutable CPU template, never a live world. Concurrent requests
// share work; rejection releases the promise so the unavailable view can retry.
export function createModelAssetLoader(load: () => Promise<THREE.Object3D>) {
  let pending: Promise<THREE.Object3D> | undefined;
  return () => {
    pending ??= load().catch((error: unknown) => { pending = undefined; throw error; });
    return pending;
  };
}

export function cloneModelAsset(template: THREE.Object3D, sourceUrl: string) {
  return createModelAssetCloner(sourceUrl)(template);
}

// One owner may instantiate several immutable parts with the same GPU resources.
// Actors use a fresh cloner per actor because friend fish mutate their own colors.
export function createModelAssetCloner(sourceUrl: string) {
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materials = new Map<THREE.Material, THREE.Material>();
  const textures = new Map<THREE.Texture, THREE.Texture>();
  return (template: THREE.Object3D) => {
    const root = template.clone(true);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (!geometries.has(object.geometry)) geometries.set(object.geometry, object.geometry.clone());
      object.geometry = geometries.get(object.geometry)!;
      const ownMaterial = (source: THREE.Material) => {
        if (!materials.has(source)) {
          const owned = source.clone();
          // GPU handles belong to this clone; immutable decoded images may remain
          // shared with the cached template and must not be closed on teardown.
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
    root.userData.assetSource = sourceUrl;
    return root;
  };
}
