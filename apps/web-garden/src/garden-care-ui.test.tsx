// @vitest-environment jsdom
import { type ReactNode, StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GameProvider, useGame } from './game-context.tsx';
import { GardenRoom } from './garden.tsx';
import type { CareEvent } from './garden-worlds.ts';

let event: CareEvent | null;
vi.mock('./garden-scene.tsx', () => ({ GardenScene: ({ careEvent, children }: { careEvent: CareEvent | null; children: ReactNode }) => {
  event = careEvent;
  return <section>{children}</section>;
} }));
let game: ReturnType<typeof useGame>;
function Probe() { game = useGame(); return null; }
const room = () => <StrictMode><GameProvider><Probe /><GardenRoom onLearn={() => {}} preselectReward={false} /></GameProvider></StrictMode>;
beforeEach(() => { localStorage.clear(); event = null; });
afterEach(cleanup);

test('every care click carries a fresh unsaved identity without touching answer dedupe or rewards', () => {
  const view = render(room());
  act(() => { for (let i = 0; i < 3; i++) game.answerItem('care-ui', String(i), 'korean'); });
  const rewards = game.state.worlds.korean.unlockedItemIds;
  const keys = game.state.worlds.korean.answeredKeys;
  const button = screen.getAllByRole('button', { name: '물 주기' })[0]!;
  fireEvent.click(button);
  const first = event!;
  fireEvent.click(button);
  expect(event!.id).toBeGreaterThan(first.id);
  expect(event!.action).toBe(first.action);
  expect(game.state.worlds.korean.careCounts.water).toBe(2);
  expect(game.state.worlds.korean.unlockedItemIds).toEqual(rewards);
  expect(game.state.worlds.korean.answeredKeys).toEqual(keys);
  act(() => { expect(game.answerItem('care-ui', '0', 'korean').progressed).toBe(false); });
  const saved = JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!);
  expect(saved).toEqual(game.state);
  expect(saved.careEvent).toBeUndefined();
  view.unmount();
  render(room());
  expect(event).toBeNull();
  expect(game.state.worlds.korean.careCounts.water).toBe(2);
});
