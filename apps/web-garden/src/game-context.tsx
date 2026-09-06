import {
  type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { Subject } from './api.ts';
import {
  EMPTY_GAME_STATE, type AnswerResult, type GardenSpotId, type GameState,
  careForWorld, growthStage, parseGameState, placeDecoration, recordAnswer, resetWorld, serializeGameState,
} from './game-state.ts';
import type { GameItem } from './garden-catalog.ts';
import { WORLDS, type CareAction } from './garden-worlds.ts';

const STORAGE_KEY = 'digi-mon/garden-state@1';
const STORAGE_ERROR = '이 기기에 저장할 수 없어요. 지금은 계속 돌볼 수 있지만, 창을 닫으면 이번 변화가 사라질 수 있어요.';

interface GameContextValue {
  state: GameState;
  latestReward: GameItem | null;
  latestRewardSubject: Subject | null;
  growthCelebration: { subject: Subject; stage: 1 | 2 | 3 } | null;
  announcement: string;
  storageError: string;
  answerItem: (worksheetId: string, itemId: string, subject: Subject) => AnswerResult;
  placeItem: (itemId: string, spotId: GardenSpotId, subject: Subject) => void;
  care: (subject: Subject, action: CareAction) => void;
  selectSubject: (subject: Subject) => void;
  dismissReward: () => void;
  resetGarden: (subject: Subject) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function initialState(): { state: GameState; storageError: string } {
  if (typeof window === 'undefined') return { state: EMPTY_GAME_STATE, storageError: '' };
  try {
    return { state: parseGameState(window.localStorage.getItem(STORAGE_KEY)), storageError: '' };
  } catch {
    return { state: EMPTY_GAME_STATE, storageError: STORAGE_ERROR };
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(initialState);
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const [storageError, setStorageError] = useState(initial.storageError);
  const [reward, setReward] = useState<{ item: GameItem; subject: Subject } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [growthCelebration, setGrowthCelebration] = useState<GameContextValue['growthCelebration']>(null);

  // Advance before publishing, not inside React's replayable updater. Synchronous callbacks
  // from a single render (including worksheet batch events) always see the latest answer.
  const publish = useCallback((next: GameState) => {
    for (const subject of ['korean', 'english', 'math'] as const) {
      const stage = growthStage(next.worlds[subject]);
      if (stage > growthStage(stateRef.current.worlds[subject]) && stage !== 0) setGrowthCelebration({ subject, stage });
    }
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeGameState(state));
      setStorageError('');
    } catch {
      setStorageError(STORAGE_ERROR);
    }
  }, [state]);

  const answerItem = useCallback((worksheetId: string, itemId: string, subject: Subject) => {
    const result = recordAnswer(stateRef.current, worksheetId, itemId, subject);
    publish(result.state);
    if (result.progressed) setAnnouncement(result.reward ? `${WORLDS[subject].name}에 새 장식이 왔어요!` : '한 걸음 했어요.');
    if (result.reward) setReward({ item: result.reward, subject });
    return result;
  }, [publish]);

  const placeItem = useCallback((itemId: string, spotId: GardenSpotId, subject: Subject) => {
    publish(placeDecoration(stateRef.current, itemId, spotId, subject));
    setAnnouncement('모은 장식을 예쁘게 놓았어요.');
  }, [publish]);

  const care = useCallback((subject: Subject, action: CareAction) => {
    publish(careForWorld(stateRef.current, subject, action));
    setAnnouncement(WORLDS[subject].care.find((entry) => entry.id === action)?.response ?? '');
  }, [publish]);

  const selectSubject = useCallback((subject: Subject) => {
    publish({ ...stateRef.current, activeSubject: subject });
    setAnnouncement('');
  }, [publish]);
  const dismissReward = useCallback(() => setReward(null), []);
  const resetGarden = useCallback((subject: Subject) => {
    publish(resetWorld(stateRef.current, subject));
    setReward((current) => current?.subject === subject ? null : current);
    setGrowthCelebration((current) => current?.subject === subject ? null : current);
    setAnnouncement(`${WORLDS[subject].name}을 새로 시작했어요.`);
  }, [publish]);

  const value = useMemo<GameContextValue>(() => ({
    state, latestReward: reward?.item ?? null, latestRewardSubject: reward?.subject ?? null,
    growthCelebration, announcement, storageError, answerItem, placeItem, care, selectSubject, dismissReward, resetGarden,
  }), [state, reward, growthCelebration, announcement, storageError, answerItem, placeItem, care, selectSubject, dismissReward, resetGarden]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error('GameProvider 안에서 사용해야 합니다.');
  return context;
}
