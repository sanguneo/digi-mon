import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { loadSpine } from '../../src/authoring/pipeline.mjs';
import {
  AUTHORED_REVIEW_FILE,
  AUTHORED_ROOT,
  authoredFilePath,
  authoredGeneratorId,
  loadAuthoredCorpus,
  loadReviewStatus,
  reviewedOnly,
} from '../../src/generators/authored.mjs';
import { createRegistry } from '../../src/engine/registry.mjs';
import { buildWorksheet } from '../../src/engine/worksheet.mjs';
import { createApp } from '../../src/server/app.mjs';
import * as reviewAdmin from '../../src/server/review-admin.mjs';

const { parsePriorityQueue, REVIEW_QUEUE_DOC } = reviewAdmin;

/**
 * 문항 검토 관리자 API(src/server/review-admin.mjs). 저장소의 data/authored 는 건드리지 않고
 * 임시 복사본에 쓴다. 승인한 문항이 학습지에 나오는지는 authored-review-gate 테스트와 같은 길
 * (reviewedOnly → createRegistry → buildWorksheet)로 확인한다.
 */
const TOKEN = 'review-admin-token';
const SPINE = loadSpine();
const REGISTRY = createRegistry({ authoredFiles: [] });
const CODE = '[4국02-04]';
const FILE = 'korean/k4-02-04.json';

let root;
const servers = {};

async function listen(options) {
  const server = http.createServer(createApp({ spine: SPINE, registry: REGISTRY, teacherToken: TOKEN, ...options }));
  const listening = once(server, 'listening', { signal: AbortSignal.timeout(10_000) });
  server.listen(0, '127.0.0.1');
  await listening;
  const address = server.address();
  assert(address && typeof address !== 'string');
  return { server, url: `http://127.0.0.1:${address.port}` };
}

before(async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'digimon-review-admin-'));
  cpSync(AUTHORED_ROOT, root, { recursive: true });
  const now = () => new Date(2026, 10, 12);
  servers.write = await listen({ reviewAdmin: { root, writeEnabled: true, now } });
  servers.readOnly = await listen({ reviewAdmin: { root, writeEnabled: false, now } });
});

after(async () => {
  for (const { server } of Object.values(servers)) {
    server.closeAllConnections();
    server.close();
  }
  rmSync(root, { recursive: true, force: true });
});

