import { useEffect, useState } from 'react';
import { useGame } from './game-context.tsx';
import type { Subject } from './api.ts';
import { GARDEN_CATEGORIES } from './garden-catalog.ts';
import { GARDEN_SPOTS, GROWTH_MILESTONES, gardenSpot, growthProgress, type GardenSpotId } from './game-state.ts';
import { WORLD_CATALOGS, WORLDS, WORLD_SUBJECTS } from './garden-worlds.ts';
import { GardenScene } from './garden-scene.tsx';
import './garden-worlds.css';

export function GardenRoom({ onLearn, preselectReward }: { onLearn: (subject?: Subject) => void; preselectReward: boolean }) {
  const { state, latestReward, latestRewardSubject, growthCelebration, announcement, storageError,
    placeItem, care, selectSubject, dismissReward, resetGarden } = useGame();
  const subject = state.activeSubject;
  const world = state.worlds[subject];
  const definition = WORLDS[subject];
  const catalog = WORLD_CATALOGS[subject];
  const growth = growthProgress(world);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const selected = catalog.find((item) => item.id === selectedItemId) ?? null;
  const rewardHere = latestRewardSubject === subject ? latestReward : null;
  const celebrated = growthCelebration?.subject === subject ? growthCelebration : null;

  useEffect(() => {
    if (preselectReward && latestReward && latestRewardSubject) {
      selectSubject(latestRewardSubject);
      setSelectedItemId(latestReward.id);
    }
  }, [latestReward, latestRewardSubject, preselectReward, selectSubject]);

  const chooseSpot = (spotId: GardenSpotId) => {
    if (!selected) return;
    placeItem(selected.id, spotId, subject);
    setSelectedItemId(null);
    dismissReward();
  };

  return (
    <main className="garden-room world-room" id="garden-view" tabIndex={-1} data-world={subject}>
      <header className="garden-room__header">
        <div>
          <p className="dm-kicker">배우고 돌보며 함께 자라요</p>
          <h1>{definition.name}</h1>
          <p>{definition.description}</p>
        </div>
        <div className="garden-room__actions">
          <div className="garden-room__progress"><span aria-hidden="true">{definition.art}</span><strong>{definition.subjectName} 걸음 {world.quotaProgress}/3</strong></div>
          <button className="dm-btn dm-btn--primary" onClick={() => onLearn()} type="button">학습하러 가기</button>
        </div>
      </header>

      <div className="world-switcher" role="group" aria-label="돌볼 세상 고르기">
        {WORLD_SUBJECTS.map((entry) => (
          <button className="dm-btn" type="button" key={entry} aria-pressed={entry === subject} onClick={() => {
            selectSubject(entry); setSelectedItemId(null); setConfirmReset(false);
          }}>
            <span aria-hidden="true">{WORLDS[entry].art}</span>
            <span>{WORLDS[entry].subjectName}<small>{entry === 'korean' ? '나무 키우기' : entry === 'english' ? '물고기 키우기' : '강아지 키우기'}</small></span>
          </button>
        ))}
      </div>
      {storageError ? <p className="world-storage-warning" role="alert">{storageError}</p> : null}
      <p className="garden-announcement" aria-live="polite" aria-atomic="true">{announcement || (rewardHere ? `${rewardHere.name}이 왔어요. 장식 상자에서 골라 보세요.` : '맞혔는지보다, 해 본 것이 소중해요.')}</p>

      <div className="world-room__play">
        <GardenScene subject={subject} world={world}>
          <div className="world-scene__care">
            <div className="world-care__actions" role="group" aria-label={`${definition.companion} 돌보기`}>
              {definition.care.map((action) => {
                const available = growth.stage >= (action.unlockStage ?? 0);
                return <button className="dm-btn" type="button" key={action.id} disabled={!available} onClick={() => care(subject, action.id)}>
                  <span aria-hidden="true">{action.art}</span> {action.label}
                  {!available ? <small>한 번 자라면 함께 놀아요</small> : null}
                </button>;
              })}
            </div>
            <p className="world-care__response" aria-live="polite" aria-atomic="true">{world.lastCare ? <>{definition.care.find((action) => action.id === world.lastCare)?.response} <span>함께 돌본 횟수 {Object.values(world.careCounts).reduce((sum, value) => sum + value, 0)}</span></> : '언제든 돌볼 수 있어요. 쉬는 동안에도 작아지지 않아요.'}</p>
          </div>
        </GardenScene>
        <aside className="world-care" aria-labelledby="world-care-title">
          <p className="dm-kicker">내 친구 {definition.companion}</p>
          <h2 id="world-care-title">{definition.stages[growth.stage]}</h2>
          {celebrated ? <p className="world-celebration" role="status">함께 키웠어요! {definition.companion}가 {definition.stages[celebrated.stage]} 모습으로 자랐어요.</p> : null}
          <div className="world-growth" data-stage={growth.stage}>
            {growth.nextStage ? <>
              <h3>다음은 {definition.stages[growth.nextStage]}</h3>
              <label>{definition.subjectName} 문제 해 보기 <strong>{Math.min(world.answeredKeys.length, growth.learningGoal)}/{growth.learningGoal}</strong>
                <progress value={Math.min(world.answeredKeys.length, growth.learningGoal)} max={growth.learningGoal} />
              </label>
              <label>마음 담아 돌보기 <strong>{Math.min(growth.careProgress, growth.careGoal)}/{growth.careGoal}</strong>
                <progress value={Math.min(growth.careProgress, growth.careGoal)} max={growth.careGoal} />
              </label>
              <p>{growth.answersNeeded > 0 ? `${definition.subjectName} 문제 ${growth.answersNeeded}개를 더 해 봐요. 정답이 아니어도 괜찮아요.` : `${growth.careNeeded}번 더 돌보면 새 모습으로 자라요.`}</p>
              <button className="dm-btn dm-btn--primary" type="button" onClick={() => {
                if (growth.answersNeeded > 0) onLearn(subject);
                else care(subject, definition.care[0]!.id);
              }}>{growth.answersNeeded > 0 ? `${definition.subjectName} 문제 해 보기` : definition.care[0]!.label}</button>
            </> : <>
              <h3>우리, 이렇게 자랐어요!</h3>
              <p>함께한 걸음과 돌봄이 쌓였어요. 이제도 놀고, 배우고, 자유롭게 꾸며요.</p>
            </>}
          </div>
          <details className="world-memory">
            <summary>함께 자란 이야기</summary>
            <ol><li>{definition.stages[0]}로 만났어요</li>{world.growthMilestones.map((milestone) => <li key={milestone} data-milestone={milestone}>{definition.stages[milestone]} · 배움 {GROWTH_MILESTONES[milestone - 1]!.answers}걸음과 돌봄 {GROWTH_MILESTONES[milestone - 1]!.care}번</li>)}</ol>
          </details>
        </aside>
      </div>

      {selected ? <section className="world-placement" aria-labelledby="placement-title">
        <div className="garden-placement-bar">
          <span className="garden-art" aria-hidden="true">{selected.art}</span>
          <div><h2 id="placement-title">{selected.name}을 어디에 놓을까요?</h2><p>아래 이름을 골라 주세요. 언제든 다시 옮길 수 있어요.</p></div>
          <button className="dm-btn dm-btn--quiet" type="button" onClick={() => setSelectedItemId(null)}>배치하지 않기</button>
        </div>
        <div className="world-placement__spots">{GARDEN_SPOTS.map((entry) => {
          const spot = gardenSpot(entry.id, subject);
          return <button className="dm-btn" type="button" key={spot.id} aria-label={`${spot.label} 배치 지점`} onClick={() => chooseSpot(spot.id)}>{spot.label}</button>;
        })}</div>
      </section> : null}

      {Object.keys(world.placements).length > 0 ? <section className="world-placed" aria-label="놓인 장식">
        {catalog.flatMap((item) => {
          const spotId = world.placements[item.id];
          return spotId ? [<p key={item.id} role="img" aria-label={`${item.name}, ${gardenSpot(spotId, subject).label}에 놓임`}><span aria-hidden="true">{item.art}</span> {item.name} · {gardenSpot(spotId, subject).label}</p>] : [];
        })}
      </section> : null}

      <section className="garden-room__inventory" aria-labelledby="inventory-title">
        <div className="garden-inventory__title"><div><p className="dm-kicker">세 걸음마다 새 장식 하나</p><h2 id="inventory-title">장식 상자</h2><p>모은 장식 {world.unlockedItemIds.length}/{catalog.length}</p></div></div>
        <div className="garden-collections">
          {GARDEN_CATEGORIES.filter((category) => catalog.some((item) => item.category === category.id)).map((category) => {
            const items = catalog.filter((item) => item.category === category.id);
            return <section className={`garden-collection garden-collection--${category.id}`} key={category.id}>
              <header><div><h3>{category.name}</h3></div><span>{items.filter((item) => world.unlockedItemIds.includes(item.id)).length}/{items.length}</span></header>
              <div className="garden-inventory__grid">{items.map((item) => {
                const unlocked = world.unlockedItemIds.includes(item.id);
                const spotId = world.placements[item.id];
                const spot = spotId ? gardenSpot(spotId, subject) : null;
                return <button className={`garden-item ${unlocked ? 'is-unlocked' : 'is-locked'}`} type="button" key={item.id} disabled={!unlocked}
                  aria-pressed={selectedItemId === item.id}
                  aria-label={[item.name, unlocked ? item.description : '다음 장식을 기다리는 중', spot ? `${spot.label}에 놓임, 다시 놓기` : ''].filter(Boolean).join(', ')}
                  onClick={() => setSelectedItemId(item.id)}>
                  <span className="garden-art" aria-hidden="true">{unlocked ? item.art : '🎁'}</span>
                  <strong>{unlocked ? item.name : '아직 비밀'}</strong><span>{unlocked ? item.description : '세 걸음마다 만나요'}</span>
                  {spot ? <small>{spot.label} · 다시 놓기</small> : null}
                </button>;
              })}</div>
            </section>;
          })}
        </div>
      </section>
      <p className="garden-rest">오늘은 여기까지 해도 괜찮아요. 내 친구는 그대로 기다려요.</p>
      <div className="world-reset">
        {confirmReset ? <div role="group" aria-label="이 세상 새로 시작 확인"><p>{definition.name}의 걸음, 성장, 돌봄과 장식이 지워져요. 다른 과목은 그대로예요.</p>
          <button className="dm-btn" type="button" onClick={() => { resetGarden(subject); setSelectedItemId(null); setConfirmReset(false); }}>이 세상만 새로 시작</button>
          <button className="dm-btn dm-btn--quiet" type="button" onClick={() => setConfirmReset(false)}>그대로 둘래요</button>
        </div> : <button className="garden-reset" type="button" onClick={() => setConfirmReset(true)}>이 세상 새로 시작하기</button>}
      </div>
    </main>
  );
}
