import { LEARNING_GUIDES } from './learning-guides.mjs';

export const LEARNING_SUPPORT_SCHEMA = 'digi-mon/learning-support@1';

const MATERIAL_KINDS = new Set(['principle', 'rule', 'strategy']);
const HINT_KINDS = new Set(['concept-recall', 'strategy']);

function fail(generatorId, message) {
  throw new Error(`학습지원 계약 위반 [${generatorId ?? '?'}]: ${message}`);
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertLearningGuide(generatorId, guide) {
  if (guide === undefined) return;
  if (!guide || typeof guide !== 'object' || Array.isArray(guide)) {
    fail(generatorId, 'guide 가 객체가 아니다');
  }
  if (guide.revision !== 1) fail(generatorId, `지원하지 않는 revision: ${guide.revision}`);
  if (!Array.isArray(guide.materials) || guide.materials.length === 0) {
    fail(generatorId, 'materials 가 비었다');
  }
  for (const material of guide.materials) {
    if (!material || !MATERIAL_KINDS.has(material.kind) || !nonEmptyText(material.text)) {
      fail(generatorId, 'material 은 kind 와 text 가 필요하다');
    }
  }
  if (!Array.isArray(guide.hints) || guide.hints.length !== 2) {
    fail(generatorId, 'hint 는 두 단계여야 한다');
  }
  if (guide.hints.some((hint, index) =>
    !hint
    || hint.level !== index + 1
    || !HINT_KINDS.has(hint.kind)
    || !nonEmptyText(hint.text))) {
    fail(generatorId, 'hint level, kind 또는 text 가 올바르지 않다');
  }
  if (!guide.teacher || typeof guide.teacher !== 'object' || Array.isArray(guide.teacher)) {
    fail(generatorId, 'teacher 가 객체가 아니다');
  }
  if (!Array.isArray(guide.teacher.lookFor)
    || guide.teacher.lookFor.length === 0
    || guide.teacher.lookFor.some((entry) => !nonEmptyText(entry))) {
    fail(generatorId, 'teacher.lookFor 가 비었다');
  }
  if (!nonEmptyText(guide.teacher.intervention)) {
    fail(generatorId, 'teacher.intervention 이 비었다');
  }
}

export function learningGuideFor(generatorId) {
  const guide = LEARNING_GUIDES[generatorId];
  return guide === undefined ? undefined : structuredClone(guide);
}

export function assertLearningSupport(generatorId, support) {
  if (!support || typeof support !== 'object' || Array.isArray(support)) {
    fail(generatorId, 'learningSupport 가 객체가 아니다');
  }
  if (support.schema !== LEARNING_SUPPORT_SCHEMA) {
    fail(generatorId, `알 수 없는 schema: ${support.schema}`);
  }
  if (!support.objective
    || !nonEmptyText(support.objective.text)
    || support.objective.source !== 'generator-skill') {
    fail(generatorId, 'objective 가 올바르지 않다');
  }
  if (support.status === 'objective-only') {
    const unexpected = Object.keys(support)
      .filter((key) => !['schema', 'status', 'objective'].includes(key));
    if (unexpected.length > 0) {
      fail(generatorId, `objective-only 에 불필요한 필드가 있다: ${unexpected.join(', ')}`);
    }
    return;
  }
  if (support.status !== 'guided-candidate') {
    fail(generatorId, `알 수 없는 status: ${support.status}`);
  }
  if (support.review?.status !== 'candidate'
    || support.review?.sourceKind !== 'repository-authored'
    || support.review?.revision !== 1) {
    fail(generatorId, 'review provenance 가 올바르지 않다');
  }
  assertLearningGuide(generatorId, {
    revision: support.review.revision,
    materials: support.materials,
    hints: support.hints,
    teacher: support.teacher,
  });
}

export function buildLearningSupport(generator) {
  const objective = {
    text: generator.skill,
    source: 'generator-skill',
  };
  if (!generator.learningGuide) {
    const support = {
      schema: LEARNING_SUPPORT_SCHEMA,
      status: 'objective-only',
      objective,
    };
    assertLearningSupport(generator.id, support);
    return support;
  }
  assertLearningGuide(generator.id, generator.learningGuide);
  const support = {
    schema: LEARNING_SUPPORT_SCHEMA,
    status: 'guided-candidate',
    objective,
    review: {
      status: 'candidate',
      sourceKind: 'repository-authored',
      revision: generator.learningGuide.revision,
    },
    materials: structuredClone(generator.learningGuide.materials),
    hints: structuredClone(generator.learningGuide.hints),
    teacher: structuredClone(generator.learningGuide.teacher),
  };
  assertLearningSupport(generator.id, support);
  return support;
}

export function learnerLearningSupport(support) {
  if (!support) return undefined;
  const { teacher, ...learner } = support;
  return structuredClone(learner);
}
