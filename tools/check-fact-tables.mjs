#!/usr/bin/env node
/**
 * 사실 표의 구조를 검사한다.
 *
 * 왜 필요한가: 높임말·반대말·방언·맞춤법처럼 **정답이 규칙이 아니라 사실**인 문항은
 * `verify` 가 같은 표를 되읽는다. 표의 항목이 틀리면 검산도 뮤테이션도 원리적으로 못 잡는다.
 * 실제로 `'자다' -> '자시다'` 로 적어 두어 정답이 선택지에 없는 문항이 나가고 있었고
 * (자시다는 '먹다'의 높임말, '자다'의 높임은 '주무시다') 외부 검토가 잡았다.
 *
 * 내용의 참·거짓은 사람이 봐야 한다. 이 게이트가 잡을 수 있는 것은 구조뿐이다.
 *   - 같은 값이 서로 다른 표제어의 답으로 두 번 쓰이는가 (한 답이 두 문제의 정답)
 *   - 표제어와 답이 같은가
 *   - 답이 다른 항목의 표제어로도 쓰이는가 (방향이 꼬였을 신호)
 *   - 짝 안에 중복이 있는가
 *
 * 구조가 깨끗해도 내용이 틀릴 수 있다는 것을 명시적으로 남긴다. §7 의 '선언으로
 * 한계를 드러내는' 패턴과 같다.
 */
import path from 'node:path';
import { REPO_ROOT, writeJson } from '../src/ontology/source.mjs';
import {
  ANTONYMS,
  DIALECTS,
  HONORIFICS,
  HYPERNYMS,
  IDIOMS,
  SPELLING_PAIRS,
} from '../src/curriculum/korean-vocab.mjs';
import { INFERENCE_DIALOGUES } from '../src/curriculum/korean-sentences.mjs';

/** 표마다 [표제어, 답] 쌍으로 정규화한다. */
const TABLES = [
  {
    id: 'HONORIFICS',
    label: '높임 표현',
    pairs: HONORIFICS.map((h) => [h.plain, h.honorific]),
    note: '표제어의 높임말이 답이다. 답이 두 표제어에 걸치면 한 답이 두 문제의 정답이 된다.',
  },
  {
    id: 'ANTONYMS',
    label: '반대말',
    pairs: ANTONYMS.map((a) => [a[0], a[1]]),
    note: '반대말은 대칭이라 같은 낱말이 여러 짝에 나올 수 있다. 같은 짝의 중복만 본다.',
    symmetric: true,
  },
  {
    id: 'DIALECTS',
    label: '표준어와 방언',
    pairs: DIALECTS.map((d) => [d.dialect, d.standard]),
    note: '방언의 표준어가 답이다. 여러 방언이 같은 표준어를 가질 수 있다.',
    allowSharedAnswer: true,
  },
  {
    id: 'IDIOMS',
    label: '관용 표현',
    pairs: IDIOMS.map((i) => [i.idiom, i.meaning]),
    note: '관용 표현의 뜻이 답이다. 두 표현이 같은 뜻이면 선택형에서 정답이 둘이 된다.',
  },
  {
    id: 'SPELLING_PAIRS',
    label: '맞춤법',
    pairs: SPELLING_PAIRS.map((p) => [p.wrong, p.correct]),
    note: '오표기의 바른 표기가 답이다. 오표기가 다른 항목의 정답과 겹치면 안 된다.',
  },
  {
    id: 'HYPERNYMS',
    label: '포함 관계',
    pairs: HYPERNYMS.flatMap((h) => h.specific.map((s) => [s, h.general])),
    note: '하위어의 상위어가 답이다. 여러 하위어가 같은 상위어를 갖는 것이 정상이다.',
    allowSharedAnswer: true,
  },
];

const problems = [];
let pairCount = 0;

/**
 * 추론 문항의 정답이 대화에 이미 있으면 추론이 아니라 베끼기다.
 *
 * [6국01-01] 은 '생략된 내용' 을 추론하는 기준이다. 정답의 핵심어가 대화에 그대로
 * 나오면 아이는 추론하지 않고 베낀다. 5차 저작분 4개 중 2개가 그랬다 —
 * '숙제를 아직 다 못 했어' 라고 말해 놓고 '숙제를 끝내지 못했기 때문' 이 정답이었다.
 * 그 표의 basis 가 스스로 자백하고 있었다: 진짜 추론은 '…했으므로' 인데 둘은
 * '말했다·답했다' 였다.
 *
 * 문자열 검사라 의미 재진술까지는 못 잡는다. 핵심어가 겹치는 것만 본다.
 */
