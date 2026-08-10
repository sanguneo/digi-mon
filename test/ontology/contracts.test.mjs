import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

import { buildCoverage } from '../../src/engine/registry.mjs';
import { validateSpine } from '../../src/ontology/contracts.mjs';
import {
  EXPECTED_CORPUS_PIN,
  assertPinnedCorpus,
} from '../../src/ontology/corpus-pin.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';

test('repository corpus loads without a sibling ontology checkout', async () => {
  // Given: 저장소 코드·스파인·공식 별책만 있는 독립 디렉터리
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'digi-mon-corpus-'));
  const copyRoot = path.join(sandbox, 'digi-mon');
  fs.cpSync(path.resolve('src', 'ontology'), path.join(copyRoot, 'src', 'ontology'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(copyRoot, 'data', 'spine'), { recursive: true });
  fs.copyFileSync(
    path.resolve('data', 'spine', 'standards.json'),
    path.join(copyRoot, 'data', 'spine', 'standards.json'),
  );
  fs.mkdirSync(path.join(copyRoot, 'reference'), { recursive: true });
  for (const name of [
    '[별책5] 국어과 교육과정.md',
    '[별책8] 수학과 교육과정.md',
    '[별책14] 영어과 교육과정.md',
  ]) {
    fs.copyFileSync(path.resolve('reference', name), path.join(copyRoot, 'reference', name));
  }

  // When: 형제 온톨로지 저장소 없이 복사본의 코퍼스를 읽는다
  const source = await import(pathToFileURL(path.join(copyRoot, 'src', 'ontology', 'source.mjs')));
  const corpus = source.loadOntology();

  // Then: 저장소 자체 자료만으로 248개 성취기준과 고정 무결성을 제공한다
  assert.equal(corpus.spine.standardCount, 248);
  assert.equal(corpus.spine.corpus.schema, 'digi-mon/curriculum-corpus@1');
  assert.ok(corpus.integrity.every((entry) => entry.matchesPin));
});

test('repository corpus pin requires every internal file hash', () => {
  const integrity = Object.entries(EXPECTED_CORPUS_PIN.files)
    .map(([file, entry]) => ({ file, sha256: entry.sha256 }));
  assert.doesNotThrow(() => assertPinnedCorpus(integrity));
  integrity[0].sha256 = 'a'.repeat(64);
  assert.throws(() => assertPinnedCorpus(integrity), /고정 해시 불일치/);
});

test('spine validation rejects count drift and duplicate achievement codes', () => {
  const spine = JSON.parse(fs.readFileSync(
    path.resolve('data', 'spine', 'standards.json'),
    'utf8',
  ));
  assert.doesNotThrow(() => validateSpine(spine));
  const badCount = structuredClone(spine);
  badCount.standardCount += 1;
  assert.throws(() => validateSpine(badCount), /성취기준 수 불일치/);
  const duplicate = structuredClone(spine);
  duplicate.standards[1].code = duplicate.standards[0].code;
  assert.throws(() => validateSpine(duplicate), /code 중복/);
});

test('repository corpus preserves official sources and qualified mappings', () => {
  const corpus = loadOntology();
  const spine = buildSpine(corpus);
  assert.equal(corpus.integrity.length, 4);
  assert.ok(corpus.integrity.every((entry) => entry.matchesPin));
  assert.ok(spine.provenance.sourceDocuments.some((source) => source.id === 'kr-ncic-math-pdf-2022'));
  assert.equal(spine.corpus.schema, 'digi-mon/curriculum-corpus@1');
  const standard = spine.standards.find((entry) => entry.code === '[4영01-01]');
  assert.deepEqual(standard.alignment.topicMappings.map((mapping) => mapping.role), ['introduces', 'supports', 'assesses']);
  assert.ok(standard.alignment.topicMappings.every((mapping) => mapping.confidence && mapping.note && mapping.workstreamFile));
});

test('semantic coverage counts explicit assessment-topic alignment, not every standard topic', () => {
  const spine = { standardCount: 1, standards: [{
    code: '[2수01-01]', subject: 'math', subjectKorean: '수학', gradeBand: '1-2', domain: '수와 연산', module: null,
    alignment: { topicMappings: [
      { topicId: 'topic-intro', role: 'introduces' },
      { topicId: 'topic-assess', role: 'assesses' },
    ] },
  }] };
  const generator = { id: 'generator-1', assessmentMappings: [{ topicId: 'topic-assess', confidence: 'reviewed', note: 'direct item match', reviewStatus: 'approved' }] };
  const registry = { size: 1, forStandard: () => [generator], all: () => [generator] };
  const coverage = buildCoverage(spine, registry);
  assert.equal(coverage.coverageRatio, 1);
  assert.equal(coverage.semanticCoverage.assessmentTopicCount, 1);
  assert.equal(coverage.semanticCoverage.alignedAssessmentTopicCount, 1);
  assert.equal(coverage.semanticCoverage.coverageRatio, 1);
  assert.deepEqual(coverage.covered[0].semanticCoverage.alignedTopicIds, ['topic-assess']);
  assert.ok(!coverage.covered[0].semanticCoverage.alignedTopicIds.includes('topic-intro'));
});

test('standard-code inferred mappings stay candidates until reviewed', () => {
  const spine = { standardCount: 1, standards: [{
    code: '[2수01-01]', subject: 'math', subjectKorean: '수학', gradeBand: '1-2', domain: '수와 연산', module: null,
    alignment: { topicMappings: [{ topicId: 'topic-assess', role: 'assesses' }] },
  }] };
  const generator = { id: 'candidate-generator' };
  const registry = { size: 1, forStandard: () => [generator], all: () => [generator] };
  const coverage = buildCoverage(spine, registry);
  assert.equal(coverage.semanticCoverage.alignedAssessmentTopicCount, 0);
  assert.equal(coverage.semanticCoverage.candidateAlignedAssessmentTopicCount, 1);
  assert.equal(coverage.covered[0].semanticCoverage.alignments[0].reviewStatus, 'candidate');
});

test('data-contract schemas are checked in and parse as JSON', () => {
  for (const name of ['corpus-pin', 'spine', 'generator-topic-alignment', 'coverage']) {
    const schema = JSON.parse(fs.readFileSync(path.resolve('schema', `${name}.schema.json`), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  }
});
