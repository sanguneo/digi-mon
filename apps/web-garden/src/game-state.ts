import type { Subject } from './api.ts';
import type { GameItem } from './garden-catalog.ts';
import { WORLD_CATALOGS, WORLDS, WORLD_SUBJECTS, type CareAction } from './garden-worlds.ts';

export type GardenSpotId = 'big-tree' | 'pond-side' | 'flower-path' | 'hill-top'
  | 'picnic-lawn' | 'little-gate' | 'stream-bridge' | 'front-garden';

export interface GardenSpot {
  id: GardenSpotId;
  label: string;
  x: number;
  y: number;
  depth: 2 | 3 | 4 | 5;
}

export interface WorldState {
  quotaProgress: number;
  answeredKeys: string[];
  unlockedItemIds: string[];
  placements: Partial<Record<string, GardenSpotId>>;
  careCounts: Partial<Record<CareAction, number>>;
  growthMilestones: (1 | 2 | 3)[];
  lastCare?: CareAction;
  latestRewardId?: string;
}

export interface GameState {
  version: 3;
  activeSubject: Subject;
  worlds: Record<Subject, WorldState>;
}

export interface AnswerResult {
  state: GameState;
  progressed: boolean;
  reward: GameItem | null;
}

export const GARDEN_SPOTS: readonly GardenSpot[] = [
  { id: 'big-tree', label: '큰 나무 아래', x: 18, y: 56, depth: 3 },
  { id: 'pond-side', label: '연못 옆', x: 68, y: 66, depth: 4 },
  { id: 'flower-path', label: '꽃길 옆', x: 43, y: 72, depth: 4 },
  { id: 'hill-top', label: '언덕 위', x: 52, y: 39, depth: 2 },
  { id: 'picnic-lawn', label: '소풍 잔디밭', x: 28, y: 76, depth: 4 },
  { id: 'little-gate', label: '작은 문 앞', x: 84, y: 52, depth: 3 },
  { id: 'stream-bridge', label: '시냇물 다리', x: 56, y: 84, depth: 5 },
  { id: 'front-garden', label: '앞뜰', x: 83, y: 83, depth: 5 },
];

function emptyWorld(): WorldState {
  return { quotaProgress: 0, answeredKeys: [], unlockedItemIds: [], placements: {}, careCounts: {}, growthMilestones: [] };
}

export const EMPTY_GAME_STATE: GameState = {
  version: 3, activeSubject: 'korean',
  worlds: { korean: emptyWorld(), english: emptyWorld(), math: emptyWorld() },
};

export function gardenSpot(id: GardenSpotId, subject: Subject = 'korean'): GardenSpot {
  const index = GARDEN_SPOTS.findIndex((spot) => spot.id === id);
  const spot = GARDEN_SPOTS[index];
  if (!spot) throw new Error(`알 수 없는 정원 지점: ${id}`);
  return { ...spot, label: WORLDS[subject].spotLabels[index]! };
}

function updateWorld(state: GameState, subject: Subject, world: WorldState): GameState {
  return { ...state, worlds: { ...state.worlds, [subject]: { ...world, growthMilestones: earnedMilestones(world) } } };
}

export function recordAnswer(state: GameState, worksheetId: string, itemId: string, subject: Subject): AnswerResult {
  const world = state.worlds[subject];
  // Retain legacy keys for duplicate detection during migration. New keys avoid delimiter collisions.
  const key = JSON.stringify([worksheetId, itemId]);
  if (world.answeredKeys.includes(key) || world.answeredKeys.includes(`${worksheetId}:${itemId}`)) {
    return { state, progressed: false, reward: null };
  }
  const nextProgress = world.quotaProgress + 1;
  const reward = nextProgress === 3
    ? WORLD_CATALOGS[subject].find((item) => !world.unlockedItemIds.includes(item.id)) ?? null
    : null;
  return {
    state: { ...updateWorld(state, subject, {
      ...world,
      quotaProgress: nextProgress % 3,
      answeredKeys: [...world.answeredKeys, key],
      unlockedItemIds: reward ? [...world.unlockedItemIds, reward.id] : world.unlockedItemIds,
      ...(reward ? { latestRewardId: reward.id } : {}),
    }), activeSubject: subject },
    progressed: true, reward,
  };
}

export function placeDecoration(state: GameState, itemId: string, spotId: GardenSpotId, subject: Subject): GameState {
  const world = state.worlds[subject];
  if (!world.unlockedItemIds.includes(itemId)) return state;
  return updateWorld(state, subject, { ...world, placements: { ...world.placements, [itemId]: spotId } });
}

export function careForWorld(state: GameState, subject: Subject, action: CareAction): GameState {
  const world = state.worlds[subject];
  if (!WORLDS[subject].care.some((entry) => entry.id === action && (entry.unlockStage ?? 0) <= growthStage(world))) return state;
  return updateWorld(state, subject, {
    ...world, lastCare: action,
    careCounts: { ...world.careCounts, [action]: (world.careCounts[action] ?? 0) + 1 },
  });
}

function careTotal(world: WorldState): number {
  return Object.values(world.careCounts).reduce((sum, count) => sum + count, 0);
}

