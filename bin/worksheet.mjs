#!/usr/bin/env node
/**
 * 학습지 생성 CLI.
 *   node bin/worksheet.mjs --seed 2026-03-02 --count 20 --grade 1-2 --domain 수와\ 연산
 */
import fs from 'node:fs';
import path from 'node:path';

import { parseWorksheetOptions } from '../src/engine/options.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { buildWorksheet } from '../src/engine/worksheet.mjs';
import { buildWorksheetFormSet } from '../src/engine/worksheet-forms.mjs';
import { loadOntology, REPO_ROOT, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { renderAnswerKey, renderWorksheet } from '../src/render/worksheet-text.mjs';

const VALUE_FLAGS = new Set([
  'seed',
  'subject',
  'grade',
  'domain',
  'code',
  'count',
  'difficulty',
  'forms',
  'title',
]);
const BOOLEAN_FLAGS = new Set(['help', 'print']);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`알 수 없는 인자: ${a}`);
    const key = a.slice(2);
    if (!VALUE_FLAGS.has(key) && !BOOLEAN_FLAGS.has(key)) {
      throw new Error(`알 수 없는 옵션: --${key}`);
    }
    if (BOOLEAN_FLAGS.has(key)) {
      out[key] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`--${key} 옵션에 값이 필요하다`);
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function printHelp() {
  console.log(`사용법: node bin/worksheet.mjs [옵션]

옵션:
  --subject math|korean|english   교과 (기본: math)
  --seed <문자열>                 재현 가능한 생성 seed
  --grade 1-2,3-4,5-6            학년군 필터
  --domain <영역명,...>           영역 필터
  --code <성취기준,...>           성취기준 코드 필터
  --count <1..100>               문항 수 (기본: 20)
  --difficulty <1|2|3>           고정 난이도
  --forms <1..8>                 같은 blueprint의 병렬 form 수 (기본: 1)
  --title <제목>                  학습지 제목
  --print                         학습지와 정답을 표준 출력
  --help                          이 도움말`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const options = parseWorksheetOptions({
    ...args,
    seed: args.seed ?? String(Date.now()),
  });
  const formCount = args.forms === undefined ? 1 : Number(args.forms);
  if (!Number.isInteger(formCount) || formCount < 1 || formCount > 8) {
    throw new Error(`forms 는 1..8 정수여야 한다: ${args.forms}`);
  }
  const ontology = loadOntology();
  const spine = buildSpine(ontology);
  if (spine.conflictCount > 0) {
    throw new Error(`스파인 불일치 ${spine.conflictCount}건 — 생성을 중단한다`);
  }
  const registry = createRegistry();
  const outDir = path.join(REPO_ROOT, 'out', 'worksheets');
  fs.mkdirSync(outDir, { recursive: true });

  if (formCount > 1) {
    const formSet = buildWorksheetFormSet(spine, registry, {
      ...options,
      formCount,
    });
    for (const { label, worksheet } of formSet.forms) {
      writeWorksheetArtifacts(outDir, worksheet, label);
    }
    const manifestBase = `${formSet.options.subject}-${formSet.seed}-forms-${formSet.fingerprint.slice(0, 12)}`;
    const manifestStamp = manifestBase.replace(/[^\w.-]/g, '_');
    writeJson(path.join(outDir, `${manifestStamp}.forms.json`), formSet);

    if (args.print) {
      for (const { label, worksheet } of formSet.forms) {
        console.log(`=== ${label}형 ===`);
        console.log(renderWorksheet(worksheet));
        console.log('\n');
        console.log(renderAnswerKey(worksheet));
        console.log('\n');
      }
    } else {
      console.log(`${formSet.forms[0].worksheet.title}`);
      console.log(
        `병렬 form ${formSet.forms.map(({ label }) => label).join('/')} `
        + `각 ${formSet.forms[0].worksheet.produced}문항 seed ${formSet.seed}`,
      );
      console.log(`-> out/worksheets/${manifestStamp}.forms.json`);
    }
    return;
  }

  const worksheet = buildWorksheet(spine, registry, options);
  if (worksheet.shortfall > 0) {
    throw new Error(
      `요청한 문항 수를 채우지 못했다: ${worksheet.produced}/${worksheet.requested}`,
    );
  }
  const stamp = writeWorksheetArtifacts(outDir, worksheet);

  if (args.print) {
    console.log(renderWorksheet(worksheet));
    console.log('\n\n');
    console.log(renderAnswerKey(worksheet));
  } else {
    console.log(`${worksheet.title}`);
    console.log(`문항 ${worksheet.produced}/${worksheet.requested}  성취기준 ${worksheet.standardsUsed.length}종  seed ${worksheet.seed}`);
    console.log(`-> out/worksheets/${stamp}.{json,txt,answers.txt}`);
  }
}

function writeWorksheetArtifacts(outDir, worksheet, label) {
  const base = `${worksheet.options.subject}-${worksheet.seed}-${worksheet.fingerprint.slice(0, 12)}`;
  const stamp = `${base}${label ? `-${label}` : ''}`.replace(/[^\w.-]/g, '_');

  writeJson(path.join(outDir, `${stamp}.json`), worksheet);
  fs.writeFileSync(path.join(outDir, `${stamp}.txt`), renderWorksheet(worksheet), 'utf8');
  fs.writeFileSync(path.join(outDir, `${stamp}.answers.txt`), renderAnswerKey(worksheet), 'utf8');
  return stamp;
}

try {
  main();
} catch (error) {
  console.error(`학습지 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
