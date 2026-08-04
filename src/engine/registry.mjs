import { generators as mathG12NumberOperations } from '../generators/math/g12-number-operations.mjs';
import { generators as mathG12GeometryMeasurement } from '../generators/math/g12-geometry-measurement.mjs';
import { generators as mathG12SolidsComparison } from '../generators/math/g12-solids-comparison.mjs';
import { generators as mathG12PatternsData } from '../generators/math/g12-patterns-data.mjs';
import { generators as mathG34NumberOperations } from '../generators/math/g34-number-operations.mjs';
import { generators as mathG34MeasurementRelations } from '../generators/math/g34-measurement-relations.mjs';
import { generators as mathG34GeometryData } from '../generators/math/g34-geometry-data.mjs';
import { generators as mathG56NumberOperations } from '../generators/math/g56-number-operations.mjs';
import { generators as mathG56RelationsMeasurement } from '../generators/math/g56-relations-measurement.mjs';
import { generators as koreanGrammar } from '../generators/korean/grammar.mjs';
import { MANUAL_SCORING, PARTIAL_SCORING, SUBJECT_STRATEGY, scoringModeOf } from '../curriculum/scoring-policy.mjs';

/**
 * 생성기 모듈 목록. 새 학년군·영역을 붙이면 여기에 추가한다.
 * 커버리지 원장이 '아직 안 붙은 성취기준'을 세므로 진척이 기계로 측정된다.
 */
const MODULES = [
  { file: 'math/g12-number-operations.mjs', generators: mathG12NumberOperations },
  { file: 'math/g12-geometry-measurement.mjs', generators: mathG12GeometryMeasurement },
  { file: 'math/g12-solids-comparison.mjs', generators: mathG12SolidsComparison },
  { file: 'math/g12-patterns-data.mjs', generators: mathG12PatternsData },
  { file: 'math/g34-number-operations.mjs', generators: mathG34NumberOperations },
  { file: 'math/g34-measurement-relations.mjs', generators: mathG34MeasurementRelations },
  { file: 'math/g34-geometry-data.mjs', generators: mathG34GeometryData },
  { file: 'math/g56-number-operations.mjs', generators: mathG56NumberOperations },
  { file: 'math/g56-relations-measurement.mjs', generators: mathG56RelationsMeasurement },
  { file: 'korean/grammar.mjs', generators: koreanGrammar },
];

function assertGeneratorContract(g, file) {
  const fail = (msg) => {
    throw new Error(`생성기 계약 위반 [${g?.id ?? '?'} in ${file}]: ${msg}`);
  };
  if (typeof g?.id !== 'string' || g.id.length === 0) fail('id 없음');
  if (typeof g.standardCode !== 'string' || !/^\[\d[가-힣]+\d{2}-\d{2}\]$/.test(g.standardCode)) fail(`standardCode 형식 오류: ${g.standardCode}`);
  if (typeof g.skill !== 'string' || g.skill.length === 0) fail('skill 없음');
  if (typeof g.generate !== 'function') fail('generate 없음');
  if (typeof g.verify !== 'function') fail('verify 없음 — 검산 없는 생성기는 받지 않는다');
}

export function createRegistry() {
  const byId = new Map();
  const byStandardCode = new Map();

  for (const { file, generators } of MODULES) {
    for (const g of generators) {
      assertGeneratorContract(g, file);
      if (byId.has(g.id)) throw new Error(`생성기 id 중복: ${g.id}`);
      byId.set(g.id, { ...g, sourceFile: file });
      if (!byStandardCode.has(g.standardCode)) byStandardCode.set(g.standardCode, []);
      byStandardCode.get(g.standardCode).push(byId.get(g.id));
    }
  }

  return {
    size: byId.size,
    byId,
    byStandardCode,
    get(id) {
      return byId.get(id);
    },
    forStandard(code) {
      return byStandardCode.get(code) ?? [];
    },
    all() {
      return [...byId.values()];
    },
  };
}

/**
 * 커버리지 원장. 스파인의 성취기준 248개 중 생성기가 붙은 것과 안 붙은 것을 센다.
 * '지속적으로 진화하는 엔진'의 진척은 이 숫자로만 주장할 수 있다.
 */
export function buildCoverage(spine, registry) {
  const bySubject = {};
  const covered = [];
  const uncovered = [];
  const manualOnly = [];

  for (const std of spine.standards) {
    const gens = registry.forStandard(std.code);
    const scoringMode = scoringModeOf(std.code);
    const entry = {
      code: std.code,
      subject: std.subject,
      gradeBand: std.gradeBand,
      domain: std.domain,
      module: std.module,
      scoringMode,
      ...(scoringMode === 'manual' ? { manualReason: MANUAL_SCORING[std.code].reason } : {}),
      ...(scoringMode === 'partial' ? { partialNote: PARTIAL_SCORING[std.code] } : {}),
      generatorCount: gens.length,
      generatorIds: gens.map((g) => g.id),
    };

    // 자동 채점 불가 기준은 분모에서 뺀다. 대신 목록으로 그대로 남겨 숨기지 않는다.
    if (scoringMode === 'manual') {
      manualOnly.push(entry);
    } else {
      (gens.length > 0 ? covered : uncovered).push(entry);
    }

    bySubject[std.subject] ??= {
      subjectKorean: std.subjectKorean,
      // 왜 이 교과가 비어 있는지(또는 채워졌는지)를 데이터에 남긴다.
      // 산문이 아니라 커버리지 산출물에서 읽혀야 한다.
      ...(SUBJECT_STRATEGY[std.subject] ?? { strategy: 'unknown', generatable: null }),
      total: 0,
      autoScorable: 0,
      manualOnly: 0,
      covered: 0,
      generators: 0,
      byDomain: {},
    };
    const b = bySubject[std.subject];
    b.total += 1;
    b.generators += gens.length;
    b.byDomain[std.domain] ??= { total: 0, autoScorable: 0, covered: 0 };
    b.byDomain[std.domain].total += 1;

    if (scoringMode === 'manual') {
      b.manualOnly += 1;
    } else {
      b.autoScorable += 1;
      b.byDomain[std.domain].autoScorable += 1;
      if (gens.length > 0) {
        b.covered += 1;
        b.byDomain[std.domain].covered += 1;
      }
    }
  }

  for (const b of Object.values(bySubject)) {
    b.coverageRatio = b.autoScorable === 0 ? 0 : Number((b.covered / b.autoScorable).toFixed(4));
  }

  const autoScorable = covered.length + uncovered.length;
  // 문항 생성 여부는 채점 방식과 별개다. 작도 문항도 학습지에는 나간다.
  const withGenerator = [...covered, ...manualOnly].filter((e) => e.generatorCount > 0).length;

  return {
    schema: 'digi-mon/coverage@2',
    generatedFrom: { standardCount: spine.standardCount, generatorCount: registry.size },
    totalStandards: spine.standards.length,
    autoScorableStandards: autoScorable,
    manualOnlyStandards: manualOnly.length,
    coveredStandards: covered.length,
    uncoveredStandards: uncovered.length,
    // 문항이 생성되는 성취기준 수. 자동 채점 가능 여부와 구분해 센다.
    standardsWithGenerator: withGenerator,
    // 분모는 자동 채점 가능한 성취기준이다. 수행·작도 과제를 억지로 객관식으로
    // 바꿔 100%를 만드는 것보다, 못 하는 것을 못 한다고 세는 쪽이 정확하다.
    coverageRatio: autoScorable === 0 ? 0 : Number((covered.length / autoScorable).toFixed(4)),
    bySubject,
    covered,
    uncovered,
    manualOnly,
  };
}
