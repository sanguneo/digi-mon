import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const MATH_GENERATOR_REVIEW = Object.freeze({
  schema: 'digi-mon/generator-set-review@1',
  subject: 'math',
  generatorCount: 152,
  reviewFingerprint: '51db84edd5a77f4ed3fb1cead28878f2f43cca62da16f685a9008489a9a14384',
  fingerprintIncludes: ['generator-contracts', 'generator-source-files'],
  curriculumReference: 'reference/[별책8] 수학과 교육과정.md',
  decision: 'approved',
  note: '2022 개정 수학과 교육과정 Markdown과 생성기·검토표를 학년군별 전수 대조한 고정 생성기 집합.',
});

function mathGenerators(generators) {
  return generators
    .filter((generator) => generator.id.startsWith('math.'))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function sourceFileFingerprint(generators) {
  const files = [...new Set(generators.map((generator) => generator.sourceFile))].sort();
  return files.map((file) => {
    const source = readFileSync(new URL(`../generators/${file}`, import.meta.url), 'utf8');
    const sha256 = createHash('sha256').update(source).digest('hex');
    return `${file}:${sha256}`;
  });
}

function contractFingerprint(generators) {
  return generators.map((generator) => JSON.stringify({
    id: generator.id,
    standardCode: generator.standardCode,
    skill: generator.skill,
    format: generator.format,
    scoring: generator.scoring ?? 'auto',
    difficulties: generator.difficulties,
    difficultyAxis: generator.difficultyAxis,
    capacity: generator.capacity,
    assessmentMappings: generator.assessmentMappings ?? [],
  }));
}

function fingerprintOf(generators) {
  const snapshot = [
    ...contractFingerprint(generators),
    ...sourceFileFingerprint(generators),
  ];
  return createHash('sha256').update(snapshot.join('\n')).digest('hex');
}

export function reviewMathGeneratorSet(generators) {
  const reviewed = mathGenerators(generators);
  const fingerprint = fingerprintOf(reviewed);
  const valid = reviewed.length === MATH_GENERATOR_REVIEW.generatorCount
    && fingerprint === MATH_GENERATOR_REVIEW.reviewFingerprint;
  return {
    valid,
    fingerprint,
    approvedGeneratorIds: new Set(valid ? reviewed.map((generator) => generator.id) : []),
  };
}
