import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');

/**
 * 대상 교과. 과학·사회·도덕 등은 범위 밖이다.
 * 순서가 산출물의 정렬 순서를 결정한다.
 */
export const SUBJECTS = [
  { slug: 'math', korean: '수학', curriculumId: 'kr-2022-elem-math' },
  { slug: 'korean', korean: '국어', curriculumId: 'kr-2022-elem-korean' },
  { slug: 'english', korean: '영어', curriculumId: 'kr-2022-elem-english-efl' },
];

export const SUBJECT_BY_KOREAN = new Map(SUBJECTS.map((s) => [s.korean, s]));

const DATA_FILES = ['curriculum-standards.json', 'topics.json', 'dependencies.json', 'clusters.json'];

/**
 * 업스트림 온톨로지 저장소 위치를 찾는다.
 * 1) KELM_DIR 환경변수
 * 2) 형제 디렉터리 ../korean-elementary-learning-map
 */
export function resolveOntologyDir(explicit) {
  const candidates = [
    explicit,
    process.env.KELM_DIR,
    path.resolve(REPO_ROOT, '..', 'korean-elementary-learning-map'),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'data', 'kr', 'curriculum-standards.json'))) {
      return path.resolve(dir);
    }
  }
  throw new Error(
    `온톨로지 저장소를 찾지 못했다. KELM_DIR 로 경로를 지정하라. 시도한 경로:\n  ${candidates.join('\n  ')}`,
  );
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * 업스트림 manifest 는 LF 기준으로 해시를 기록한다.
 * Windows 체크아웃(core.autocrlf)에서는 작업 트리 바이트가 CRLF 이므로
 * 비교 전에 LF 로 정규화해야 같은 내용을 같은 것으로 판정한다.
 */
function normalizeEol(buf) {
  return buf.includes(0x0d) ? Buffer.from(buf.toString('utf8').replaceAll('\r\n', '\n'), 'utf8') : buf;
}

/**
 * 업스트림 data/kr/manifest.json 의 sha256 과 대조해 소스 버전을 고정한다.
 * 업스트림이 갱신되면 여기서 즉시 드러난다.
 */
export function loadOntology(explicitDir) {
  const dir = resolveOntologyDir(explicitDir);
  const krDir = path.join(dir, 'data', 'kr');
  const manifest = JSON.parse(fs.readFileSync(path.join(krDir, 'manifest.json'), 'utf8'));
  const files = manifest.files ?? manifest;

  const raw = {};
  const integrity = [];
  for (const name of DATA_FILES) {
    const onDisk = fs.readFileSync(path.join(krDir, name));
    const canonical = normalizeEol(onDisk);
    const actual = sha256(canonical);
    const expected = files[name]?.sha256 ?? null;
    integrity.push({
      file: name,
      bytes: canonical.byteLength,
      bytesOnDisk: onDisk.byteLength,
      eolNormalized: canonical.byteLength !== onDisk.byteLength,
      sha256: actual,
      manifestSha256: expected,
      matchesManifest: expected === null ? null : expected === actual,
    });
    raw[name.replace(/\.json$/, '')] = JSON.parse(canonical.toString('utf8'));
  }

  const mismatched = integrity.filter((f) => f.matchesManifest === false);
  if (mismatched.length > 0) {
    throw new Error(
      `업스트림 데이터가 manifest 해시와 불일치한다: ${mismatched.map((f) => f.file).join(', ')}`,
    );
  }

  return {
    dir,
    upstream: {
      dataVersion: raw['curriculum-standards'].dataset ?? raw.topics.version ?? null,
      taxonomyVersion: raw.topics.taxonomyVersion ?? null,
      generatedAt: raw['curriculum-standards'].generatedAt ?? null,
    },
    integrity,
    standards: raw['curriculum-standards'],
    topics: raw.topics,
    dependencies: raw.dependencies,
    clusters: raw.clusters,
  };
}

/** 대상 3교과의 원본 성취기준 레코드만 잘라 낸다. */
export function selectSubjectCurricula(ontology) {
  return SUBJECTS.map((subject) => {
    const curriculum = ontology.standards.curricula.find((c) => c.id === subject.curriculumId);
    if (!curriculum) throw new Error(`교육과정 레코드 없음: ${subject.curriculumId}`);
    return { subject, curriculum };
  });
}

/** 대상 3교과의 원본 주제 레코드만 잘라 낸다. */
export function selectSubjectTopics(ontology) {
  return ontology.topics.topics.filter((t) => SUBJECT_BY_KOREAN.has(t.subjectKorean));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}
