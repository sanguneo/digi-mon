#!/usr/bin/env node
/**
 * AI 문항 작성 CLI.
 *
 *   node bin/ai-generate.mjs --subject korean --grade g34 --standard 4국02-04 --count 50
 *   node bin/ai-generate.mjs --subject english --grade g56 --count 30 --dry-run
 *   node bin/ai-generate.mjs --subject korean --candidates k4-02-04.json [--candidates ...]
 *
 * 후보를 OpenAI 호환 API 로 받아 게이트와 GGW 린터를 통과한 것만
 * data/authored/<교과>/<성취기준>.json 에 더한다. --standard 를 빼면 그 교과·학년군의
 * 자동 채점 성취기준 전부를 돈다. --dry-run 은 파일을 쓰지 않고 결과만 보여 준다.
 * --candidates 는 LLM 을 부르지 않고 파일에 적힌 후보(LLM 응답과 같은 꼴)를 같은 게이트와
 * GGW 린터에 통과시킨다. 파일마다 standardCode 를 적거나 --standard 로 준다. 키가 필요 없다.
 *
 * 환경변수: DIGIMON_LLM_BASE_URL, DIGIMON_LLM_API_KEY, DIGIMON_LLM_MODEL (필수)
 *           DIGIMON_GGW_LINTER (선택, polish-lint.ts 경로)
 */
import { parseArgs } from 'node:util';
import { createLlmClient, LLM_ENV, llmConfigFromEnv } from '../src/authoring/llm.mjs';
import {
  authorStandard,
  candidatesClient,
  gradeBandOf,
  loadSpine,
  readCandidatesFile,
  summarizeRejections,
  targetStandards,
} from '../src/authoring/pipeline.mjs';
import { AUTHORED_ROOT } from '../src/generators/authored.mjs';

const USAGE = `사용법: node bin/ai-generate.mjs --subject <korean|english|math> [--grade g12|g34|g56] [--standard <코드>] [--count N] [--dry-run]
       node bin/ai-generate.mjs --subject <korean|english|math> --candidates <file.json> [--candidates ...] [--standard <코드>] [--dry-run]
환경변수 ${LLM_ENV.join(', ')} 가 필요하다(--candidates 는 필요 없다).`;

function fail(message, code = 2) {
  console.error(message);
  console.error(USAGE);
  process.exit(code);
}

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      subject: { type: 'string' },
      grade: { type: 'string' },
      standard: { type: 'string' },
      count: { type: 'string', default: '20' },
      batch: { type: 'string', default: '20' },
      rounds: { type: 'string', default: '3' },
      'dry-run': { type: 'boolean', default: false },
      'corpus-root': { type: 'string' },
      candidates: { type: 'string', multiple: true },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  fail(error.message);
}

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!['korean', 'english', 'math'].includes(args.subject)) fail('--subject 는 korean, english, math 중 하나다');
const count = Number(args.count);
const batchSize = Number(args.batch);
const maxRounds = Number(args.rounds);
for (const [name, value] of [['count', count], ['batch', batchSize], ['rounds', maxRounds]]) {
  if (!Number.isInteger(value) || value < 1 || value > 500) fail(`--${name} 는 1..500 정수다`);
}

// 성취기준마다 한 번씩 도는 작업. 후보 파일이면 파일 하나가 작업 하나다.
const jobs = [];
const spine = loadSpine();
if (args.candidates) {
  for (const file of args.candidates) {
    let candidates;
    let standard;
    try {
      candidates = readCandidatesFile(file);
      const code = candidates.standardCode ?? args.standard;
      if (!code) fail(`${file}: standardCode 가 없다. 파일에 적거나 --standard 로 준다`);
      [standard] = targetStandards(spine, { subject: args.subject, gradeBand: gradeBandOf(args.grade), standard: code });
    } catch (error) {
      fail(`${file}: ${error.message}`);
    }
    if (!standard) fail(`${file}: 사람이 채점하는 성취기준이라 대상이 아니다`);
    const n = Math.max(candidates.items.length, 1);
    jobs.push({ standard, client: candidatesClient(candidates.items, candidates.model), count: n, batchSize: n, maxRounds: 1 });
  }
} else {
  const config = llmConfigFromEnv();
  if (!config.ok) {
    fail(`LLM 설정이 없다: ${config.missing.join(', ')}. 실제 생성은 키가 있어야 한다(docs/ai-item-generation.md).`);
  }
  let standards;
  try {
    standards = targetStandards(spine, {
      subject: args.subject,
      gradeBand: gradeBandOf(args.grade),
      standard: args.standard,
    });
  } catch (error) {
    fail(error.message);
  }
  if (standards.length === 0) fail('자동 채점 대상 성취기준이 없다');
  const client = createLlmClient(config);
  for (const standard of standards) jobs.push({ standard, client, count, batchSize, maxRounds });
}

const root = args['corpus-root'] ?? AUTHORED_ROOT;
const results = [];
let failed = false;

for (const job of jobs) {
  const { standard } = job;
  try {
    const result = await authorStandard({
      ...job,
      root,
      dryRun: args['dry-run'],
    });
    results.push(result);
    if (!args.json) {
      const rejections = summarizeRejections(result.rejected);
      const reasonText = Object.entries(rejections).map(([gate, n]) => `${gate} ${n}`).join(', ') || '없음';
      console.log(`${standard.code} ${standard.summary}`);
      console.log(`  요청 ${result.requested} · 통과 ${result.accepted.length} · 탈락 ${result.rejected.length} (${reasonText})`);
      console.log(`  코퍼스 ${result.corpusBefore} -> ${result.corpusAfter}${args['dry-run'] ? ' (dry-run, 파일을 쓰지 않음)' : ''}`);
      for (const warning of result.warnings) console.log(`  경고: ${warning}`);
      for (const { entry, reasons } of result.rejected.slice(0, 5)) {
        console.log(`  탈락 ${entry?.stem?.split('\n')[0]?.slice(0, 40) ?? '(응답)'}: ${reasons.map((r) => `${r.gate} ${r.detail}`).join(' / ').slice(0, 160)}`);
      }
    }
  } catch (error) {
    failed = true;
    console.error(`${standard.code} 작성 실패: ${error.message}`);
  }
}

if (args.json) {
  console.log(JSON.stringify(results.map((r) => ({
    standardCode: r.standardCode,
    requested: r.requested,
    accepted: r.accepted.map((e) => e.id),
    rejected: r.rejected.map(({ entry, reasons }) => ({ id: entry?.id ?? null, stem: entry?.stem ?? null, reasons })),
    rejectionsByGate: summarizeRejections(r.rejected),
    warnings: r.warnings,
    corpusBefore: r.corpusBefore,
    corpusAfter: r.corpusAfter,
    written: r.written,
  })), null, 2));
} else {
  const accepted = results.reduce((s, r) => s + r.accepted.length, 0);
  const rejected = results.reduce((s, r) => s + r.rejected.length, 0);
  console.log(`합계: 성취기준 ${results.length}개 · 통과 ${accepted} · 탈락 ${rejected}`);
}
process.exitCode = failed ? 1 : 0;
