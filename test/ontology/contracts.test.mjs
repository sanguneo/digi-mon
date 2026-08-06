import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildCoverage } from '../../src/engine/registry.mjs';
import { validateOntologyDocuments } from '../../src/ontology/contracts.mjs';
import { EXPECTED_UPSTREAM_PIN, assertPinnedManifest } from '../../src/ontology/pin.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONTOLOGY_DIR = path.resolve(HERE, '..', '..', '..', 'korean-elementary-learning-map');

function documents() {
  return {
    manifest: {
      taxonomyVersion: 'v1',
      counts: { sources: 1, curricula: 1, standards: 1, topics: 2, dependencies: 1, clusters: 1, standardMappings: 2, coverageGaps: 0 },
      files: Object.fromEntries(Object.keys(EXPECTED_UPSTREAM_PIN.files).map((file) => [file, { sha256: 'a'.repeat(64) }])),
    },
    standards: {
      taxonomyVersion: 'v1', sourceCount: 1, sources: [{ id: 'source-1' }], curriculumCount: 1,
      standardCount: 1, microTopicCount: 2, mappingCount: 2, coverageGapCount: 0,
      curricula: [{ id: 'curriculum-1', standardCount: 1, standards: [{ key: 'standard-1', sourceRefs: ['source-1'] }] }],
      standardMappings: [
        { standardKey: 'standard-1', microTopicId: 'topic-1', relationship: 'introduces' },
        { standardKey: 'standard-1', microTopicId: 'topic-2', relationship: 'assesses' },
      ], coverageGaps: [],
    },
    topics: { version: 'v1', taxonomyVersion: 'v1', topicCount: 2, topics: [{ id: 'topic-1' }, { id: 'topic-2' }] },
    dependencies: { version: 'v1', taxonomyVersion: 'v1', edgeCount: 1, dependencies: [{ topicId: 'topic-2', prerequisiteId: 'topic-1' }] },
    clusters: { version: 'v1', taxonomyVersion: 'v1', clusterCount: 1, clusters: [{ id: 'cluster-1', topicCount: 2, topics: ['topic-1', 'topic-2'] }] },
  };
}

test('the checked-in upstream pin is deliberate and manifest hashes are mandatory', () => {
  assert.equal(EXPECTED_UPSTREAM_PIN.taxonomyVersion, 'kr-full-depth-v0.4');
  assert.deepEqual(Object.keys(EXPECTED_UPSTREAM_PIN.files).sort(), [
    'clusters.json', 'curriculum-standards.json', 'dependencies.json', 'topics.json',
  ]);
  const manifest = { taxonomyVersion: EXPECTED_UPSTREAM_PIN.taxonomyVersion, files: structuredClone(EXPECTED_UPSTREAM_PIN.files) };
  assert.doesNotThrow(() => assertPinnedManifest(manifest));
  delete manifest.files['topics.json'].sha256;
  assert.throws(() => assertPinnedManifest(manifest), /topics\.json.*sha256/);
});

test('ontology validation rejects count drift and dangling taxonomy IDs', () => {
  assert.doesNotThrow(() => validateOntologyDocuments(documents()));
  const badCount = documents();
  badCount.topics.topicCount = 3;
  assert.throws(() => validateOntologyDocuments(badCount), /topics\.json topicCount/);
  const dangling = documents();
  dangling.dependencies.dependencies[0].prerequisiteId = 'missing-topic';
  assert.throws(() => validateOntologyDocuments(dangling), /missing-topic/);
  const crossFile = documents();
  crossFile.topics.topics[0].standards = ['missing-standard'];
  assert.throws(() => validateOntologyDocuments(crossFile), /missing-standard/);
});

test('real ontology load enforces the pin and preserves scoped provenance and qualified mappings', () => {
  const ontology = loadOntology(ONTOLOGY_DIR);
  const spine = buildSpine(ontology);
  assert.equal(ontology.integrity.length, 4);
  assert.ok(ontology.integrity.every((entry) => entry.matchesPin && entry.matchesManifest));
  assert.ok(spine.upstream.sourceDocuments.some((source) => source.id === 'kr-ncic-math-pdf-2022'));
  assert.ok(spine.upstream.coverageGaps.some((gap) => gap.workstreamFile === 'math.json'));
  const standard = spine.standards.find((entry) => entry.code === '[4영01-01]');
  assert.deepEqual(standard.upstream.topicMappings.map((mapping) => mapping.role), ['introduces', 'supports', 'assesses']);
  assert.ok(standard.upstream.topicMappings.every((mapping) => mapping.confidence && mapping.note && mapping.workstreamFile));
});

test('semantic coverage counts explicit assessment-topic alignment, not every standard topic', () => {
  const spine = { standardCount: 1, standards: [{
    code: '[2수01-01]', subject: 'math', subjectKorean: '수학', gradeBand: '1-2', domain: '수와 연산', module: null,
    upstream: { topicMappings: [
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
    upstream: { topicMappings: [{ topicId: 'topic-assess', role: 'assesses' }] },
  }] };
  const generator = { id: 'candidate-generator' };
  const registry = { size: 1, forStandard: () => [generator], all: () => [generator] };
  const coverage = buildCoverage(spine, registry);
  assert.equal(coverage.semanticCoverage.alignedAssessmentTopicCount, 0);
  assert.equal(coverage.semanticCoverage.candidateAlignedAssessmentTopicCount, 1);
  assert.equal(coverage.covered[0].semanticCoverage.alignments[0].reviewStatus, 'candidate');
});

test('data-contract schemas are checked in and parse as JSON', () => {
  for (const name of ['ontology-pin', 'spine', 'generator-topic-alignment', 'coverage']) {
    const schema = JSON.parse(fs.readFileSync(path.resolve('schema', `${name}.schema.json`), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  }
});
