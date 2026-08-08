#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ENGLISH_VOCABULARY_REVIEW,
  WORDS_BY_BAND,
  WORDS_G34,
  WORDS_G56,
} from '../src/curriculum/english-vocab.mjs';

const BACKSLASH = String.fromCharCode(92);
const OFFICIAL_SOURCE = 'reference/[별책14] 영어과 교육과정.md';
const CANDIDATE_SOURCE = 'docs/assets/english-wordlist.md';
const OUTPUT = 'data/curriculum/english-official-vocabulary.json';

function invariant(condition, message) {
  if (!condition) throw new Error(`Official vocabulary extraction failed: ${message}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function parenthesisBalance(value) {
  let balance = 0;
  for (const character of value) {
    if (character === '(') balance += 1;
    if (character === ')') balance -= 1;
  }
  return balance;
}

function escapedStarCount(value) {
  let count = 0;
  for (let index = 1; index < value.length; index += 1) {
    if (value[index] === '*' && value[index - 1] === BACKSLASH) count += 1;
  }
  return count;
}

function removeEscapedStars(value) {
  return value.replaceAll(`${BACKSLASH}*`, '').trim();
}

function splitEntryNotation(raw) {
  const opening = raw.indexOf('(');
  if (opening === -1) return { main: raw.trim(), related: [] };

  invariant(raw.endsWith(')'), `unterminated parenthetical notation: ${raw}`);
  const main = raw.slice(0, opening).trim();
  const contents = raw.slice(opening + 1, -1).trim();
  return {
    main,
    related: contents.split(/\s*[,/]\s*/u).filter(Boolean),
  };
}

function parseOfficialEntry(raw) {
  const { main, related } = splitEntryNotation(raw);
  const markedAlternatives = main.split(/\s*\/\s*/u);
  const markerLevels = markedAlternatives.map(escapedStarCount);
  invariant(markerLevels.every((level) => level === markerLevels[0]), `mixed recommendation markers: ${raw}`);
  invariant(markerLevels[0] >= 0 && markerLevels[0] <= 2, `invalid recommendation marker: ${raw}`);

  const alternatives = markedAlternatives.map(removeEscapedStars);
  invariant(alternatives.every(Boolean), `empty headword alternative: ${raw}`);

  return {
    headword: alternatives[0],
    alternatives,
    listedRelatedForms: related,
    recommendationMarker: markerLevels[0] === 1 ? 'elementary' : markerLevels[0] === 2 ? 'secondary-common' : 'other-courses',
    sourceNotation: raw.replaceAll(`${BACKSLASH}*`, '*'),
  };
}

export function parseOfficialVocabulary(markdown) {
  const appendixStart = markdown.indexOf('## [별표 3] 어휘');
  invariant(appendixStart !== -1, 'Appendix 3 heading not found');
  const listHeading = '\n기본 어휘 목록\n';
  const listHeadingStart = markdown.indexOf(listHeading, appendixStart);
  invariant(listHeadingStart !== -1, 'Appendix 3 vocabulary-list heading not found');
  const listStart = listHeadingStart + 1;
  const appendixEnd = markdown.indexOf('## [별표 4]', listStart);
  invariant(appendixEnd !== -1, 'Appendix 4 boundary not found');

  const blocks = markdown.slice(listStart, appendixEnd)
    .split(/\r?\n\s*\r?\n/u)
    .map((block) => block.trim())
    .filter((block) => block
      && block !== '기본 어휘 목록'
      && !block.startsWith('![')
      && !/^## [A-Z]$/u.test(block));

  const joinedEntries = [];
  for (const block of blocks) {
    const previous = joinedEntries.at(-1);
    const isContinuation = previous && (
      parenthesisBalance(previous) > 0
      || block.startsWith('(')
      || /[,/]$/u.test(previous)
    );
    if (isContinuation) joinedEntries[joinedEntries.length - 1] = `${previous} ${block}`;
    else joinedEntries.push(block);
  }

  invariant(joinedEntries.every((entry) => parenthesisBalance(entry) === 0), 'unbalanced entry parentheses remain after joining wrapped lines');
  const entries = joinedEntries.map(parseOfficialEntry);
  const elementaryEntries = entries.filter((entry) => entry.recommendationMarker === 'elementary');
  const secondaryCommonEntries = entries.filter((entry) => entry.recommendationMarker === 'secondary-common');
  const otherCourseEntries = entries.filter((entry) => entry.recommendationMarker === 'other-courses');
  const counts = {
    all: entries.length,
    elementaryRecommended: elementaryEntries.length,
    secondaryCommonRecommended: secondaryCommonEntries.length,
    otherCoursesRecommended: otherCourseEntries.length,
  };

  invariant(counts.all === 3000, `expected 3,000 representative entries, found ${counts.all}`);
  invariant(counts.elementaryRecommended === 800, `expected 800 elementary entries, found ${counts.elementaryRecommended}`);
  invariant(counts.secondaryCommonRecommended === 1200, `expected 1,200 secondary/common entries, found ${counts.secondaryCommonRecommended}`);
  invariant(counts.otherCoursesRecommended === 1000, `expected 1,000 other-course entries, found ${counts.otherCoursesRecommended}`);

  return { counts, elementaryEntries };
}

function parseCandidateDisplay(display) {
  const opening = display.indexOf('(');
  if (opening === -1) return { headword: display, listedForms: [] };
  invariant(display.endsWith(')'), `unterminated candidate parenthetical notation: ${display}`);
  return {
    headword: display.slice(0, opening).trim(),
    listedForms: display.slice(opening + 1, -1).split(/\s*[,/]\s*/u).filter(Boolean),
  };
}

export function parseMergedCandidatePool(markdown) {
  const candidates = [];
  for (const line of markdown.split(/\r?\n/u)) {
    const match = line.match(/^\|\s*(★?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$/u);
    if (!match || match[2] === '단어' || match[2].startsWith('---')) continue;
    const display = match[2].trim();
    const { headword, listedForms } = parseCandidateDisplay(display);
    const ministryDesignated800 = match[1] === '★';
    candidates.push({
      headword,
      display,
      listedForms,
      meaning: match[3].trim() || null,
      sourceListMembership: {
        mergedCandidatePool: true,
        ministryDesignated800,
        dongshimExclusive: !ministryDesignated800,
      },
    });
  }

  invariant(candidates.length === 1252, `expected 1,252 merged candidates, found ${candidates.length}`);
  invariant(candidates.filter((entry) => entry.sourceListMembership.ministryDesignated800).length === 800, 'expected 800 ministry-designated source entries');
  invariant(new Set(candidates.map((entry) => entry.headword.toLowerCase())).size === candidates.length, 'candidate headwords are not unique');
  return candidates;
}

export function buildOfficialVocabularyArtifact({ officialMarkdown, candidateMarkdown }) {
  const official = parseOfficialVocabulary(officialMarkdown);
  const candidates = parseMergedCandidatePool(candidateMarkdown);
  const officialByAlternative = new Map();

  for (const entry of official.elementaryEntries) {
    for (const alternative of entry.alternatives) {
      const key = alternative.toLowerCase();
      invariant(!officialByAlternative.has(key), `duplicate official alternative: ${alternative}`);
      officialByAlternative.set(key, entry);
    }
  }

  const candidatePool = candidates.map((candidate) => {
    const officialEntry = officialByAlternative.get(candidate.headword.toLowerCase());
    return {
      ...candidate,
      officialElementaryCandidate: Boolean(officialEntry),
      officialEntryHeadword: officialEntry?.headword ?? null,
      gradeBandApproval: {
        status: 'unassigned',
        approvedGradeBands: [],
      },
    };
  });

  const candidateByHeadword = new Map(candidatePool.map((entry) => [entry.headword.toLowerCase(), entry]));
  const officialEntries = official.elementaryEntries.map((entry) => ({
    ...entry,
    candidatePoolMatches: entry.alternatives
      .map((alternative) => candidateByHeadword.get(alternative.toLowerCase())?.headword)
      .filter(Boolean),
  }));
  const officialEntriesMissingFromCandidatePool = officialEntries
    .filter((entry) => entry.candidatePoolMatches.length === 0)
    .map((entry) => entry.headword);
  const officialEntriesWithMultipleCandidatePoolMatches = officialEntries
    .filter((entry) => entry.candidatePoolMatches.length > 1)
    .map((entry) => ({ headword: entry.headword, matches: entry.candidatePoolMatches }));
  const ministrySourceEntriesNotOfficialElementary = candidatePool
    .filter((entry) => entry.sourceListMembership.ministryDesignated800 && !entry.officialElementaryCandidate)
    .map((entry) => entry.headword);
  const officialElementaryCandidatesNotInMinistrySource = candidatePool
    .filter((entry) => entry.officialElementaryCandidate && !entry.sourceListMembership.ministryDesignated800)
    .map((entry) => entry.headword);
  const officialElementaryEntriesNotInMinistrySource = officialEntries
    .filter((entry) => !entry.candidatePoolMatches.some((headword) => candidateByHeadword.get(headword.toLowerCase()).sourceListMembership.ministryDesignated800))
    .map((entry) => entry.headword);

  return {
    schema: 'digi-mon/english-official-vocabulary@1',
    sources: {
      officialCurriculum: { path: OFFICIAL_SOURCE, sha256: sha256(officialMarkdown) },
      mergedCandidatePool: { path: CANDIDATE_SOURCE, sha256: sha256(candidateMarkdown) },
    },
    summary: {
      officialBasicVocabularyCount: official.counts.all,
      officialElementaryEntryCount: official.counts.elementaryRecommended,
      officialSecondaryCommonEntryCount: official.counts.secondaryCommonRecommended,
      officialOtherCourseEntryCount: official.counts.otherCoursesRecommended,
      candidatePoolCount: candidatePool.length,
      candidatesOfficialElementary: candidatePool.filter((entry) => entry.officialElementaryCandidate).length,
      gradeBandApprovedCount: 0,
      engineReviewedSeedCount: WORDS_BY_BAND['5-6'].length,
    },
    guidelines: {
      recommendationMarkerMeaning: 'A single * marks one of the 800 representative entries recommended for elementary-school use.',
      representativeHeadwordCoversInflections: true,
      parentheticalFormsAreListedUsefulDerivedForms: true,
      slashFormsAreAlternativesWithinOneRepresentativeEntry: true,
      derivationalAffixesCoveredByRepresentativeHeadword: [
        'un-', 'in- (il-, im-, ir-)', 'en- (em-)', 'inter-', 'mis-', 're-', 'dis-',
        '-able', '-er', '-ish', '-less', '-ly', '-ness', '-or', '-th', '-y',
        '-al (-ical, -ual)', '-ation (-ication)', '-ful', '-ist', '-ity', '-ism',
        '-ize (-ise)', '-ment', '-ous', '-ance', '-ant (-icant)', '-ary', '-ence',
        '-ent', '-ship', '-ic', '-ify', '-ion', '-ive', '-ure',
      ],
      excludedFromNewVocabularyCounts: [
        'proper nouns', 'titles', 'interjections', 'romanized Korean and non-English foreign words',
        'alphabet letters and characters', 'units', 'abbreviations', 'chemical formulae',
        'cardinal numbers except the explicitly listed basic forms',
        'ordinal numbers except first, second, third, twenty-first, twenty-second, and twenty-third',
      ],
      elementaryLearningWordLimits: {
        grades3to4: 300,
        grades5to6: 300,
        cumulative: 600,
      },
      elementaryGradeBandsAreAssignedByAppendix: false,
    },
    statusSemantics: {
      officialElementaryCandidate: 'Membership in the official Appendix 3 single-star set; this is not a grade-band approval.',
      gradeBandApproval: 'Candidate rows remain unassigned in this official-source artifact; runtime seed approval is recorded separately.',
      engineGradeBandReview: 'The runtime uses a reviewed 30-word grades 3-4 seed plus 24 new grades 5-6 words.',
      sourceListMembership: 'Provenance in docs/assets/english-wordlist.md; this is independent of official Appendix 3 status.',
    },
    engineGradeBandReview: {
      schema: ENGLISH_VOCABULARY_REVIEW.schema,
      status: ENGLISH_VOCABULARY_REVIEW.status,
      source: 'src/curriculum/english-vocab.mjs',
      grades3to4Count: WORDS_G34.length,
      grades5to6NewCount: WORDS_G56.length,
      grades5to6CumulativeCount: WORDS_BY_BAND['5-6'].length,
    },
    anomalies: {
      officialEntriesMissingFromCandidatePool,
      officialEntriesWithMultipleCandidatePoolMatches,
      ministrySourceEntriesNotOfficialElementary,
      officialElementaryCandidatesNotInMinistrySource,
      officialElementaryEntriesNotInMinistrySource,
    },
    officialElementaryEntries: officialEntries,
    candidatePool,
  };
}

function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const officialMarkdown = fs.readFileSync(path.join(repoRoot, OFFICIAL_SOURCE), 'utf8');
  const candidateMarkdown = fs.readFileSync(path.join(repoRoot, CANDIDATE_SOURCE), 'utf8');
  const outputPath = path.join(repoRoot, OUTPUT);
  const serialized = `${JSON.stringify(buildOfficialVocabularyArtifact({ officialMarkdown, candidateMarkdown }), null, 2)}\n`;

  if (process.argv.includes('--check')) {
    invariant(fs.existsSync(outputPath), `${OUTPUT} does not exist`);
    invariant(fs.readFileSync(outputPath, 'utf8') === serialized, `${OUTPUT} is stale; run this tool without --check`);
    console.log(`official English vocabulary artifact is current: ${OUTPUT}`);
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, 'utf8');
  const artifact = JSON.parse(serialized);
  console.log(`official elementary entries: ${artifact.summary.officialElementaryEntryCount}`);
  console.log(`merged candidates: ${artifact.summary.candidatePoolCount}`);
  console.log(`cross-referenced official candidates: ${artifact.summary.candidatesOfficialElementary}`);
  console.log(`anomalies: ${Object.values(artifact.anomalies).reduce((sum, entries) => sum + entries.length, 0)}`);
  console.log(`wrote ${OUTPUT}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
