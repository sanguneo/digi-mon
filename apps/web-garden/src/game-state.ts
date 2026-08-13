export type GardenSpotId =
  | 'big-tree'
  | 'pond-side'
  | 'flower-path'
  | 'hill-top'
  | 'picnic-lawn'
  | 'little-gate'
  | 'stream-bridge'
  | 'front-garden';

export interface GardenSpot {
  id: GardenSpotId;
  label: string;
  x: number;
  y: number;
  depth: 2 | 3 | 4 | 5;
}

export interface GameItem {
  id: string;
  name: string;
  description: string;
}

export interface GameState {
  version: 2;
  quotaProgress: number;
  answeredKeys: string[];
  unlockedItemIds: string[];
  placements: Partial<Record<string, GardenSpotId>>;
  latestRewardId?: string;
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

export const GAME_CATALOG: readonly GameItem[] = [
  { id: 'moon-chair', name: '달빛 의자', description: '달빛 아래 쉬어 가는 의자' },
  { id: 'dandelion-pot', name: '민들레 화분', description: '노란 민들레가 피었어요' },
  { id: 'tiny-pond', name: '작은 연못', description: '물고기가 살짝 헤엄쳐요' },
  { id: 'cloud-balloon', name: '구름 풍선', description: '하늘에 둥실 떠 있어요' },
  { id: 'reading-cat', name: '책 읽는 고양이', description: '고양이가 조용히 책을 읽어요' },
  { id: 'rainbow-flag', name: '무지개 깃발', description: '정원 입구를 밝혀요' },
];

export const EMPTY_GAME_STATE: GameState = {
  version: 2,
  quotaProgress: 0,
  answeredKeys: [],
  unlockedItemIds: [],
  placements: {},
};

export function gardenSpot(id: GardenSpotId): GardenSpot {
  const spot = GARDEN_SPOTS.find((entry) => entry.id === id);
  if (!spot) throw new Error(`알 수 없는 정원 지점: ${id}`);
  return spot;
}

export function recordAnswer(
  state: GameState,
  worksheetId: string,
  itemId: string,
): AnswerResult {
  const key = `${worksheetId}:${itemId}`;
  if (state.answeredKeys.includes(key)) {
    return { state, progressed: false, reward: null };
  }
  const nextProgress = state.quotaProgress + 1;
  const answeredKeys = [...state.answeredKeys, key];
  if (nextProgress < 3) {
    return {
      state: { ...state, quotaProgress: nextProgress, answeredKeys },
      progressed: true,
      reward: null,
    };
  }
  const reward = GAME_CATALOG.find((item) => !state.unlockedItemIds.includes(item.id)) ?? null;
  return {
    state: {
      ...state,
      quotaProgress: 0,
      answeredKeys,
      unlockedItemIds: reward
        ? [...state.unlockedItemIds, reward.id]
        : state.unlockedItemIds,
      ...(reward ? { latestRewardId: reward.id } : {}),
    },
    progressed: true,
    reward,
  };
}

export function placeDecoration(
  state: GameState,
  itemId: string,
  spotId: GardenSpotId,
): GameState {
  if (!state.unlockedItemIds.includes(itemId)) return state;
  return {
    ...state,
    placements: {
      ...state.placements,
      [itemId]: spotId,
    },
  };
}

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

function uniqueStrings(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) return null;
  return [...new Set(value)];
}

const V1_MIGRATION: Record<string, GardenSpotId> = {
  left: 'big-tree',
  center: 'pond-side',
  right: 'little-gate',
  front: 'front-garden',
};

function validPlacementMap(
  raw: unknown,
  unlockedItemIds: string[],
  version: 1 | 2,
): Partial<Record<string, GardenSpotId>> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const placements: Partial<Record<string, GardenSpotId>> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!unlockedItemIds.includes(id) || typeof value !== 'string') return null;
    const spotId = version === 1 ? V1_MIGRATION[value] : value as GardenSpotId;
    if (!spotId || !GARDEN_SPOTS.some((spot) => spot.id === spotId)) return null;
    placements[id] = spotId;
  }
  return placements;
}

export function parseGameState(raw: string | null): GameState {
  if (!raw) return EMPTY_GAME_STATE;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if ((value.version !== 1 && value.version !== 2)
      || !Number.isInteger(value.quotaProgress)
      || Number(value.quotaProgress) < 0
      || Number(value.quotaProgress) > 2) {
      return EMPTY_GAME_STATE;
    }
    const answeredKeys = uniqueStrings(value.answeredKeys);
    const unlockedItemIds = uniqueStrings(value.unlockedItemIds);
    if (!answeredKeys || !unlockedItemIds) return EMPTY_GAME_STATE;
    if (unlockedItemIds.some((id) => !GAME_CATALOG.some((item) => item.id === id))) {
      return EMPTY_GAME_STATE;
    }
    const placements = validPlacementMap(value.placements, unlockedItemIds, value.version);
    if (!placements) return EMPTY_GAME_STATE;
    const latestRewardId = value.latestRewardId;
    if (latestRewardId !== undefined
      && (typeof latestRewardId !== 'string' || !unlockedItemIds.includes(latestRewardId))) {
      return EMPTY_GAME_STATE;
    }
    return {
      version: 2,
      quotaProgress: Number(value.quotaProgress),
      answeredKeys,
      unlockedItemIds,
      placements,
      ...(typeof latestRewardId === 'string' ? { latestRewardId } : {}),
    };
  } catch {
    return EMPTY_GAME_STATE;
  }
}
