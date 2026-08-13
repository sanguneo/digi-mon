import { describe, expect, test } from 'vitest';

import {
  EMPTY_GAME_STATE,
  parseGameState,
  placeDecoration,
  recordAnswer,
  serializeGameState,
} from './game-state.ts';
import { GAME_CATALOG } from './garden-catalog.ts';

describe('garden game state', () => {
  test('offers twelve decorations across four garden themes', () => {
    expect(GAME_CATALOG.map((item) => item.id)).toEqual([
      'moon-chair',
      'dandelion-pot',
      'tiny-pond',
      'cloud-balloon',
      'reading-cat',
      'rainbow-flag',
      'picnic-basket',
      'strawberry-patch',
      'mushroom-home',
      'bird-bath',
      'pebble-fountain',
      'firefly-lantern',
    ]);
    expect(new Set(GAME_CATALOG.map((item) => item.category)).size).toBe(4);
  });

  test('counts each answered worksheet item once and ignores correctness', () => {
    const first = recordAnswer(EMPTY_GAME_STATE, 'sheet-a', 'item-1');
    const changed = recordAnswer(first.state, 'sheet-a', 'item-1');
    const wrong = recordAnswer(changed.state, 'sheet-a', 'item-2');

    expect(first.state.quotaProgress).toBe(1);
    expect(changed.state.quotaProgress).toBe(1);
    expect(changed.progressed).toBe(false);
    expect(wrong.state.quotaProgress).toBe(2);
  });

  test('unlocks exactly one ordered decoration every three unique answers', () => {
    const one = recordAnswer(EMPTY_GAME_STATE, 'sheet-a', 'item-1');
    const two = recordAnswer(one.state, 'sheet-a', 'item-2');
    const three = recordAnswer(two.state, 'sheet-a', 'item-3');

    expect(three.reward).toEqual(GAME_CATALOG[0]);
    expect(three.state.quotaProgress).toBe(0);
    expect(three.state.unlockedItemIds).toEqual(['moon-chair']);

    const duplicate = recordAnswer(three.state, 'sheet-a', 'item-3');
    expect(duplicate.reward).toBeNull();
    expect(duplicate.state.unlockedItemIds).toHaveLength(1);
  });

  test('unlocks the entire expanded catalog in stable order', () => {
    let state = EMPTY_GAME_STATE;
    const rewards: string[] = [];

    for (let index = 0; index < GAME_CATALOG.length * 3; index += 1) {
      const result = recordAnswer(state, 'catalog-sheet', `item-${index}`);
      state = result.state;
      if (result.reward) rewards.push(result.reward.id);
    }

    expect(rewards).toEqual(GAME_CATALOG.map((item) => item.id));
    expect(state.unlockedItemIds).toEqual(rewards);

    const afterComplete = recordAnswer(state, 'catalog-sheet', 'one-more');
    expect(afterComplete.reward).toBeNull();
    expect(afterComplete.state.unlockedItemIds).toEqual(rewards);
  });

  test('places and persists every decoration in the expanded catalog', () => {
    const unlocked = {
      ...EMPTY_GAME_STATE,
      unlockedItemIds: GAME_CATALOG.map((item) => item.id),
    };
    const placed = GAME_CATALOG.reduce(
      (state, item, index) => placeDecoration(
        state,
        item.id,
        index % 2 === 0 ? 'flower-path' : 'hill-top',
      ),
      unlocked,
    );

    expect(Object.keys(placed.placements)).toHaveLength(GAME_CATALOG.length);
    expect(parseGameState(serializeGameState(placed))).toEqual(placed);
  });

  test('places an unlocked item and moves it without deleting inventory', () => {
    const unlocked = {
      ...EMPTY_GAME_STATE,
      unlockedItemIds: ['moon-chair'],
    };
    const centered = placeDecoration(unlocked, 'moon-chair', 'pond-side');
    const moved = placeDecoration(centered, 'moon-chair', 'big-tree');

    expect(centered.placements['moon-chair']).toBe('pond-side');
    expect(moved.placements['moon-chair']).toBe('big-tree');
    expect(moved.unlockedItemIds).toEqual(['moon-chair']);
  });

  test('round-trips versioned local state and rejects corrupt data', () => {
    const state = placeDecoration({
      ...EMPTY_GAME_STATE,
      quotaProgress: 2,
      unlockedItemIds: ['moon-chair'],
      answeredKeys: ['sheet-a:item-1', 'sheet-a:item-2'],
    }, 'moon-chair', 'flower-path');

    expect(parseGameState(serializeGameState(state))).toEqual(state);
    expect(parseGameState('{nope')).toEqual(EMPTY_GAME_STATE);
    expect(parseGameState(JSON.stringify({ version: 99 }))).toEqual(EMPTY_GAME_STATE);
  });

  test('migrates version-one placements into version-two named spots', () => {
    const migrated = parseGameState(JSON.stringify({
      version: 1,
      quotaProgress: 1,
      answeredKeys: ['sheet:item'],
      unlockedItemIds: ['moon-chair'],
      placements: { 'moon-chair': 'center' },
    }));

    expect(migrated.version).toBe(2);
    expect(migrated.placements['moon-chair']).toBe('pond-side');
  });
});
