import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const MATH_GENERATOR_REVIEW = Object.freeze({
  schema: 'digi-mon/generator-set-review@1',
  subject: 'math',
  generatorCount: 152,
  reviewFingerprint: '263bc20669b4b955313451029820be50b6107e4315c5b5410128d826d6f4c22b',
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

/**
 * 생성기 소스 파일의 내용 지문. 줄바꿈은 지문에서 빼고 LF 로 정규화한 뒤 해시한다.
 *
 * 정규화 없이 파일 바이트를 그대로 해시하면 체크아웃 환경이 지문을 바꾼다.
 * Windows 에서 core.autocrlf=true 로 받은 작업 사본은 CRLF 가 되고, 그 상태에서
 * 계산한 값을 핀으로 굳히면 저장소에 커밋된 LF 내용으로는 영구히 재현되지 않는다.
 * 그리고 이 지문이 어긋나면 승인 집합이 빈 집합이 되어 의미 커버리지가 조용히
 * 0 으로 무너진다 — 실제로 그렇게 오염된 핀이 커밋돼 있었다(`REVIEW.md` §13).
 *
 * 검토 대상은 소스의 내용이지 줄바꿈 표현이 아니다. 내용이 바뀌면 여전히 잡힌다.
 */
export function sourceContentDigest(source) {
  return createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
}

function sourceFileFingerprint(generators) {
  const files = [...new Set(generators.map((generator) => generator.sourceFile))].sort();
  return files.map((file) => {
    const source = readFileSync(new URL(`../generators/${file}`, import.meta.url), 'utf8');
    return `${file}:${sourceContentDigest(source)}`;
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
