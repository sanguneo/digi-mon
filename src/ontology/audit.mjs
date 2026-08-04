import {
  SUBJECTS,
  SUBJECT_BY_KOREAN,
  selectSubjectCurricula,
  selectSubjectTopics,
} from './source.mjs';

/**
 * 문항 생성에 실제로 필요한 축. 업스트림 주제 레코드에 있는지 확인한다.
 * 없는 축은 digi-mon 스펙 레이어에서 새로 저작해야 하는 대상이다.
 */
const REQUIRED_GENERATION_AXES = [
  { key: 'officialStandardText', label: '성취기준 원문', probe: (t) => t.officialText ?? t.standardText ?? null },
  { key: 'grade', label: '학년(학년군 아님)', probe: (t) => t.grade ?? null },
  { key: 'numberRange', label: '수 범위·수치 제약', probe: (t) => t.numberRange ?? t.valueRange ?? t.constraints ?? null },
  { key: 'itemFormat', label: '문항 형식', probe: (t) => t.itemFormat ?? t.questionType ?? null },
  { key: 'misconceptions', label: '오개념·오답 유형', probe: (t) => t.misconceptions ?? t.distractors ?? t.commonErrors ?? null },
  { key: 'difficulty', label: '난이도', probe: (t) => t.difficulty ?? t.level ?? null },
  { key: 'solutionSteps', label: '풀이 절차', probe: (t) => t.solution ?? t.solutionSteps ?? t.worked ?? null },
];

/**
 * 주제 레코드에서 자기 자신을 식별하는 문자열을 치환해 "문장틀"만 남긴다.
 * 긴 문자열부터 치환해야 부분 겹침으로 틀이 갈라지지 않는다.
 */
function shapeOf(text, topic) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const code = topic.sourceStandardCode ?? topic.standards?.[0]?.split(':')[1] ?? null;
  const tokens = [
    [topic.name, '⟦NAME⟧'],
    [topic.titleKorean, '⟦TITLE⟧'],
    [topic.title, '⟦TITLE⟧'],
    [topic.focus, '⟦FOCUS⟧'],
    [topic.module, '⟦MODULE⟧'],
    [topic.domainKorean, '⟦DOMAIN⟧'],
    [topic.curriculumAreaKorean, '⟦AREA⟧'],
    [topic.officialAreaKorean, '⟦AREA⟧'],
    [code, '⟦CODE⟧'],
    [topic.gradeBand, '⟦BAND⟧'],
  ]
    .filter(([v]) => typeof v === 'string' && v.length > 0)
    .sort((a, b) => b[0].length - a[0].length);

  let out = text;
  for (const [needle, ph] of tokens) out = out.replaceAll(needle, ph);
  return out.replace(/\d+/g, '#');
}

function distinct(values) {
  return new Set(values.filter((v) => v !== null)).size;
}

function ratio(unique, total) {
  return total === 0 ? null : Number((unique / total).toFixed(4));
}

/**
 * 고유 문장틀 비율로 내용 재사용 가능성을 판정한다.
 *  - < 0.05 : 사실상 상수. 소주제명만 치환된 보일러플레이트.
 *  - < 0.5  : 부분 템플릿. 검토 가치 제한적.
 *  - >= 0.5 : 주제별로 실제 문장이 다름. 검토 후보.
 */
function classify(r) {
  if (r === null) return 'empty';
  if (r < 0.05) return 'boilerplate';
  if (r < 0.5) return 'partially-templated';
  return 'reviewable-candidate';
}

function auditSubjectTopics(topics) {
  const perStandard = new Map();
  for (const t of topics) {
    for (const k of t.standards ?? []) perStandard.set(k, (perStandard.get(k) ?? 0) + 1);
  }
  const fanout = {};
  for (const v of perStandard.values()) fanout[v] = (fanout[v] ?? 0) + 1;

  const fields = {};
  for (const [name, pick] of [
    ['description', (t) => [t.description]],
    ['assessmentPrompt', (t) => [t.assessmentPrompt]],
    ['evidence', (t) => t.evidence ?? []],
  ]) {
    const shapes = topics.flatMap((t) => pick(t).map((v) => shapeOf(v, t)));
    const total = shapes.filter((v) => v !== null).length;
    const unique = distinct(shapes);
    fields[name] = { total, uniqueShapes: unique, uniqueRatio: ratio(unique, total), verdict: classify(ratio(unique, total)) };
  }

  const missingAxes = REQUIRED_GENERATION_AXES.filter((a) => topics.every((t) => a.probe(t) === null || a.probe(t) === undefined)).map((a) => ({ key: a.key, label: a.label }));

  return {
    topicCount: topics.length,
    standardsCovered: perStandard.size,
    fanoutPerStandard: fanout,
    fanoutIsUniform: Object.keys(fanout).length === 1,
    fields,
    missingGenerationAxes: missingAxes,
  };
}

