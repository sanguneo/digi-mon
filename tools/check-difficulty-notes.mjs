#!/usr/bin/env node
/**
 * difficultyNote 가 실제 문항 행동과 맞는지 검사한다.
 *
 * check-difficulty 는 노트가 **있는지**만 본다. 노트에 "난이도 1은 받아올림 없음,
 * 2 이상은 생긴다" 고 적어 두고 코드가 반대로 동작해도 통과한다. 3차 검토가
 * 이 공백을 지적했다.
 *
 * 노트 전문을 기계가 이해할 수는 없다. 대신 노트가 **약속하는 구조**를 검사한다.
 *   1. 노트가 난이도 번호를 언급하면 그 난이도에서 실제로 문항이 생성되는가
 *   2. 노트가 "1은 A, 2 이상은 B" 꼴이면 난이도별 문항 집합이 실제로 달라지는가
 *      (categorical 축의 정의가 곧 이것이다)
 *   3. 노트가 "넓힌다·까지" 꼴이면 난이도가 오를 때 문항 종류가 줄지 않는가
 *      — 포함 관계가 뒤집히면 노트가 거짓이다
 *
 * 잡을 수 없는 것: 노트의 서술이 교육과정상 옳은지, A와 B가 정말 그 내용인지.
 * 그건 사람이 봐야 한다. 여기서는 노트가 **자기 모순이 아닌지**만 본다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';

const SAMPLES = Number(process.env.SAMPLES ?? 120);

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

/** 한 난이도에서 나오는 문항 종류(dedupeKey 집합). */
function keysAt(generator, standard, difficulty) {
  const keys = new Set();
  for (let n = 0; n < SAMPLES; n += 1) {
    try {
      keys.add(generateItem(generator, standard, createRng(`${generator.id}|note|${n}`), difficulty).dedupeKey);
    } catch {
      // 생성 실패는 verify-generators 가 잡는다.
    }
  }
  return keys;
}

/** 노트가 언급한 난이도 번호. "난이도 1은 …, 2 이상은 …" -> [1, 2] */
function mentionedLevels(note) {
  const levels = new Set();
  for (const m of note.matchAll(/난이도\s*([123])/g)) levels.add(Number(m[1]));
  for (const m of note.matchAll(/([123])\s*(?:이상|은|는|에서|까지)/g)) levels.add(Number(m[1]));
  return [...levels].sort();
}

const problems = [];
const rows = [];

for (const g of registry.all()) {
  if ((g.difficultyAxis ?? 'numeric') !== 'categorical') continue;
  const standard = standardByCode.get(g.standardCode);
  const note = g.difficultyNote;
  const levels = g.difficulties ?? [1, 2, 3];
  const sets = new Map(levels.map((d) => [d, keysAt(g, standard, d)]));

  const mentioned = mentionedLevels(note);
  const row = {
    generatorId: g.id,
    code: g.standardCode,
    note,
    mentionedLevels: mentioned,
    uniqueByLevel: Object.fromEntries([...sets].map(([d, s]) => [d, s.size])),
  };

  // 1. 노트가 언급한 난이도가 실제로 지원되는가
  for (const d of mentioned) {
    if (!levels.includes(d)) {
      problems.push({
        generatorId: g.id,
        kind: 'level-not-supported',
        message: `노트가 난이도 ${d} 를 말하지만 지원 난이도는 [${levels.join(',')}] 이다`,
      });
    }
  }

  // 2. categorical 은 난이도별 문항 집합이 달라야 한다.
  //    모든 난이도가 같은 집합이면 그 노트는 거짓이다.
  const signatures = new Set([...sets.values()].map((s) => [...s].sort().join('\u0000')));
  if (signatures.size === 1 && levels.length > 1) {
    problems.push({
      generatorId: g.id,
      kind: 'no-variation',
      message: `categorical 인데 난이도 ${levels.join('/')} 의 문항 집합이 완전히 같다`,
    });
  }

  /**
   * 넓힘 포함관계 검사는 버렸다.
   *
   * "난이도가 오를수록 넓힌다" 는 노트를 두고 난이도별 dedupeKey 집합이 포함관계인지
   * 보려 했는데, dedupeKey 에 난이도를 넣은 생성기가 있어(같은 사례를 난이도별로 따로
   * 세기 위해) 집합이 원리적으로 겹치지 않는다. 노트 문면에서 '넓힘' 과 '교체' 를
   * 가려내는 것도 신뢰할 수 없었다 — '이상은' 은 순수 문법이고 '까지' 는 양쪽에 쓰인다.
   *
   * 두 번 오탐을 낸 검사는 남기지 않는다. 옳은 코드를 위반이라 부르는 게이트는 꺼진다.
   * 난이도가 실제로 어려워지는지는 응답 데이터가 있어야 판정된다(§14).
   */

  rows.push(row);
}

writeJson(path.join(REPO_ROOT, 'data', 'audit', 'difficulty-notes-check.json'), {
  schema: 'digi-mon/difficulty-notes-check@1',
  note: '노트가 자기 모순이 아닌지만 본다. 노트의 서술이 교육과정상 옳은지는 사람이 봐야 한다.',
  samplesPerLevel: SAMPLES,
  categoricalCount: rows.length,
  problemCount: problems.length,
  problems,
  rows,
});

console.log(`난이도 노트 검사: categorical ${rows.length}개 (난이도별 표본 ${SAMPLES})`);
console.log(`노트와 실제 행동이 어긋난 건수: ${problems.length}`);
console.log('노트 서술이 교육과정상 옳은지는 이 게이트가 판정하지 않는다.');

if (problems.length > 0) {
  console.log('');
  for (const p of problems.slice(0, 20)) console.log(`  [${p.kind}] ${p.generatorId}: ${p.message}`);
  process.exitCode = 1;
}
