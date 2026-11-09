/**
 * AI 후보 문항이 코퍼스에 들어가기 전에 지나는 게이트.
 *
 * 새 규칙을 만들지 않고 저장소가 이미 쓰는 게이트를 그대로 건다.
 *   schema       코퍼스 항목 모양(src/generators/authored.mjs assertAuthoredFile)
 *   contract     문항 계약과 정답 검산(engine/worksheet.mjs generateItem)
 *   korean-text  한국어 표기 규칙(engine/korean-text-checks.mjs, check-korean 과 같은 규칙)
 *   vocabulary   학년 어휘(curriculum/vocabulary-gate.mjs, check-vocabulary 와 같은 규칙)
 *                영어는 공식 초등 권장 어휘 800개 밖 낱말도 막는다
 *   answer-leak  발문·지문이 정답을 드러내는지
 *   duplicate    코퍼스나 같은 묶음에 이미 있는지
 * GGW 린터는 묶음 단위로 돌아서 src/authoring/ggw.mjs 에 따로 있다.
 */
import { createHash } from 'node:crypto';
import { authoredGenerator, AUTHORED_SCHEMA } from '../generators/authored.mjs';
import { generateItem } from '../engine/worksheet.mjs';
import { createRng } from '../engine/rng.mjs';
import { scanKoreanText } from '../engine/korean-text-checks.mjs';
import { vocabularyFor } from '../curriculum/korean-vocab.mjs';
import { englishWordsFor } from '../curriculum/english-vocab.mjs';
import { englishWordsOf, learnedWordsOf } from '../curriculum/vocabulary-gate.mjs';
import { englishWordsOutsideOfficial } from './english-official.mjs';
import { ENGLISH_NAMES } from './prompt.mjs';

const text = (v) => (typeof v === 'string' ? v.trim().replace(/\r\n?/g, '\n') : v);

export function authoredItemId(standardCode, stem, answer) {
  return createHash('sha256').update(`${standardCode}|${stem}|${answer}`).digest('hex').slice(0, 12);
}

/** 모델이 준 후보를 코퍼스 항목 꼴로 다듬는다. 값을 고치지 않고 공백만 정리한다. */
export function normalizeCandidate(raw, standardCode, provenance) {
  const stem = text(raw?.stem);
  const answer = text(raw?.answer);
  return {
    id: authoredItemId(standardCode, stem, answer),
    difficulty: raw?.difficulty,
    instruction: text(raw?.instruction),
    stem,
    answer,
    distractors: Array.isArray(raw?.distractors) ? raw.distractors.map(text) : raw?.distractors,
    solution: Array.isArray(raw?.solution) ? raw.solution.map(text) : (typeof raw?.solution === 'string' ? [text(raw.solution)] : raw?.solution),
    provenance,
  };
}

/**
 * 정답이 발문·지문에서 혼자 드러나는가.
 *
 * '사실인지 의견인지 고르시오' 처럼 발문이 선택지를 함께 부르거나, 지문 속 낱말을 고르는
 * 문항은 정답과 오답이 같은 문면에 있다. 그런 문면은 정답을 가리키지 않는다.
 * 오답은 하나도 없고 정답만 있으면 그 문면이 정답을 알려 주는 것이다.
 */
export function answerLeak(entry) {
  for (const [name, value] of [['발문', entry.instruction], ['지문', entry.stem]]) {
    if (!value.includes(entry.answer)) continue;
    if (entry.distractors.some((d) => value.includes(d))) continue;
    return `${name}에 정답만 있고 오답은 없다`;
  }
  return null;
}

/**
 * 후보 하나를 검사해 탈락 사유 목록을 돌려준다. 비어 있으면 통과다.
 *
 * @param {object} entry normalizeCandidate 결과
 * @param {object} ctx
 * @param {object} ctx.standard 스파인 성취기준 레코드
 * @param {string} ctx.skill
 * @param {Set<string>} ctx.seenIds 코퍼스와 앞선 후보의 id
 * @param {Set<string>} ctx.seenStems 코퍼스와 앞선 후보의 지문
 */
export function checkCandidate(entry, { standard, skill, seenIds, seenStems }) {
  const reasons = [];
  const file = {
    schema: AUTHORED_SCHEMA,
    subject: standard.subject,
    standardCode: standard.code,
    skill,
    items: [entry],
  };

  let generator;
  try {
    generator = authoredGenerator(file);
  } catch (error) {
    return [{ gate: 'schema', detail: error.message.replace(/^AI 작성 코퍼스 오류 \[.+?\]: /, '') }];
  }

  let item;
  try {
    item = generateItem(generator, standard, createRng(`authoring|${entry.id}`), entry.difficulty);
  } catch (error) {
    return [{ gate: 'contract', detail: error.message }];
  }

  const texts = [item.instruction, item.stem, item.answer.display, ...item.solution, ...item.choices.map((c) => c.text)];
  for (const t of texts) {
    for (const hit of scanKoreanText(t, standard.subject)) reasons.push({ gate: 'korean-text', detail: `${hit.label}: ${hit.problem}` });
  }

  if (standard.subject === 'korean') {
    const allowed = new Set(vocabularyFor(standard.gradeBand));
    for (const word of learnedWordsOf(item, allowed)) {
      if (!allowed.has(word)) reasons.push({ gate: 'vocabulary', detail: `${standard.gradeBand} 어휘 목록 밖 낱말 '${word}'` });
    }
  }
  if (standard.subject === 'english') {
    const band = new Set(englishWordsFor(standard.gradeBand).map((w) => w.toLowerCase()));
    for (const word of englishWordsOf(item)) {
      if (!band.has(word)) reasons.push({ gate: 'vocabulary', detail: `${standard.gradeBand} 선택지 낱말 목록 밖 '${word}'` });
    }
    for (const word of englishWordsOutsideOfficial(texts, ENGLISH_NAMES)) {
      reasons.push({ gate: 'vocabulary', detail: `공식 초등 권장 어휘 800개 밖 '${word}'` });
    }
  }

  const leak = answerLeak(entry);
  if (leak) reasons.push({ gate: 'answer-leak', detail: leak });

  if (seenIds.has(entry.id)) reasons.push({ gate: 'duplicate', detail: '같은 지문·정답 문항이 이미 있다' });
  else if (seenStems.has(entry.stem)) reasons.push({ gate: 'duplicate', detail: '같은 지문이 이미 있다' });

  return reasons;
}