async function call(which, method, pathname, body, token = TOKEN) {
  const response = await fetch(`${servers[which].url}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

const readTree = () => Object.fromEntries(['korean', 'english'].flatMap((subject) => readdirSync(path.join(root, subject))
  .map((name) => [`${subject}/${name}`, readFileSync(path.join(root, subject, name), 'utf8')])));
const readStatus = () => JSON.parse(readFileSync(path.join(root, AUTHORED_REVIEW_FILE), 'utf8'));
const itemsOf = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8')).items;
const editable = (item) => ({
  instruction: item.instruction, stem: item.stem, answer: item.answer,
  distractors: [...item.distractors], solution: [...item.solution],
});

test('교사 토큰이 없거나 틀리면 검토 API 를 모두 막는다', async () => {
  for (const [method, pathname] of [
    ['GET', '/v1/review/items'], ['GET', '/v1/review/item?id=111cb2ecec0d'],
    ['POST', '/v1/review/item'], ['POST', '/v1/review/verdict'],
  ]) {
    assert.equal((await call('write', method, pathname, method === 'POST' ? {} : undefined, null)).status, 403, pathname);
    assert.equal((await call('write', method, pathname, method === 'POST' ? {} : undefined, 'wrong')).status, 403, pathname);
  }
  const noToken = await listen({ teacherToken: null, reviewAdmin: { root, writeEnabled: true } });
  try {
    const response = await fetch(`${noToken.url}/v1/review/items`, { headers: { authorization: 'Bearer anything' } });
    assert.equal(response.status, 403);
  } finally {
    noToken.server.close();
  }
});

test('목록은 우선 검토 35문항을 표 순서대로 먼저 주고 지적 사유와 오달 판정을 붙인다', async () => {
  const queue = parsePriorityQueue(readFileSync(REVIEW_QUEUE_DOC, 'utf8'));
  assert.equal(queue.length, 35);
  const { status, body } = await call('readOnly', 'GET', '/v1/review/items?limit=40');
  assert.equal(status, 200);
  assert.equal(body.writeEnabled, false);
  assert.equal(body.total, loadAuthoredCorpus(root).reduce((n, f) => n + f.items.length, 0));
  assert.deepEqual(body.items.slice(0, 35).map((i) => i.id), queue.map((row) => row.id));
  assert.equal(body.items[35].priority, null);
  const first = body.items[0];
  assert.equal(first.id, '111cb2ecec0d');
  assert.match(first.reasons[0].text, /띄어 읽을 자리/);
  assert.equal(first.notes[0].verdict, 'problem');
  assert.equal(first.notes[0].kind, 'multi-answer');

  const filtered = await call('readOnly', 'GET', `/v1/review/items?standard=${encodeURIComponent(CODE)}&status=pending&limit=500`);
  assert.equal(filtered.body.matched, itemsOf(FILE).length);
  assert.ok(filtered.body.items.every((i) => i.standardCode === CODE && i.status === 'pending'));
  const noted = await call('readOnly', 'GET', '/v1/review/items?verdict=problem&limit=500');
  assert.ok(noted.body.matched > 0);
  assert.ok(noted.body.items.every((i) => i.notes.some((n) => n.verdict === 'problem')));
  assert.equal((await call('readOnly', 'GET', '/v1/review/items?status=nope')).status, 400);
});

test('쓰기 환경변수가 꺼진 서버는 조회만 되고 쓰기 요청은 403 이며 파일을 건드리지 않는다', async () => {
  const before = readTree();
  const statusBefore = readFileSync(path.join(root, AUTHORED_REVIEW_FILE), 'utf8');
  const [item] = itemsOf(FILE);
  assert.equal((await call('readOnly', 'GET', `/v1/review/item?id=${item.id}`)).status, 200);
  const save = await call('readOnly', 'POST', '/v1/review/item', { id: item.id, item: editable(item) });
  assert.equal(save.status, 403);
  assert.match(save.body.error, /DIGIMON_ADMIN_WRITE/);
  const verdict = await call('readOnly', 'POST', '/v1/review/verdict', { id: item.id, action: 'approve', reviewer: '검토자' });
  assert.equal(verdict.status, 403);
  assert.deepEqual(readTree(), before);
  assert.equal(readFileSync(path.join(root, AUTHORED_REVIEW_FILE), 'utf8'), statusBefore);
});

test('작성 게이트를 통과하지 못한 수정은 사유를 돌려주고 저장하지 않는다', async () => {
  const before = readTree();
  const [item] = itemsOf(FILE);
  const overlap = await call('write', 'POST', '/v1/review/item', {
    id: item.id, item: { ...editable(item), answer: item.distractors[0] },
  });
  assert.equal(overlap.status, 422);
  assert.ok(overlap.body.detail.reasons.length > 0);
  assert.ok(overlap.body.detail.reasons.every((r) => typeof r.gate === 'string' && typeof r.detail === 'string'));

  const leak = await call('write', 'POST', '/v1/review/item', {
    id: item.id, item: { ...editable(item), stem: `${item.stem} 정답은 ${item.answer}입니다.` },
  });
  assert.equal(leak.status, 422);
  assert.ok(leak.body.detail.reasons.some((r) => r.gate === 'answer-leak'), JSON.stringify(leak.body.detail));

  const approveBroken = await call('write', 'POST', '/v1/review/verdict', {
    id: item.id, action: 'approve', reviewer: '검토자', item: { ...editable(item), answer: item.distractors[0] },
  });
  assert.equal(approveBroken.status, 422);
  assert.deepEqual(readTree(), before);
  assert.deepEqual(readStatus().reviewed, []);
});

test('게이트를 통과한 수정은 그 문항 하나만 바꾸고 id·다른 문항·다른 파일·포맷을 그대로 둔다', async () => {
  const before = readTree();
  const items = itemsOf(FILE);
  const target = items.find((i) => i.solution.length > 1);
  const save = await call('write', 'POST', '/v1/review/item', {
    id: target.id, item: { ...editable(target), solution: target.solution.slice(0, -1).join('\n') },
  });
  assert.equal(save.status, 200, JSON.stringify(save.body));
  assert.equal(save.body.item.id, target.id);

  const after = readTree();
  for (const [rel, text] of Object.entries(before)) if (rel !== FILE) assert.equal(after[rel], text, rel);
  const parsed = JSON.parse(after[FILE]);
  assert.equal(after[FILE], `${JSON.stringify(parsed, null, 2)}\n`);
  assert.deepEqual(parsed.items.map((i) => i.id), items.map((i) => i.id));
  parsed.items.forEach((item, index) => {
    if (item.id === target.id) {
      assert.deepEqual(item, { ...target, solution: target.solution.slice(0, -1) });
    } else {
      assert.deepEqual(item, items[index]);
    }
  });
});

test('승인은 검토자 이름이 있어야 하고, 승인한 문항만 학습지에 나온다', async () => {
  const [item] = itemsOf(FILE);
  const blank = await call('write', 'POST', '/v1/review/verdict', { id: item.id, action: 'approve', reviewer: '  ' });
  assert.equal(blank.status, 400);
  assert.deepEqual(readStatus().reviewed, []);

  const approved = await call('write', 'POST', '/v1/review/verdict', { id: item.id, action: 'approve', reviewer: '김검토' });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, 'reviewed');
  assert.deepEqual(readStatus().reviewed, [{ id: item.id, reviewer: '김검토', reviewedAt: '2026-11-12' }]);

  const files = reviewedOnly(loadAuthoredCorpus(root), loadReviewStatus(root));
  const registry = createRegistry({ authoredFiles: files });
  assert.deepEqual(registry.all().filter((g) => g.authored).map((g) => g.id), [authoredGeneratorId('korean', CODE)]);
  const worksheet = buildWorksheet(SPINE, registry, {
    subject: 'korean', codes: [CODE], generatorIds: [authoredGeneratorId('korean', CODE)], seed: 'review-admin', count: 1,
  });
  assert.deepEqual(worksheet.items.map((i) => i.params.authoredId), [item.id]);

  const reset = await call('write', 'POST', '/v1/review/verdict', { id: item.id, action: 'reset' });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.status, 'pending');
  assert.deepEqual(readStatus().reviewed, []);
});

test('고친 뒤 승인은 저장과 승인을 함께 하고, 빼기는 문항을 지우지 않고 제외로 표시하며 되돌릴 수 있다', async () => {
  const items = itemsOf(FILE);
  const target = items.filter((i) => i.solution.length > 1)[1];
  const fixed = await call('write', 'POST', '/v1/review/verdict', {
    id: target.id, action: 'approve', reviewer: '김검토', item: { ...editable(target), solution: target.solution.slice(0, 1) },
  });
  assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
  assert.equal(fixed.body.saved, true);
  assert.deepEqual(itemsOf(FILE).find((i) => i.id === target.id).solution, target.solution.slice(0, 1));
  assert.deepEqual(readStatus().reviewed.map((e) => e.id), [target.id]);

  const other = items.find((i) => i.id !== target.id);
  const excluded = await call('write', 'POST', '/v1/review/verdict', {
    id: other.id, action: 'exclude', reviewer: '김검토', reason: '정답이 둘',
  });
  assert.equal(excluded.status, 200);
  assert.equal(excluded.body.status, 'excluded');
  assert.deepEqual(readStatus().excluded, [{ id: other.id, reviewer: '김검토', excludedAt: '2026-11-12', reason: '정답이 둘' }]);
  assert.ok(itemsOf(FILE).some((i) => i.id === other.id), '빼기는 문항을 지우지 않는다');
  const files = reviewedOnly(loadAuthoredCorpus(root), loadReviewStatus(root));
  assert.ok(!files.flatMap((f) => f.items.map((i) => i.id)).includes(other.id));

  // 제외한 문항을 승인하면 제외에서 빠지고 검토 완료가 된다.
  await call('write', 'POST', '/v1/review/verdict', { id: other.id, action: 'approve', reviewer: '김검토' });
  assert.equal(readStatus().excluded, undefined);
  for (const id of [target.id, other.id]) {
    assert.equal((await call('write', 'POST', '/v1/review/verdict', { id, action: 'reset' })).status, 200);
  }
  assert.deepEqual(readStatus(), { schema: 'digi-mon/authored-review-status@1', reviewed: [] });
});

test('목록은 offset 으로 500문항 뒤까지 넘겨 볼 수 있고 한 번에 500문항까지만 준다', async () => {
  const total = loadAuthoredCorpus(root).reduce((n, f) => n + f.items.length, 0);
  assert.ok(total > 1000, `코퍼스가 500문항 페이지 두 개보다 커야 한다: ${total}`);
  const capped = await call('readOnly', 'GET', '/v1/review/items?limit=550');
  assert.equal(capped.body.items.length, 500);
  const ids = [];
  for (let offset = 0; offset < total; offset += 500) {
    const page = await call('readOnly', 'GET', `/v1/review/items?offset=${offset}&limit=500`);
    assert.equal(page.status, 200);
    assert.equal(page.body.offset, offset);
    ids.push(...page.body.items.map((i) => i.id));
  }
  assert.equal(ids.length, total);
  assert.equal(new Set(ids).size, total);
  assert.deepEqual(ids.slice(0, 500), capped.body.items.map((i) => i.id));
});

test('지문 중복은 같은 성취기준 안에서만 막는다: 다른 성취기준과 지문이 같은 문항도 고쳐 저장된다', async () => {
  const corpus = loadAuthoredCorpus(root);
  const owner = corpus.find((f) => f.items.some((i) => i.id === '02ee7ef6f527'));
  const cat = owner.items.find((i) => i.id === '02ee7ef6f527');
  const elsewhere = corpus.filter((f) => f !== owner && f.items.some((i) => i.stem === cat.stem));
  assert.ok(elsewhere.length > 0, '다른 성취기준에도 같은 지문이 있어야 이 테스트가 뜻이 있다');
  const rel = path.relative(root, authoredFilePath(owner.subject, owner.standardCode, root));
  const before = readFileSync(path.join(root, rel), 'utf8');

  const same = await call('write', 'POST', '/v1/review/item', { id: cat.id, item: editable(cat) });
  assert.equal(same.status, 200, JSON.stringify(same.body));
  assert.equal(readFileSync(path.join(root, rel), 'utf8'), before, '그대로 다시 저장하면 파일이 바뀌지 않는다');

  const solution = [...cat.solution, '낱말을 소리 내어 읽어 본다.'];
  const fixed = await call('write', 'POST', '/v1/review/item', { id: cat.id, item: { ...editable(cat), solution } });
  assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
  assert.deepEqual(itemsOf(rel).find((i) => i.id === cat.id).solution, solution);
  writeFileSync(path.join(root, rel), before);
});

test('같은 성취기준 안의 지문 중복은 여전히 거절한다', async () => {
  const before = readTree();
  const [first, second] = itemsOf(FILE);
  const dup = await call('write', 'POST', '/v1/review/item', { id: first.id, item: { ...editable(first), stem: second.stem } });
  assert.equal(dup.status, 422);
  assert.ok(dup.body.detail.reasons.some((r) => r.gate === 'duplicate'), JSON.stringify(dup.body.detail));
  assert.deepEqual(readTree(), before);
});

test('성질: 코퍼스의 모든 기존 문항은 그대로 다시 저장하면 게이트를 통과하고 내용이 바뀌지 않는다', () => {
  const standards = new Map(SPINE.standards.map((s) => [s.code, s]));
  const failures = [];
  let checked = 0;
  for (const file of loadAuthoredCorpus(AUTHORED_ROOT)) {
    for (const item of file.items) {
      const { entry, reasons } = reviewAdmin.checkEdit(file, item, { ...editable(item), difficulty: item.difficulty }, standards.get(file.standardCode));
      checked += 1;
      if (reasons.length > 0) failures.push({ id: item.id, standard: file.standardCode, reasons });
      else assert.deepEqual(entry, item, item.id);
    }
  }
  assert.ok(checked > 3000, `${checked}`);
  assert.deepEqual(failures.slice(0, 5), [], `${failures.length}문항이 그대로 다시 저장되지 않는다`);
});

test('검토 상태 파일의 excluded 도 스키마를 검사한다', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'digimon-review-excluded-'));
  const write = (status) => writeFileSync(path.join(dir, AUTHORED_REVIEW_FILE), JSON.stringify(status));
  const schema = 'digi-mon/authored-review-status@1';
  const excludedEntry = { id: 'aaaaaaaaaaaa', reviewer: 'x', excludedAt: '2026-11-12' };
  try {
    write({ schema, reviewed: [], excluded: [excludedEntry] });
    assert.doesNotThrow(() => loadReviewStatus(dir));
    write({ schema, reviewed: [], excluded: [{ ...excludedEntry, reviewer: '' }] });
    assert.throws(() => loadReviewStatus(dir), /reviewer/);
    write({ schema, reviewed: [], excluded: [{ ...excludedEntry, excludedAt: '11/12' }] });
    assert.throws(() => loadReviewStatus(dir), /excludedAt/);
    write({ schema, reviewed: [{ id: 'aaaaaaaaaaaa', reviewer: 'x', reviewedAt: '2026-11-12' }], excluded: [excludedEntry] });
    assert.throws(() => loadReviewStatus(dir), /함께/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
