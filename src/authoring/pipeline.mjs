/**
 * AI 문항 작성 파이프라인: 후보 생성 -> 게이트 -> GGW 린터 -> 코퍼스 추가.
 *
 * LLM 은 client.complete(messages) 하나로만 부른다. 실제 호출은 src/authoring/llm.mjs,
 * 테스트는 가짜 client 를 넣는다. 통과한 문항만 data/authored/<교과>/<성취기준>.json 에
 * 쌓고, 파일 안 문항은 id 순서로 정렬해 같은 입력이면 같은 파일이 나오게 한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadOntology } from '../ontology/source.mjs';
import { buildSpine } from '../ontology/spine.mjs';
import { createRegistry } from '../engine/registry.mjs';
import { createRng } from '../engine/rng.mjs';
import { generateItem } from '../engine/worksheet.mjs';
import { vocabularyFor } from '../curriculum/korean-vocab.mjs';
import {
  AUTHORED_ROOT,
  AUTHORED_SCHEMA,
  assertAuthoredFile,
  authoredFilePath,
} from '../generators/authored.mjs';
import { buildMessages, PROMPT_VERSION } from './prompt.mjs';
import { parseCandidates } from './llm.mjs';
import { AUTHORING_SUBJECTS, authoringIneligibility, checkCandidate, normalizeCandidate } from './gates.mjs';
import { lintWithGgw } from './ggw.mjs';
import { officialEnglishWords } from './english-official.mjs';

const GRADE_BANDS = { g12: '1-2', g34: '3-4', g56: '5-6' };

export function gradeBandOf(grade) {
  if (grade === undefined) return undefined;
  const band = GRADE_BANDS[grade] ?? (Object.values(GRADE_BANDS).includes(grade) ? grade : undefined);
  if (!band) throw new Error(`--grade 는 g12, g34, g56 중 하나다: ${grade}`);
  return band;
}

export function normalizeStandardCode(code) {
  const trimmed = String(code).trim();
  return trimmed.startsWith('[') ? trimmed : `[${trimmed}]`;
}

export function loadSpine() {
  return buildSpine(loadOntology());
}

/**
 * 작성 대상 성취기준. 사람이 채점하는 기준, 아직 없는 자료가 있어야 하는 기준, 선택지를 내면
 * 안 되는 기준은 뺀다(gates.mjs authoringIneligibility). 성취기준을 직접 짚었는데 대상이
 * 아니면 까닭을 담아 오류를 던진다.
 */
export function targetStandards(spine, { subject, gradeBand, standard }) {
  if (subject && !AUTHORING_SUBJECTS.includes(subject)) {
    throw new Error(`AI 작성은 국어·영어만 받는다(${AUTHORING_SUBJECTS.join(', ')}): ${subject}`);
  }
  const code = standard ? normalizeStandardCode(standard) : undefined;
  const list = spine.standards.filter((s) => (!subject || s.subject === subject)
    && (!gradeBand || s.gradeBand === gradeBand)
    && (!code || s.code === code));
  if (code && list.length === 0) throw new Error(`조건에 맞는 성취기준이 없다: ${code} (${subject ?? '-'} ${gradeBand ?? '-'})`);
  if (code) {
    const reason = authoringIneligibility(list[0]);
    if (reason) throw new Error(`${code} 는 AI 작성 대상이 아니다: ${reason}`);
  }
  return list.filter((s) => authoringIneligibility(s) === null);
}

export function readCorpusFile(subject, code, root = AUTHORED_ROOT) {
  const file = authoredFilePath(subject, code, root);
  if (!existsSync(file)) return null;
  return assertAuthoredFile(JSON.parse(readFileSync(file, 'utf8')), file);
}

/** 기존 파일에 새 문항을 더한다. 문항은 id 순서로 정렬한다. */
export function mergeCorpus(existing, { subject, standardCode, skill }, added) {
  const items = [...(existing?.items ?? []), ...added].sort((a, b) => a.id.localeCompare(b.id));
  return assertAuthoredFile({
    schema: AUTHORED_SCHEMA,
    subject,
    standardCode,
    skill: existing?.skill ?? skill,
    items,
  }, standardCode);
}

export function writeCorpusFile(file, root = AUTHORED_ROOT) {
  const target = authoredFilePath(file.subject, file.standardCode, root);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  return target;
}

/** 프롬프트에 형식 참고로 넣을 기존 문항 표본. AI 작성 생성기는 빼고 손으로 지은 생성기만 쓴다. */
function exampleItems(registry, standard, limit = 4) {
  const out = [];
  for (const generator of registry.forStandard(standard.code).filter((g) => !g.authored)) {
    for (let n = 0; n < 2 && out.length < limit; n += 1) {
      const item = generateItem(generator, standard, createRng(`authoring-example|${generator.id}|${n}`), 2);
      out.push({
        instruction: item.instruction ?? '',
        stem: item.stem,
        answer: item.answer.display,
        ...(item.choices ? { distractors: item.choices.filter((c) => !c.correct).map((c) => c.text) } : {}),
      });
    }
  }
  return out;
}

function vocabularyForPrompt(standard) {
  if (standard.subject === 'english') return [...officialEnglishWords()].sort();
  if (standard.subject === 'korean') return vocabularyFor(standard.gradeBand);
  return [];
}

/** GGW 린터가 읽을 문면: 지시문·지문·정답·오답지·해설 전부. 영어 문장과 한 낱말 선택지도 빼지 않는다. */
function lintTexts(entry) {
  return [entry.instruction, entry.stem, entry.answer, ...entry.distractors, ...entry.solution].filter((t) => typeof t === 'string' && t.length > 0);
}

