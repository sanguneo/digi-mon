/**
 * AI 작성 문항 코퍼스를 생성기로 내는 모듈.
 *
 * 엔진은 실행 중에 네트워크를 쓰지 않는다. AI 는 문항을 쓰는 도구로만 쓴다.
 * bin/ai-generate.mjs 가 후보 문항을 받아 저장소 게이트(문항 계약, 정답 검산,
 * 한국어 표기, 학년 어휘, 정답 노출, GGW 린터)를 통과한 것만
 * data/authored/<교과>/<성취기준>.json 에 쌓는다. 이 모듈은 그 파일을 읽어
 * 성취기준마다 생성기 하나를 만들고, 생성기는 시드 rng 로 코퍼스에서 문항을 뽑는다.
 * 같은 코퍼스와 같은 시드면 같은 문항이 나온다.
 *
 * 코퍼스가 비어 있으면 생성기도 없다. 기존 생성기와 같은 성취기준에 등록되므로
 * 학습지는 두 종류 문항을 함께 낸다.
 *
 * 검토 상태: 게이트를 통과한 문항도 처음에는 '검토 전'이다. 사람이 검토해
 * data/authored/review-status.json 의 reviewed 목록에 올린 문항만 생성기에 들어간다.
 * 리뷰를 돌릴 때마다 정답이 둘로 읽히는 애매한 문항이 새로 나와서, 기계 게이트만으로는
 * 학습지에 내보내지 않기로 했다(docs/authored-review-queue.md).
 *
 * 정답은 표의 사실이므로 verify 가 같은 표를 되읽는다(영어 문장 생성기와 같은 한계).
 * 수학은 이 한계 때문에 받지 않는다. 모델이 준 답을 모델이 준 답으로 검산하면
 * '2 + 2 = □' 의 답을 5로 적어도 통과한다. 정답을 따로 계산하는 검산이 생기기 전까지
 * AI 작성 코퍼스는 국어·영어만 둔다.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChoices } from '../engine/item.mjs';

export const AUTHORED_SCHEMA = 'digi-mon/authored-items@1';
export const AUTHORED_SUBJECTS = ['korean', 'english'];
export const AUTHORED_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'authored');

const SUBJECT_LETTER = { 국: 'k', 영: 'e', 수: 'm' };

/** '[4국02-04]' -> 'k4-02-04'. 파일 이름과 생성기 id 에 쓰는 ASCII 꼴이다. */
export function authoredSlug(code) {
  const m = /^\[(\d)([국영수])(\d{2})-(\d{2})\]$/.exec(code);
  if (!m) throw new Error(`성취기준 코드 형식 오류: ${code}`);
  return `${SUBJECT_LETTER[m[2]]}${m[1]}-${m[3]}-${m[4]}`;
}

export function authoredGeneratorId(subject, code) {
  return `${subject}.authored.${authoredSlug(code)}`;
}

export function authoredFilePath(subject, code, root = AUTHORED_ROOT) {
  return path.join(root, subject, `${authoredSlug(code)}.json`);
}

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * 코퍼스 파일 하나의 모양을 확인한다. 저장소에 들어온 뒤에 손으로 고친 파일도
 * 여기서 걸러야 학습지에 깨진 문항이 나가지 않는다.
 */
export function assertAuthoredFile(file, where = '?') {
  const fail = (msg) => {
    throw new Error(`AI 작성 코퍼스 오류 [${where}]: ${msg}`);
  };
  if (file?.schema !== AUTHORED_SCHEMA) fail(`schema 는 ${AUTHORED_SCHEMA}`);
  if (!AUTHORED_SUBJECTS.includes(file.subject)) fail(`알 수 없는 subject: ${file.subject}`);
  authoredSlug(file.standardCode);
  if (!nonEmpty(file.skill)) fail('skill 이 비었다');
  if (!Array.isArray(file.items) || file.items.length === 0) fail('items 가 비었다');
  const ids = new Set();
  for (const item of file.items) {
    if (!/^[0-9a-f]{12}$/.test(item?.id ?? '')) fail(`id 형식 오류: ${item?.id}`);
    if (ids.has(item.id)) fail(`id 중복: ${item.id}`);
    ids.add(item.id);
    if (![1, 2, 3].includes(item.difficulty)) fail(`${item.id}: difficulty 는 1..3`);
    for (const key of ['instruction', 'stem', 'answer']) {
      if (!nonEmpty(item[key])) fail(`${item.id}: ${key} 가 비었다`);
    }
    if (!Array.isArray(item.distractors) || item.distractors.length !== 3 || !item.distractors.every(nonEmpty)) {
      fail(`${item.id}: distractors 는 비어 있지 않은 문자열 3개`);
    }
    if (new Set([item.answer, ...item.distractors]).size !== 4) fail(`${item.id}: 정답과 오답이 겹친다`);
    if (!Array.isArray(item.solution) || item.solution.length === 0 || !item.solution.every(nonEmpty)) {
      fail(`${item.id}: solution 이 비었다`);
    }
  }
  return file;
}

