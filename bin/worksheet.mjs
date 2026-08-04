#!/usr/bin/env node
/**
 * 학습지 생성 CLI.
 *   node bin/worksheet.mjs --seed 2026-03-02 --count 20 --grade 1-2 --domain 수와\ 연산
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { buildWorksheet } from '../src/engine/worksheet.mjs';
import { renderWorksheet, renderAnswerKey } from '../src/render/worksheet-text.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const ontology = loadOntology();
const spine = buildSpine(ontology);
const registry = createRegistry();

const worksheet = buildWorksheet(spine, registry, {
  seed: args.seed ?? String(Date.now()),
  subject: args.subject ?? 'math',
  gradeBands: args.grade ? String(args.grade).split(',') : undefined,
  domains: args.domain ? String(args.domain).split(',') : undefined,
  codes: args.code ? String(args.code).split(',') : undefined,
  count: Number(args.count ?? 20),
  difficulty: args.difficulty ? Number(args.difficulty) : undefined,
  title: args.title,
});

const outDir = path.join(REPO_ROOT, 'out', 'worksheets');
const stamp = `${worksheet.options.subject}-${worksheet.seed}`.replace(/[^\w.-]/g, '_');
fs.mkdirSync(outDir, { recursive: true });

writeJson(path.join(outDir, `${stamp}.json`), worksheet);
fs.writeFileSync(path.join(outDir, `${stamp}.txt`), renderWorksheet(worksheet), 'utf8');
fs.writeFileSync(path.join(outDir, `${stamp}.answers.txt`), renderAnswerKey(worksheet), 'utf8');

if (args.print) {
  console.log(renderWorksheet(worksheet));
  console.log('\n\n');
  console.log(renderAnswerKey(worksheet));
} else {
  console.log(`${worksheet.title}`);
  console.log(`문항 ${worksheet.produced}/${worksheet.requested}  성취기준 ${worksheet.standardsUsed.length}종  seed ${worksheet.seed}`);
  console.log(`-> out/worksheets/${stamp}.{json,txt,answers.txt}`);
}
