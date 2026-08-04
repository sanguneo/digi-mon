#!/usr/bin/env node
/**
 * 학년군 어휘 화이트리스트 게이트.
 *
 * 국어 문항은 어휘를 고르는 순간 학년 수준이 결정된다. '3학년 수준으로 써 달라'는
 * 지시로는 통제되지 않는다 — 사람이든 LLM 이든 지키지 못한다. 목록을 두고
 * 기계로 검사해야 학년을 벗어난 낱말이 문항에 들어가는 것을 막을 수 있다.
 *
 * 이 게이트는 국어 문항에만 적용한다. 수학 문항의 사물 명사는 계산 대상일 뿐
 * 어휘 학습 대상이 아니어서 같은 기준으로 재면 잘못된 실패를 만든다.
 *
 * 검사 대상은 '문항이 학습 대상으로 제시하는 낱말'이다. 발문·풀이의 설명 문장은
 * 교사 언어라서 학년 어휘로 묶지 않는다. 대신 낱말 자체를 보여 주는 자리
 * (선택지, 낱말 stem, params 의 어휘)를 본다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';
import { vocabularyFor } from '../src/curriculum/korean-vocab.mjs';
import { isSyllable } from '../src/engine/hangul.mjs';

const SAMPLES = Number(process.env.SAMPLES ?? 60);

/**
 * 어휘 검사에서 뺄 것.
 * 문법 용어와 자모·부호는 학습 어휘가 아니라 메타 언어다.
 */
const META_TERMS = new Set([
  '기역', '쌍기역', '니은', '디귿', '쌍디귿', '리을', '미음', '비읍', '쌍비읍',
  '시옷', '쌍시옷', '이응', '지읒', '쌍지읒', '치읓', '키읔', '티읕', '피읖', '히읗',
  '마침표', '물음표', '느낌표', '쉼표',
  '주어', '서술어', '목적어', '표준어', '방언', '고유어', '한자어', '관용', '표현',
  '아', '애', '야', '얘', '어', '에', '여', '예', '오', '와', '왜', '외',
  '요', '우', '워', '웨', '위', '유', '으', '의', '이',
]);

/**
 * 문항에서 '학습 대상 낱말'만 뽑는다.
 *
 * 어절과 조사는 낱말이 아니다. '고양이가' 는 낱말 '고양이' 에 주격 조사가 붙은
 * 어절이고 '께서' 는 조사 자체다. 이것들을 어휘 목록으로 재면 옳은 문항을 계속
 * 위반으로 보고해 게이트가 무력해진다. 조사를 떼고 남은 낱말을 본다.
 */
const PARTICLES = [
  '께서', '에게', '으로', '이라고', '까지', '부터', '보다', '만큼', '처럼', '에서',
  '에', '은', '는', '이', '가', '을', '를', '과', '와', '도', '만', '의', '께',
];

/** 조사를 떼어 낸 낱말. 조사만으로 된 말은 낱말이 아니므로 null 을 준다. */
function stripParticle(text, allowed) {
  if (allowed.has(text)) return text;
  if (PARTICLES.includes(text)) return null;
  for (const p of [...PARTICLES].sort((a, b) => b.length - a.length)) {
    if (text.endsWith(p) && text.length > p.length) {
      const stem = text.slice(0, -p.length);
      if (allowed.has(stem)) return stem;
    }
  }
  return text;
}

function learnedWordsOf(item, allowed) {
  const out = new Set();
  const isPlainWord = (t) => typeof t === 'string'
    && t.length > 0
    && [...t].every((ch) => isSyllable(ch))
    && [...t].length <= 4;

  const add = (value) => {
    if (!isPlainWord(value)) return;
    const word = stripParticle(value, allowed);
    if (word !== null) out.add(word);
  };

  for (const value of Object.values(item.params ?? {})) {
    add(value);
    if (Array.isArray(value)) for (const v of value) add(v);
  }
  for (const choice of item.choices ?? []) add(choice.text);
  add(item.stem);
  add(item.answer.value);

  for (const term of META_TERMS) out.delete(term);
  return [...out];
}

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

const offenders = [];
let checkedItems = 0;
let checkedWords = 0;

for (const g of registry.all()) {
  const standard = standardByCode.get(g.standardCode);
  if (standard.subject !== 'korean') continue;
  const allowed = new Set(vocabularyFor(standard.gradeBand));

  for (let n = 0; n < SAMPLES; n += 1) {
    let item;
    try {
      item = generateItem(g, standard, createRng(`${g.id}|vocab|${n}`), (n % 3) + 1);
    } catch {
      continue;
    }
    checkedItems += 1;
    for (const word of learnedWordsOf(item, allowed)) {
      checkedWords += 1;
      if (!allowed.has(word)) {
        offenders.push({
          generatorId: g.id,
          code: g.standardCode,
          gradeBand: standard.gradeBand,
          word,
        });
      }
    }
  }
}

// 같은 낱말이 여러 번 걸리므로 생성기·낱말 짝으로 묶는다.
const grouped = new Map();
for (const o of offenders) {
  const key = `${o.generatorId}|${o.word}`;
  if (!grouped.has(key)) grouped.set(key, { ...o, count: 0 });
  grouped.get(key).count += 1;
}
const unique = [...grouped.values()].sort((a, b) => b.count - a.count);

writeJson(path.join(REPO_ROOT, 'data', 'audit', 'vocabulary-check.json'), {
  schema: 'digi-mon/vocabulary-check@1',
  note: '어휘 목록은 이 저장소가 시드한 것이고 공식 목록이 아니다. 교과 전문가 검토 대상이다.',
  samplesPerGenerator: SAMPLES,
  koreanItemsChecked: checkedItems,
  wordsChecked: checkedWords,
  violationCount: offenders.length,
  uniqueViolations: unique.length,
  violations: unique,
  vocabularySize: {
    '1-2': vocabularyFor('1-2').length,
    '3-4': vocabularyFor('3-4').length,
    '5-6': vocabularyFor('5-6').length,
  },
});

console.log(`어휘 화이트리스트 검사: 국어 문항 ${checkedItems}개, 학습 대상 낱말 ${checkedWords}건`);
console.log(`목록 밖 낱말: ${offenders.length}건 (고유 ${unique.length}종)`);
console.log(`어휘 목록 크기: 1-2 ${vocabularyFor('1-2').length} / 3-4 ${vocabularyFor('3-4').length} / 5-6 ${vocabularyFor('5-6').length}`);

if (unique.length > 0) {
  console.log('');
  for (const u of unique.slice(0, 25)) {
    console.log(`  [${u.gradeBand}] '${u.word}' — ${u.generatorId} (${u.count}회)`);
  }
  process.exitCode = 1;
}
