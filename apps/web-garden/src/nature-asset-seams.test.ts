import { expect, test, vi } from 'vitest';
import { Group } from 'three';
import { createTreeAssetLoader, parseTreeAsset } from './tree-asset.ts';
import { createFishAssetLoader, parseFishAsset } from './fish-asset.ts';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWorldModel } from './garden-models.ts';
import { prepareWorldAssets } from './garden-renderer.ts';
import { EMPTY_GAME_STATE } from './game-state.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

for (const [name, createLoader, parse] of [['tree', createTreeAssetLoader, parseTreeAsset], ['fish', createFishAssetLoader, parseFishAsset]] as const) {
  test(`${name} caches concurrent successes but releases concurrent failures for retry`, async () => {
    const first = deferred<Group>();
    const second = deferred<Group>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const loader = createLoader(load);
    const rejected = loader();
    expect(loader()).toBe(rejected);
    const failure = new Error('asset unavailable');
    const observed = expect(rejected).rejects.toBe(failure);
    first.reject(failure);
    await observed;
    const retried = loader();
    expect(loader()).toBe(retried);
    const template = new Group(); // Cache seam only; geometry tests use shipped GLBs.
    second.resolve(template);
    expect(await retried).toBe(template);
    expect(await loader()).toBe(template);
    expect(load).toHaveBeenCalledTimes(2);
  });
  test(`${name} rejects a parsed scene missing its animation contract`, async () => {
    const data = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }] }));
    await expect(parse(data.buffer)).rejects.toThrow(/required root/);
  });
}

for (const [subject, name] of [['korean', 'tree'], ['english', 'fish']] as const) {
  test(`${subject} cannot silently substitute a procedural actor`, () => {
    expect(() => buildWorldModel(subject, EMPTY_GAME_STATE.worlds[subject])).toThrow(new RegExp(name, 'i'));
  });
  test(`${subject} requests only its own asset and retries a rejected request`, async () => {
    const failure = new Error('503 asset unavailable');
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(failure);
    try {
      await expect(prepareWorldAssets(subject)).rejects.toBe(failure);
      await expect(prepareWorldAssets(subject)).rejects.toBe(failure);
      expect(load.mock.calls).toEqual([[`/models/${name}.glb`], [`/models/props-${subject}.glb`], [`/models/${name}.glb`], [`/models/props-${subject}.glb`]]);
    } finally { load.mockRestore(); }
  });
}
