import { describe, expect, test } from 'vitest';
import {
  EMPTY_GAME_STATE, careForWorld, growthProgress, growthStage, parseGameState, placeDecoration,
  recordAnswer, resetWorld, serializeGameState,
} from './game-state.ts';
import { GAME_CATALOG } from './garden-catalog.ts';
import { WORLD_CATALOGS } from './garden-worlds.ts';

describe('subject nurturing state', () => {
  test('counts participation once per delivered subject without correctness input', () => {
    const first = recordAnswer(EMPTY_GAME_STATE, 'sheet', '1', 'english');
    const duplicate = recordAnswer(first.state, 'sheet', '1', 'english');
    const otherSubject = recordAnswer(duplicate.state, 'sheet', '1', 'math');
    expect(first.state.worlds.english.quotaProgress).toBe(1);
    expect(duplicate.state).toBe(first.state);
    expect(duplicate.progressed).toBe(false);
    expect(otherSubject.state.worlds.math.quotaProgress).toBe(1);
    expect(otherSubject.state.worlds.korean).toEqual(EMPTY_GAME_STATE.worlds.korean);
  });

  test.each(['korean', 'english', 'math'] as const)('%s unlocks its own catalog in stable order every three answers', (subject) => {
    let state = EMPTY_GAME_STATE;
    const rewards: string[] = [];
    for (let i = 0; i < WORLD_CATALOGS[subject].length * 3; i++) {
      const result = recordAnswer(state, 'sheet', String(i), subject);
      state = result.state;
      if (result.reward) rewards.push(result.reward.id);
    }
    expect(rewards).toEqual(WORLD_CATALOGS[subject].map((item) => item.id));
    expect(state.worlds[subject].quotaProgress).toBe(0);
    const complete = recordAnswer(state, 'sheet', 'extra', subject);
    expect(complete.reward).toBeNull();
    expect(complete.state.worlds[subject].unlockedItemIds).toEqual(rewards);
  });

  test('migrates every old reward and placement into Korean only', () => {
    const legacy = {
      version: 2, quotaProgress: 2, answeredKeys: ['old:1', 'old:2'],
      unlockedItemIds: GAME_CATALOG.map((item) => item.id),
      placements: Object.fromEntries(GAME_CATALOG.map((item) => [item.id, 'flower-path'])),
      latestRewardId: 'firefly-lantern',
    };
    const migrated = parseGameState(JSON.stringify(legacy));
    expect(migrated.version).toBe(3);
    expect(migrated.worlds.korean).toMatchObject({
      quotaProgress: legacy.quotaProgress, answeredKeys: legacy.answeredKeys,
      unlockedItemIds: legacy.unlockedItemIds, placements: legacy.placements,
      latestRewardId: legacy.latestRewardId,
    });
    expect(migrated.worlds.korean.unlockedItemIds).toHaveLength(12);
    expect(migrated.worlds.english).toEqual(EMPTY_GAME_STATE.worlds.english);
    expect(migrated.worlds.math).toEqual(EMPTY_GAME_STATE.worlds.math);
    expect(recordAnswer(migrated, 'old', '1', 'korean').progressed).toBe(false);
    expect(parseGameState(serializeGameState(migrated))).toEqual(migrated);
  });

  test('migrates version-one areas and preserves reward order', () => {
    const migrated = parseGameState(JSON.stringify({
      version: 1, quotaProgress: 1, answeredKeys: ['sheet:item'],
      unlockedItemIds: ['moon-chair'], placements: { 'moon-chair': 'center' },
    }));
    expect(migrated.worlds.korean.placements['moon-chair']).toBe('pond-side');
    expect(WORLD_CATALOGS.korean).toEqual(GAME_CATALOG);
  });

  test('care is persistent, isolated, always available, and never spends a reward', () => {
    const fed = careForWorld(EMPTY_GAME_STATE, 'math', 'feed');
    const brushed = careForWorld(fed, 'math', 'brush');
    expect(brushed.worlds.math.careCounts).toEqual({ feed: 1, brush: 1 });
    expect(brushed.worlds.math.lastCare).toBe('brush');
    expect(brushed.worlds.math.quotaProgress).toBe(0);
    expect(brushed.worlds.math.unlockedItemIds).toEqual([]);
    expect(brushed.worlds.english).toBe(EMPTY_GAME_STATE.worlds.english);
    expect(parseGameState(serializeGameState(brushed))).toEqual(brushed);
    expect(careForWorld(brushed, 'math', 'water')).toBe(brushed);
    let grown = brushed;
    for (let i = 0; i < 40; i++) grown = careForWorld(grown, 'math', 'feed');
    expect(growthStage(grown.worlds.math)).toBe(0);
    expect(growthStage(parseGameState(serializeGameState(grown)).worlds.math)).toBe(0);
  });

  test.each(['korean', 'english', 'math'] as const)('%s growth needs both learning and bounded care, and persists reached milestones', (subject) => {
    let state = EMPTY_GAME_STATE;
    for (let i = 0; i < 36; i++) state = recordAnswer(state, 'growth', String(i), subject).state;
    expect(growthStage(state.worlds[subject])).toBe(0);
    const action = subject === 'korean' ? 'water' : 'feed';
    for (let count = 1; count <= 6; count++) {
      state = careForWorld(state, subject, action);
      const stage = count >= 6 ? 3 : count >= 3 ? 2 : 1;
      expect(growthStage(state.worlds[subject])).toBe(stage);
      expect(state.worlds[subject].growthMilestones).toEqual(Array.from({ length: stage }, (_, i) => i + 1));
      expect(parseGameState(serializeGameState(state))).toEqual(state);
    }
    for (let i = 0; i < 40; i++) state = careForWorld(state, subject, action);
    expect(growthStage(state.worlds[subject])).toBe(3);
  });

  test('growth learning boundaries are exactly 3, 12 and 36 with care contribution capped at six', () => {
    let state = EMPTY_GAME_STATE;
    for (let i = 0; i < 40; i++) state = careForWorld(state, 'korean', 'water');
    expect(growthProgress(state.worlds.korean).careProgress).toBe(6);
    for (let answered = 1; answered <= 37; answered++) {
      state = recordAnswer(state, 'boundary', String(answered), 'korean').state;
      expect(growthStage(state.worlds.korean)).toBe(answered >= 36 ? 3 : answered >= 12 ? 2 : answered >= 3 ? 1 : 0);
      const progress = growthProgress(state.worlds.korean);
      expect(progress.answersNeeded).toBe(answered >= 36 ? 0 : (answered >= 12 ? 36 : answered >= 3 ? 12 : 3) - answered);
    }
  });

  test('recomputes earlier version-three milestone records without discarding earned rewards or care', () => {
    let state = EMPTY_GAME_STATE;
    for (let i = 0; i < 9; i++) state = recordAnswer(state, 'draft', String(i), 'math').state;
    for (let i = 0; i < 3; i++) state = careForWorld(state, 'math', 'feed');
    const draft = { ...state, worlds: { ...state.worlds, math: { ...state.worlds.math, growthMilestones: [1, 2, 3] } } };
    const loaded = parseGameState(JSON.stringify(draft));
    expect(loaded.worlds.math.unlockedItemIds).toEqual(state.worlds.math.unlockedItemIds);
    expect(loaded.worlds.math.careCounts).toEqual({ feed: 3 });
    expect(loaded.worlds.math.growthMilestones).toEqual([1]);
  });

  test('puppy play unlocks only after the first learning-and-care milestone', () => {
    expect(careForWorld(EMPTY_GAME_STATE, 'math', 'play')).toBe(EMPTY_GAME_STATE);
    let state = careForWorld(EMPTY_GAME_STATE, 'math', 'feed');
    for (let i = 0; i < 3; i++) state = recordAnswer(state, 'growth', String(i), 'math').state;
    expect(growthStage(state.worlds.math)).toBe(1);
    expect(careForWorld(state, 'math', 'play').worlds.math.careCounts.play).toBe(1);
  });

  test('only unlocked, subject-owned items can be placed; moving preserves collection', () => {
    let state = EMPTY_GAME_STATE;
    for (let i = 0; i < 3; i++) state = recordAnswer(state, 'sheet', String(i), 'english').state;
    const id = WORLD_CATALOGS.english[0]!.id;
    expect(placeDecoration(state, id, 'pond-side', 'math')).toBe(state);
    expect(placeDecoration(state, 'moon-chair', 'pond-side', 'english')).toBe(state);
    const placed = placeDecoration(state, id, 'pond-side', 'english');
    const moved = placeDecoration(placed, id, 'big-tree', 'english');
    expect(moved.worlds.english.placements[id]).toBe('big-tree');
    expect(moved.worlds.english.unlockedItemIds).toEqual([id]);
    expect(parseGameState(serializeGameState(moved))).toEqual(moved);
  });

  test('reset only affects the chosen world', () => {
    const math = careForWorld(EMPTY_GAME_STATE, 'math', 'feed');
    const both = careForWorld(math, 'korean', 'water');
    const reset = resetWorld(both, 'math');
    expect(reset.worlds.math).toEqual(EMPTY_GAME_STATE.worlds.math);
    expect(reset.worlds.korean).toEqual(both.worlds.korean);
  });

  test('rejects malformed and future storage safely, including foreign items and care', () => {
    for (const raw of ['{nope', 'null', '{}', '{"version":99}']) {
      expect(parseGameState(raw)).toEqual(EMPTY_GAME_STATE);
    }
    for (const patch of [
      { unlockedItemIds: ['moon-chair'] }, { quotaProgress: 3 },
      { careCounts: { feed: -1 } }, { careCounts: { water: 1 } },
      { placements: { 'shell-arch': 'not-a-spot' } }, { lastCare: 'water' },
    ]) {
      const corrupt = { ...EMPTY_GAME_STATE, worlds: { ...EMPTY_GAME_STATE.worlds,
        english: { ...EMPTY_GAME_STATE.worlds.english, ...patch } } };
      expect(parseGameState(JSON.stringify(corrupt))).toEqual(EMPTY_GAME_STATE);
    }
  });
});
