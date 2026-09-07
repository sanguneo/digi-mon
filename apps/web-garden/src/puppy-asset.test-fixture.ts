import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Object3D } from 'three';
import { afterAll, beforeAll } from 'vitest';
import { buildWorldModel as buildModel, disposeModel } from './garden-models.ts';
import { parsePuppyAsset } from './puppy-asset.ts';

export async function readShippedPuppy() {
  // Resolve as a Node filesystem path: Vite rewrites the static new URL(asset,
  // import.meta.url) form to an HTTP URL in jsdom's browser-like environment.
  const bytes = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../public/models/puppy.glb'));
  // GLTFLoader checks instanceof ArrayBuffer. Copy filesystem bytes into the
  // active realm rather than passing Node's buffer into jsdom's ArrayBuffer check.
  const data = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(data).set(bytes);
  return parsePuppyAsset(data);
}

let puppyTemplate: Object3D;
beforeAll(async () => { puppyTemplate = await readShippedPuppy(); });
afterAll(() => { if (puppyTemplate) disposeModel(puppyTemplate); });

// Every existing math geometry/care assertion exercises the shipped GLB, with
// precisely the same synchronous template-to-owned-model seam as the renderer.
export function buildWorldModel(...[subject, world, options]: Parameters<typeof buildModel>) {
  return buildModel(subject, world, { ...options, puppyTemplate });
}
