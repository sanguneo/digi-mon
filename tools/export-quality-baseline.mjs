#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createRegistry } from '../src/engine/registry.mjs';
import { stableJson } from '../src/engine/stable-json.mjs';
import { buildWorksheet } from '../src/engine/worksheet.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { REPO_ROOT, loadOntology } from '../src/ontology/source.mjs';
import { renderAnswerKey, renderWorksheet } from '../src/render/worksheet-text.mjs';

const QUALITY_BASELINE_SCHEMA = 'digi-mon/quality-baseline@1';
const ITEMS_PER_CASE = 10;
const SUBJECTS = [
  { subject: 'math', abbreviation: 'M', seedCode: 'm', gradeBands: ['1-2', '3-4', '5-6'] },
  { subject: 'korean', abbreviation: 'K', seedCode: 'k', gradeBands: ['1-2', '3-4', '5-6'] },
  { subject: 'english', abbreviation: 'E', seedCode: 'e', gradeBands: ['3-4', '5-6'] },
];

export const QUALITY_REVIEW_AXES = [
  'curriculum-alignment',
  'answer-correctness',
  'wording-naturalness',
  'distractor-quality',
  'perceived-difficulty',
  'repetition',
];

export const QUALITY_REVIEW_RATINGS = {
  core: ['pass', 'fix', 'undecidable', 'n-a'],
  perceivedDifficulty: ['match', 'easier', 'harder', 'undecidable'],
  repetition: ['varied', 'repetitive', 'undecidable'],
};

export const QUALITY_BASELINE_CASES = SUBJECTS.flatMap(({
  subject,
  abbreviation,
  seedCode,
  gradeBands,
}) => gradeBands.flatMap((gradeBand) => [1, 2, 3].map((difficulty) => {
  const compactBand = gradeBand.replace('-', '');
  return {
    id: `WS-${abbreviation}${compactBand}-D${difficulty}`,
    seed: `review-ws-${seedCode}${compactBand}-d${difficulty}`,
    options: {
      subject,
      gradeBands: [gradeBand],
      count: ITEMS_PER_CASE,
      difficulty,
    },
  };
})));

function fingerprint(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function buildQualityBaseline() {
  const spine = buildSpine(loadOntology());
  const registry = createRegistry();
  const worksheets = QUALITY_BASELINE_CASES.map((definition) => {
    const worksheet = buildWorksheet(spine, registry, {
      ...definition.options,
      seed: definition.seed,
    });
    if (worksheet.shortfall !== 0) {
      throw new Error(
        `${definition.id} 품질 표본이 ${worksheet.produced}/${worksheet.requested}문항만 생성됐다`,
      );
    }
    return { id: definition.id, worksheet };
  });

  const cases = QUALITY_BASELINE_CASES.map((definition, index) => {
    const worksheet = worksheets[index].worksheet;
    return {
      ...definition,
      worksheetFingerprint: worksheet.fingerprint,
      standardsUsed: worksheet.standardsUsed,
      difficultyHistogram: worksheet.difficultyHistogram,
    };
  });
  const identity = {
    schema: QUALITY_BASELINE_SCHEMA,
    reviewAxes: QUALITY_REVIEW_AXES,
    reviewRatings: QUALITY_REVIEW_RATINGS,
    caseCount: cases.length,
    itemsPerCase: ITEMS_PER_CASE,
    totalItems: cases.length * ITEMS_PER_CASE,
    cases,
  };

  return {
    artifact: { ...identity, fingerprint: fingerprint(identity) },
    worksheets,
  };
}

export function renderQualityBaselineSamples({ artifact, worksheets }) {
  const lines = [
    '# 대표 학습지 품질 기준선',
    '',
    '`tools/export-quality-baseline.mjs`가 생성한다. 손으로 고치지 않는다.',
    '',
    `- 기준선 fingerprint: \`${artifact.fingerprint}\``,
    `- 사례 ${artifact.caseCount}개 · 사례당 ${artifact.itemsPerCase}문항 · 총 ${artifact.totalItems}문항`,
    '- 이 문서는 사람 검토용 증거다. 생성 성공이나 자동 게이트 통과는 교육적 품질 승인이 아니다.',
    '',
    '| 사례 | 교과 | 학년군 | 요청 난이도 | 실제 난이도 | seed | worksheet fingerprint | 성취기준 수 |',
    '|---|---|---|---:|---|---|---|---:|',
  ];

  for (const entry of artifact.cases) {
    const actualDifficulty = Object.entries(entry.difficultyHistogram)
      .map(([level, count]) => `${level}:${count}`)
      .join(' ');
    lines.push(
      `| \`${entry.id}\` | ${entry.options.subject} | ${entry.options.gradeBands[0]} `
      + `| ${entry.options.difficulty} | ${actualDifficulty} | \`${entry.seed}\` `
      + `| \`${entry.worksheetFingerprint}\` | ${entry.standardsUsed.length} |`,
    );
  }

  for (const { id, worksheet } of worksheets) {
    lines.push(
      '',
      `## ${id}`,
      '',
      `- fingerprint: \`${worksheet.fingerprint}\``,
      `- seed: \`${worksheet.seed}\``,
      `- 성취기준: ${worksheet.standardsUsed.map((code) => `\`${code}\``).join(' ')}`,
      '',
      '### 학습지',
      '',
      '```text',
      renderWorksheet(worksheet),
      '```',
      '',
      '### 정답과 풀이',
      '',
      '```text',
      renderAnswerKey(worksheet),
      '```',
    );
  }

  return `${lines.join('\n')}\n`;
}

export function exportQualityBaseline() {
  const baseline = buildQualityBaseline();
  const dataPath = path.join(REPO_ROOT, 'data', 'audit', 'quality-baseline.json');
  const reviewPath = path.join(REPO_ROOT, 'docs', 'review', 'quality-baseline.md');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
  fs.writeFileSync(dataPath, `${JSON.stringify(baseline.artifact, null, 2)}\n`, 'utf8');
  fs.writeFileSync(reviewPath, renderQualityBaselineSamples(baseline), 'utf8');
  console.log(
    `품질 기준선: ${baseline.artifact.caseCount}개 학습지 · `
    + `${baseline.artifact.totalItems}문항 -> data/audit/quality-baseline.json`,
  );
  console.log('사람 검토 표본 -> docs/review/quality-baseline.md');
}

const entryUrl = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (entryUrl === import.meta.url) exportQualityBaseline();
