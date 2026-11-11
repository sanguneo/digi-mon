import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { loadSpine } from '../../src/authoring/pipeline.mjs';
import {
  AUTHORED_REVIEW_FILE,
  AUTHORED_ROOT,
  authoredFilePath,
  authoredGeneratorId,
  authoredRevision,
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

/** 지금 디스크에 있는 문항의 내용 버전. 화면이 상세를 열어 받은 값과 같다. */
const revisionOf = (id) => authoredRevision(loadAuthoredCorpus(root).flatMap((f) => f.items).find((i) => i.id === id));

/** 쓰기 요청. revision 을 따로 주지 않으면 지금 내용의 버전(방금 연 화면)을 붙인다. */
const post = (pathname, body) => call('write', 'POST', pathname, 'revision' in body ? body : { ...body, revision: revisionOf(body.id) });

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
  const overlap = await post('/v1/review/item', {
    id: item.id, item: { ...editable(item), answer: item.distractors[0] },
  });
  assert.equal(overlap.status, 422);
  assert.ok(overlap.body.detail.reasons.length > 0);
  assert.ok(overlap.body.detail.reasons.every((r) => typeof r.gate === 'string' && typeof r.detail === 'string'));

  const leak = await post('/v1/review/item', {
    id: item.id, item: { ...editable(item), stem: `${item.stem} 정답은 ${item.answer}입니다.` },
  });
  assert.equal(leak.status, 422);
  assert.ok(leak.body.detail.reasons.some((r) => r.gate === 'answer-leak'), JSON.stringify(leak.body.detail));

  const approveBroken = await post('/v1/review/verdict', {
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
  const save = await post('/v1/review/item', {
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
  const blank = await post('/v1/review/verdict', { id: item.id, action: 'approve', reviewer: '  ' });
  assert.equal(blank.status, 400);
  assert.deepEqual(readStatus().reviewed, []);

  const approved = await post('/v1/review/verdict', { id: item.id, action: 'approve', reviewer: '김검토' });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, 'reviewed');
  assert.deepEqual(readStatus().reviewed, [{ id: item.id, reviewer: '김검토', reviewedAt: '2026-11-12', revision: authoredRevision(item) }]);

  const files = reviewedOnly(loadAuthoredCorpus(root), loadReviewStatus(root));
  const registry = createRegistry({ authoredFiles: files });
  assert.deepEqual(registry.all().filter((g) => g.authored).map((g) => g.id), [authoredGeneratorId('korean', CODE)]);
  const worksheet = buildWorksheet(SPINE, registry, {
    subject: 'korean', codes: [CODE], generatorIds: [authoredGeneratorId('korean', CODE)], seed: 'review-admin', count: 1,
  });
  assert.deepEqual(worksheet.items.map((i) => i.params.authoredId), [item.id]);

  const reset = await post('/v1/review/verdict', { id: item.id, action: 'reset' });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.status, 'pending');
  assert.deepEqual(readStatus().reviewed, []);
});

test('고친 뒤 승인은 저장과 승인을 함께 하고, 빼기는 문항을 지우지 않고 제외로 표시하며 되돌릴 수 있다', async () => {
  const items = itemsOf(FILE);
  const target = items.filter((i) => i.solution.length > 1)[1];
  const fixed = await post('/v1/review/verdict', {
    id: target.id, action: 'approve', reviewer: '김검토', item: { ...editable(target), solution: target.solution.slice(0, 1) },
  });
  assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
  assert.equal(fixed.body.saved, true);
  assert.deepEqual(itemsOf(FILE).find((i) => i.id === target.id).solution, target.solution.slice(0, 1));
  assert.deepEqual(readStatus().reviewed.map((e) => e.id), [target.id]);

  const other = items.find((i) => i.id !== target.id);
  const excluded = await post('/v1/review/verdict', {
    id: other.id, action: 'exclude', reviewer: '김검토', reason: '정답이 둘',
  });
  assert.equal(excluded.status, 200);
  assert.equal(excluded.body.status, 'excluded');
  assert.deepEqual(readStatus().excluded, [{ id: other.id, reviewer: '김검토', excludedAt: '2026-11-12', reason: '정답이 둘' }]);
  assert.ok(itemsOf(FILE).some((i) => i.id === other.id), '빼기는 문항을 지우지 않는다');
  const files = reviewedOnly(loadAuthoredCorpus(root), loadReviewStatus(root));
  assert.ok(!files.flatMap((f) => f.items.map((i) => i.id)).includes(other.id));

  // 제외한 문항을 승인하면 제외에서 빠지고 검토 완료가 된다.
  await post('/v1/review/verdict', { id: other.id, action: 'approve', reviewer: '김검토' });
  assert.equal(readStatus().excluded, undefined);
  for (const id of [target.id, other.id]) {
    assert.equal((await post('/v1/review/verdict', { id, action: 'reset' })).status, 200);
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

  const same = await post('/v1/review/item', { id: cat.id, item: editable(cat) });
  assert.equal(same.status, 200, JSON.stringify(same.body));
  assert.equal(readFileSync(path.join(root, rel), 'utf8'), before, '그대로 다시 저장하면 파일이 바뀌지 않는다');

  const solution = [...cat.solution, '낱말을 소리 내어 읽어 본다.'];
  const fixed = await post('/v1/review/item', { id: cat.id, item: { ...editable(cat), solution } });
  assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
  assert.deepEqual(itemsOf(rel).find((i) => i.id === cat.id).solution, solution);
  writeFileSync(path.join(root, rel), before);
});

test('같은 성취기준 안의 지문 중복은 여전히 거절한다', async () => {
  const before = readTree();
  const [first, second] = itemsOf(FILE);
  const dup = await post('/v1/review/item', { id: first.id, item: { ...editable(first), stem: second.stem } });
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

test('검토 쓰기는 JSON 이 아니면 토큰이 있어도 415로 막고 아무것도 바꾸지 않는다', async () => {
  const before = readTree();
  const status = readStatus();
  const { items } = (await call('write', 'GET', '/v1/review/items?limit=1')).body;
  for (const [pathname, type] of [
    ['/v1/review/verdict', 'text/plain'],
    ['/v1/review/verdict', 'application/x-www-form-urlencoded'],
    ['/v1/review/item', 'text/plain'],
    ['/v1/review/verdict', null],
  ]) {
    const response = await fetch(`${servers.write.url}${pathname}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, ...(type ? { 'content-type': type } : {}) },
      body: JSON.stringify({ id: items[0].id, action: 'reject', reviewer: '위조', reason: 'csrf' }),
    });
    assert.equal(response.status, 415, `${pathname} ${type}`);
  }
  assert.deepEqual(readTree(), before);
  assert.deepEqual(readStatus(), status);
});

/** 이 테스트가 쓴 문항 파일과 검토 상태를 테스트 전 그대로 되돌린다. 뒤 테스트가 빈 상태를 가정한다. */
function restoring(run) {
  const tree = readTree();
  const status = readFileSync(path.join(root, AUTHORED_REVIEW_FILE), 'utf8');
  return Promise.resolve().then(run).finally(() => {
    for (const [rel, text] of Object.entries(tree)) writeFileSync(path.join(root, rel), text);
    writeFileSync(path.join(root, AUTHORED_REVIEW_FILE), status);
  });
}

/** 서버를 다시 켠 것처럼 디스크에서 새로 읽어 학습지를 만든다. 그 성취기준 문항을 모두 뽑는다. */
function worksheetIdsAfterRestart() {
  const files = reviewedOnly(loadAuthoredCorpus(root), loadReviewStatus(root));
  const registry = createRegistry({ authoredFiles: files });
  const generatorId = authoredGeneratorId('korean', CODE);
  if (!registry.all().some((g) => g.id === generatorId)) return [];
  const count = files.find((f) => f.standardCode === CODE).items.length;
  const worksheet = buildWorksheet(SPINE, registry, {
    subject: 'korean', codes: [CODE], generatorIds: [generatorId], seed: 'restart', count,
  });
  return [...new Set(worksheet.items.map((i) => i.params.authoredId))].sort();
}

test('회귀: 승인한 문항을 고쳐 그냥 저장하면 승인이 풀려, 서버를 다시 켜도 학습지에 나가지 않는다', () => restoring(async () => {
  const target = itemsOf(FILE).find((i) => i.solution.length > 1);
  assert.equal((await post('/v1/review/verdict', { id: target.id, action: 'approve', reviewer: '김검토' })).status, 200);
  assert.deepEqual(worksheetIdsAfterRestart(), [target.id]);

  const save = await post('/v1/review/item', {
    id: target.id, item: { ...editable(target), solution: target.solution.slice(0, -1).join('\n') },
  });
  assert.equal(save.status, 200, JSON.stringify(save.body));
  assert.equal(save.body.status, 'pending');
  assert.equal(save.body.unapproved, true);
  assert.equal(save.body.statusEntry, null);
  assert.deepEqual(readStatus().reviewed, []);
  assert.deepEqual(worksheetIdsAfterRestart(), [], '고친 내용이 새 승인 없이 학습지에 나갔다');
}));

test('승인한 문항을 내용 그대로(공백만 다르게) 저장하면 승인을 유지한다', () => restoring(async () => {
  const [item] = itemsOf(FILE);
  await post('/v1/review/verdict', { id: item.id, action: 'approve', reviewer: '김검토' });
  const fields = editable(item);
  const same = await post('/v1/review/item', {
    id: item.id, item: { ...fields, stem: `  ${fields.stem}  `, solution: `${fields.solution.join('\n\n')}\n` },
  });
  assert.equal(same.status, 200, JSON.stringify(same.body));
  assert.equal(same.body.status, 'reviewed');
  assert.equal(same.body.unapproved, false);
  assert.deepEqual(readStatus().reviewed, [{ id: item.id, reviewer: '김검토', reviewedAt: '2026-11-12', revision: authoredRevision(item) }]);
  assert.deepEqual(worksheetIdsAfterRestart(), [item.id]);
}));

test('고친 뒤 승인은 이미 승인된 문항이어도 새 검토자·날짜로 승인을 갈아 쓴다', () => restoring(async () => {
  const target = itemsOf(FILE).find((i) => i.solution.length > 1);
  await post('/v1/review/verdict', { id: target.id, action: 'approve', reviewer: '김검토' });
  const later = reviewAdmin.createReviewAdmin({ spine: SPINE, root, writeEnabled: true, now: () => new Date(2026, 10, 20) });
  const verdict = later.routes.find((r) => r.method === 'POST' && r.path === '/v1/review/verdict');
  const result = verdict.handle({
    id: target.id, revision: authoredRevision(target), action: 'approve', reviewer: '박검토',
    item: { ...editable(target), solution: target.solution.slice(0, 1) },
  });
  assert.equal(result.status, 'reviewed');
  const fixed = { ...target, solution: target.solution.slice(0, 1) };
  assert.deepEqual(readStatus().reviewed, [{ id: target.id, reviewer: '박검토', reviewedAt: '2026-11-20', revision: authoredRevision(fixed) }]);
  assert.equal(result.revision, authoredRevision(fixed));
  assert.deepEqual(worksheetIdsAfterRestart(), [target.id]);
  assert.deepEqual(itemsOf(FILE).find((i) => i.id === target.id).solution, target.solution.slice(0, 1));
}));

const openItem = async (id) => (await call('write', 'GET', `/v1/review/item?id=${id}`)).body;

test('회귀: 탭 A 가 연 뒤 탭 B 가 고치면, A 의 무변경 승인은 409 로 거절되고 B 의 내용은 승인되지 않는다', () => restoring(async () => {
  const target = itemsOf(FILE).find((i) => i.solution.length > 1);
  const tabA = await openItem(target.id);
  const tabB = await openItem(target.id);
  assert.equal(tabA.revision, authoredRevision(target));
  assert.equal(tabB.revision, tabA.revision);

  const edited = { ...editable(target), stem: `${target.stem} 그리고 집에 갔습니다.` };
  const saveB = await post('/v1/review/item', { id: target.id, revision: tabB.revision, item: edited });
  assert.equal(saveB.status, 200, JSON.stringify(saveB.body));
  assert.notEqual(saveB.body.revision, tabA.revision);

  const approveA = await post('/v1/review/verdict', { id: target.id, revision: tabA.revision, action: 'approve', reviewer: '김검토' });
  assert.equal(approveA.status, 409, JSON.stringify(approveA.body));
  assert.equal(approveA.body.detail.current.revision, saveB.body.revision);
  assert.equal(approveA.body.detail.current.item.stem, edited.stem);
  assert.deepEqual(readStatus().reviewed, []);
  assert.deepEqual(worksheetIdsAfterRestart(), [], 'A 가 보지 못한 B 의 내용이 승인됐다');

  // 두 검토자가 같은 문항을 고쳐 저장해도 나중 사람이 앞사람 수정을 모르고 덮어쓰지 못한다.
  const saveA = await post('/v1/review/item', { id: target.id, revision: tabA.revision, item: { ...editable(target), answer: target.answer } });
  assert.equal(saveA.status, 409);
  assert.equal(itemsOf(FILE).find((i) => i.id === target.id).stem, edited.stem);

  // A 가 최신 내용을 받아 본 뒤 승인하면 그 내용으로 승인된다.
  const approveAgain = await post('/v1/review/verdict', {
    id: target.id, revision: approveA.body.detail.current.revision, action: 'approve', reviewer: '김검토',
  });
  assert.equal(approveAgain.status, 200, JSON.stringify(approveAgain.body));
  assert.deepEqual(readStatus().reviewed, [{ id: target.id, reviewer: '김검토', reviewedAt: '2026-11-12', revision: saveB.body.revision }]);
  assert.deepEqual(worksheetIdsAfterRestart(), [target.id]);
}));

test('모든 쓰기 경로는 낡은 revision 이면 409, 없으면 400 이고 아무것도 바꾸지 않는다', () => restoring(async () => {
  const [item, other] = itemsOf(FILE);
  // item 은 승인된 상태에서 시작해 되돌리기도 뜻이 있게 한다.
  assert.equal((await post('/v1/review/verdict', { id: item.id, action: 'approve', reviewer: '김검토' })).status, 200);
  const stale = authoredRevision(other);
  const writes = [
    ['저장', '/v1/review/item', { item: { ...editable(item), stem: `${item.stem} 다시` } }],
    ['승인', '/v1/review/verdict', { action: 'approve', reviewer: '김검토' }],
    ['고친 뒤 승인', '/v1/review/verdict', { action: 'approve', reviewer: '김검토', item: { ...editable(item), stem: `${item.stem} 다시` } }],
    ['빼기', '/v1/review/verdict', { action: 'exclude', reviewer: '김검토', reason: '낡은 화면' }],
    ['되돌리기', '/v1/review/verdict', { action: 'reset' }],
  ];
  const before = readTree();
  const status = readStatus();
  for (const [name, pathname, body] of writes) {
    const staleWrite = await post(pathname, { id: item.id, revision: stale, ...body });
    assert.equal(staleWrite.status, 409, `${name}: ${JSON.stringify(staleWrite.body)}`);
    assert.equal(staleWrite.body.detail.current.revision, authoredRevision(item), name);
    for (const revision of [undefined, '', 'nope']) {
      const missing = await call('write', 'POST', pathname, { id: item.id, ...body, ...(revision === undefined ? {} : { revision }) });
      assert.equal(missing.status, 400, `${name} revision=${revision}`);
      assert.match(missing.body.error, /revision/);
    }
  }
  assert.deepEqual(readTree(), before);
  assert.deepEqual(readStatus(), status);
}));

test('승인한 뒤 문항 파일을 손으로 고치면 승인이 저절로 풀리고, 지금 내용을 다시 승인해야 학습지에 나간다', () => restoring(async () => {
  const target = itemsOf(FILE).find((i) => i.solution.length > 1);
  assert.equal((await post('/v1/review/verdict', { id: target.id, action: 'approve', reviewer: '김검토' })).status, 200);
  assert.deepEqual(worksheetIdsAfterRestart(), [target.id]);

  const file = JSON.parse(readFileSync(path.join(root, FILE), 'utf8'));
  file.items = file.items.map((i) => (i.id === target.id ? { ...i, answer: i.distractors[0], distractors: [i.answer, ...i.distractors.slice(1)] } : i));
  writeFileSync(path.join(root, FILE), `${JSON.stringify(file, null, 2)}\n`);
  assert.equal(readStatus().reviewed.length, 1, '상태 파일은 그대로다');
  assert.deepEqual(worksheetIdsAfterRestart(), [], '손으로 고친 내용이 옛 승인으로 학습지에 나갔다');

  const opened = await openItem(target.id);
  assert.equal(opened.status, 'pending');
  assert.equal(opened.staleApproval, true);
  const listed = await call('write', 'GET', `/v1/review/items?standard=${encodeURIComponent(CODE)}&status=reviewed`);
  assert.equal(listed.body.matched, 0);

  const approved = await post('/v1/review/verdict', { id: target.id, revision: opened.revision, action: 'approve', reviewer: '박검토' });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.staleApproval, false);
  assert.deepEqual(worksheetIdsAfterRestart(), [target.id]);
}));

/** 결정적 의사 난수(mulberry32). 실패하면 seed 로 같은 순서를 다시 돌린다. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('성질: 두 탭·손 편집이 섞여 어떤 순서로 저장·승인·고친 뒤 승인·빼기·되돌리기를 해도 학습지에 나가는 문항 = 현재 내용으로 승인된 문항', () => {
  const mini = mkdtempSync(path.join(os.tmpdir(), 'digimon-review-prop-'));
  try {
    mkdirSync(path.join(mini, 'korean'));
    cpSync(path.join(AUTHORED_ROOT, FILE), path.join(mini, FILE));
    const pristine = readFileSync(path.join(mini, FILE), 'utf8');
    const ids = JSON.parse(pristine).items.slice(0, 3).map((i) => i.id);
    const content = (item) => ({ ...editable(item), difficulty: item.difficulty });
    const same = (a, b) => JSON.stringify(content(a)) === JSON.stringify(content(b));
    const current = () => new Map(JSON.parse(readFileSync(path.join(mini, FILE), 'utf8')).items.map((i) => [i.id, i]));
    const variant = (item, n) => ({ ...editable(item), solution: [...item.solution.filter((s) => !s.startsWith('다시 읽어 확인한다')), `다시 읽어 확인한다 ${n}.`] });
    /** 서버를 거치지 않고 문항 파일을 손으로 고친다. */
    const handEdit = (id, n) => {
      const file = JSON.parse(readFileSync(path.join(mini, FILE), 'utf8'));
      file.items = file.items.map((i) => (i.id === id ? { ...i, ...variant(i, n) } : i));
      writeFileSync(path.join(mini, FILE), `${JSON.stringify(file, null, 2)}\n`);
    };
    const disk = () => [FILE, AUTHORED_REVIEW_FILE].map((rel) => readFileSync(path.join(mini, rel), 'utf8'));
    let ops = 0;
    let rejected = 0;
    for (let seed = 1; seed <= 25; seed += 1) {
      writeFileSync(path.join(mini, FILE), pristine);
      writeFileSync(path.join(mini, AUTHORED_REVIEW_FILE), JSON.stringify({ schema: 'digi-mon/authored-review-status@1', reviewed: [] }));
      let day = 1;
      const admin = reviewAdmin.createReviewAdmin({ spine: SPINE, root: mini, writeEnabled: true, now: () => new Date(2026, 10, day) });
      const route = (p) => admin.routes.find((r) => r.method === 'POST' && r.path === p).handle;
      const random = rng(seed);
      const pick = (list) => list[Math.floor(random() * list.length)];
      const log = [];
      // 모델: 승인한 그 순간의 내용. 학습지에는 승인 내용과 지금 내용이 같은 문항만 나간다.
      const approvals = new Map();
      // 다른 탭(B)이 예전에 열어 둔 내용 버전.
      const tabB = new Map();
      for (let step = 0; step < 20; step += 1) {
        day = step + 1;
        const id = pick(ids);
        const item = current().get(id);
        const kind = pick(['open-b', 'hand-edit', 'save-edit', 'save-same', 'save-space', 'approve', 'approve-edit', 'exclude', 'reset']);
        const n = 1 + Math.floor(random() * 3);
        const fromB = tabB.has(id) && random() < 0.5;
        const revision = fromB ? tabB.get(id) : authoredRevision(item);
        const stale = revision !== authoredRevision(item);
        log.push(`${fromB ? 'B ' : ''}${kind}${stale ? '(낡은 버전)' : ''}:${id}`);
        const where = `seed ${seed}: ${log.join(' → ')}`;
        ops += 1;
        if (kind === 'open-b') tabB.set(id, authoredRevision(item));
        else if (kind === 'hand-edit') handEdit(id, n);
        else {
          const send = () => {
            if (kind === 'save-edit') route('/v1/review/item')({ id, revision, item: variant(item, n) });
            if (kind === 'save-same') route('/v1/review/item')({ id, revision, item: editable(item) });
            if (kind === 'save-space') route('/v1/review/item')({ id, revision, item: { ...editable(item), instruction: ` ${item.instruction}\r\n` } });
            if (kind === 'approve') route('/v1/review/verdict')({ id, revision, action: 'approve', reviewer: `r${step}` });
            if (kind === 'approve-edit') route('/v1/review/verdict')({ id, revision, action: 'approve', reviewer: `r${step}`, item: variant(item, n) });
            if (kind === 'exclude') route('/v1/review/verdict')({ id, revision, action: 'exclude', reviewer: `r${step}` });
            if (kind === 'reset') route('/v1/review/verdict')({ id, revision, action: 'reset' });
          };
          if (stale) {
            // 그사이 바뀐 내용을 못 본 요청: 409 와 최신 내용, 아무것도 쓰지 않는다.
            const before = disk();
            assert.throws(send, (e) => e.status === 409 && e.detail.current.revision === authoredRevision(item), where);
            assert.deepEqual(disk(), before, where);
            rejected += 1;
          } else {
            send();
            const after = current().get(id);
            if (kind.startsWith('approve')) approvals.set(id, { item: after, reviewer: `r${step}`, day });
            else if (kind === 'exclude' || kind === 'reset') approvals.delete(id);
            else if (approvals.has(id) && !same(approvals.get(id).item, after)) approvals.delete(id);
          }
        }

        const now = current();
        const shipped = reviewedOnly(loadAuthoredCorpus(mini), loadReviewStatus(mini)).flatMap((f) => f.items);
        const expected = [...approvals].filter(([key, a]) => same(a.item, now.get(key))).map(([key]) => key);
        assert.deepEqual(shipped.map((i) => i.id).sort(), expected.sort(), where);
        for (const shippedItem of shipped) {
          assert.deepEqual(content(shippedItem), content(approvals.get(shippedItem.id).item), `승인 뒤 바뀐 내용이 나간다 ${where}`);
        }
        const entries = JSON.parse(readFileSync(path.join(mini, AUTHORED_REVIEW_FILE), 'utf8')).reviewed;
        assert.deepEqual(entries.map((e) => e.id).sort(), [...approvals.keys()].sort(), where);
        for (const entry of entries) {
          const approval = approvals.get(entry.id);
          assert.equal(entry.reviewer, approval.reviewer, where);
          assert.equal(entry.reviewedAt, `2026-11-${String(approval.day).padStart(2, '0')}`, where);
          assert.equal(entry.revision, authoredRevision(approval.item), where);
        }
      }
    }
    assert.equal(ops, 500);
    assert.ok(rejected > 20, `낡은 버전 요청이 충분히 섞여야 한다: ${rejected}`);
  } finally {
    rmSync(mini, { recursive: true, force: true });
  }
});
