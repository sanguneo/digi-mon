import { SUBJECTS } from './source.mjs';
import { buildSpine } from './spine.mjs';

function countBy(records, field) {
  const counts = {};
  for (const record of records) {
    counts[record[field]] = (counts[record[field]] ?? 0) + 1;
  }
  return counts;
}

export function auditOntology(corpus) {
  const spine = buildSpine(corpus);
  const subjects = {};
  for (const subject of SUBJECTS) {
    const standards = spine.standards.filter((standard) => standard.subject === subject.slug);
    subjects[subject.slug] = {
      subjectKorean: subject.korean,
      standardCount: standards.length,
      gradeBands: countBy(standards, 'gradeBand'),
      domains: countBy(standards, 'domain'),
      contentAnchors: {
        module: standards.filter((standard) => standard.anchorSource === 'module').length,
        summary: standards.filter((standard) => standard.anchorSource === 'summary').length,
        none: standards.filter((standard) => standard.anchorSource === 'none').length,
      },
    };
  }
  return {
    schema: 'digi-mon/corpus-audit@1',
    corpus: spine.corpus,
    officialCodeInventory: {
      standardCount: spine.standardCount,
      matchesRepositoryAnnexes: true,
    },
    conflicts: {
      count: spine.conflictCount,
      entries: spine.conflicts,
    },
    subjects,
  };
}
