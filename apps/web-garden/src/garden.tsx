import { type CSSProperties, useEffect, useState } from 'react';

import { useGame } from './game-context.tsx';
import {
  GAME_CATALOG,
  GARDEN_CATEGORIES,
  type GameItem,
} from './garden-catalog.ts';
import {
  GARDEN_SPOTS,
  gardenSpot,
  type GardenSpotId,
} from './game-state.ts';

function DecorationArt({ item }: { item: GameItem }) {
  return <span className="garden-art" aria-hidden="true">{item.art}</span>;
}

export function GardenRoom({
  onLearn,
  preselectReward,
}: {
  onLearn: () => void;
  preselectReward: boolean;
}) {
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

  useEffect(() => {
    if (preselectReward && latestReward) setSelectedItemId(latestReward.id);
  }, [latestReward, preselectReward]);

  const chooseSpot = (spotId: GardenSpotId) => {
    if (!selected) return;
    placeItem(selected.id, spotId);
    setSelectedItemId(null);
    dismissReward();
  };

  return (
    <main className="garden-room" id="garden-view">
      <header className="garden-room__header">
        <div>
          <p className="dm-kicker">배움으로 가꾸는 나만의 공간</p>
          <h1>나만의 정원</h1>
          <p>모은 장식을 골라 나무 아래, 연못 옆, 꽃길에 자유롭게 놓아 보세요.</p>
        </div>
        <div className="garden-room__actions">
          <div className="garden-room__progress">
            <span aria-hidden="true">🌱</span>
            <strong>오늘의 걸음 {state.quotaProgress}/3</strong>
          </div>
          <button className="dm-btn dm-btn--primary" onClick={onLearn} type="button">
            학습하러 가기
          </button>
        </div>
      </header>

      <p className="garden-announcement" aria-live="polite">
        {latestReward ? '정원에 새 친구가 왔어요!' : announcement}
      </p>

      <section className="garden-canvas" aria-label="꾸미는 정원 풍경">
        <div className="garden-canvas__sky" aria-hidden="true">
          <span className="garden-canvas__sun">☀️</span>
          <span className="garden-canvas__cloud garden-canvas__cloud--one">☁️</span>
          <span className="garden-canvas__cloud garden-canvas__cloud--two">☁️</span>
        </div>
        <div className="garden-landmark garden-landmark--tree" aria-hidden="true">🌳</div>
        <div className="garden-landmark garden-landmark--pond" aria-hidden="true">
          <span>🐟</span>
        </div>
        <div className="garden-landmark garden-landmark--flowers" aria-hidden="true">🌷 🌼 🌸</div>
        <div className="garden-landmark garden-landmark--gate" aria-hidden="true">🏡</div>
        <div className="garden-landmark garden-landmark--bridge" aria-hidden="true">🌉</div>
        <div className="garden-path" aria-hidden="true" />
        <div className="garden-stream" aria-hidden="true" />

        {GAME_CATALOG.flatMap((item) => {
          const spotId = state.placements[item.id];
          if (!spotId) return [];
          const spot = gardenSpot(spotId);
          return [(
            <div
              className="garden-decoration"
              key={item.id}
              role="img"
              aria-label={`${item.name}, ${spot.label}에 놓임`}
              style={{
                '--spot-x': `${spot.x}%`,
                '--spot-y': `${spot.y}%`,
                '--spot-depth': String(spot.depth),
              } as CSSProperties}
            >
              <DecorationArt item={item} />
              <span>{item.name}</span>
            </div>
          )];
        })}

        {selected ? GARDEN_SPOTS.map((spot) => (
          <button
            className="garden-spot"
            key={spot.id}
            onClick={() => chooseSpot(spot.id)}
            type="button"
            aria-label={`${spot.label} 배치 지점`}
            style={{
              '--spot-x': `${spot.x}%`,
              '--spot-y': `${spot.y}%`,
              '--spot-depth': String(spot.depth + 10),
            } as CSSProperties}
          >
            <span>{spot.label}</span>
          </button>
        )) : null}
      </section>

      {selected ? (
        <aside className="garden-placement-bar" aria-live="polite">
          <DecorationArt item={selected} />
          <div>
            <strong>{selected.name}을 어디에 놓을까요?</strong>
            <p>정원 풍경 안의 반짝이는 지점을 골라 주세요.</p>
          </div>
          <button className="dm-btn dm-btn--quiet" onClick={() => setSelectedItemId(null)} type="button">
            배치하지 않기
          </button>
        </aside>
      ) : null}

      <section className="garden-room__inventory" aria-labelledby="inventory-title">
        <div className="garden-inventory__title">
          <div>
            <p className="dm-kicker">모은 친구를 풍경 속으로</p>
            <h2 id="inventory-title">장식 상자</h2>
            <p>
              모은 장식 {state.unlockedItemIds.length}/{GAME_CATALOG.length}
              <span aria-hidden="true"> · </span>
              네 가지 이야기
            </p>
          </div>
          <button className="garden-reset" onClick={resetGarden} type="button">
            정원 새로 시작하기
          </button>
        </div>
        <div className="garden-collections">
          {GARDEN_CATEGORIES.map((category) => (
            <section className={`garden-collection garden-collection--${category.id}`} key={category.id}>
              <header>
                <div>
                  <p>{category.description}</p>
                  <h3>{category.name}</h3>
                </div>
                <span>
                  {GAME_CATALOG.filter((item) => (
                    item.category === category.id
                    && state.unlockedItemIds.includes(item.id)
                  )).length}/3
                </span>
              </header>
              <div className="garden-inventory__grid">
                {GAME_CATALOG.filter((item) => item.category === category.id).map((item) => {
                  const unlocked = state.unlockedItemIds.includes(item.id);
                  const spotId = state.placements[item.id];
                  const spot = spotId ? gardenSpot(spotId) : null;
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
                        spot ? `${spot.label}에 놓임, 다시 놓기` : '',
                      ].filter(Boolean).join(', ')}
                    >
                      <DecorationArt item={item} />
                      <strong>{unlocked ? item.name : '아직 비밀'}</strong>
                      <span>{unlocked ? item.description : '다음 장식을 기다리는 중'}</span>
                      {spot ? <small>{spot.label} · 다시 놓기</small> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
      <p className="garden-rest">오늘은 여기까지 해도 괜찮아요.</p>
    </main>
  );
}
