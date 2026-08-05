#!/usr/bin/env node
/**
 * 수학 문항을 교과 전문가가 읽을 표로 낸다.
 *
 * 다섯 회차의 외부 검토가 전부 국어·영어 자산을 팠다. 수학은 초기에 120/120 이 되고
 * 나서 **한 번도 내용 검토 대상이 아니었다** — 자산 검토표 26종 264항목에 수학
 * 생성기 147개 중 0개가 올라 있다.
 *
 * 이유는 형태가 달라서다. 국어·영어는 문장 목록이라 표로 그대로 뽑히는데 수학은
 * 파라메트릭 생성기라 '자산' 이 없다. 그래서 표를 못 만들고 넘어갔고, 검토 요청도
 * §12-F 에 "명백한 오류가 보이면 알려 달라" 는 한 줄로만 남았다.
 *
 * 생성기마다 난이도별 실제 문항을 뽑아 싣는다. 게이트가 걸러 낸 것은 답이 맞는지이고,
 * **교육과정에 맞는지·학년 수준인지는 사람이 봐야 한다.**
 * 게이트가 생성하며 손으로 고치지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadOntology } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';
import { MANUAL_SCORING, PARTIAL_SCORING } from '../src/curriculum/scoring-policy.mjs';

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const byCode = new Map(spine.standards.map((s) => [s.code, s]));

const outDir = path.join(REPO_ROOT, 'docs', 'review');
fs.mkdirSync(outDir, { recursive: true });

const esc = (v) => String(v ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');

/** 한 생성기에서 난이도별 문항 하나씩. 시드를 고정해 표가 매번 같게 나온다. */
function samplesOf(generator, standard) {
  const out = [];
  for (const d of generator.difficulties ?? [1, 2, 3]) {
    try {
      const item = generateItem(generator, standard, createRng(`${generator.id}|review|${d}`), d);
      out.push({
        difficulty: d,
        stem: item.stem,
        choices: item.choices ? item.choices.map((c) => c.text).join(' / ') : '',
        answer: item.answer.display,
        solution: (item.solution ?? []).join(' → '),
        figure: item.figure ? item.figure.kind : '',
      });
    } catch (err) {
      out.push({ difficulty: d, stem: `(생성 실패: ${err.message})`, choices: '', answer: '', solution: '', figure: '' });
    }
  }
  return out;
}

const mathStandards = spine.standards
  .filter((s) => s.subject === 'math')
  .sort((a, b) => a.code.localeCompare(b.code));

const lines = [
  '# 수학 문항 검토표 — 2022 개정 초등 수학',
  '',
  '`REVIEW.md` §12-F의 판정 대상이다. **다섯 회차의 외부 검토가 전부 국어·영어를 팠고',
  '수학은 한 번도 내용 검토를 받지 않았다.** 자산 검토표 264항목에 수학 생성기 147개 중',
  '0개가 올라 있다.',
  '',
  '형태가 달라서 넘어갔다. 국어·영어는 문장 목록이라 표로 그대로 뽑히는데 수학은',
  '파라메트릭 생성기라 "자산"이 없다. 그래서 생성기마다 실제 문항을 뽑아 싣는다.',
  '',
  '**게이트가 이미 보장하는 것 — 다시 볼 필요 없다.**',
  '',
  '- 답이 맞는가: `verify()`가 독립 경로로 되짚는다. 21,027개 틀린 답을 주입해 통과 0.',
  '- 조사·표기: 문면 71,216건 위반 0.',
  '- 난이도가 실제로 커지는가: 계산 크기 측정. 평평 0.',
  '- 문항 용량·중복·표기 다듬기: 각각 게이트가 있다.',
  '',
  '**사람이 봐야 하는 것 — 이 표의 목적이다.**',
  '',
  '1. **학년 수준**이 맞는가. 3~4학년 문항에 5~6학년 개념이 섞이지 않았는가.',
  '   (이미 겪었다: 3~4학년에 5학년 약분, `[2수03-01]` 선택지에 정육면체, km→mm 백만 배 환산)',
  '2. **성취기준과 문항이 맞는가.** 코드는 맞는데 다른 것을 묻고 있지 않은가.',
  '   저작자는 **성취기준 원문을 본 적이 없다** — 상위 저장소가 저작권상 원문을 담지 않는다.',
  '   코드·학년군·영역·소주제만 대조하고 내용은 저작자 지식으로 만들었다.',
  '3. **오개념을 심지 않는가.** (이미 겪었다: 대칭축 문항이 정다각형만 다뤄 "대칭축 수 = 변의 수"를',
  '   심고 있었고, 검산기도 같은 오개념을 전제해 반례 168건을 오답 처리했다)',
  '4. **풀이 절차**가 교실에서 가르치는 방식과 맞는가.',
  '',
  '게이트가 생성하며 손으로 고치지 않는다.',
  '',
];

let generatorCount = 0;
let sampleCount = 0;
const domains = new Map();

for (const std of mathStandards) {
  const gens = registry.forStandard(std.code);
  if (gens.length === 0) continue;
  domains.set(std.domain, (domains.get(std.domain) ?? 0) + gens.length);
}

lines.push(
  '## 규모',
  '',
  `- 성취기준 ${mathStandards.length}개 · 생성기 ${registry.all().filter((g) => g.id.startsWith('math.')).length}개`,
  `- 영역별: ${[...domains].map(([d, n]) => `${d} ${n}`).join(' · ')}`,
  '',
  '---',
  '',
);

for (const std of mathStandards) {
  const gens = registry.forStandard(std.code);
  const manual = MANUAL_SCORING[std.code];
  const partial = PARTIAL_SCORING[std.code];

  lines.push(`## \`${std.code}\` ${std.module ?? ''}`, '');
  lines.push(`- ${std.gradeBand}학년군 · ${std.domain} · 생성기 ${gens.length}개`);
  if (manual) lines.push(`- **자동채점 불가**(${manual.kind}): ${manual.reason}`);
  if (partial) lines.push(`- **부분 채점**: 재는 것 — ${partial.scored} / 안 재는 것 — ${partial.notScored}`);
  lines.push('');

  if (gens.length === 0) {
    lines.push('생성기 없음.', '');
    continue;
  }

  for (const g of gens) {
    generatorCount += 1;
    const rows = samplesOf(g, std);
    sampleCount += rows.length;
    lines.push(`### ${g.skill}`, '');
    lines.push(`\`${g.id}\` · ${g.format} · 난이도축 ${g.difficultyAxis ?? 'numeric'}`);
    if (g.difficultyNote) lines.push(`> ${g.difficultyNote}`);
    if (g.capacityNote) lines.push(`> 용량: ${g.capacityNote}`);
    lines.push('');
    lines.push('| 난이도 | 발문 | 선택지 | 정답 | 풀이 |');
    lines.push('|---|---|---|---|---|');
    for (const r of rows) {
      const stem = r.figure ? `${esc(r.stem)} <br>[그림: ${r.figure}]` : esc(r.stem);
      lines.push(`| ${r.difficulty} | ${stem} | ${esc(r.choices) || '—'} | ${esc(r.answer)} | ${esc(r.solution)} |`);
    }
    lines.push('');
  }
}

fs.writeFileSync(path.join(outDir, 'math.md'), `${lines.join('\n')}\n`, 'utf8');

console.log(`수학 검토표: 성취기준 ${mathStandards.length}개 · 생성기 ${generatorCount}개 · 표본 ${sampleCount}문항`);
console.log('-> docs/review/math.md');
