import { useState } from 'react';

import { useGame } from './game-context.tsx';
import {
  GAME_CATALOG,
  type DecorationArea,
  type GameItem,
} from './game-state.ts';

const AREAS: Array<{ id: DecorationArea; label: string }> = [
  { id: 'left', label: '왼쪽' },
  { id: 'center', label: '가운데' },
  { id: 'right', label: '오른쪽' },
  { id: 'front', label: '앞쪽' },
];
const AREA_NAMES = Object.fromEntries(AREAS.map(({ id, label }) => [id, label])) as Record<
  DecorationArea,
  string
>;

function DecorationArt({ item }: { item: GameItem }) {
  const artwork: Record<string, string> = {
    'moon-chair': '🌙',
    'dandelion-pot': '🌼',
    'tiny-pond': '🐟',
    'cloud-balloon': '☁️',
    'reading-cat': '🐈',
    'rainbow-flag': '🌈',
  };
  return <span className="garden-art" aria-hidden="true">{artwork[item.id]}</span>;
}

export function Garden() {
  const {
    state,
    latestReward,
    announcement,
    placeItem,
    dismissReward,
    resetGarden,
  } = useGame();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selected = GAME_CATALOG.find((item) => item.id === selectedItemId) ?? null;

  const chooseArea = (area: DecorationArea) => {
    if (!selected) return;
    placeItem(selected.id, area);
    setSelectedItemId(null);
    dismissReward();
  };

  return (
    <section className="garden-shell" aria-labelledby="garden-title">
      <div className="garden-heading">
        <div>
          <p className="dm-kicker">내가 키우는 배움 공간</p>
          <h2 id="garden-title">오늘의 작은 정원</h2>
          <p>문제 세 개를 천천히 풀면 정원에 새 장식 하나가 도착해요.</p>
        </div>
        <fieldset className="garden-progress">
          <legend className="sr-only">오늘의 걸음 진행</legend>
          <strong>오늘의 걸음 {state.quotaProgress}/3</strong>
          <div className="garden-progress__track" aria-hidden="true">
            {[0, 1, 2].map((step) => (
              <span className={step < state.quotaProgress ? 'is-grown' : ''} key={step}>
                {step < state.quotaProgress ? '🌱' : '○'}
              </span>
            ))}
          </div>
          <small>맞혔는지보다, 해 본 것이 소중해요.</small>
        </fieldset>
      </div>

      <p className="garden-announcement" aria-live="polite">
        {latestReward ? '정원에 새 친구가 왔어요!' : announcement}
      </p>

      <section className="garden-stage" aria-label="꾸민 정원">
        {AREAS.map(({ id, label }) => (
          <div className={`garden-zone garden-zone--${id}`} key={id}>
            <span className="garden-zone__name">{label}</span>
            {GAME_CATALOG.filter((item) => state.placements[item.id] === id).map((item) => (
              <div
                className="garden-placed"
                role="img"
                aria-label={`${item.name}, ${label}에 놓임`}
                key={item.id}
              >
                <DecorationArt item={item} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="garden-sun" aria-hidden="true">☀️</div>
        <div className="garden-cloud garden-cloud--one" aria-hidden="true">☁️</div>
        <div className="garden-cloud garden-cloud--two" aria-hidden="true">☁️</div>
      </section>

      {selected ? (
        <div className="garden-placement" aria-live="polite">
          <div>
            <strong>{selected.name}을 어디에 놓을까요?</strong>
            <p>{selected.description}</p>
          </div>
          <div className="garden-placement__areas">
            {AREAS.map(({ id, label }) => (
              <button className="dm-btn garden-area-button" key={id} onClick={() => chooseArea(id)} type="button">
                {label}
              </button>
            ))}
            <button className="dm-btn dm-btn--quiet" onClick={() => setSelectedItemId(null)} type="button">
              배치하지 않기
            </button>
          </div>
        </div>
      ) : null}

      <div className="garden-inventory">
        <div className="garden-inventory__title">
          <div>
            <p className="dm-kicker">나의 장식 상자</p>
            <h3>모은 정원 친구들</h3>
          </div>
          <button className="garden-reset" onClick={resetGarden} type="button">정원 새로 시작하기</button>
        </div>
        <div className="garden-inventory__grid">
          {GAME_CATALOG.map((item) => {
            const unlocked = state.unlockedItemIds.includes(item.id);
            const area = state.placements[item.id];
            return (
              <button
                className={`garden-item ${unlocked ? 'is-unlocked' : 'is-locked'}`}
                disabled={!unlocked}
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                type="button"
                aria-label={[
                  item.name,
                  unlocked ? item.description : '다음 장식을 기다리는 중',
                  area ? `${AREA_NAMES[area]}에 놓임, 다시 놓기` : '',
                ].filter(Boolean).join(', ')}
              >
                <DecorationArt item={item} />
                <strong>{unlocked ? item.name : '아직 비밀'}</strong>
                <span>{unlocked ? item.description : '다음 장식을 기다리는 중'}</span>
                {area ? <small>{AREA_NAMES[area]} · 다시 놓기</small> : null}
              </button>
            );
          })}
        </div>
      </div>

      <p className="garden-rest">오늘은 여기까지 해도 괜찮아요.</p>
    </section>
  );
}