export const GROWTH_MILESTONES = [
  { stage: 1, answers: 3, care: 1 },
  { stage: 2, answers: 12, care: 3 },
  { stage: 3, answers: 36, care: 6 },
] as const;

function earnedMilestones(world: Pick<WorldState, 'answeredKeys' | 'careCounts'>): (1 | 2 | 3)[] {
  const care = Object.values(world.careCounts).reduce((sum, count) => sum + count, 0);
  return GROWTH_MILESTONES.filter((milestone) => world.answeredKeys.length >= milestone.answers && care >= milestone.care).map((milestone) => milestone.stage);
}

export function growthStage(world: WorldState): 0 | 1 | 2 | 3 {
  return world.growthMilestones.at(-1) ?? 0;
}

export function growthProgress(world: WorldState) {
  const stage = growthStage(world);
  const next = stage === 3 ? undefined : GROWTH_MILESTONES[stage];
  return {
    stage, nextStage: next?.stage ?? null,
    answersNeeded: next ? Math.max(0, next.answers - world.answeredKeys.length) : 0,
    careNeeded: next ? Math.max(0, next.care - careTotal(world)) : 0,
    learningGoal: next?.answers ?? 36,
    careGoal: next?.care ?? 6,
    careProgress: Math.min(6, careTotal(world)),
  };
}

export function resetWorld(state: GameState, subject: Subject): GameState {
  return updateWorld(state, subject, emptyWorld());
}

export function serializeGameState(state: GameState): string { return JSON.stringify(state); }

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) return null;
  return [...new Set(value)];
}

const V1_MIGRATION: Record<string, GardenSpotId> = {
  left: 'big-tree', center: 'pond-side', right: 'little-gate', front: 'front-garden',
};

function parseWorld(raw: unknown, subject: Subject, version: 1 | 2 | 3): WorldState | null {
  if (!object(raw) || !Number.isInteger(raw.quotaProgress)
    || Number(raw.quotaProgress) < 0 || Number(raw.quotaProgress) > 2) return null;
  const answeredKeys = uniqueStrings(raw.answeredKeys);
  const unlockedItemIds = uniqueStrings(raw.unlockedItemIds);
  if (!answeredKeys || !unlockedItemIds
    || unlockedItemIds.some((id) => !WORLD_CATALOGS[subject].some((item) => item.id === id))
    || !object(raw.placements)) return null;
  const placements: WorldState['placements'] = {};
  for (const [id, value] of Object.entries(raw.placements)) {
    if (!unlockedItemIds.includes(id) || typeof value !== 'string') return null;
    const spot = version === 1 ? V1_MIGRATION[value] : value as GardenSpotId;
    if (!spot || !GARDEN_SPOTS.some((entry) => entry.id === spot)) return null;
    placements[id] = spot;
  }
  if (raw.latestRewardId !== undefined
    && (typeof raw.latestRewardId !== 'string' || !unlockedItemIds.includes(raw.latestRewardId))) return null;
  const careCounts: WorldState['careCounts'] = {};
  if (version === 3) {
    if (!object(raw.careCounts)) return null;
    for (const [action, count] of Object.entries(raw.careCounts)) {
      if (!WORLDS[subject].care.some((entry) => entry.id === action)
        || !Number.isSafeInteger(count) || Number(count) < 0) return null;
      careCounts[action as CareAction] = Number(count);
    }
    if (raw.lastCare !== undefined && !WORLDS[subject].care.some((entry) => entry.id === raw.lastCare)) return null;
  }
  const growthMilestones = earnedMilestones({ answeredKeys, careCounts });
  if (version === 3 && (!Array.isArray(raw.growthMilestones)
    || raw.growthMilestones.length > 3
    || raw.growthMilestones.some((stage, index) => stage !== index + 1))) return null;
  return {
    quotaProgress: Number(raw.quotaProgress), answeredKeys, unlockedItemIds, placements, careCounts, growthMilestones,
    ...(typeof raw.latestRewardId === 'string' ? { latestRewardId: raw.latestRewardId } : {}),
    ...(version === 3 && typeof raw.lastCare === 'string' ? { lastCare: raw.lastCare as CareAction } : {}),
  };
}

export function parseGameState(raw: string | null): GameState {
  if (!raw) return EMPTY_GAME_STATE;
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value)) return EMPTY_GAME_STATE;
    if (value.version === 1 || value.version === 2) {
      const korean = parseWorld(value, 'korean', value.version);
      return korean ? updateWorld(EMPTY_GAME_STATE, 'korean', korean) : EMPTY_GAME_STATE;
    }
    if (value.version !== 3 || !object(value.worlds)
      || !WORLD_SUBJECTS.some((subject) => subject === value.activeSubject)) return EMPTY_GAME_STATE;
    const korean = parseWorld(value.worlds.korean, 'korean', 3);
    const english = parseWorld(value.worlds.english, 'english', 3);
    const math = parseWorld(value.worlds.math, 'math', 3);
    if (!korean || !english || !math) return EMPTY_GAME_STATE;
    return { version: 3, activeSubject: value.activeSubject as Subject, worlds: { korean, english, math } };
  } catch {
    return EMPTY_GAME_STATE;
  }
}
