import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildOfficialVocabularyArtifact,
  parseMergedCandidatePool,
  parseOfficialVocabulary,
} from '../../tools/build-english-official-vocabulary.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const officialPath = path.join(repoRoot, 'reference', '[별책14] 영어과 교육과정.md');
const candidatePath = path.join(repoRoot, 'docs', 'assets', 'english-wordlist.md');
const artifactPath = path.join(repoRoot, 'data', 'curriculum', 'english-official-vocabulary.json');
const officialMarkdown = fs.readFileSync(officialPath, 'utf8');
const candidateMarkdown = fs.readFileSync(candidatePath, 'utf8');

test('Appendix 3 parser extracts exactly the single-star elementary entries', () => {
  const parsed = parseOfficialVocabulary(officialMarkdown);

  assert.deepEqual(parsed.counts, {
    all: 3000,
    elementaryRecommended: 800,
    secondaryCommonRecommended: 1200,
    otherCoursesRecommended: 1000,
  });
  assert.equal(parsed.elementaryEntries.length, 800);
  assert.equal(new Set(parsed.elementaryEntries.map((entry) => entry.headword)).size, 800);

  const a = parsed.elementaryEntries.find((entry) => entry.headword === 'a');
  assert.deepEqual(a.alternatives, ['a']);
  assert.deepEqual(a.listedRelatedForms, ['an']);

  const act = parsed.elementaryEntries.find((entry) => entry.headword === 'act');
  assert.deepEqual(act.listedRelatedForms, ['actual', 'interact']);

  const hello = parsed.elementaryEntries.find((entry) => entry.headword === 'hello');
  assert.deepEqual(hello.alternatives, ['hello', 'hey', 'hi']);

  assert.equal(parsed.elementaryEntries.some((entry) => entry.headword === 'able'), false);
  assert.equal(parsed.elementaryEntries.some((entry) => entry.headword === 'administration'), false);
});

test('Appendix 3 parser fails closed on a missing section or changed marker class', () => {
  assert.throws(
    () => parseOfficialVocabulary(
      officialMarkdown.replace('## [별표 3] 어휘', '## removed vocabulary appendix'),
    ),
    /Appendix 3/,
  );
  assert.throws(
    () => parseOfficialVocabulary(officialMarkdown.replace('about\\*', 'about\\*\\*')),
    /800/,
  );
});

test('merged pool parser retains source-list status without treating it as approval', () => {
  const candidates = parseMergedCandidatePool(candidateMarkdown);

  assert.equal(candidates.length, 1252);
  assert.equal(candidates.filter((entry) => entry.sourceListMembership.ministryDesignated800).length, 800);
  assert.equal(candidates.filter((entry) => entry.sourceListMembership.dongshimExclusive).length, 452);
  assert.deepEqual(candidates.find((entry) => entry.headword === 'a').listedForms, ['an']);
});

test('generated artifact cross-references all candidates and leaves grade bands unassigned', () => {
  const generated = buildOfficialVocabularyArtifact({ officialMarkdown, candidateMarkdown });
  const committed = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  assert.deepEqual(committed, generated);
  assert.equal(generated.summary.candidatePoolCount, 1252);
  assert.equal(generated.summary.officialElementaryEntryCount, 800);
  // One official entry has both "mathematics" and slash alternative "math" in the pool.
  assert.equal(generated.summary.candidatesOfficialElementary, 801);
  assert.equal(generated.summary.gradeBandApprovedCount, 0);
  assert.equal(generated.summary.engineReviewedSeedCount, 54);
  assert.deepEqual(generated.engineGradeBandReview, {
    schema: 'digi-mon/english-grade-band-vocabulary-review@1',
    status: 'project-selected',
    source: 'src/curriculum/english-vocab.mjs',
    grades3to4Count: 30,
    grades5to6NewCount: 24,
    grades5to6CumulativeCount: 54,
  });
  assert.deepEqual(generated.anomalies, {
    officialEntriesMissingFromCandidatePool: [],
    officialEntriesWithMultipleCandidatePoolMatches: [
      { headword: 'mathematics', matches: ['mathematics', 'math'] },
    ],
    ministrySourceEntriesNotOfficialElementary: [],
    officialElementaryCandidatesNotInMinistrySource: ['mathematics'],
    officialElementaryEntriesNotInMinistrySource: [],
  });

  for (const candidate of generated.candidatePool) {
    assert.equal(candidate.sourceListMembership.mergedCandidatePool, true);
    assert.equal(typeof candidate.officialElementaryCandidate, 'boolean');
    assert.deepEqual(candidate.gradeBandApproval, {
      status: 'unassigned',
      approvedGradeBands: [],
    });
  }

  assert.equal(generated.guidelines.representativeHeadwordCoversInflections, true);
  assert.equal(generated.guidelines.elementaryGradeBandsAreAssignedByAppendix, false);
  assert.deepEqual(generated.guidelines.elementaryLearningWordLimits, {
    grades3to4: 300,
    grades5to6: 300,
    cumulative: 600,
  });
});
