import type { Difficulty, GradeBand, Subject, Worksheet } from './api.ts';

export interface PracticePreset {
  count: number;
  label: string;
  domain: string;
  difficulty: Difficulty;
}

export const SUBJECT_PRACTICE: Record<Subject, {
  label: string;
  mark: string;
  grade: GradeBand;
  count: number;
  chunk: number;
  title: string;
  guidance: string;
  answerLabel: string;
  presets: PracticePreset[];
}> = {
  math: {
    label: '수학', mark: '수', grade: '1-2', count: 12, chunk: 4,
    title: '세고, 그리고, 생각해요',
    guidance: '네 문제씩 차근차근 해 봐요. 계산하거나 그림을 그려도 좋아요. 한 묶음 뒤에는 쉬어 가도 괜찮아요.',
    answerLabel: '계산하거나 그려 보세요',
    presets: [
      { count: 12, label: '12문항 골고루', domain: '', difficulty: 1 },
      { count: 30, label: '30문항 기초 연습', domain: '수와 연산', difficulty: 1 },
      { count: 50, label: '50문항 넉넉히', domain: '수와 연산', difficulty: 1 },
    ],
  },
  korean: {
    label: '국어', mark: '국', grade: '1-2', count: 6, chunk: 2,
    title: '읽고, 내 생각을 써요',
    guidance: '두 문제씩 읽어 봐요. 글에서 중요한 말을 찾고, 내 생각은 아래 칸에 천천히 써요.',
    answerLabel: '내 생각을 써 보세요',
    presets: [
      { count: 6, label: '6문항 차근차근', domain: '', difficulty: 1 },
      { count: 10, label: '10문항 더 읽기', domain: '', difficulty: 1 },
    ],
  },
  english: {
    label: '영어', mark: '영', grade: '3-4', count: 6, chunk: 3,
    title: '짧게 읽고, 한마디씩',
    guidance: '세 문제씩 만나요. 낱말과 짧은 문장을 읽고, 알맞은 답을 고르거나 써요.',
    answerLabel: '낱말이나 짧은 문장을 써 보세요',
    presets: [
      { count: 6, label: '6문항 짧게 시작', domain: '', difficulty: 1 },
      { count: 9, label: '9문항 더 연습', domain: '', difficulty: 1 },
    ],
  },
};

export function practicePresets(subject: Subject, grade: GradeBand): PracticePreset[] {
  if (subject !== 'math') {
    return SUBJECT_PRACTICE[subject].presets.map((preset) => ({ ...preset, difficulty: grade === '5-6' ? 2 : 1 }));
  }
  const topic = { '1-2': '수 세기와 계산', '3-4': '곱셈·나눗셈과 수', '5-6': '분수·소수와 계산' }[grade];
  return [
    { count: 12, label: '12문항 골고루', domain: '', difficulty: grade === '1-2' ? 1 : 2 },
    { count: 30, label: `30문항 ${topic}`, domain: '수와 연산', difficulty: 1 },
    { count: 50, label: '50문항 넉넉히', domain: '수와 연산', difficulty: 1 },
    { count: 12, label: '12문항 생각 넓히기', domain: '', difficulty: grade === '1-2' ? 2 : 3 },
  ];
}

export function WorksheetHeader({ worksheet, adaptive = false }: { worksheet: Worksheet; adaptive?: boolean }) {
  const practice = SUBJECT_PRACTICE[worksheet.options.subject];
  const grades = [...new Set(worksheet.items.map((item) => item.gradeBand))].join(', ');
  const difficulty = worksheet.options.difficulty;
  const difficultyLabel = difficulty ? ({ 1: '쉬움', 2: '기본', 3: '도전' } as const)[difficulty] : '혼합';
  return (
    <>
      <header className="dm-worksheet__header">
        <div>
          <p className="dm-kicker">{adaptive ? '맞춤 학습지' : practice.title}</p>
          <h3>{adaptive ? '맞춤 학습지' : `${practice.label} · ${grades}학년`}</h3>
          <p>난이도 {difficultyLabel} · {worksheet.produced}문항</p>
        </div>
        <div className="dm-seal">
          <span>seed {worksheet.seed}</span>
          <span>fingerprint {worksheet.fingerprint.slice(0, 12)}</span>
        </div>
      </header>
      <div className="dm-worksheet__guidance">
        <span className="dm-subject-option__mark" aria-hidden="true">{practice.mark}</span>
        <p>{practice.guidance}</p>
      </div>
      <div className="dm-worksheet__tools">
        <p>한 번에 다 풀지 않아도 좋아요. 인쇄하면 모든 문제가 나와요.</p>
        <button className="dm-btn" onClick={() => window.print()} type="button">학습지 인쇄</button>
      </div>
    </>
  );
}
