import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSpine } from '../../src/authoring/pipeline.mjs';
import {
  AUTHORED_REVIEW_FILE,
  AUTHORED_REVIEW_SCHEMA,
  authoredGeneratorId,
  loadAuthoredCorpus,
  loadReviewStatus,
  reviewedOnly,
} from '../../src/generators/authored.mjs';
import { createRegistry } from '../../src/engine/registry.mjs';
import { buildWorksheet } from '../../src/engine/worksheet.mjs';

/**
 * AI 작성 문항은 사람이 검토해 data/authored/review-status.json 에 올린 것만 생성에 나간다.
 * docs/authored-review-queue.md 가 검토 순서와 상태를 바꾸는 법을 적는다.
 */
const SPINE = loadSpine();
const CORPUS = loadAuthoredCorpus();
const isAuthoredItem = (item) => item.params?.authoredId !== undefined || String(item.dedupeKey).startsWith('authored:');

/** 성취기준마다 학습지를 뽑아 나온 AI 작성 문항 id 를 모은다. */
const authoredIdsInWorksheets = (registry, files) => {
  const ids = [];
  for (const file of files) {
    for (const seed of ['review-gate-a', 'review-gate-b']) {
      const worksheet = buildWorksheet(SPINE, registry, { subject: file.subject, codes: [file.standardCode], seed, count: 10 });
      for (const item of worksheet.items.filter(isAuthoredItem)) ids.push(item.params.authoredId);
    }
  }
  return ids;
};

test('기본 레지스트리와 학습지에는 저장소에서 검토 완료된 AI 작성 문항만 나온다', () => {
  const reviewedIds = loadReviewStatus();
  const reviewedFiles = reviewedOnly(CORPUS, reviewedIds);
  const registry = createRegistry();
  assert.deepEqual(
    registry.all().filter((g) => g.authored).map((g) => g.id).sort(),
    reviewedFiles.map((f) => authoredGeneratorId(f.subject, f.standardCode)).sort(),
  );
  const leaked = authoredIdsInWorksheets(registry, CORPUS).filter((id) => !reviewedIds.has(id));
  assert.deepEqual(leaked, []);
});

test('저장소의 검토 상태 목록은 스키마를 따르고 코퍼스에 있는 문항만 가리킨다', () => {
  assert.doesNotThrow(() => reviewedOnly(CORPUS, loadReviewStatus()));
});

const withStatus = (reviewed, run) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'digimon-review-'));
  try {
    const file = CORPUS.find((f) => f.standardCode === '[4국02-04]');
    mkdirSync(path.join(root, file.subject));
    writeFileSync(path.join(root, file.subject, 'k4-02-04.json'), JSON.stringify(file));
    writeFileSync(path.join(root, AUTHORED_REVIEW_FILE), JSON.stringify({ schema: AUTHORED_REVIEW_SCHEMA, reviewed }));
    return run(root, file);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('검토 완료가 0개면 AI 작성 생성기도 없고 학습지에 AI 작성 문항이 나오지 않는다', () => {
  withStatus([], (root, file) => {
    const files = reviewedOnly(loadAuthoredCorpus(root), loadReviewStatus(root));
    assert.deepEqual(files, []);
    const registry = createRegistry({ authoredFiles: files });
    assert.deepEqual(registry.all().filter((g) => g.authored).map((g) => g.id), []);
    assert.deepEqual(authoredIdsInWorksheets(registry, [file]), []);
  });
});

test('검토 완료가 1개면 그 문항 하나만 학습지에 나온다', () => {
  const [only] = CORPUS.find((f) => f.standardCode === '[4국02-04]').items;
  withStatus([{ id: only.id, reviewer: 'test', reviewedAt: '2026-11-11' }], (root, file) => {
    const files = reviewedOnly(loadAuthoredCorpus(root), loadReviewStatus(root));
    const registry = createRegistry({ authoredFiles: files });
    assert.deepEqual(registry.all().filter((g) => g.authored).map((g) => g.id), [authoredGeneratorId('korean', '[4국02-04]')]);
    const ids = authoredIdsInWorksheets(registry, [file]);
    assert.ok(ids.length > 0);
    assert.deepEqual(new Set(ids), new Set([only.id]));
  });
});

test('검토 완료로 바꾼 문항만 학습지에 나오고 나머지는 여전히 빠진다', () => {
  const [first, second] = CORPUS.find((f) => f.standardCode === '[4국02-04]').items;
  const reviewed = [first.id, second.id].map((id) => ({ id, reviewer: 'test', reviewedAt: '2026-11-11' }));
  withStatus(reviewed, (root) => {
    const files = reviewedOnly(loadAuthoredCorpus(root), loadReviewStatus(root));
    assert.deepEqual(files.flatMap((f) => f.items.map((i) => i.id)), [first.id, second.id]);
    const registry = createRegistry({ authoredFiles: files });
    const generatorId = authoredGeneratorId('korean', '[4국02-04]');
    const worksheet = buildWorksheet(SPINE, registry, {
      subject: 'korean', codes: ['[4국02-04]'], generatorIds: [generatorId], seed: 'reviewed', count: 2,
    });
    assert.equal(worksheet.produced, 2);
    assert.deepEqual(new Set(worksheet.items.map((i) => i.params.authoredId)), new Set([first.id, second.id]));
  });
});

test('검토 상태 목록이 깨졌거나 없는 문항을 가리키면 생성을 멈춘다', () => {
  withStatus([{ id: 'ffffffffffff', reviewer: 'test', reviewedAt: '2026-11-11' }], (root) => {
    assert.throws(() => reviewedOnly(loadAuthoredCorpus(root), loadReviewStatus(root)), /코퍼스에 없는 id ffffffffffff/);
  });
  withStatus([{ id: 'ffffffffffff', reviewedAt: '2026-11-11' }], (root) => {
    assert.throws(() => loadReviewStatus(root), /reviewer/);
  });
});

test('손으로 만든 국어·영어 생성기는 그대로 학습지를 채운다', () => {
  const registry = createRegistry();
  for (const subject of ['korean', 'english']) {
    const worksheet = buildWorksheet(SPINE, registry, { subject, seed: `review-gate-${subject}`, count: 20 });
    assert.equal(worksheet.produced, 20, subject);
    assert.equal(worksheet.shortfall, 0, subject);
  }
  // AI 작성 코퍼스가 있던 성취기준도 손으로 만든 생성기만으로 문항을 낸다.
  const handmadeOnly = createRegistry({ authoredFiles: [] });
  for (const file of CORPUS) {
    const worksheet = buildWorksheet(SPINE, handmadeOnly, { subject: file.subject, codes: [file.standardCode], seed: 'handmade', count: 3 });
    assert.ok(worksheet.produced > 0, file.standardCode);
    assert.ok(worksheet.items.every((item) => !handmadeOnly.get(item.generatorId).authored), file.standardCode);
  }
});
