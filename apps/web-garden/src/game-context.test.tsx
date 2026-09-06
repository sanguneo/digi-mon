// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GameProvider, useGame } from './game-context.tsx';

let game: ReturnType<typeof useGame>;
function Probe() {
  game = useGame();
  return <output data-testid="state">{JSON.stringify(game.state)}</output>;
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('batched answers from the same callback are all retained under StrictMode', () => {
  render(<StrictMode><GameProvider><Probe /></GameProvider></StrictMode>);
  const answer = game.answerItem;
  act(() => {
    answer('sheet', '1', 'english');
    answer('sheet', '2', 'english');
    answer('sheet', '3', 'english');
    answer('sheet', '3', 'english');
    answer('sheet', '1', 'math');
  });
  const state = JSON.parse(screen.getByTestId('state').textContent!);
  expect(state.worlds.english.answeredKeys).toHaveLength(3);
  expect(state.worlds.english.unlockedItemIds).toHaveLength(1);
  expect(state.worlds.math.quotaProgress).toBe(1);
  expect(state.worlds.korean.answeredKeys).toEqual([]);
  expect(JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!)).toEqual(state);
});

test('unavailable storage is surfaced without blocking care or participation', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
  render(<GameProvider><Probe /></GameProvider>);
  expect(game.storageError).not.toBe('');
  act(() => {
    game.answerItem('sheet', '1', 'math');
    game.care('math', 'feed');
  });
  expect(game.state.worlds.math.quotaProgress).toBe(1);
  expect(game.state.worlds.math.careCounts.feed).toBe(1);
});
