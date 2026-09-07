// @vitest-environment jsdom
import { BufferGeometry } from 'three';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWorldRenderer } from './garden-renderer.ts';
import { EMPTY_GAME_STATE, careForWorld } from './game-state.ts';

// Only replace the GPU boundary. Real scene, model, care timeline, camera, controls
// and disposal execute, so their integration remains able to fail.
vi.mock('three', async () => {
  const three = await vi.importActual<typeof import('three')>('three');
  return { ...three, WebGLRenderer: class {
    shadowMap = {}; setPixelRatio() {} setSize() {} render() {} dispose() {} forceContextLoss() {}
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
  frames.clear(); nextFrame = 0; hidden = false; disconnect.mockClear();
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { observeIntersection = callback; } observe() {} disconnect = disconnect; });
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('care phase events are transition-only, repeat clicks restart, and care updates allocate no new geometry', () => {
  const element = canvas();
  const runtime = createWorldRenderer(element, 'english', EMPTY_GAME_STATE.worlds.english, () => {});
  const phases: string[] = [];
  element.addEventListener('garden-care-phase', (event) => phases.push(`${(event as CustomEvent).detail.id}:${(event as CustomEvent).detail.phase}`));
  const finished = vi.fn(); element.addEventListener('garden-care-finished', finished);
  const cloning = vi.spyOn(BufferGeometry.prototype, 'clone');
  runtime.setMotion(true);
  runtime.update(careForWorld(EMPTY_GAME_STATE, 'english', 'feed').worlds.english);
  runtime.care({ id: 1, subject: 'english', action: 'feed' });
  tick(0); tick(50);
  runtime.care({ id: 2, subject: 'english', action: 'feed' });
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
