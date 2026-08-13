import { useGame } from './game-context.tsx';

export function GardenSummary({ onOpenGarden }: { onOpenGarden: () => void }) {
  const { state, latestReward } = useGame();
  return (
    <section className="garden-summary" aria-labelledby="garden-summary-title">
      <div className="garden-summary__progress">
        <div className="garden-summary__sprout" aria-hidden="true">🌱</div>
        <div>
          <p className="dm-kicker">내 정원이 기다리고 있어요</p>
          <h2 id="garden-summary-title">오늘의 걸음 {state.quotaProgress}/3</h2>
          <p>맞혔는지보다, 해 본 것이 소중해요.</p>
        </div>
      </div>
      <div className="garden-summary__steps" aria-hidden="true">
        {[0, 1, 2].map((step) => (
          <span className={step < state.quotaProgress ? 'is-grown' : ''} key={step}>
            {step < state.quotaProgress ? '🌿' : '○'}
          </span>
        ))}
      </div>
      {latestReward ? (
        <div className="garden-reward-card" aria-live="polite">
          <span aria-hidden="true">🎁</span>
          <div>
            <strong>정원에 새 친구가 왔어요!</strong>
            <p>{latestReward.name}을 어디에 둘지 골라 주세요.</p>
          </div>
          <button className="dm-btn dm-btn--primary" onClick={onOpenGarden} type="button">
            정원에 놓으러 가기
          </button>
        </div>
      ) : (
        <button className="dm-btn garden-summary__cta" onClick={onOpenGarden} type="button">
          정원 보기
        </button>
      )}
    </section>
  );
}
