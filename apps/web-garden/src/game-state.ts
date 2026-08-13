export type DecorationArea = 'left' | 'center' | 'right' | 'front';

export interface GameItem {
  id: string;
  name: string;
  description: string;
}

export interface GameState {
  version: 1;
  quotaProgress: number;
  answeredKeys: string[];
  unlockedItemIds: string[];
  placements: Partial<Record<string, DecorationArea>>;
  latestRewardId?: string;
}

export interface AnswerResult {
  state: GameState;
  progressed: boolean;
  reward: GameItem | null;
}

export const GAME_CATALOG: readonly GameItem[] = [
  { id: 'moon-chair', name: '달빛 의자', description: '달빛 아래 쉬어 가는 의자' },
  { id: 'dandelion-pot', name: '민들레 화분', description: '노란 민들레가 피었어요' },
  { id: 'tiny-pond', name: '작은 연못', description: '물고기가 살짝 헤엄쳐요' },
  { id: 'cloud-balloon', name: '구름 풍선', description: '하늘에 둥실 떠 있어요' },
  { id: 'reading-cat', name: '책 읽는 고양이', description: '고양이가 조용히 책을 읽어요' },
  { id: 'rainbow-flag', name: '무지개 깃발', description: '정원 입구를 밝혀요' },
];

export const EMPTY_GAME_STATE: GameState = {
  version: 1,
  quotaProgress: 0,
  answeredKeys: [],
  unlockedItemIds: [],
  placements: {},
};

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
      state: {
        ...state,
        quotaProgress: nextProgress,
        answeredKeys,
      },
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
  area: DecorationArea,
): GameState {
  if (!state.unlockedItemIds.includes(itemId)) return state;
  return {
    ...state,
    placements: {
      ...state.placements,
      [itemId]: area,
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

export function parseGameState(raw: string | null): GameState {
  if (!raw) return EMPTY_GAME_STATE;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.version !== 1
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
    const rawPlacements = value.placements;
    if (!rawPlacements || typeof rawPlacements !== 'object' || Array.isArray(rawPlacements)) {
      return EMPTY_GAME_STATE;
    }
    const validAreas: DecorationArea[] = ['left', 'center', 'right', 'front'];
    const placements: Partial<Record<string, DecorationArea>> = {};
    for (const [id, area] of Object.entries(rawPlacements)) {
      if (!unlockedItemIds.includes(id)
        || typeof area !== 'string'
        || !validAreas.includes(area as DecorationArea)) {
        return EMPTY_GAME_STATE;
      }
      placements[id] = area as DecorationArea;
    }
    const latestRewardId = value.latestRewardId;
    if (latestRewardId !== undefined
      && (typeof latestRewardId !== 'string' || !unlockedItemIds.includes(latestRewardId))) {
      return EMPTY_GAME_STATE;
    }
    return {
      version: 1,
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
