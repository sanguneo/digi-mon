import { SUBJECT_BY_KOREAN, selectSubjectCurricula, selectSubjectTopics } from './source.mjs';

/**
 * 성취기준 코드 파서.
 *
 * 2022 개정 코드 형식: [<학년군끝>{교과문자}{영역번호}-{일련번호}]
 *   [2수01-01] -> 1~2학년군 / 수학 / 수와 연산 / 1번
 *   [4영02-03] -> 3~4학년군 / 영어 / 표현 / 3번
 *
 * 영역번호는 교육과정 문서의 영역 배열 순서이므로 정렬 키로 그대로 쓴다.
 */
const CODE_RE = /^\[(2|4|6)([가-힣]+)(\d{2})-(\d{2})\]$/;

const SUBJECT_CHAR = { math: '수', korean: '국', english: '영' };

/** 코드 영역번호 -> 영역명. 교육과정 문서의 영역 순서와 동일하다. */
const DOMAINS = {
  math: {
    '01': { korean: '수와 연산', english: 'Number & Operations' },
    '02': { korean: '변화와 관계', english: 'Change & Relationships' },
    '03': { korean: '도형과 측정', english: 'Geometry & Measurement' },
    '04': { korean: '자료와 가능성', english: 'Data & Probability' },
  },
  korean: {
    '01': { korean: '듣기·말하기', english: 'Listening & Speaking' },
    '02': { korean: '읽기', english: 'Reading' },
    '03': { korean: '쓰기', english: 'Writing' },
    '04': { korean: '문법', english: 'Grammar' },
    '05': { korean: '문학', english: 'Literature' },
    '06': { korean: '매체', english: 'Media' },
  },
  english: {
    '01': { korean: '이해', english: 'Comprehension' },
    '02': { korean: '표현', english: 'Expression' },
  },
};

const GRADE_BANDS = {
  2: { band: '1-2', gradeStart: 1, gradeEnd: 2, ageStart: 6, ageEnd: 8 },
  4: { band: '3-4', gradeStart: 3, gradeEnd: 4, ageStart: 8, ageEnd: 10 },
  6: { band: '5-6', gradeStart: 5, gradeEnd: 6, ageStart: 10, ageEnd: 12 },
};

export function parseStandardCode(code) {
  const m = CODE_RE.exec(code);
  if (!m) throw new Error(`성취기준 코드 형식 불일치: ${code}`);
  const [, bandDigit, subjectChar, domainNumber, sequence] = m;
  const grade = GRADE_BANDS[Number(bandDigit)];
  if (!grade) throw new Error(`학년군 숫자 해석 불가: ${code}`);
  return {
    code,
    subjectChar,
    domainNumber,
    sequence: Number(sequence),
    ...grade,
  };
}

function normalizeSource(std) {
  const loc = std.sourceLocator ?? null;
  const firstEvidence = Array.isArray(std.evidence) ? std.evidence[0] : null;
  return {
    sourceIds: std.sourceRefs ?? [],
    sourceId: loc?.sourceId ?? std.sourceRefs?.[0] ?? null,
    attachmentNo: loc?.attachmentNo ?? null,
    sha256: loc?.sha256 ?? null,
    pdfPage: loc?.pdfPage ?? null,
    printedPage: loc?.printedPage ?? null,
    section: loc?.section ?? std.sourceSection ?? null,
    locator: loc?.locator ?? firstEvidence?.locator ?? null,
    officialTextIncluded: false,
  };
}

/**
 * 이질적인 3교과 성취기준 레코드를 하나의 정규 스파인으로 접는다.
 * 코드에서 파생한 값과 업스트림이 기록한 값이 어긋나면 conflicts 로 올린다.
 */