function checkInferenceNotRestatement() {
  const found = [];
  for (const d of INFERENCE_DIALOGUES) {
    const text = d.lines.join(' ');
    // 정답에서 조사·어미를 걷어낸 핵심 낱말을 뽑는다.
    const stems = String(d.answer)
      .split(/\s+/)
      .map((w) => w.replace(/(이다|입니다|때문이다|합니다|한다|다)$/, ''))
      .map((w) => w.replace(/(이|가|은|는|을|를|의|에|도|만)$/, ''))
      .filter((w) => [...w].length >= 2);
    for (const stem of stems) {
      if (text.includes(stem)) {
        found.push({ answer: d.answer, stem, lines: text });
        break;
      }
    }
    // basis 가 추론이 아니라 진술을 가리키면 신호다.
    if (/말했다|답했다|라고 했다$/.test(d.basis) && !/므로|때문에|따라서/.test(d.basis)) {
      found.push({ answer: d.answer, stem: '(basis 가 추론이 아니라 진술을 가리킨다)', lines: d.basis });
    }
  }
  return found;
}

const inferenceProblems = checkInferenceNotRestatement();
for (const p of inferenceProblems) {
  problems.push({
    table: 'INFERENCE_DIALOGUES',
    kind: 'restatement',
    message: `정답 '${p.answer}' 의 '${p.stem}' 가 대화에 이미 있다 — 추론이 아니라 베끼기다: ${p.lines}`,
  });
}

for (const table of TABLES) {
  pairCount += table.pairs.length;
  const seenPair = new Set();
  const answerOwners = new Map();
  const heads = new Set(table.pairs.map(([h]) => h));

  for (const [head, answer] of table.pairs) {
    const key = `${head}\u0000${answer}`;
    if (seenPair.has(key)) {
      problems.push({ table: table.id, kind: 'duplicate-pair', message: `짝 중복: ${head} → ${answer}` });
    }
    seenPair.add(key);

    if (head === answer) {
      problems.push({ table: table.id, kind: 'same-value', message: `표제어와 답이 같다: ${head}` });
    }

    if (!table.allowSharedAnswer) {
      const owner = answerOwners.get(answer);
      if (owner !== undefined && owner !== head) {
        problems.push({
          table: table.id,
          kind: 'shared-answer',
          message: `답 '${answer}' 이 '${owner}' 와 '${head}' 두 표제어에 걸쳐 있다`,
        });
      }
      answerOwners.set(answer, head);
    }

    if (!table.symmetric && heads.has(answer)) {
      problems.push({
        table: table.id,
        kind: 'answer-is-head',
        message: `답 '${answer}' 이 다른 항목의 표제어로도 쓰인다 (방향이 꼬였을 신호)`,
      });
    }
  }
}

writeJson(path.join(REPO_ROOT, 'data', 'audit', 'fact-tables-check.json'), {
  schema: 'digi-mon/fact-tables-check@1',
  note: '구조만 검사한다. 내용의 참·거짓은 사람이 봐야 한다. verify 가 같은 표를 되읽으므로 뮤테이션도 표의 오류를 못 잡는다.',
  tableCount: TABLES.length,
  pairCount,
  problemCount: problems.length,
  tables: TABLES.map((t) => ({ id: t.id, label: t.label, pairs: t.pairs.length, note: t.note })),
  problems,
});

console.log(`사실 표 구조 검사: 표 ${TABLES.length}종, 짝 ${pairCount}개`);
console.log(`구조 문제: ${problems.length}건`);
console.log('내용의 참·거짓은 이 게이트가 판정하지 않는다. 사람 검토가 필요하다.');

if (problems.length > 0) {
  console.log('');
  for (const p of problems.slice(0, 20)) console.log(`  [${p.table}] ${p.kind}: ${p.message}`);
  process.exitCode = 1;
}
