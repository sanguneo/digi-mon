import { useGame } from './game-context.tsx';
import { growthProgress } from './game-state.ts';
import { WORLDS } from './garden-worlds.ts';

export function GardenSummary({ onOpenGarden }: { onOpenGarden: () => void }) {
  const { state, latestReward, latestRewardSubject, growthCelebration, storageError } = useGame();
  const definition = WORLDS[state.activeSubject];
  const world = state.worlds[state.activeSubject];
  const growth = growthProgress(world);
  const rewardWorld = latestRewardSubject ? WORLDS[latestRewardSubject] : definition;
  return (
    <section className="garden-summary" aria-labelledby="garden-summary-title">
      <div className="garden-summary__progress">
        <div className="garden-summary__sprout" aria-hidden="true">{definition.art}</div>
        <div>
          <p className="dm-kicker">{definition.companion} · {definition.stages[growth.stage]}</p>
          <h2 id="garden-summary-title">{definition.subjectName} 걸음 {world.quotaProgress}/3</h2>
          <p>맞혔는지보다, 해 본 것이 소중해요.</p>
          {growth.nextStage ? <p>다음 모습까지 {definition.subjectName} {growth.answersNeeded}걸음, 돌봄 {growth.careNeeded}번</p> : <p>함께 자란 친구와 계속 놀고 꾸며요.</p>}
        </div>
      </div>
      <div className="garden-summary__steps" aria-hidden="true">{[0, 1, 2].map((step) => <span className={step < world.quotaProgress ? 'is-grown' : ''} key={step}>{step < world.quotaProgress ? '🌿' : '○'}</span>)}</div>
      {latestReward ? <div className="garden-reward-card" aria-live="polite">
        <span aria-hidden="true">🎁</span><div><strong>{rewardWorld.name}에 새 장식이 왔어요!</strong><p>{latestReward.name}을 어디에 둘지 골라 주세요.</p></div>
        <button className="dm-btn dm-btn--primary" onClick={onOpenGarden} type="button">새 장식 놓으러 가기</button>
      </div> : <button className="dm-btn garden-summary__cta" onClick={onOpenGarden} type="button">내 세상 둘러보기</button>}
      {growthCelebration ? <p role="status">{WORLDS[growthCelebration.subject].companion}가 {WORLDS[growthCelebration.subject].stages[growthCelebration.stage]} 모습으로 자랐어요!</p> : null}
      {storageError ? <p role="alert">{storageError}</p> : null}
    </section>
  );
}
