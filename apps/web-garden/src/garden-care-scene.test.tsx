// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GardenScene } from './garden-scene.tsx';
import { EMPTY_GAME_STATE, type WorldState } from './game-state.ts';
import type { WorldModelAssets } from './garden-models.ts';
import { WORLD_CATALOGS, type CareEvent } from './garden-worlds.ts';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readShippedAssetBytes } from './puppy-asset.test-fixture.ts';

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

// Subscribe before triggering a transition. The timeout only bounds a missing
// signal; no sleep or polling advances the test.
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

for (const subject of ['korean', 'english', 'math'] as const) {
  const nextSubject = subject === 'korean' ? 'english' : 'korean';
  const action = subject === 'korean' ? 'water' : 'feed';
  test.each(['resolve', 'reject'] as const)(`${subject}: switching away ignores late asset %s without creating a stale renderer`, async (completion) => {
    const pending = deferred<WorldModelAssets>();
    const requested = deferred<void>();
    prepare.mockImplementation((requestedSubject: string) => {
      if (requestedSubject !== subject) return Promise.resolve({});
      requested.resolve(); return pending.promise;
    });
    const warn = vi.spyOn(console, 'warn');
    const view = render(<GardenScene subject={subject} world={EMPTY_GAME_STATE.worlds[subject]} />);
    await act(async () => { await requested.promise; });
    expect(create).not.toHaveBeenCalled();
    const ready = statusChanged(view.container, 'ready');
    await act(async () => { view.rerender(<GardenScene subject={nextSubject} world={EMPTY_GAME_STATE.worlds[nextSubject]} />); });
    await ready;
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![1]).toBe(nextSubject);
    expect(prepare.mock.calls).toEqual([[subject], [nextSubject]]);
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

  test(`${subject}: unmounted pending load never creates a renderer`, async () => {
    const pending = deferred<WorldModelAssets>();
    const requested = deferred<void>();
    prepare.mockImplementation(() => { requested.resolve(); return pending.promise; });
    const view = render(<GardenScene subject={subject} world={EMPTY_GAME_STATE.worlds[subject]} />);
    await act(async () => { await requested.promise; });
    view.unmount();
    await act(async () => { pending.resolve({}); await pending.promise; });
    expect(create).not.toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
  });

  test(`${subject}: pending load uses current growth and placements without replaying loading care clicks`, async () => {
    const pending = deferred<WorldModelAssets>();
    const requested = deferred<void>();
    prepare.mockImplementation(() => { requested.resolve(); return pending.promise; });
    const view = render(<GardenScene subject={subject} world={EMPTY_GAME_STATE.worlds[subject]} />);
    await act(async () => { await requested.promise; });
    const world: WorldState = { ...EMPTY_GAME_STATE.worlds[subject], growthMilestones: [1], placements: { [WORLD_CATALOGS[subject][0]!.id]: 'front-garden' } };
    view.rerender(<GardenScene subject={subject} world={world} careEvent={{ id: 1, subject, action }} />);
    const ready = statusChanged(view.container, 'ready');
    await act(async () => { pending.resolve({}); await pending.promise; });
    await ready;
    expect(create.mock.calls[0]![2]).toBe(world);
    expect(care).not.toHaveBeenCalled();
    view.rerender(<GardenScene subject={subject} world={world} careEvent={{ id: 2, subject, action }} />);
    expect(care).toHaveBeenCalledExactlyOnceWith({ id: 2, subject, action });
  });

  test(`${subject}: failed load exposes retry, uses latest growth, and never replays loading care or history`, async () => {
    const pending = deferred<WorldModelAssets>();
    const requested = deferred<void>();
    prepare.mockImplementationOnce(() => { requested.resolve(); return pending.promise; }).mockResolvedValue({});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first: CareEvent = { id: 8, subject, action };
    const view = render(<GardenScene subject={subject} world={EMPTY_GAME_STATE.worlds[subject]} careEvent={first} />);
    await act(async () => { await requested.promise; });
    const world: WorldState = { ...EMPTY_GAME_STATE.worlds[subject], growthMilestones: [1, 2], lastCare: action };
    view.rerender(<GardenScene subject={subject} world={world} careEvent={{ ...first, id: 9 }} />);
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
    view.rerender(<GardenScene subject={subject} world={world} careEvent={{ ...first, id: 10 }} />);
    expect(care).toHaveBeenCalledExactlyOnceWith({ ...first, id: 10 });
    view.unmount();
    const reloaded = render(<GardenScene subject={subject} world={world} careEvent={{ ...first, id: 10 }} />);
    const reloadedReady = statusChanged(reloaded.container, 'ready');
    await act(async () => {});
    await reloadedReady;
    expect(care).toHaveBeenCalledTimes(1);
  });

  test.each(['503', 'missing-part'] as const)(`${subject}: actual prop library %s reaches unavailable and retry preserves placements without care replay`, async (failure) => {
    vi.resetModules();
    const actual = await vi.importActual<typeof import('./garden-renderer.ts')>('./garden-renderer.ts');
    let completed = deferred<void>();
    prepare.mockImplementation(async (requestedSubject: Parameters<typeof actual.prepareWorldAssets>[0]) => {
      try { return await actual.prepareWorldAssets(requestedSubject); }
      finally { completed.resolve(); }
    });
    let fail = true;
    const propUrl = `/models/props-${subject}.glb`;
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async url => {
      if (url === propUrl && fail && failure === '503') throw new Error('503');
      const name = url.split('/').pop()!.replace('.glb', '') as Parameters<typeof readShippedAssetBytes>[0];
      const parsed = await new GLTFLoader().parseAsync(await readShippedAssetBytes(name), '');
      if (url === propUrl && fail) parsed.scene.getObjectByName(WORLD_CATALOGS[subject][0]!.id)!.removeFromParent();
      return parsed;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const world: WorldState = { ...EMPTY_GAME_STATE.worlds[subject], placements: { [WORLD_CATALOGS[subject][0]!.id]: 'front-garden' }, lastCare: action };
    const view = render(<GardenScene subject={subject} world={world} careEvent={{ id: 1, subject, action }} />);
    const unavailable = statusChanged(view.container, 'unavailable');
    await act(async () => { await completed.promise; });
    await unavailable;
    expect(create).not.toHaveBeenCalled(); expect(warn).toHaveBeenCalledTimes(1);
    expect(load.mock.calls.map(([url]) => url).sort()).toEqual([propUrl, `/models/${subject === 'korean' ? 'tree' : subject === 'english' ? 'fish' : 'puppy'}.glb`].sort());
    fail = false;
    completed = deferred<void>();
    const ready = statusChanged(view.container, 'ready');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '3D 다시 열기' })); });
    await act(async () => { await completed.promise; });
    await ready;
    expect(load.mock.calls.filter(([url]) => url === propUrl)).toHaveLength(2);
    expect(create.mock.calls[0]![2]).toBe(world);
    expect((create.mock.calls[0]![4] as WorldModelAssets).propTemplate!.getObjectByName(WORLD_CATALOGS[subject][0]!.id)).toBeDefined();
    expect(care).not.toHaveBeenCalled();
  });

  test.each(['resolve', 'reject'] as const)(`${subject}: unmount cancels a real primary/props preparation with late prop %s`, async (completion) => {
    vi.resetModules();
    const actual = await vi.importActual<typeof import('./garden-renderer.ts')>('./garden-renderer.ts');
    const requested = deferred<void>(), gate = deferred<void>(), completed = deferred<void>();
    prepare.mockImplementation(async (requestedSubject: Parameters<typeof actual.prepareWorldAssets>[0]) => {
      try { return await actual.prepareWorldAssets(requestedSubject); }
      finally { completed.resolve(); }
    });
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async url => {
      if (url === `/models/props-${subject}.glb`) { requested.resolve(); await gate.promise; }
      const name = url.split('/').pop()!.replace('.glb', '') as Parameters<typeof readShippedAssetBytes>[0];
      return new GLTFLoader().parseAsync(await readShippedAssetBytes(name), '');
    });
    const warn = vi.spyOn(console, 'warn');
    const view = render(<GardenScene subject={subject} world={EMPTY_GAME_STATE.worlds[subject]} />);
    await act(async () => { await requested.promise; });
    view.unmount();
    await act(async () => {
      if (completion === 'resolve') gate.resolve();
      else gate.reject(new Error('late 503'));
      await completed.promise;
    });
    expect(create).not.toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
}
