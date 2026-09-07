import { SubjectMark } from './subject-mark.tsx';

export function StudioWelcome() {
  return <section className="studio-welcome">
    <div>
      <p className="dm-kicker">나의 작은 배움터</p>
      <h1>오늘도, 한 장의 발견</h1>
      <p>천천히 풀어도 좋아요.<br className="studio-welcome__break" /> 해 보는 만큼 친구도 자라요.</p>
    </div>
    <div className="studio-welcome__books" aria-hidden="true">
      <span><SubjectMark subject="korean" /></span>
      <span><SubjectMark subject="english" /></span>
      <span><SubjectMark subject="math" /></span>
    </div>
  </section>;
}