function auditSubjectEdges(topics, dependencies) {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const edges = dependencies.filter((e) => byId.has(e.topicId));
  if (edges.length === 0) return { edgeCount: 0 };

  let intraStandard = 0;
  let crossDomain = 0;
  let crossGradeBand = 0;
  for (const e of edges) {
    const a = byId.get(e.topicId);
    const b = byId.get(e.prerequisiteId);
    if (!b) continue;
    if ((a.standards?.[0] ?? null) === (b.standards?.[0] ?? null)) intraStandard += 1;
    if (a.domainKorean !== b.domainKorean) crossDomain += 1;
    if (a.gradeBand !== b.gradeBand) crossGradeBand += 1;
  }
  const reasonShapes = distinct(edges.map((e) => shapeOf(e.reason, byId.get(e.topicId))));

  return {
    edgeCount: edges.length,
    intraStandardEdges: intraStandard,
    intraStandardRatio: ratio(intraStandard, edges.length),
    crossDomainEdges: crossDomain,
    crossGradeBandEdges: crossGradeBand,
    reasonUniqueShapes: reasonShapes,
    // 영역·학년군을 넘지 못하면 교과 내 진짜 위계(예: 분수 -> 분수의 곱셈)를 담지 못한다.
    carriesRealHierarchy: crossDomain > 0 || crossGradeBand > edges.length * 0.1,
  };
}

/**
 * 성취기준 레코드 자체의 앵커 품질.
 *
 * 처음 감사는 topics.json 만 봤다. 그래서 '국어 주제내용 index-only' 라고 판정하고
 * 국어는 못 한다고 결론했는데, 성취기준 레코드의 summary 는 87/87 전부 고유한
 * 내용 라벨이었다. 앵커는 교과마다 다른 필드에 있다.
 *   수학  module 121/121, summary 는 고유 문장틀 2개(보일러플레이트)
 *   국어  module 0, summary 87/87 고유
 *   영어  module 0, summary 40/40 고유
 * 이 사실이 데이터에 없으면 같은 실수를 또 한다.
 */
function auditStandardAnchors(curriculum) {
  const standards = curriculum.standards;
  const shapes = new Set(standards.map((s) => {
    let out = s.summary ?? '';
    for (const token of [s.code, s.module, s.domainKorean, s.officialAreaKorean, s.gradeBand].filter(Boolean)) {
      out = out.split(token).join('⟦⟧');
    }
    return out.replace(/\d+/g, '#');
  }));
  const withModule = standards.filter((s) => typeof s.module === 'string' && s.module.length > 0).length;
  const ratio = standards.length === 0 ? null : Number((shapes.size / standards.length).toFixed(4));

  return {
    standardCount: standards.length,
    moduleCount: withModule,
    summaryUniqueShapes: shapes.size,
    summaryUniqueRatio: ratio,
    summaryVerdict: classify(ratio),
    // 문항을 저작할 때 무엇에 앵커할 수 있는가.
    usableAnchor: withModule === standards.length ? 'module' : (ratio !== null && ratio >= 0.5 ? 'summary' : 'none'),
  };
}

export function auditOntology(ontology) {
  const allTopics = selectSubjectTopics(ontology);
  const curricula = new Map(selectSubjectCurricula(ontology).map((x) => [x.subject.slug, x.curriculum]));
  const subjects = {};

  for (const subject of SUBJECTS) {
    const topics = allTopics.filter((t) => t.subjectKorean === subject.korean);
    const topicAudit = auditSubjectTopics(topics);
    const edgeAudit = auditSubjectEdges(topics, ontology.dependencies.dependencies);

    const contentVerdicts = Object.values(topicAudit.fields).map((f) => f.verdict);
    const usableAsContent = contentVerdicts.every((v) => v === 'reviewable-candidate');

    subjects[subject.slug] = {
      subjectKorean: subject.korean,
      topics: topicAudit,
      standards: auditStandardAnchors(curricula.get(subject.slug)),
      dependencies: edgeAudit,
      usage: {
        codeInventory: 'trusted',
        topicContent: usableAsContent ? 'reviewable-candidate' : 'index-only',
        standardAnchor: auditStandardAnchors(curricula.get(subject.slug)).usableAnchor,
        prerequisiteGraph: edgeAudit.carriesRealHierarchy ? 'reviewable-candidate' : 'index-only',
      },
    };
  }

  return {
    schema: 'digi-mon/ontology-audit@1',
    scope: { subjects: SUBJECTS.map((s) => s.slug) },
    upstream: ontology.upstream,
    integrity: ontology.integrity,
    thresholds: { boilerplate: 0.05, partiallyTemplated: 0.5 },
    subjects,
  };
}

export { SUBJECT_BY_KOREAN };
