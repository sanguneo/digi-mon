import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  EMPTY_GAME_STATE,
  type AnswerResult,
  type GardenSpotId,
  type GameItem,
  type GameState,
  parseGameState,
  placeDecoration,
  recordAnswer,
  serializeGameState,
} from './game-state.ts';

const STORAGE_KEY = 'digi-mon/garden-state@1';

interface GameContextValue {
  state: GameState;
  latestReward: GameItem | null;
  announcement: string;
  answerItem: (worksheetId: string, itemId: string) => AnswerResult;
  placeItem: (itemId: string, spotId: GardenSpotId) => void;
  dismissReward: () => void;
  resetGarden: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function initialState(): GameState {
  if (typeof window === 'undefined') return EMPTY_GAME_STATE;
  return parseGameState(window.localStorage.getItem(STORAGE_KEY));
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [latestReward, setLatestReward] = useState<GameItem | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, serializeGameState(state));
  }, [state]);

  const answerItem = useCallback((worksheetId: string, itemId: string) => {
    const result = recordAnswer(state, worksheetId, itemId);
    setState(result.state);
    if (result.progressed) {
      setAnnouncement(
        result.reward
          ? '정원에 새 친구가 왔어요!'
          : '한 걸음 했어요.',
      );
    }
    if (result.reward) setLatestReward(result.reward);
    return result;
  }, [state]);

  const placeItem = useCallback((itemId: string, spotId: GardenSpotId) => {
    setState((current) => placeDecoration(current, itemId, spotId));
    setAnnouncement('정원에 예쁘게 놓았어요.');
  }, []);

  const dismissReward = useCallback(() => setLatestReward(null), []);
  const resetGarden = useCallback(() => {
    setState(EMPTY_GAME_STATE);
    setLatestReward(null);
    setAnnouncement('작은 정원을 새로 시작했어요.');
  }, []);

  const value = useMemo<GameContextValue>(() => ({
    state,
    latestReward,
    announcement,
    answerItem,
    placeItem,
    dismissReward,
    resetGarden,
  }), [
    state,
    latestReward,
    announcement,
    answerItem,
    placeItem,
    dismissReward,
    resetGarden,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error('GameProvider 안에서 사용해야 합니다.');
  return context;
}