/** data/authored/<교과>/*.json 을 이름 순서로 읽는다. 폴더가 없으면 빈 코퍼스다. */
export function loadAuthoredCorpus(root = AUTHORED_ROOT) {
  const files = [];
  for (const subject of AUTHORED_SUBJECTS) {
    const dir = path.join(root, subject);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
      const where = `${subject}/${name}`;
      const file = assertAuthoredFile(JSON.parse(readFileSync(path.join(dir, name), 'utf8')), where);
      if (file.subject !== subject) throw new Error(`AI 작성 코퍼스 오류 [${where}]: 폴더와 subject 가 다르다`);
      if (`${authoredSlug(file.standardCode)}.json` !== name) {
        throw new Error(`AI 작성 코퍼스 오류 [${where}]: 파일 이름과 성취기준이 다르다`);
      }
      files.push(file);
    }
  }
  return files;
}

/**
 * 난이도 1·2·3 의 뜻. 작성 프롬프트(src/authoring/prompt.mjs)도 같은 문구로 요청한다.
 * 기계로 재지 못하는 언어적 난이도라 categorical 로 선언한다.
 */
export const AUTHORED_DIFFICULTY_NOTE = '작성 때 매긴 난이도를 따른다. 1은 문장 하나에서 바로 판단하는 문항, 2는 두 가지 단서를 함께 보는 문항, 3은 비슷한 선택지 사이에서 근거를 따져야 하는 문항이다.';

/** 코퍼스 파일 하나를 생성기 하나로 만든다. */
export function authoredGenerator(file) {
  assertAuthoredFile(file, file.standardCode);
  const id = authoredGeneratorId(file.subject, file.standardCode);
  const byId = new Map(file.items.map((item) => [item.id, item]));
  const levels = [...new Set(file.items.map((item) => item.difficulty))].sort();
  const single = levels.length === 1;
  return {
    id,
    standardCode: file.standardCode,
    skill: file.skill,
    format: 'multiple-choice',
    difficultyAxis: single ? 'single' : 'categorical',
    difficulties: levels,
    ...(single ? {} : { difficultyNote: AUTHORED_DIFFICULTY_NOTE }),
    capacityNote: `AI로 작성해 게이트를 통과한 코퍼스 문항 ${file.items.length}개가 상한이다. 문항을 더 쌓으면 늘어난다.`,
    authored: true,
    generate(rng, { difficulty }) {
      const pool = file.items.filter((item) => item.difficulty === difficulty);
      const entry = rng.pick(pool.length > 0 ? pool : file.items);
      return {
        params: { authoredId: entry.id },
        instruction: entry.instruction,
        stem: entry.stem,
        choices: buildChoices(rng, entry.answer, entry.distractors),
        answer: { value: entry.answer, display: entry.answer, accepts: [entry.answer] },
        solution: [...entry.solution],
        dedupeKey: `authored:${entry.id}`,
        difficulty: entry.difficulty,
      };
    },
    verify({ authoredId }, answer) {
      const entry = byId.get(authoredId);
      if (!entry) return false;
      return answer.value === entry.answer && !entry.distractors.includes(answer.value);
    },
  };
}

export function authoredGenerators(files) {
  return files.map(authoredGenerator);
}

export const AUTHORED_REVIEW_SCHEMA = 'digi-mon/authored-review-status@1';
export const AUTHORED_REVIEW_FILE = 'review-status.json';

/** 학습지에 나가는 내용 필드. 이 가운데 하나라도 바뀌면 이전 승인은 이 내용을 본 것이 아니다. */
export const AUTHORED_CONTENT_KEYS = ['difficulty', 'instruction', 'stem', 'answer', 'distractors', 'solution'];

