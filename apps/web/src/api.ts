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

export interface ProblemType {
  id: string;
  skill: string;
  subject: Subject;
  gradeBand: GradeBand;
  domain: string;
  difficulties: Difficulty[];
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

interface LearningObjective {
  text: string;
  source: 'generator-skill';
}

export type LearningSupport = {
  schema: 'digi-mon/learning-support@1';
  objective: LearningObjective;
} & ({
  status: 'objective-only';
} | {
  status: 'guided-candidate';
  review: { status: 'candidate'; sourceKind: 'repository-authored'; revision: 1 };
  materials: Array<{ kind: 'principle' | 'rule' | 'strategy'; text: string }>;
  hints: [
    { level: 1; kind: 'concept-recall' | 'strategy'; text: string },
    { level: 2; kind: 'concept-recall' | 'strategy'; text: string },
  ];
});

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
  learningSupport?: LearningSupport;
}

export interface WorksheetOptions {
  subject: Subject;
  gradeBands?: GradeBand[];
  domains?: string[];
  codes?: string[];
  generatorIds?: string[];
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

// 다른 기기에서 검토할 때 교사가 직접 입력한 토큰. 저장소에 남기지 않고 이 탭의 메모리에만 둔다.
let typedTeacherToken = '';

export function setTeacherToken(token: string) {
  typedTeacherToken = token.trim();
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(typedTeacherToken && path.startsWith('/teacher/api/') ? { authorization: `Bearer ${typedTeacherToken}` } : {}),
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

export async function getProblemTypes(): Promise<ProblemType[]> {
  const payload = await requestJson<{ generators: ProblemType[] }>('/learner/api/v1/generators');
  return payload.generators;
}

export function createWorksheet(
  options: {
    subject: Subject;
    grade?: GradeBand[];
    domain?: string[];
    codes?: string[];
    generatorIds?: string[];
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

export type ReviewStatus = 'pending' | 'reviewed' | 'excluded';
export type ReviewAction = 'approve' | 'exclude' | 'reset';

export interface ReviewNote {
  verdict: string;
  kind: string | null;
  note: string;
  source: string;
}

export interface ReviewSummary {
  id: string;
  subject: 'korean' | 'english';
  standardCode: string;
  skill: string;
  difficulty: Difficulty;
  instruction: string;
  stem: string;
  answer: string;
  status: ReviewStatus;
  priority: number | null;
  reasons: Array<{ source: string; text: string }>;
  notes: ReviewNote[];
}

export interface AuthoredItemFields {
  instruction: string;
  stem: string;
  answer: string;
  distractors: string[];
  solution: string[];
}

export interface ReviewItemDetail extends ReviewSummary {
  file: string;
  item: AuthoredItemFields & { id: string; difficulty: Difficulty };
  statusEntry: { reviewer: string; reviewedAt?: string; excludedAt?: string; reason?: string } | null;
  /** 내용 버전. 모든 쓰기 요청에 돌려보내고, 서버 내용과 다르면 409 로 거절된다. */
  revision: string;
  /** 승인한 뒤 파일 내용이 바뀌어 그 승인이 풀렸다. */
  staleApproval?: boolean;
  writeEnabled: boolean;
  saved?: boolean;
  /** 일반 저장이 승인된 문항의 내용을 바꿔 승인을 풀었다. */
  unapproved?: boolean;
}

export interface ReviewList {
  writeEnabled: boolean;
  total: number;
  matched: number;
  offset: number;
  limit: number;
  counts: Record<ReviewStatus, number>;
  facets: {
    subjects: string[];
    standards: Array<{ code: string; subject: string; skill: string; count: number }>;
    verdicts: string[];
  };
  items: ReviewSummary[];
}

export interface ReviewFilters {
  subject?: string;
  standard?: string;
  status?: string;
  verdict?: string;
  offset?: number;
  limit?: number;
}

export interface GateReason {
  gate: string;
  detail: string;
}

/** 작성 게이트 실패(422)의 사유 목록. 다른 오류면 null. */
export function gateReasonsOf(error: unknown): GateReason[] | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;
  const detail = error.detail as { reasons?: GateReason[] } | null;
  return detail?.reasons ?? null;
}

/** 다른 곳에서 문항이 바뀌어 거절된 쓰기(409)의 최신 내용. 다른 오류면 null. */
export function conflictOf(error: unknown): ReviewItemDetail | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const detail = error.detail as { current?: ReviewItemDetail } | null;
  return detail?.current ?? null;
}

const REVIEW_API = '/teacher/api/v1/review';

export function getReviewList(filters: ReviewFilters): Promise<ReviewList> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return requestJson(`${REVIEW_API}/items?${params}`);
}

export function getReviewItem(id: string): Promise<ReviewItemDetail> {
  return requestJson(`${REVIEW_API}/item?id=${encodeURIComponent(id)}`);
}

export function saveReviewItem(id: string, revision: string, item: AuthoredItemFields): Promise<ReviewItemDetail> {
  return requestJson(`${REVIEW_API}/item`, { method: 'POST', body: JSON.stringify({ id, revision, item }) });
}

export function submitReviewVerdict(verdict: {
  id: string;
  revision: string;
  action: ReviewAction;
  reviewer?: string;
  reason?: string;
  item?: AuthoredItemFields;
}): Promise<ReviewItemDetail> {
  return requestJson(`${REVIEW_API}/verdict`, { method: 'POST', body: JSON.stringify(verdict) });
}
