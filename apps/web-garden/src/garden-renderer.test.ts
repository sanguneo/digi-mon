// @vitest-environment jsdom
import { BufferGeometry, Mesh, type Scene } from 'three';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWorldRenderer, prepareWorldAssets } from './garden-renderer.ts';
import { readShippedPuppy } from './puppy-asset.test-fixture.ts';
import { disposeModel } from './garden-models.ts';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PUPPY_ASSET_URL } from './puppy-asset.ts';
import { EMPTY_GAME_STATE, careForWorld } from './game-state.ts';

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

test.each(['english', 'math'] as const)('%s care phase events are transition-only, repeat clicks restart, and care updates allocate no new geometry', async (subject) => {
  const element = canvas();
  const puppyTemplate = await readShippedPuppy();
  const runtime = createWorldRenderer(element, subject, EMPTY_GAME_STATE.worlds[subject], () => {}, { puppyTemplate });
  const phases: string[] = [];
  element.addEventListener('garden-care-phase', (event) => phases.push(`${(event as CustomEvent).detail.id}:${(event as CustomEvent).detail.phase}`));
  const finished = vi.fn(); element.addEventListener('garden-care-finished', finished);
  const cloning = vi.spyOn(BufferGeometry.prototype, 'clone');
  runtime.setMotion(true);
  runtime.update(careForWorld(EMPTY_GAME_STATE, subject, 'feed').worlds[subject]);
  runtime.care({ id: 1, subject, action: 'feed' });
  tick(0); tick(50);
  runtime.care({ id: 2, subject, action: 'feed' });
  for (let i = 2; i <= 76; i++) tick(i * 50);
  expect(phases).toEqual(['1:approach', '2:approach', '2:respond', '2:settle', '2:settled']);
  expect(finished).toHaveBeenCalledTimes(1);
  expect(element.dataset.careId).toBe('2');
  expect(element.dataset.careState).toBe('settled');
  expect(cloning).not.toHaveBeenCalled();
  runtime.dispose(); runtime.dispose();
  expect(frames.size).toBe(0);
  expect(disconnect).toHaveBeenCalledTimes(2);
  disposeModel(puppyTemplate);
});

test('pause, offscreen and background do not advance care; static actions finish without a motion loop', () => {
  const element = canvas();
  const runtime = createWorldRenderer(element, 'korean', EMPTY_GAME_STATE.worlds.korean, () => {});
  const finished = vi.fn(); element.addEventListener('garden-care-finished', finished);
  runtime.care({ id: 1, subject: 'korean', action: 'water' });
  expect(element.dataset.careState).toBe('settled');
  expect(finished).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
  runtime.setMotion(true);
  runtime.care({ id: 2, subject: 'korean', action: 'sunlight' });
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

test('asset preparation is lazy for math and failed requests remain retryable', async () => {
  const failure = new Error('503 puppy unavailable');
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(failure);
  expect(await prepareWorldAssets('korean')).toEqual({});
  expect(await prepareWorldAssets('english')).toEqual({});
  expect(load).not.toHaveBeenCalled();
  await expect(prepareWorldAssets('math')).rejects.toBe(failure);
  await expect(prepareWorldAssets('math')).rejects.toBe(failure);
  expect(load).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenLastCalledWith(PUPPY_ASSET_URL);
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
