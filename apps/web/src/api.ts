export type Subject = 'math' | 'korean' | 'english';
export type GradeBand = '1-2' | '3-4' | '5-6';
export type Difficulty = 1 | 2 | 3;

export interface DomainCoverage {
  domain: string;
  total: number;
  covered: number;
  coverageRatio: number;
}

export interface SubjectCoverage {
  subject: Subject;
  subjectKorean: string;
  standardCount: number;
  coveredStandards: number;
  coverageRatio: number;
  domains: DomainCoverage[];
}

export interface Choice {
  label: string;
  text: string;
}

export interface Figure {
  kind: string;
  altText: string;
  access?: string;
  accommodation?: string;
  svg?: string;
}

export interface WorksheetItem {
  id: string;
  number: number;
  standardCode: string;
  subject: Subject;
  subjectKorean: string;
  gradeBand: GradeBand;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  format: string;
  scoring: 'auto' | 'manual';
  instruction?: string;
  stem: string;
  choices?: Choice[];
  figure?: Figure;
}

export interface WorksheetOptions {
  subject: Subject;
  gradeBands?: GradeBand[];
  domains?: string[];
  codes?: string[];
  count: number;
  difficulty?: Difficulty;
  difficultyMix?: Record<string, number>;
  modes: string[];
  followLearningOrder: boolean;
  excludeItemIds: string[];
}

export interface Worksheet {
  schema: 'digi-mon/worksheet@5';
  seed: string;
  fingerprint: string;
  title: string;
  requested: number;
  produced: number;
  shortfall: number;
  options: WorksheetOptions;
  standardsUsed: string[];
  difficultyHistogram: Record<string, number>;
  items: WorksheetItem[];
}

export interface GradingAggregate {
  attempted: number;
  correct: number;
  accuracy: number;
}

export interface GradingResult {
  schema: 'digi-mon/grading-result@1';
  graded: number;
  answered: number;
  total: number;
  manualScoringCount: number;
  correct: number;
  accuracy: number | null;
  completionRate: number | null;
  byStandard: Record<string, GradingAggregate & { skills?: unknown }>;
}

export interface LearningRecommendation {
  decision: 'practice' | 'remediate' | 'advance' | 'await-manual-review';
  reasonCodes: string[];
  nextAction:
    | { kind: 'worksheet'; codes: string[]; modes: string[]; count: number }
    | { kind: 'remediation'; weakStandards: string[]; depth: number; prerequisitePolicy: 'approved-only' }
    | { kind: 'manual-review'; pendingItems: number }
    | { kind: 'complete'; completedStandards: string[] };
}

export interface Remediation {
  worksheet: Worksheet;
  plan: Array<{
    code: string;
    role: 'target' | 'prerequisite';
    hasGenerator: boolean;
  }>;
  skipped: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
  const payload = await response.json() as { error?: string; detail?: unknown } & T;
  if (!response.ok) {
    throw new ApiError(payload.error ?? '요청을 완료하지 못했습니다.', response.status, payload.detail);
  }
  return payload;
}

export async function getSubjects(): Promise<SubjectCoverage[]> {
  const payload = await requestJson<{ subjects: SubjectCoverage[] }>('/learner/api/v1/subjects');
  return payload.subjects;
}

export function createWorksheet(
  options: {
    subject: Subject;
    grade?: GradeBand[];
    domain?: string[];
    codes?: string[];
    count: number;
    difficulty?: Difficulty;
    modes?: string[];
    seed: string;
  },
): Promise<Worksheet> {
  return requestJson('/learner/api/v1/worksheets', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export function gradeWorksheet(
  worksheet: Worksheet,
  responses: Record<string, string>,
): Promise<GradingResult> {
  return requestJson('/learner/api/v1/grade', {
    method: 'POST',
    body: JSON.stringify({
      ...worksheet.options,
      seed: worksheet.seed,
      fingerprint: worksheet.fingerprint,
      responses,
      records: false,
    }),
  });
}

export function recommendLearning(
  worksheet: Worksheet,
  grading: GradingResult,
): Promise<LearningRecommendation> {
  const byStandard = Object.fromEntries(
    Object.entries(grading.byStandard).map(([code, aggregate]) => [
      code,
      {
        attempted: aggregate.attempted,
        correct: aggregate.correct,
        accuracy: aggregate.accuracy,
      },
    ]),
  );
  return requestJson('/learner/api/v1/learning-gate', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'digi-mon/learning-gate-request@1',
      policyRevision: 1,
      evidence: {
        source: 'grading-result',
        graded: grading.graded,
        answered: grading.answered,
        total: grading.total,
        manualScoringCount: grading.manualScoringCount,
        accuracy: grading.accuracy,
        completionRate: grading.completionRate,
        byStandard,
      },
      target: {
        subject: worksheet.options.subject,
        codes: worksheet.standardsUsed,
        modes: worksheet.options.modes,
        count: worksheet.requested,
      },
    }),
  });
}

export function createAdaptiveWorksheet(
  source: Worksheet,
  recommendation: LearningRecommendation,
): Promise<Worksheet> {
  const action = recommendation.nextAction;
  if (action.kind !== 'worksheet') {
    throw new Error('worksheet 추천이 아닙니다.');
  }
  return createWorksheet({
    subject: source.options.subject,
    codes: action.codes,
    count: action.count,
    modes: action.modes,
    seed: `${source.seed}-next`,
  });
}

export async function createRemediation(
  source: Worksheet,
  recommendation: LearningRecommendation,
): Promise<Worksheet> {
  const action = recommendation.nextAction;
  if (action.kind !== 'remediation') {
    throw new Error('remediation 추천이 아닙니다.');
  }
  const result = await requestJson<Remediation>('/learner/api/v1/remediation', {
    method: 'POST',
    body: JSON.stringify({
      weakStandards: action.weakStandards,
      depth: action.depth,
      count: source.requested,
      seed: `${source.seed}-remediation`,
    }),
  });
  return result.worksheet;
}
