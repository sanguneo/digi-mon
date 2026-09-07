// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GardenScene } from './garden-scene.tsx';
import { EMPTY_GAME_STATE, type WorldState } from './game-state.ts';
import type { WorldModelAssets } from './garden-models.ts';

const { prepare, create, care, dispose, update } = vi.hoisted(() => ({
  prepare: vi.fn(), create: vi.fn(), care: vi.fn(), dispose: vi.fn(), update: vi.fn(),
}));
vi.mock('./garden-renderer.ts', () => ({
  prepareWorldAssets: prepare,
  createWorldRenderer: create,
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Observe the exact React lifecycle state, subscribed before resolving/rejecting
// a load. The timeout only bounds a missing signal; it never advances the test.
function statusChanged(container: HTMLElement, status: string) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`Missing scene status ${status}`)); }, 3000);
    const observer = new MutationObserver(() => {
      if (container.querySelector('.world-scene')?.getAttribute('data-status') !== status) return;
      clearTimeout(timer); observer.disconnect(); resolve();
    });
    observer.observe(container, { subtree: true, attributes: true, attributeFilter: ['data-status'] });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  create.mockImplementation(() => ({ care, dispose, update, setMotion: vi.fn(), setGestures: vi.fn(), camera: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test.each(['resolve', 'reject'] as const)('switching away during loading ignores late asset %s without creating a stale renderer', async (completion) => {
  const pending = deferred<WorldModelAssets>();
  const requested = deferred<void>();
  prepare.mockImplementation((subject: string) => {
    if (subject !== 'math') return Promise.resolve({});
    requested.resolve(); return pending.promise;
  });
  const warn = vi.spyOn(console, 'warn');
  const view = render(<GardenScene subject="math" world={EMPTY_GAME_STATE.worlds.math} />);
  await act(async () => { await requested.promise; });
  expect(create).not.toHaveBeenCalled();
  const ready = statusChanged(view.container, 'ready');
  await act(async () => { view.rerender(<GardenScene subject="english" world={EMPTY_GAME_STATE.worlds.english} />); });
  await ready;
  expect(create).toHaveBeenCalledTimes(1);
  expect(create.mock.calls[0]![1]).toBe('english');
  await act(async () => {
    if (completion === 'resolve') { pending.resolve({}); await pending.promise; }
    else {
      pending.reject(new Error('late asset failure'));
      await expect(pending.promise).rejects.toThrow('late asset failure');
    }
  });
  expect(create).toHaveBeenCalledTimes(1);
  expect(warn).not.toHaveBeenCalled();
  expect(view.container.querySelector('.world-scene')!.getAttribute('data-status')).toBe('ready');
  view.unmount();
  expect(dispose).toHaveBeenCalledTimes(1);
});

test('unmounted pending math load never creates a renderer', async () => {
  const pending = deferred<WorldModelAssets>();
  const requested = deferred<void>();
  prepare.mockImplementation(() => { requested.resolve(); return pending.promise; });
  const view = render(<GardenScene subject="math" world={EMPTY_GAME_STATE.worlds.math} />);
  await act(async () => { await requested.promise; });
  view.unmount();
  await act(async () => { pending.resolve({}); await pending.promise; });
  expect(create).not.toHaveBeenCalled();
  expect(dispose).not.toHaveBeenCalled();
});

test('a successful pending load uses current growth and placements without replaying care clicks from loading', async () => {
  const pending = deferred<WorldModelAssets>();
  const requested = deferred<void>();
  prepare.mockImplementation(() => { requested.resolve(); return pending.promise; });
  const view = render(<GardenScene subject="math" world={EMPTY_GAME_STATE.worlds.math} />);
  await act(async () => { await requested.promise; });
  const world: WorldState = { ...EMPTY_GAME_STATE.worlds.math, growthMilestones: [1], placements: { 'puppy-ball': 'front-garden' } };
  view.rerender(<GardenScene subject="math" world={world} careEvent={{ id: 1, subject: 'math', action: 'play' }} />);
  const ready = statusChanged(view.container, 'ready');
  await act(async () => { pending.resolve({}); await pending.promise; });
  await ready;
  expect(create.mock.calls[0]![2]).toBe(world);
  expect(care).not.toHaveBeenCalled();
  view.rerender(<GardenScene subject="math" world={world} careEvent={{ id: 2, subject: 'math', action: 'play' }} />);
  expect(care).toHaveBeenCalledExactlyOnceWith({ id: 2, subject: 'math', action: 'play' });
});

test('failed asset load exposes retry, uses latest growth, and never replays care received while loading or persisted history', async () => {
  const pending = deferred<WorldModelAssets>();
  const requested = deferred<void>();
  prepare.mockImplementationOnce(() => { requested.resolve(); return pending.promise; }).mockResolvedValue({});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const first = { id: 8, subject: 'math' as const, action: 'feed' as const };
  const view = render(<GardenScene subject="math" world={EMPTY_GAME_STATE.worlds.math} careEvent={first} />);
  await act(async () => { await requested.promise; });
  const world: WorldState = { ...EMPTY_GAME_STATE.worlds.math, growthMilestones: [1, 2], lastCare: 'feed' };
  view.rerender(<GardenScene subject="math" world={world} careEvent={{ ...first, id: 9 }} />);
  const unavailable = statusChanged(view.container, 'unavailable');
  await act(async () => { pending.reject(new Error('503')); await expect(pending.promise).rejects.toThrow('503'); });
  await unavailable;
  expect(create).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledTimes(1);
  const ready = statusChanged(view.container, 'ready');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '3D 다시 열기' })); });
  await ready;
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0]![2]).toBe(world);
  expect(care).not.toHaveBeenCalled();
  view.rerender(<GardenScene subject="math" world={world} careEvent={{ ...first, id: 10 }} />);
  expect(care).toHaveBeenCalledExactlyOnceWith({ ...first, id: 10 });
  view.unmount();
  const reloaded = render(<GardenScene subject="math" world={world} careEvent={{ ...first, id: 10 }} />);
  const reloadedReady = statusChanged(reloaded.container, 'ready');
  await act(async () => {});
  await reloadedReady;
  expect(care).toHaveBeenCalledTimes(1);
});
