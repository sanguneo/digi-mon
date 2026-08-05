#!/usr/bin/env node
/**
 * 문항 한국어 표기 검사.
 *
 * 이번 저장소에서 눈으로 잡은 조사 버그가 셋 있었다.
 *   '27송이을 더 받았습니다'  (송이 -> 를)
 *   '2과 1/3'                (2는 '이'로 읽으니 와)
 *   '무게 한 개의 무게가'      (문구에서 정규식으로 명사를 잘라낸 결과)
 * 셋 다 규칙으로 판정되는 오류였는데 사람이 읽어서 찾았다. 기계가 볼 수 있는
 * 것을 사람이 보고 있으면 못 본 것이 남는다.
 *
 * 이 검사기는 규칙으로 확정되는 것만 본다. 문체·자연스러움은 판정하지 않는다.
 * 그건 자산 텍스트(지문) 쪽 일이고, 문항 발문은 기계가 조립하므로 규칙으로 족하다.
 */
import path from 'node:path';
import { REPO_ROOT, loadOntology, writeJson } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';
import { particle, particleRo, sinoKoreanLarge } from '../src/engine/korean-number.mjs';
import { vocabularyFor } from '../src/curriculum/korean-vocab.mjs';

const SAMPLES = Number(process.env.SAMPLES ?? 60);

/**
 * 조사 중복 검사가 낱말을 알아야 하는 이유.
 *
 * '가을을'은 낱말 '가을'에 조사 '을'이 붙은 정상 표기인데 문자열로만 보면 '을을'
 * 중복이다('세로로'와 같은 부류). '로'는 목록에서 뺐지만 '을'은 뺄 수 없다 —
 * 빼면 진짜 중복('공을을')을 놓친다. 그래서 겹침의 앞부분이 학년군 어휘의 낱말이면
 * 정상으로 본다. 낱말이 아닌데 겹치면 그대로 위반이다.
 */
const KNOWN_WORDS = new Set([...vocabularyFor('1-2'), ...vocabularyFor('3-4'), ...vocabularyFor('5-6')]);

/** 종성 유무로 갈리는 조사 짝. [받침있음, 받침없음] */
const JOSA_PAIRS = [
  ['은', '는'],
  ['이', '가'],
  ['을', '를'],
  ['과', '와'],
];
const ALL_JOSA = [...JOSA_PAIRS.flat(), '으로', '로'];
/**
 * 중복 조사 검사에서 쓰는 목록. 로는 넣지 않는다.
 * 한국어에 로로 끝나는 명사가 많아('세로', '가로', '도로') '세로로'가 정상인데
 * '로로' 중복으로 잡힌다.
 */
const DUPLICABLE_JOSA = JOSA_PAIRS.flat();

/** 단위 기호를 한국어로 읽은 소리. 조사는 읽는 소리가 정한다. */
const UNIT_READING = {
  cm: '센티미터',
  mm: '밀리미터',
  m: '미터',
  km: '킬로미터',
  g: '그램',
  kg: '킬로그램',
  t: '톤',
  L: '리터',
  mL: '밀리리터',
  '%': '퍼센트',
  '°': '도',
};

/** 종성 규칙으로 옳은 조사를 고른다. */
function expectedJosa(readingLastWord, josa) {
  // 로/으로는 받침 ㄹ 예외가 있어 2항 판정이 안 된다. 이걸 빼놓아서
  // '1 : 3로' 가 문면 62,255건 위반 0을 통과했다. 외부 검토가 잡았다.
  if (josa === '로' || josa === '으로') return particleRo(readingLastWord);
  const pair = JOSA_PAIRS.find((p) => p.includes(josa));
  if (!pair) return null;
  return particle(readingLastWord, pair[0], pair[1]);
}