/**
 * 성취기준 하나에 문항을 작성한다.
 *
 * @param {object} p
 * @param {object} p.standard 스파인 성취기준 레코드
 * @param {number} p.count 받을 통과 문항 수
 * @param {{ model: string, complete: (messages: object[]) => Promise<string> }} p.client
 * @param {typeof lintWithGgw} [p.lint]
 * @param {string} [p.root] 코퍼스 폴더
 * @param {boolean} [p.dryRun] true 면 파일을 쓰지 않는다
 * @param {number} [p.batchSize] 한 번에 요청하는 후보 수
 * @param {number} [p.maxRounds] 요청 횟수 상한
 * @param {object} [p.registry]
 * @returns 결과. API 요청이 실패하면(인증·장애·시간 초과) 거기서 멈추고 error 에 까닭을 담는다.
 *   그때까지 통과한 문항은 그대로 쓴다. 응답이 왔지만 형식이 깨진 것은 후보 탈락(response)이다.
 */
export async function authorStandard({
  standard,
  count,
  client,
  lint = lintWithGgw,
  root = AUTHORED_ROOT,
  dryRun = false,
  batchSize = 20,
  maxRounds = 3,
  registry = createRegistry(),
}) {
  const ineligible = authoringIneligibility(standard);
  if (ineligible) throw new Error(`${standard.code} 는 AI 작성 대상이 아니다: ${ineligible}`);
  const existing = readCorpusFile(standard.subject, standard.code, root);
  const skill = existing?.skill ?? standard.summary;
  const seenIds = new Set(existing?.items.map((i) => i.id) ?? []);
  const seenStems = new Set(existing?.items.map((i) => i.stem) ?? []);
  const examples = exampleItems(registry, standard);
  const vocabulary = vocabularyForPrompt(standard);
  const provenance = { model: client.model, prompt: PROMPT_VERSION };

  const accepted = [];
  const rejected = [];
  const warnings = [];
  let requested = 0;
  let ggwMode = null;
  let error = null;

  for (let round = 0; round < maxRounds && accepted.length < count; round += 1) {
    const need = Math.min(batchSize, count - accepted.length);
    requested += need;
    const messages = buildMessages({ standard, count: need, vocabulary, examples, avoidStems: [...seenStems].slice(-40) });
    let content;
    try {
      content = await client.complete(messages);
    } catch (failure) {
      // 전송·API 오류는 후보 탈락이 아니다. 다음 바퀴도 같은 까닭으로 실패하므로 멈춘다.
      error = failure.message;
      break;
    }
    let raws;
    try {
      raws = parseCandidates(content);
    } catch (failure) {
      rejected.push({ entry: null, reasons: [{ gate: 'response', detail: failure.message }] });
      continue;
    }

    const passed = [];
    for (const raw of raws) {
      const entry = normalizeCandidate(raw, standard.code, provenance);
      const reasons = checkCandidate(entry, { standard, skill, seenIds, seenStems });
      if (reasons.length > 0) {
        rejected.push({ entry, reasons });
        continue;
      }
      seenIds.add(entry.id);
      seenStems.add(entry.stem);
      passed.push(entry);
    }

    const ggw = await lint(passed.map((entry) => ({ id: entry.id, texts: lintTexts(entry) })));
    if (ggw.warning && !warnings.includes(ggw.warning)) warnings.push(ggw.warning);
    if (ggw.mode) ggwMode = ggw.mode;
    for (const entry of passed) {
      const flags = ggw.flagged.get(entry.id);
      if (flags) {
        rejected.push({ entry, reasons: flags });
        seenIds.delete(entry.id);
        seenStems.delete(entry.stem);
      } else if (accepted.length < count) {
        accepted.push(entry);
      }
    }
  }

  let written = null;
  if (!dryRun && accepted.length > 0) {
    written = writeCorpusFile(mergeCorpus(existing, { subject: standard.subject, standardCode: standard.code, skill }, accepted), root);
  }
  return {
    standardCode: standard.code,
    requested,
    accepted,
    rejected,
    warnings,
    ggwMode,
    corpusBefore: existing?.items.length ?? 0,
    corpusAfter: (existing?.items.length ?? 0) + (dryRun ? 0 : accepted.length),
    written,
    error,
  };
}

/**
 * 후보 파일을 읽는다. 파일은 LLM 응답과 같은 꼴({"items":[...]})이고, 성취기준 코드
 * (standardCode)와 작성 모델(model)을 위에 더 적을 수 있다.
 */
export function readCandidatesFile(file) {
  const text = readFileSync(file, 'utf8');
  const items = parseCandidates(text);
  const data = JSON.parse(text.replace(/^\uFEFF/, ''));
  return {
    items,
    standardCode: typeof data?.standardCode === 'string' ? data.standardCode : undefined,
    model: typeof data?.model === 'string' && data.model.trim() ? data.model.trim() : 'candidates-file',
  };
}

/**
 * LLM 을 부르지 않고 미리 쓴 후보를 그대로 돌려주는 client. authorStandard 에
 * count·batchSize 를 후보 수로, maxRounds 를 1 로 주면 후보 전부가 한 번에 게이트를 지난다.
 */
export function candidatesClient(items, model = 'candidates-file') {
  return {
    model,
    async complete() {
      return JSON.stringify({ items });
    },
  };
}

/** 탈락 사유를 게이트별로 센다. */
export function summarizeRejections(rejected) {
  const byGate = {};
  for (const { reasons } of rejected) {
    for (const gate of new Set(reasons.map((r) => r.gate))) byGate[gate] = (byGate[gate] ?? 0) + 1;
  }
  return byGate;
}
