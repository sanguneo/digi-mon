/**
 * AI 작성 문항 검토 관리자 API.
 *
 * 사람이 data/authored/review-status.json 을 손으로 고치던 일을 화면에서 하게 한다.
 * 교사 Bearer 토큰이 있어야 하고, 파일을 쓰는 요청은 DIGIMON_ADMIN_WRITE=1 로 켠
 * 로컬 서버에서만 받는다. 배포 서버가 실수로 저장소 파일을 쓰지 않게 하려는 것이다.
 *
 *   GET  /v1/review/items    목록. 우선 검토 문항(docs/authored-review-queue.md) 먼저
 *   GET  /v1/review/item     문항 하나
 *   POST /v1/review/item     문항 고치기. 작성 게이트(checkCandidate)를 다시 통과해야 저장한다
 *   POST /v1/review/verdict  승인 / 고친 뒤 승인 / 빼기 / 되돌리기
 *
 * 문항 파일은 고친 문항 하나만 바꾸고 나머지 문항·순서·포맷·id 는 그대로 둔다.
 * 실행 중인 서버의 생성기는 부팅 때 만든 것이라, 승인한 문항은 서버를 다시 켜야 학습지에 나온다.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTHORED_REVIEW_FILE,
  AUTHORED_REVIEW_SCHEMA,
  AUTHORED_ROOT,
  assertAuthoredFile,
  authoredFilePath,
  loadAuthoredCorpus,
  loadReviewStatus,
} from '../generators/authored.mjs';
import { checkCandidate } from '../authoring/gates.mjs';

export const REVIEW_QUEUE_DOC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'authored-review-queue.md',
);
export const REVIEW_NOTES_DIR = 'review-notes';
const STATUSES = ['pending', 'reviewed', 'excluded'];
const ACTIONS = ['approve', 'exclude', 'reset'];
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export class ReviewAdminError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => v.trim().replace(/\r\n?/g, '\n');

function localDate(now) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 큐 문서의 '우선 검토' 표를 읽는다. 열: # | id | 성취기준 | 위치 | 출처 | 지문 | 정답 | 짚은 점.
 * 문서가 없거나 표가 없으면 빈 목록이다.
 */
export function parsePriorityQueue(markdown) {
  const start = markdown.search(/^## 우선 검토/m);
  if (start < 0) return [];
  const rest = markdown.slice(start);
  const end = rest.slice(3).search(/^## /m);
  const section = end < 0 ? rest : rest.slice(0, end + 3);
  const rows = [];
  for (const line of section.split('\n')) {
    const m = /^\|\s*(\d+)\s*\|\s*`([0-9a-f]{12})`\s*\|(.*)\|\s*$/.exec(line);
    if (!m) continue;
    const cells = m[3].split('|').map((c) => c.trim());
    rows.push({
      rank: Number(m[1]),
      id: m[2],
      source: cells[2] ?? '',
      reason: cells.slice(5).join(' | '),
    });
  }
  return rows;
}

/** data/authored/review-notes/*.jsonl 의 판정 {id, verdict, kind, note}. 줄마다 하나다. */
export function loadReviewNotes(root) {
  const dir = path.join(root, REVIEW_NOTES_DIR);
  const byId = new Map();
  if (!existsSync(dir)) return byId;
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
    const lines = readFileSync(path.join(dir, name), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      let note;
      try {
        note = JSON.parse(line);
      } catch {
        throw new Error(`검토 판정 파일 오류 [${name}:${index + 1}]: JSON 이 아니다`);
      }
      if (!/^[0-9a-f]{12}$/.test(note?.id ?? '') || !nonEmpty(note.verdict)) {
        throw new Error(`검토 판정 파일 오류 [${name}:${index + 1}]: id·verdict 가 필요하다`);
      }
      const entry = { verdict: note.verdict, kind: note.kind ?? null, note: note.note ?? '', source: name };
      byId.set(note.id, [...(byId.get(note.id) ?? []), entry]);
    });
  }
  return byId;
}

