import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateOfficialCodeInventory,
  validateSpine,
} from './contracts.mjs';
import {
  EXPECTED_CORPUS_PIN,
  assertPinnedCorpus,
} from './corpus-pin.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');

export const SUBJECTS = [
  { slug: 'math', korean: '수학' },
  { slug: 'korean', korean: '국어' },
  { slug: 'english', korean: '영어' },
];

export const SUBJECT_BY_KOREAN = new Map(SUBJECTS.map((subject) => [
  subject.korean,
  subject,
]));

const CORPUS_FILES = Object.freeze([
  Object.freeze({ file: 'data/spine/standards.json', subject: null }),
  Object.freeze({ file: 'reference/[별책5] 국어과 교육과정.md', subject: 'korean' }),
  Object.freeze({ file: 'reference/[별책8] 수학과 교육과정.md', subject: 'math' }),
  Object.freeze({ file: 'reference/[별책14] 영어과 교육과정.md', subject: 'english' }),
]);

function canonicalBuffer(file) {
  const onDisk = fs.readFileSync(path.join(REPO_ROOT, file));
  return Buffer.from(onDisk.toString('utf8').replaceAll('\r\n', '\n'), 'utf8');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function internalSpine(snapshot, integrity) {
  const {
    upstream: importedProvenance,
    standards: snapshotStandards,
    ...spine
  } = snapshot;
  const standards = snapshotStandards.map((standard) => {
    const { upstream: alignment, ...record } = standard;
    return { ...record, alignment };
  });
  return {
    ...spine,
    provenance: {
      kind: 'frozen-import',
      sourceDocuments: importedProvenance.sourceDocuments,
      coverageGaps: importedProvenance.coverageGaps,
      coverageGapCount: importedProvenance.coverageGapCount,
    },
    standards,
    corpus: {
      schema: 'digi-mon/curriculum-corpus@1',
      revision: EXPECTED_CORPUS_PIN.revision,
      standardCount: EXPECTED_CORPUS_PIN.standardCount,
      integrity,
    },
  };
}

export function loadOntology() {
  const files = CORPUS_FILES.map(({ file, subject }) => {
    const buffer = canonicalBuffer(file);
    return {
      file,
      subject,
      buffer,
      sha256: sha256(buffer),
    };
  });
  const integrity = files.map(({ file, sha256: digest }) => ({
    file,
    sha256: digest,
    matchesPin: digest === EXPECTED_CORPUS_PIN.files[file].sha256,
  }));
  assertPinnedCorpus(integrity);

  const snapshot = validateSpine(JSON.parse(files[0].buffer.toString('utf8')));
  if (snapshot.standardCount !== EXPECTED_CORPUS_PIN.standardCount) {
    throw new Error(
      `고정 성취기준 수 불일치: expected ${EXPECTED_CORPUS_PIN.standardCount}, `
      + `got ${snapshot.standardCount}`,
    );
  }
  const annexTexts = Object.fromEntries(
    files
      .filter(({ subject }) => subject !== null)
      .map(({ subject, buffer }) => [subject, buffer.toString('utf8')]),
  );
  validateOfficialCodeInventory(snapshot, annexTexts);

  return {
    dir: REPO_ROOT,
    integrity,
    spine: internalSpine(snapshot, integrity),
  };
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}