/**
 * 문항 내용 버전. 내용 필드를 정해진 순서로 이은 JSON 의 sha256 앞 16자리다.
 * 승인은 이 값에 붙는다. 파일을 손으로 고쳐도 값이 바뀌어 승인이 저절로 풀린다.
 */
export function authoredRevision(item) {
  const content = JSON.stringify(AUTHORED_CONTENT_KEYS.map((key) => item[key]));
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * 사람이 검토를 마친 문항을 읽는다. 값은 id → 승인한 내용 버전(revision)이다.
 * 목록에 없는 문항은 모두 '검토 전'이다. 파일이 없으면 검토 완료 문항도 없다.
 * revision 이 없는 항목(이전 형식)은 어떤 내용과도 맞지 않아 학습지에 나가지 않는다.
 */
export function loadReviewStatus(root = AUTHORED_ROOT) {
  const file = path.join(root, AUTHORED_REVIEW_FILE);
  if (!existsSync(file)) return new Map();
  const fail = (msg) => {
    throw new Error(`AI 작성 검토 상태 오류 [${AUTHORED_REVIEW_FILE}]: ${msg}`);
  };
  const status = JSON.parse(readFileSync(file, 'utf8'));
  if (status?.schema !== AUTHORED_REVIEW_SCHEMA) fail(`schema 는 ${AUTHORED_REVIEW_SCHEMA}`);
  if (!Array.isArray(status.reviewed)) fail('reviewed 는 배열');
  const ids = new Map();
  for (const entry of status.reviewed) {
    if (!/^[0-9a-f]{12}$/.test(entry?.id ?? '')) fail(`id 형식 오류: ${entry?.id}`);
    if (ids.has(entry.id)) fail(`id 중복: ${entry.id}`);
    if (!nonEmpty(entry.reviewer)) fail(`${entry.id}: reviewer 가 비었다`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt ?? '')) fail(`${entry.id}: reviewedAt 은 YYYY-MM-DD`);
    if (entry.revision !== undefined && !/^[0-9a-f]{16}$/.test(entry.revision)) fail(`${entry.id}: revision 은 16자리 16진수`);
    ids.set(entry.id, entry.revision ?? null);
  }
  // excluded 는 사람이 검토해 학습지에서 뺀 문항이다. 문항은 지우지 않고 여기 표시만 한다.
  // 없어도 된다(이전 파일). 검토 완료와 제외에 동시에 오를 수는 없다.
  if (status.excluded !== undefined) {
    if (!Array.isArray(status.excluded)) fail('excluded 는 배열');
    const excluded = new Set();
    for (const entry of status.excluded) {
      if (!/^[0-9a-f]{12}$/.test(entry?.id ?? '')) fail(`excluded id 형식 오류: ${entry?.id}`);
      if (excluded.has(entry.id)) fail(`excluded id 중복: ${entry.id}`);
      if (ids.has(entry.id)) fail(`${entry.id}: reviewed 와 excluded 에 함께 있다`);
      if (!nonEmpty(entry.reviewer)) fail(`${entry.id}: reviewer 가 비었다`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.excludedAt ?? '')) fail(`${entry.id}: excludedAt 은 YYYY-MM-DD`);
      excluded.add(entry.id);
    }
  }
  return ids;
}

/**
 * 코퍼스에서 검토 완료 문항만 남긴다. 승인한 내용 버전과 지금 내용 버전이 같아야 검토 완료다.
 * 남는 문항이 없는 파일은 뺀다. 코퍼스에 없는 id 가 목록에 있으면 오타나 지워진 문항이므로 멈춘다.
 * @param {Map<string, string | null>} reviewed loadReviewStatus 의 결과
 */
export function reviewedOnly(files, reviewed) {
  const known = new Set(files.flatMap((file) => file.items.map((item) => item.id)));
  const unknown = [...reviewed.keys()].filter((id) => !known.has(id));
  if (unknown.length > 0) throw new Error(`AI 작성 검토 상태 오류: 코퍼스에 없는 id ${unknown.join(', ')}`);
  return files
    .map((file) => ({ ...file, items: file.items.filter((item) => reviewed.get(item.id) === authoredRevision(item)) }))
    .filter((file) => file.items.length > 0);
}

export const generators = authoredGenerators(reviewedOnly(loadAuthoredCorpus(), loadReviewStatus()));