function readStatusFile(root) {
  const file = path.join(root, AUTHORED_REVIEW_FILE);
  loadReviewStatus(root); // 스키마 검사. 깨진 파일이면 여기서 멈춘다.
  if (!existsSync(file)) return { schema: AUTHORED_REVIEW_SCHEMA, reviewed: [] };
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeStatusFile(root, status) {
  const next = { ...status };
  if (Array.isArray(next.excluded) && next.excluded.length === 0) delete next.excluded;
  writeFileSync(path.join(root, AUTHORED_REVIEW_FILE), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  loadReviewStatus(root);
}

/** 고칠 수 있는 필드만 받아 코퍼스 항목 꼴로 다듬는다. id·provenance 는 원래 것을 쓴다. */
function editedEntry(original, fields) {
  if (!fields || typeof fields !== 'object') throw new ReviewAdminError(400, 'item 이 필요하다');
  const bad = [];
  for (const key of ['instruction', 'stem', 'answer']) {
    if (typeof fields[key] !== 'string') bad.push(key);
  }
  if (!Array.isArray(fields.distractors) || !fields.distractors.every((d) => typeof d === 'string')) bad.push('distractors');
  const solution = typeof fields.solution === 'string' ? fields.solution.split('\n') : fields.solution;
  if (!Array.isArray(solution) || !solution.every((s) => typeof s === 'string')) bad.push('solution');
  if (fields.difficulty !== undefined && ![1, 2, 3].includes(fields.difficulty)) bad.push('difficulty');
  if (bad.length > 0) throw new ReviewAdminError(400, `item 형식 오류: ${bad.join(', ')}`);
  return {
    ...original,
    difficulty: fields.difficulty ?? original.difficulty,
    instruction: clean(fields.instruction),
    stem: clean(fields.stem),
    answer: clean(fields.answer),
    distractors: fields.distractors.map(clean),
    solution: solution.map(clean).filter((s) => s.length > 0),
  };
}

/**
 * 고친 문항을 작성 게이트(checkCandidate)에 다시 넣는다. 작성 파이프라인(authorStandard)과 같은 범위로,
 * 중복은 같은 성취기준 파일 안에서만 보고 고치는 문항 자신은 뺀다. 다른 성취기준에 같은 지문이 있어도 막지 않는다.
 *
 * @param {object} file 문항이 든 코퍼스 파일
 * @param {object} original 고치기 전 문항
 * @param {object} fields 고친 필드
 * @param {object} standard 스파인 성취기준 레코드
 * @returns {{ entry: object, reasons: Array<{gate: string, detail: string}> }}
 */
export function checkEdit(file, original, fields, standard) {
  const entry = editedEntry(original, fields);
  const others = file.items.filter((item) => item.id !== entry.id);
  const reasons = checkCandidate(entry, {
    standard,
    skill: file.skill,
    seenIds: new Set(others.map((item) => item.id)),
    seenStems: new Set(others.map((item) => item.stem)),
  });
  return { entry, reasons };
}

/**
 * @param {object} p
 * @param {object} p.spine 스파인. 게이트가 성취기준 레코드를 쓴다
 * @param {string} [p.root] data/authored 폴더
 * @param {string} [p.queueDoc] 우선 검토 표가 있는 문서
 * @param {boolean} [p.writeEnabled] 파일 쓰기 허용
 * @param {() => Date} [p.now]
 */
export function createReviewAdmin({
  spine,
  root = AUTHORED_ROOT,
  queueDoc = REVIEW_QUEUE_DOC,
  writeEnabled = process.env.DIGIMON_ADMIN_WRITE === '1',
  now = () => new Date(),
}) {
  const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

  const priorityQueue = () => (existsSync(queueDoc) ? parsePriorityQueue(readFileSync(queueDoc, 'utf8')) : []);

  /** 코퍼스·상태·판정을 디스크에서 새로 읽는다. 쓰기 직후에도 같은 값을 보게 하려는 것이다. */
  function snapshot() {
    const files = loadAuthoredCorpus(root);
    const status = readStatusFile(root);
    const reviewed = new Map(status.reviewed.map((e) => [e.id, e]));
    const excluded = new Map((status.excluded ?? []).map((e) => [e.id, e]));
    const priority = new Map(priorityQueue().map((row) => [row.id, row]));
    const notes = loadReviewNotes(root);
    const records = [];
    for (const file of files) {
      for (const item of file.items) {
        const entry = reviewed.get(item.id) ?? excluded.get(item.id) ?? null;
        const row = priority.get(item.id);
        records.push({
          file,
          item,
          status: reviewed.has(item.id) ? 'reviewed' : excluded.has(item.id) ? 'excluded' : 'pending',
          statusEntry: entry,
          priority: row?.rank ?? null,
          reasons: row ? [{ source: row.source, text: row.reason }] : [],
          notes: notes.get(item.id) ?? [],
        });
      }
    }
    return { files, status, records };
  }

  const summary = (r) => ({
    id: r.item.id,
    subject: r.file.subject,
    standardCode: r.file.standardCode,
    skill: r.file.skill,
    difficulty: r.item.difficulty,
    instruction: r.item.instruction,
    stem: r.item.stem,
    answer: r.item.answer,
    status: r.status,
    priority: r.priority,
    reasons: r.reasons,
    notes: r.notes,
  });

  const detail = (r) => ({
    ...summary(r),
    file: `data/authored/${path.relative(root, authoredFilePath(r.file.subject, r.file.standardCode, root)).replace(/\\/g, '/')}`,
    item: r.item,
    statusEntry: r.statusEntry,
    writeEnabled,
  });

  function find(snap, id) {
    if (!/^[0-9a-f]{12}$/.test(id ?? '')) throw new ReviewAdminError(400, 'id 는 12자리 16진수');
    const record = snap.records.find((r) => r.item.id === id);
    if (!record) throw new ReviewAdminError(404, `없는 문항: ${id}`);
    return record;
  }

  function requireWrite() {
    if (!writeEnabled) {
      throw new ReviewAdminError(403, '문항 검토 쓰기가 꺼져 있다. 로컬에서 DIGIMON_ADMIN_WRITE=1 로 서버를 켜라');
    }
  }

  /** 게이트를 다시 돌려 통과할 때만 그 문항 하나를 바꿔 쓴다. 실패하면 422 와 사유 목록. */
  function saveItem(record, fields) {
    const standard = standardByCode.get(record.file.standardCode);
    if (!standard) throw new ReviewAdminError(500, `스파인에 없는 성취기준: ${record.file.standardCode}`);
    const { entry, reasons } = checkEdit(record.file, record.item, fields, standard);
    if (reasons.length > 0) {
      throw new ReviewAdminError(422, '작성 게이트를 통과하지 못해 저장하지 않았다', { reasons });
    }
    const file = { ...record.file, items: record.file.items.map((item) => (item.id === entry.id ? entry : item)) };
    assertAuthoredFile(file, record.file.standardCode);
    writeFileSync(authoredFilePath(file.subject, file.standardCode, root), `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    return entry;
  }

  function applyVerdict(id, action, reviewer, reason) {
    const status = readStatusFile(root);
    const reviewed = status.reviewed.filter((e) => e.id !== id);
    const excluded = (status.excluded ?? []).filter((e) => e.id !== id);
    const date = localDate(now());
    if (action === 'approve') reviewed.push({ id, reviewer: reviewer.trim(), reviewedAt: date });
    if (action === 'exclude') {
      excluded.push({ id, reviewer: reviewer.trim(), excludedAt: date, ...(nonEmpty(reason) ? { reason: reason.trim() } : {}) });
    }
    writeStatusFile(root, { ...status, reviewed, excluded });
  }

  return {
    writeEnabled,
    routes: [
      {
        method: 'GET',
        path: '/v1/review/items',
        handle: (_body, url) => {
          const q = (key) => url.searchParams.get(key) || null;
          const statusFilter = q('status');
          if (statusFilter && !STATUSES.includes(statusFilter)) {
            throw new ReviewAdminError(400, `status 는 ${STATUSES.join(', ')} 중 하나`);
          }
          const offset = Math.max(0, Number.parseInt(q('offset') ?? '0', 10) || 0);
          const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(q('limit') ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT));
          const snap = snapshot();
          const verdictFilter = q('verdict');
          const matches = snap.records.filter((r) => (!q('subject') || r.file.subject === q('subject'))
            && (!q('standard') || r.file.standardCode === q('standard'))
            && (!statusFilter || r.status === statusFilter)
            && (!q('priority') || (r.priority !== null) === (q('priority') === 'true'))
            && (!verdictFilter
              || (verdictFilter === 'none' ? r.notes.length === 0 : r.notes.some((n) => n.verdict === verdictFilter))));
          // 우선 검토 표 순서 먼저, 나머지는 교과·성취기준 파일 순서 그대로.
          const ordered = [
            ...matches.filter((r) => r.priority !== null).sort((a, b) => a.priority - b.priority),
            ...matches.filter((r) => r.priority === null),
          ];
          const counts = Object.fromEntries(STATUSES.map((s) => [s, snap.records.filter((r) => r.status === s).length]));
          return {
            writeEnabled,
            total: snap.records.length,
            counts,
            matched: ordered.length,
            offset,
            limit,
            facets: {
              subjects: [...new Set(snap.files.map((f) => f.subject))],
              standards: snap.files.map((f) => ({ code: f.standardCode, subject: f.subject, skill: f.skill, count: f.items.length })),
              verdicts: [...new Set(snap.records.flatMap((r) => r.notes.map((n) => n.verdict)))].sort(),
            },
            items: ordered.slice(offset, offset + limit).map(summary),
          };
        },
      },
      {
        method: 'GET',
        path: '/v1/review/item',
        handle: (_body, url) => detail(find(snapshot(), url.searchParams.get('id'))),
      },
      {
        method: 'POST',
        path: '/v1/review/item',
        handle: (body) => {
          requireWrite();
          const snap = snapshot();
          const record = find(snap, body.id);
          saveItem(record, body.item);
          return { saved: true, ...detail(find(snapshot(), body.id)) };
        },
      },
      {
        method: 'POST',
        path: '/v1/review/verdict',
        handle: (body) => {
          requireWrite();
          if (!ACTIONS.includes(body.action)) throw new ReviewAdminError(400, `action 은 ${ACTIONS.join(', ')} 중 하나`);
          if (body.action !== 'reset' && !nonEmpty(body.reviewer)) {
            throw new ReviewAdminError(400, '검토자 이름(reviewer)이 비었다');
          }
          if (body.item !== undefined && body.action !== 'approve') {
            throw new ReviewAdminError(400, '문항 수정은 승인(approve)과만 함께 보낼 수 있다');
          }
          const snap = snapshot();
          const record = find(snap, body.id);
          // 고친 뒤 승인: 게이트를 통과해 저장된 뒤에만 승인한다.
          if (body.item !== undefined) saveItem(record, body.item);
          applyVerdict(record.item.id, body.action, body.reviewer ?? '', body.reason);
          return { saved: body.item !== undefined, ...detail(find(snapshot(), record.item.id)) };
        },
      },
    ],
  };
}
