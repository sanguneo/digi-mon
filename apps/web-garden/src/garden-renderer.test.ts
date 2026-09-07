// @vitest-environment jsdom
import { BufferGeometry, Mesh, type Scene } from 'three';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWorldRenderer, prepareWorldAssets } from './garden-renderer.ts';
import { readShippedAssetBytes, readShippedPuppy, shippedAssets } from './puppy-asset.test-fixture.ts';
import { disposeModel } from './garden-models.ts';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PUPPY_ASSET_URL } from './puppy-asset.ts';
import { TREE_ASSET_URL } from './tree-asset.ts';
import { FISH_ASSET_URL } from './fish-asset.ts';
import { EMPTY_GAME_STATE, careForWorld, type WorldState } from './game-state.ts';

const { gpuDraw } = vi.hoisted(() => ({ gpuDraw: vi.fn() }));

// Only replace the GPU boundary. Real scene, model, care timeline, camera, controls
// and disposal execute, so their integration remains able to fail.
vi.mock('three', async () => {
  const three = await vi.importActual<typeof import('three')>('three');
  return { ...three, WebGLRenderer: class {
    shadowMap = {}; setPixelRatio() {} setSize() {} render(scene: Scene) { gpuDraw(scene); } dispose() {} forceContextLoss() {}
  } };
});
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let observeIntersection: IntersectionObserverCallback;
let hidden = false;
const disconnect = vi.fn();
function tick(time: number) {
  const callbacks = [...frames.values()]; frames.clear();
  for (const callback of callbacks) callback(time);
}
function canvas() {
  const result = document.createElement('canvas'); document.body.append(result);
  vi.spyOn(result, 'getBoundingClientRect').mockReturnValue({ width: 700, height: 500 } as DOMRect);
  return result;
}
beforeEach(() => {
  frames.clear(); nextFrame = 0; hidden = false; disconnect.mockClear(); gpuDraw.mockClear();
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { observeIntersection = callback; } observe() {} disconnect = disconnect; });
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test.each(['korean', 'english', 'math'] as const)('%s care phase events are transition-only, repeat clicks restart, and care updates allocate no new geometry', (subject) => {
  const element = canvas();
  const action = subject === 'korean' ? 'water' : 'feed';
  const runtime = createWorldRenderer(element, subject, EMPTY_GAME_STATE.worlds[subject], () => {}, shippedAssets);
  const phases: string[] = [];
  element.addEventListener('garden-care-phase', (event) => phases.push(`${(event as CustomEvent).detail.id}:${(event as CustomEvent).detail.phase}`));
  const finished = vi.fn(); element.addEventListener('garden-care-finished', finished);
  const cloning = vi.spyOn(BufferGeometry.prototype, 'clone');
  runtime.setMotion(true);
  runtime.update(careForWorld(EMPTY_GAME_STATE, subject, action).worlds[subject]);
  runtime.care({ id: 1, subject, action });
  tick(0); tick(50);
  runtime.care({ id: 2, subject, action });
  for (let i = 2; i <= 76; i++) tick(i * 50);
  expect(phases).toEqual(['1:approach', '2:approach', '2:respond', '2:settle', '2:settled']);
  expect(finished).toHaveBeenCalledTimes(1);
  expect(element.dataset.careId).toBe('2');
  expect(element.dataset.careState).toBe('settled');
  expect(cloning).not.toHaveBeenCalled();
  runtime.dispose(); runtime.dispose();
  expect(frames.size).toBe(0);
  expect(disconnect).toHaveBeenCalledTimes(2);
});

