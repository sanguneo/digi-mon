import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll } from 'vitest';
import { buildWorldModel as buildModel, disposeModel, type WorldModelAssets } from './garden-models.ts';
import { parsePuppyAsset } from './puppy-asset.ts';
import { parseTreeAsset } from './tree-asset.ts';
import { parseFishAsset } from './fish-asset.ts';

export async function readShippedAssetBytes(name: 'puppy' | 'tree' | 'fish') {
  // Resolve as a Node filesystem path: Vite rewrites the static new URL(asset,
  // import.meta.url) form to an HTTP URL in jsdom's browser-like environment.
  const bytes = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), `../public/models/${name}.glb`));
  // GLTFLoader checks instanceof ArrayBuffer. Copy filesystem bytes into the
  // active realm rather than passing Node's buffer into jsdom's ArrayBuffer check.
  const data = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(data).set(bytes);
  return data;
}

export async function readShippedPuppy() { return parsePuppyAsset(await readShippedAssetBytes('puppy')); }
export async function readShippedTree() { return parseTreeAsset(await readShippedAssetBytes('tree')); }
export async function readShippedFish() { return parseFishAsset(await readShippedAssetBytes('fish')); }

export let shippedAssets: WorldModelAssets;
beforeAll(async () => {
  const [puppyTemplate, treeTemplate, fishTemplate] = await Promise.all([readShippedPuppy(), readShippedTree(), readShippedFish()]);
  shippedAssets = { puppyTemplate, treeTemplate, fishTemplate };
});
afterAll(() => { if (shippedAssets) for (const template of Object.values(shippedAssets)) disposeModel(template); });

// Keep the existing fixture API: all three worlds now exercise shipped GLBs at
// precisely the same synchronous template-to-owned-model seam as the renderer.
export function buildWorldModel(...[subject, world, options]: Parameters<typeof buildModel>) {
  return buildModel(subject, world, { ...shippedAssets, ...options });
}