const CHECKS = [
  {
    id: 'josa-after-number',
    label: '숫자 뒤 조사',
    /**
     * 숫자에 바로 붙은 조사. 조사는 표기가 아니라 읽는 소리가 정한다.
     * 27(이십칠) -> 은 / 52(오십이) -> 는
     *
     * 분수는 분자를 마지막에 소리 낸다. '1/4' 은 '사분의 일' 이므로 '1/4은' 이
     * 맞다. 끝 숫자 4만 보면 옳은 표기를 틀렸다고 보고한다.
     */
    scan(text) {
      const found = [];
      const fractionSpans = [];

      // 분수 표기를 먼저 처리하고 그 구간을 기록해 두어 중복 판정을 막는다.
      const fracRe = /(\d+)\/(\d+)(으로|로|은|는|이|가|을|를|과|와)(?=[\s.,)?]|$)/g;
      let fm = fracRe.exec(text);
      while (fm !== null) {
        fractionSpans.push([fm.index, fm.index + fm[0].length]);
        const numerator = Number(fm[1]);
        const want = expectedJosa(sinoKoreanLarge(numerator), fm[3]);
        if (want !== null && want !== fm[3]) {
          found.push(`'${fm[0]}' -> '${fm[1]}/${fm[2]}${want}' (분자 ${numerator}을 마지막에 읽는다)`);
        }
        fm = fracRe.exec(text);
      }

      const re = /(\d+)(으로|로|은|는|이|가|을|를|과|와)(?=[\s.,)?]|$)/g;
      let m = re.exec(text);
      while (m !== null) {
        const start = m.index;
        const inFraction = fractionSpans.some(([s, e]) => start >= s && start < e);
        const n = Number(m[1]);
        if (!inFraction && Number.isSafeInteger(n) && n >= 0 && n < 10 ** 13) {
          const want = expectedJosa(sinoKoreanLarge(n), m[2]);
          if (want !== null && want !== m[2]) {
            found.push(`'${m[0]}' -> '${m[1]}${want}' (${n}은 '${sinoKoreanLarge(n)}'으로 읽는다)`);
          }
        }
        m = re.exec(text);
      }
      return found;
    },
  },
  {
    id: 'josa-after-unit',
    label: '단위 뒤 조사',
    scan(text) {
      const found = [];
      const units = Object.keys(UNIT_READING).sort((a, b) => b.length - a.length);
      for (const unit of units) {
        const escaped = unit.replace(/[.*+?^${}()|[\]\\%°]/g, '\\$&');
        const re = new RegExp(`\\d${escaped}(으로|로|은|는|이|가|을|를|과|와)(?=[\\s.,)?]|$)`, 'g');
        let m = re.exec(text);
        while (m !== null) {
          const want = expectedJosa(UNIT_READING[unit], m[1]);
          if (want !== null && want !== m[1]) {
            found.push(`'${m[0]}' -> 단위 ${unit}(${UNIT_READING[unit]}) 뒤에는 '${want}'`);
          }
          m = re.exec(text);
        }
      }
      return found;
    },
  },
  {
    id: 'josa-after-counter',
    label: '단위명사 뒤 조사',
    scan(text) {
      const found = [];
      const counters = ['개', '권', '장', '자루', '마리', '송이', '명', '번', '조각', '묶음', '층'];
      for (const counter of counters) {
        const re = new RegExp(`\\d+${counter}(으로|로|은|는|이|가|을|를|과|와)(?=[\\s.,)?]|$)`, 'g');
        let m = re.exec(text);
        while (m !== null) {
          const want = expectedJosa(counter, m[1]);
          if (want !== null && want !== m[1]) {
            found.push(`'${m[0]}' -> 단위명사 ${counter} 뒤에는 '${want}'`);
          }
          m = re.exec(text);
        }
      }
      return found;
    },
  },
  {
    id: 'duplicate-josa',
    label: '조사 중복',
    scan(text) {
      const found = [];
      for (const j of DUPLICABLE_JOSA) {
        let at = text.indexOf(`${j}${j}`);
        while (at !== -1) {
          // 겹침의 첫 글자까지가 낱말이면 정상 표기다('가을' + '을' = '가을을').
          const wordStart = Math.max(text.lastIndexOf(' ', at), -1) + 1;
          const stem = text.slice(wordStart, at + j.length);
          if (!KNOWN_WORDS.has(stem)) found.push(`'${j}${j}' (${text.slice(wordStart, at + j.length * 2)})`);
          at = text.indexOf(`${j}${j}`, at + 1);
        }
      }
      return found;
    },
  },
  {
    id: 'space-before-josa',
    label: '조사 앞 공백',
    scan(text) {
      const m = text.match(/\d\s+(은|는|이|가|을|를)(?=[\s.,?]|$)/g);
      return m ? m.map((x) => `'${x}'`) : [];
    },
  },
  {
    id: 'template-leak',
    label: '치환 안 된 흔적',
    scan(text) {
      const found = [];
      for (const bad of ['${', 'undefined', 'NaN', '[object', 'null']) {
        if (text.includes(bad)) found.push(`'${bad}'`);
      }
      // 조립용 자리표시자가 남으면 문항이 깨진다. □ 는 정상 표기이므로 제외한다.
      if (/⟦|\{\{|%s|%d/.test(text)) found.push('자리표시자 잔존');
      return found;
    },
  },
  {
    id: 'double-space',
    label: '연속 공백·문장부호 앞 공백',
    /**
     * 들여쓰기와 줄임표는 정상 표기다.
     *   여러 줄 발문은 줄바꿈 뒤 공백으로 들여쓴다.
     *   '■ ● ■ ...' 와 '= 3 ... 2' 의 줄임표 앞 공백은 의도한 것이다.
     * 이 둘을 걸러내지 않으면 옳은 표기를 계속 위반으로 보고해 게이트가 무력해진다.
     */
    scan(text) {
      const found = [];
      // 줄바꿈에 붙은 공백은 들여쓰기이므로 제외한다.
      const withoutIndent = text.replace(/\n[ ]*/g, '\n');
      if (/ {2,}/.test(withoutIndent)) found.push('공백 2칸 이상');
      // 줄임표를 지운 뒤 문장부호 앞 공백을 본다.
      const withoutEllipsis = withoutIndent.replace(/\.{2,}|…/g, '');
      if (/\s[.,?!]/.test(withoutEllipsis)) found.push('문장부호 앞 공백');
      return found;
    },
  },
];

const ontology = loadOntology();
const spine = buildSpine(ontology);
const registry = createRegistry();
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

const byCheck = {};
for (const c of CHECKS) byCheck[c.id] = { label: c.label, count: 0, generators: new Set(), examples: [] };
let scanned = 0;

for (const g of registry.all()) {
  const standard = standardByCode.get(g.standardCode);
  for (let n = 0; n < SAMPLES; n += 1) {
    let item;
    try {
      item = generateItem(g, standard, createRng(`${g.id}|ko|${n}`), (n % 3) + 1);
    } catch {
      continue;
    }
    // 사람이 읽는 모든 문면을 검사한다. 정답 표기와 풀이도 학습지에 인쇄된다.
    const texts = [
      item.instruction,
      item.stem,
      item.answer.display,
      ...(item.solution ?? []),
      ...(item.choices ?? []).map((c) => c.text),
      item.figure?.altText,
    ].filter((t) => typeof t === 'string' && t.length > 0);

    for (const text of texts) {
      scanned += 1;
      for (const check of CHECKS) {
        for (const hit of check.scan(text)) {
          const bucket = byCheck[check.id];
          bucket.count += 1;
          bucket.generators.add(g.id);
          if (bucket.examples.length < 6) {
            bucket.examples.push({ generatorId: g.id, text: text.slice(0, 90), problem: hit });
          }
        }
      }
    }
  }
}

const report = {
  schema: 'digi-mon/korean-check@1',
  samplesPerGenerator: SAMPLES,
  textsScanned: scanned,
  checks: Object.fromEntries(
    Object.entries(byCheck).map(([id, v]) => [id, {
      label: v.label,
      count: v.count,
      generatorCount: v.generators.size,
      generators: [...v.generators].sort(),
      examples: v.examples,
    }]),
  ),
};
writeJson(path.join(REPO_ROOT, 'data', 'audit', 'korean-check.json'), report);

const total = Object.values(byCheck).reduce((s, v) => s + v.count, 0);
console.log(`한국어 표기 검사: 문면 ${scanned}건 검사, 위반 ${total}건`);
for (const [, v] of Object.entries(byCheck)) {
  console.log(`  ${v.label.padEnd(18)} ${String(v.count).padStart(5)}건  생성기 ${v.generators.size}개`);
}

if (total > 0) {
  console.log('');
  for (const [, v] of Object.entries(byCheck)) {
    if (v.count === 0) continue;
    console.log(`[${v.label}] ${v.count}건`);
    for (const e of v.examples) {
      console.log(`  ${e.generatorId}`);
      console.log(`    "${e.text}"`);
      console.log(`    ${e.problem}`);
    }
    console.log('');
  }
  process.exitCode = 1;
}
