#!/usr/bin/env node
/**
 * 타입 검사. 빌드 단계는 만들지 않는다 — tsc 는 검사만 하고(noEmit) 아무것도 내지 않는다.
 *
 * tsc 는 include 로 지정한 파일뿐 아니라 그것이 import 하는 파일까지 전부 프로그램에
 * 넣고 진단을 낸다. 그래서 src/engine 만 검사하려 해도 registry.mjs 가 끌어오는
 * 생성기 193개가 함께 딸려 온다. 지금 생성기 쪽 진단은 tsc 가 구조 분해 매개변수를
 * 튜플로 추론해서 나는 것이고(코드 자체는 옳다), 고치려면 생성기 파일을 손대야 하는데
 * 수학 생성기는 검토 지문(MATH_GENERATOR_REVIEW.reviewFingerprint)이 걸려 있다.
 * 주석 한 줄만 바꿔도 지문이 어긋나 의미 커버리지가 0으로 무너진다 — 실제로 겪었다.
 * 사람 검토 없이 통과시킬 수 없는 영역이므로, 이 게이트는 검사 범위를 src/engine 으로
 * 좁힌다. 범위 밖 진단은 숨기지 않고 참고로 전부 출력한다.
 *
 * 범위는 넓히는 방향으로만 바꾼다: engine → curriculum → server → generators.
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENFORCED_PREFIX = 'src/engine/';

const tsc = spawnSync(
  process.execPath,
  [path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json', '--pretty', 'false'],
  { cwd: ROOT, encoding: 'utf8' },
);

if (tsc.error) {
  console.error(`tsc 를 실행하지 못했다: ${tsc.error.message}`);
  process.exitCode = 1;
} else {
  const lines = `${tsc.stdout ?? ''}${tsc.stderr ?? ''}`
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const diagnostics = lines.filter((line) => /error TS\d+:/.test(line));
  const enforced = diagnostics.filter((line) => line.replace(/\\/g, '/').startsWith(ENFORCED_PREFIX));
  const outOfScope = diagnostics.filter((line) => !enforced.includes(line));

  console.log(`타입 검사: 진단 ${diagnostics.length}건 (검사 범위 ${ENFORCED_PREFIX} ${enforced.length}건)`);

  if (outOfScope.length > 0) {
    console.log('');
    console.log('범위 밖 진단 (참고 — 지금은 실패시키지 않는다):');
    for (const line of outOfScope) console.log(`  ${line}`);
  }

  if (enforced.length > 0) {
    console.error('');
    console.error(`${ENFORCED_PREFIX} 타입 오류:`);
    for (const line of enforced) console.error(`  ${line}`);
    process.exitCode = 1;
  }
}