test.each(['korean', 'english', 'math'] as const)('%s pause, offscreen and background do not advance care; static actions finish without a motion loop', (subject) => {
  const element = canvas();
  const runtime = createWorldRenderer(element, subject, EMPTY_GAME_STATE.worlds[subject], () => {}, shippedAssets);
  const finished = vi.fn(); element.addEventListener('garden-care-finished', finished);
  runtime.care({ id: 1, subject, action: subject === 'korean' ? 'water' : 'feed' });
  expect(element.dataset.careState).toBe('settled');
  expect(finished).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
  runtime.setMotion(true);
  runtime.care({ id: 2, subject, action: subject === 'korean' ? 'sunlight' : 'play' });
  tick(0); tick(50);
  runtime.setMotion(false); tick(50_000);
  expect(element.dataset.careState).toBe('approach');
  expect(frames.size).toBe(0);
  runtime.setMotion(true);
  observeIntersection([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
  tick(70_000); expect(frames.size).toBe(0);
  observeIntersection([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  tick(90_000); expect(frames.size).toBe(0);
  hidden = false; document.dispatchEvent(new Event('visibilitychange'));
  tick(100_000);
  expect(element.dataset.careState).toBe('approach');
  for (let i = 1; i <= 75; i++) tick(100_000 + i * 50);
  expect(element.dataset.careState).toBe('settled');
  expect(finished).toHaveBeenCalledTimes(2);
  runtime.dispose();
});

test.each([['korean', TREE_ASSET_URL], ['english', FISH_ASSET_URL], ['math', PUPPY_ASSET_URL]] as const)('%s asset preparation requests only the active subject and failures remain retryable', async (subject, url) => {
  const failure = new Error('503 asset unavailable');
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(failure);
  await expect(prepareWorldAssets(subject)).rejects.toBe(failure);
  await expect(prepareWorldAssets(subject)).rejects.toBe(failure);
  expect(load.mock.calls).toEqual([[url], [url]]);
});

test.each([['korean', 'tree', TREE_ASSET_URL], ['english', 'fish', FISH_ASSET_URL]] as const)('%s real asset growth and context retry release owned scenes without poisoning templates or replaying history', (subject, name, url) => {
  const template = name === 'tree' ? shippedAssets.treeTemplate! : shippedAssets.fishTemplate!;
  const protectedResources = new Set<BufferGeometry | import('three').Material>();
  template.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    protectedResources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) protectedResources.add(material);
  });
  const templateDisposals = [...protectedResources].map((resource) => vi.spyOn(resource, 'dispose'));
  const element = canvas();
  const lost = vi.fn();
  const action = subject === 'korean' ? 'water' : 'feed';
  const world: WorldState = { ...EMPTY_GAME_STATE.worlds[subject], lastCare: action };
  const runtime = createWorldRenderer(element, subject, world, lost, shippedAssets);
  expect(element.dataset.assetSource).toBe(url);
  expect(element.dataset.careState).toBe('idle');
  const scene = gpuDraw.mock.lastCall![0] as Scene;
  runtime.setMotion(true);
  for (const stage of [1, 2, 3]) {
    const old = scene.getObjectByName(`world:${subject}`)!;
    const oldGeometries = new Set<BufferGeometry>();
    old.traverse((object) => { if (object instanceof Mesh) oldGeometries.add(object.geometry); });
    const oldDisposals = [...oldGeometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    runtime.care({ id: stage, subject, action });
    runtime.update({ ...world, growthMilestones: ([1, 2, 3] as const).slice(0, stage) });
    expect(element.dataset.stage).toBe(String(stage));
    expect(element.dataset.careState).toBe('settled');
    expect(scene.getObjectByName(`${name}-asset`)).toBeDefined();
    if (subject === 'korean') {
      const asset = scene.getObjectByName('tree-asset')!;
      expect(asset.children.map((object) => object.name)).toEqual([`tree-stage-${stage}`]);
    } else expect(scene.getObjectByName('fish')!.scale.x).toBe([0.82, 1.02, 1.27, 1.48][stage]);
    for (const spy of oldDisposals) expect(spy).toHaveBeenCalledTimes(1);
    expect(old.children).toHaveLength(0);
  }
  element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  expect(lost).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
  runtime.dispose();
  expect(element.dataset.assetSource).toBeUndefined();
  const retryElement = canvas();
  const retry = createWorldRenderer(retryElement, subject, world, () => {}, shippedAssets);
  expect(retryElement.dataset.careState).toBe('idle');
  expect(retryElement.dataset.assetSource).toBe(url);
  expect((gpuDraw.mock.lastCall![0] as Scene).getObjectByName(`${name}-asset`)).toBeDefined();
  retry.dispose();
  for (const spy of templateDisposals) expect(spy).not.toHaveBeenCalled();
});

test('actual puppy growth and context retry dispose owned art without poisoning the template or replaying history', async () => {
  const puppyTemplate = await readShippedPuppy();
  const templateDisposals: ReturnType<typeof vi.spyOn>[] = [];
  puppyTemplate.traverse((object) => {
    if (object instanceof Mesh) {
      templateDisposals.push(vi.spyOn(object.geometry, 'dispose'));
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) templateDisposals.push(vi.spyOn(material, 'dispose'));
    }
  });
  const element = canvas();
  const lost = vi.fn();
  const world = { ...EMPTY_GAME_STATE.worlds.math, lastCare: 'feed' as const };
  const runtime = createWorldRenderer(element, 'math', world, lost, { puppyTemplate });
  expect(element.dataset.assetSource).toBe(PUPPY_ASSET_URL);
  expect(element.dataset.careState).toBe('idle');
  const scene = gpuDraw.mock.lastCall![0] as Scene;
  const old = scene.getObjectByName('world:math')!;
  const oldDisposals: ReturnType<typeof vi.spyOn>[] = [];
  old.traverse((object) => { if (object instanceof Mesh) oldDisposals.push(vi.spyOn(object.geometry, 'dispose')); });
  runtime.setMotion(true);
  runtime.care({ id: 1, subject: 'math', action: 'brush' });
  runtime.update({ ...world, growthMilestones: [1, 2, 3] });
  expect(element.dataset.stage).toBe('3');
  expect(element.dataset.careState).toBe('settled');
  expect(scene.getObjectByName('puppy')!.scale.x).toBe(1.2);
  for (const spy of oldDisposals) expect(spy).toHaveBeenCalledTimes(1);
  expect(old.children).toHaveLength(0);
  element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  expect(lost).toHaveBeenCalledTimes(1);
  runtime.dispose();
  const retry = createWorldRenderer(canvas(), 'math', world, () => {}, { puppyTemplate });
  expect((gpuDraw.mock.lastCall![0] as Scene).getObjectByName('puppy-asset')).toBeDefined();
  retry.dispose();
  for (const spy of templateDisposals) expect(spy).not.toHaveBeenCalled();
  disposeModel(puppyTemplate);
});

test('successful preparation caches each real shipped GLB independently and never preloads inactive subjects', async () => {
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async (url) => {
    const name = url === TREE_ASSET_URL ? 'tree' : url === FISH_ASSET_URL ? 'fish' : 'puppy';
    return new GLTFLoader().parseAsync(await readShippedAssetBytes(name), '');
  });
  for (const [index, subject, key, url] of [
    [1, 'korean', 'treeTemplate', TREE_ASSET_URL],
    [2, 'english', 'fishTemplate', FISH_ASSET_URL],
    [3, 'math', 'puppyTemplate', PUPPY_ASSET_URL],
  ] as const) {
    const [first, concurrent] = await Promise.all([prepareWorldAssets(subject), prepareWorldAssets(subject)]);
    expect(Object.keys(first)).toEqual([key]);
    expect(first[key] === concurrent[key]).toBe(true);
    expect((await prepareWorldAssets(subject))[key] === first[key]).toBe(true);
    expect(load).toHaveBeenCalledTimes(index);
    expect(load).toHaveBeenLastCalledWith(url);
  }
});
