import {
  approvedAncestorsOf,
  MATH_PREREQUISITES,
} from './prerequisites.mjs';
import { MIN_SAMPLES } from '../engine/response-log.mjs';
import {
  exactObject,
  failLearningGateRequest,
  LearningGateRequestError,
  summarizeLearningEvidence,
  validateLearningTarget,
} from './learning-gate-evidence.mjs';

const REQUEST_SCHEMA = 'digi-mon/learning-gate-request@1';
const RECOMMENDATION_SCHEMA = 'digi-mon/learning-gate-recommendation@1';
const POLICY_REVISION = 1;
const WEAK_ACCURACY_BELOW = 0.6;

function worksheetAction(target, codes = target.codes) {
  return {
    kind: 'worksheet',
    codes,
    modes: target.modes,
    count: target.count,
  };
}

function weakRecommendation(target, evidenceSummary) {
  const canRemediate = target.subject === 'math'
    && evidenceSummary.weakStandards.every((code) =>
      Object.hasOwn(MATH_PREREQUISITES, code));
  const hasApprovedPath = canRemediate
    && evidenceSummary.weakStandards.some((code) =>
      approvedAncestorsOf(code, { maxDepth: 2 }).length > 0);
  const reasonCodes = [
    'weak-standard',
    hasApprovedPath
      ? 'approved-prerequisite-path'
      : 'no-approved-prerequisite-path',
  ];
  if (canRemediate) {
    return {
      decision: 'remediate',
      reasonCodes,
      nextAction: {
        kind: 'remediation',
        weakStandards: evidenceSummary.weakStandards,
        depth: 2,
        prerequisitePolicy: 'approved-only',
      },
    };
  }
  return {
    decision: 'practice',
    reasonCodes,
    nextAction: worksheetAction(target, evidenceSummary.weakStandards),
  };
}

function decide(target, evidenceSummary) {
  if (evidenceSummary.graded === 0 && evidenceSummary.manualScoringCount > 0) {
    return {
      decision: 'await-manual-review',
      reasonCodes: ['manual-scoring-pending'],
      nextAction: {
        kind: 'manual-review',
        pendingItems: evidenceSummary.manualScoringCount,
      },
    };
  }
  if (evidenceSummary.sufficientStandardCount === 0) {
    return {
      decision: 'practice',
      reasonCodes: ['insufficient-evidence'],
      nextAction: worksheetAction(target),
    };
  }
  if (evidenceSummary.weakStandards.length > 0) {
    return weakRecommendation(target, evidenceSummary);
  }
  if (evidenceSummary.completionRate < 1) {
    return {
      decision: 'practice',
      reasonCodes: ['incomplete'],
      nextAction: worksheetAction(target),
    };
  }
  return {
    decision: 'advance',
    reasonCodes: ['meets-policy-threshold'],
    nextAction: target.advanceToCodes.length > 0
      ? worksheetAction(target, target.advanceToCodes)
      : { kind: 'complete', completedStandards: target.codes },
  };
}

export function recommendLearningGate(request) {
  exactObject(request, 'request', ['schema', 'policyRevision', 'evidence', 'target']);
  if (request.schema !== REQUEST_SCHEMA) {
    failLearningGateRequest(
      'schema',
      `지원하지 않는 learning gate request schema: ${request.schema}`,
      request.schema,
    );
  }
  if (request.policyRevision !== POLICY_REVISION) {
    failLearningGateRequest(
      'policyRevision',
      `지원하지 않는 policy revision: ${request.policyRevision}`,
      request.policyRevision,
    );
  }
  const target = validateLearningTarget(request.target);
  const evidenceSummary = summarizeLearningEvidence(request.evidence);
  const outsideTarget = evidenceSummary.evaluatedStandards
    .filter((code) => !target.codes.includes(code));
  if (outsideTarget.length > 0) {
    failLearningGateRequest(
      'evidence.byStandard',
      `target 밖의 성취기준 evidence가 있다: ${outsideTarget.join(', ')}`,
      outsideTarget,
    );
  }
  return {
    schema: RECOMMENDATION_SCHEMA,
    policyRevision: POLICY_REVISION,
    policy: {
      weakAccuracyBelow: WEAK_ACCURACY_BELOW,
      minResponseRecordsPerStandard: MIN_SAMPLES,
    },
    ...decide(target, evidenceSummary),
    evidenceSummary,
  };
}

export { LearningGateRequestError };
