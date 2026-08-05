#!/usr/bin/env node
/**
 * 어휘 화이트리스트의 자기승인을 탐지한다.
 *
 * check-vocabulary 는 문항의 낱말이 학년군 목록 안에 있는지 본다. 그런데 목록 자체를
 * 자산이 공급한다 — 문장 자산의 어절이 목록에 들어가면 게이트가 원리적으로 못 본다.
 * 4차 검토 실측: '공을'·'배와' 등 14건이 그렇게 통과했다. 자산이 스스로 승인한 것이다.
 *
 * 낮은 오탐으로 잡는 법(4차 지시서):
 *   목록 안에서 **토큰 = 다른 토큰 + 조사** 꼴의 짝을 찾는다.
 *   '공을' 과 '공' 이 함께 있으면 '공을' 은 어절일 확률이 높다.
 *   '가을' 은 '가' 가 목록에 없으므로 걸리지 않는다.
 *
 * 잡을 수 없는 것: 어간이 목록에 없는 어절('아침에' 만 있고 '아침' 이 없으면 못 본다).
 * 그건 사람이 목록을 읽어야 한다.
 */
import path from 'node:path';
import { REPO_ROOT, writeJson } from '../src/ontology/source.mjs';
import { vocabularyFor } from '../src/curriculum/korean-vocab.mjs';

/** 어절 끝에 붙는 조사. 자기승인 판정에만 쓴다. */
const PARTICLES = [
  '에서는', '으로는', '에게는', '에는', '에도', '와는', '과는',
  '에서', '으로', '에게', '까지', '부터', '보다', '처럼', '같이',
  '은', '는', '이', '가', '을', '를', '와', '과', '로', '도', '만', '의', '에',
];

/**
 * 정상 낱말인데 우연히 '다른 낱말 + 조사' 로 쪼개지는 것.
 *
 * 게이트가 옳은 낱말을 위반이라 부르면 결국 꺼진다(§13 오탐 원칙). 여기 적은 것은
 * 전부 그 자체로 한 낱말이고, 앞부분이 목록에 있는 것은 우연이다.
 */
const COINCIDENCE = new Set([
  '가을',   // '가' + '을' 이 아니라 계절 이름이다
  '나비',   // '나' + '비' 로 쪼개지지 않는다
  '개와',   // 실제로는 없어야 하지만 '개' 가 목록에 있으면 걸린다
  '무엇',   // '무' + '엇' 이 아니다
  '바다',   // '바' 가 목록에 있으면 걸린다
  '사과',   // '사' + '과' 가 아니라 과일 이름이다
  '만나다', // '만' 으로 시작하지만 용언이다
  '도서관', // '도' 로 시작하지만 한 낱말이다
  '나이',   // '나' + '이' 가 아니다
  '가위',   // '가' 로 시작하지만 한 낱말이다
  '오이',   // '오' + '이' 가 아니다
  '거미',   // 한 낱말이다
  '개미',   // 한 낱말이다
  // 시제 문항의 시간 부사어다(TENSE_CASES). '작년에 ~했습니다' 처럼 조사가 붙은
  // 꼴로 문항에 나가야 뜻이 성립한다. 어간 '작년' 만 두면 발문을 만들 수 없다.
  // 어절이지만 이 자산은 어절이 곧 단위다.
  '작년에',
]);

const bands = ['1-2', '3-4', '5-6'];
const findings = [];
let tokenCount = 0;

for (const band of bands) {
  const words = vocabularyFor(band);
  const set = new Set(words);
  tokenCount += words.length;

  for (const w of words) {
    if (COINCIDENCE.has(w)) continue;
    for (const p of PARTICLES) {
      if (!w.endsWith(p)) continue;
      const stem = w.slice(0, -p.length);
      // 어간이 한 글자면 조사가 붙은 어절과 구별할 수 없다. 두 글자 이상만 본다.
      if ([...stem].length < 2) continue;
      if (!set.has(stem)) continue;
      findings.push({ band, token: w, stem, particle: p });
      break;
    }
  }
}

writeJson(path.join(REPO_ROOT, 'data', 'audit', 'vocab-selfapproval-check.json'), {
  schema: 'digi-mon/vocab-selfapproval-check@1',
  note: '목록 안에서 토큰 = 다른 토큰 + 조사 꼴을 찾는다. 어간이 목록에 없는 어절은 잡지 못한다.',
  bands,
  tokenCount,
  coincidenceAllowed: [...COINCIDENCE],
  findingCount: findings.length,
  findings,
});

console.log(`어휘 자기승인 검사: 학년군 3개, 토큰 ${tokenCount}건 (예외 ${COINCIDENCE.size}종)`);
console.log(`목록 안에 어절로 들어온 것: ${findings.length}건`);
console.log('어간이 목록에 없는 어절은 이 게이트가 못 본다. 목록은 사람이 읽어야 한다.');

if (findings.length > 0) {
  console.log('');
  console.log('어절이 어휘 목록에 있다 — 자산이 스스로 승인했다. 자산에서 조사를 떼거나 예외에 사유와 함께 등록할 것:');
  for (const f of findings.slice(0, 20)) {
    console.log(`  [${f.band}] '${f.token}' = '${f.stem}' + '${f.particle}'`);
  }
  process.exitCode = 1;
}