export function buildSpine(ontology) {
  const topics = selectSubjectTopics(ontology);
  const topicsByStandardKey = new Map();
  for (const t of topics) {
    for (const key of t.standards ?? []) {
      if (!topicsByStandardKey.has(key)) topicsByStandardKey.set(key, []);
      topicsByStandardKey.get(key).push(t.id);
    }
  }

  const conflicts = [];
  const standards = [];

  for (const { subject, curriculum } of selectSubjectCurricula(ontology)) {
    for (const std of curriculum.standards) {
      const parsed = parseStandardCode(std.code);

      if (parsed.subjectChar !== SUBJECT_CHAR[subject.slug]) {
        conflicts.push({ code: std.code, field: 'subjectChar', parsed: parsed.subjectChar, upstream: SUBJECT_CHAR[subject.slug] });
      }
      if (std.gradeBand && std.gradeBand !== parsed.band) {
        conflicts.push({ code: std.code, field: 'gradeBand', parsed: parsed.band, upstream: std.gradeBand });
      }
      const domain = DOMAINS[subject.slug][parsed.domainNumber];
      if (!domain) {
        conflicts.push({ code: std.code, field: 'domainNumber', parsed: parsed.domainNumber, upstream: null });
        continue;
      }
      const upstreamDomain = std.domainKorean ?? std.officialAreaKorean ?? null;
      if (upstreamDomain && upstreamDomain !== domain.korean) {
        conflicts.push({ code: std.code, field: 'domain', parsed: domain.korean, upstream: upstreamDomain });
      }

      const topicIds = (topicsByStandardKey.get(std.key) ?? []).slice().sort();

      standards.push({
        specId: `${subject.slug}.g${parsed.gradeStart}-${parsed.gradeEnd}.d${parsed.domainNumber}.s${String(parsed.sequence).padStart(2, '0')}`,
        code: std.code,
        standardKey: std.key,
        subject: subject.slug,
        subjectKorean: subject.korean,
        gradeBand: parsed.band,
        gradeStart: parsed.gradeStart,
        gradeEnd: parsed.gradeEnd,
        ageStart: parsed.ageStart,
        ageEnd: parsed.ageEnd,
        domainNumber: parsed.domainNumber,
        domain: domain.korean,
        domainEnglish: domain.english,
        sequence: parsed.sequence,
        module: std.module ?? null,
        /**
         * 성취기준 내용 앵커.
         *
         * 온톨로지는 교과마다 다른 필드로 앵커를 준다. 수학은 module(소주제)이
         * 121/121 있고 summary 는 고유 문장틀 2개짜리 보일러플레이트다.
         * 국어·영어는 module 이 없고 summary 가 87/87, 40/40 전부 고유한 내용
         * 라벨이다. 어느 필드를 앵커로 쓸 수 있는지 교과마다 다르므로 데이터에 남긴다.
         */
        summary: std.summary ?? null,
        contentAnchor: std.module ?? (subject.slug === 'math' ? null : std.summary ?? null),
        anchorSource: std.module ? 'module' : (subject.slug === 'math' ? 'none' : 'summary'),
        tags: std.domainTags ?? [],
        officialTextAvailable: false,
        source: normalizeSource(std),
        upstream: {
          verificationStatus: std.verificationStatus ?? null,
          workstreamFile: std.workstreamFile ?? null,
          topicIds,
          topicCount: topicIds.length,
        },
      });
    }
  }

  standards.sort((a, b) => {
    const sa = [...SUBJECT_BY_KOREAN.values()].findIndex((s) => s.slug === a.subject);
    const sb = [...SUBJECT_BY_KOREAN.values()].findIndex((s) => s.slug === b.subject);
    return sa - sb || a.gradeStart - b.gradeStart || a.domainNumber.localeCompare(b.domainNumber) || a.sequence - b.sequence;
  });

  const bySubject = {};
  for (const s of standards) {
    bySubject[s.subject] ??= { subjectKorean: s.subjectKorean, standardCount: 0, gradeBands: {}, domains: {}, modules: {} };
    const b = bySubject[s.subject];
    b.standardCount += 1;
    b.gradeBands[s.gradeBand] = (b.gradeBands[s.gradeBand] ?? 0) + 1;
    b.domains[s.domain] = (b.domains[s.domain] ?? 0) + 1;
    if (s.module) b.modules[`${s.gradeBand} / ${s.domain} / ${s.module}`] = (b.modules[`${s.gradeBand} / ${s.domain} / ${s.module}`] ?? 0) + 1;
  }

  return {
    schema: 'digi-mon/spine@1',
    scope: {
      subjects: ['math', 'korean', 'english'],
      note: '2022 개정 초등 국어·수학·영어. 과학·사회 등 타 교과는 범위 밖이다.',
    },
    upstream: { ...ontology.upstream, dir: null, integrity: ontology.integrity },
    standardCount: standards.length,
    conflictCount: conflicts.length,
    conflicts,
    summary: bySubject,
    standards,
  };
}
