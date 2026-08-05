#!/usr/bin/env node
/**
 * 교과 전문가·검토자가 읽을 표를 내보낸다.
 *
 * 검토를 요청하는 것과 검토 가능한 산출물을 주는 것은 다르다. REVIEW.md §12 가
 * 선수 관계 154개 간선과 영어 40개 성취기준의 판정을 요청하지만, 지금은 코드와
 * 391KB JSON 안에만 있어 읽으려면 저장소를 파야 한다.
 *
 * 두 표를 낸다.
 *   docs/review/prerequisites.md  선수 간선 154개 (양끝 기준의 소주제·학년군 포함)
 *   docs/review/english.md        영어 40개 성취기준 (현재 분류와 판정 대상 표시)
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadOntology } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { MATH_PREREQUISITES, ancestorsOf, dependentsOf, learningOrder } from '../src/curriculum/prerequisites.mjs';
import { MANUAL_SCORING } from '../src/curriculum/scoring-policy.mjs';

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const byCode = new Map(spine.standards.map((s) => [s.code, s]));
const outDir = path.join(REPO_ROOT, 'docs', 'review');
fs.mkdirSync(outDir, { recursive: true });

const label = (code) => {
  const st = byCode.get(code);
  if (!st) return { anchor: '(스파인에 없음)', band: '?', domain: '?' };
  return { anchor: st.module ?? st.contentAnchor ?? '(라벨 없음)', band: st.gradeBand, domain: st.domain };
};

// ── 1. 선수 관계 검토표 ─────────────────────────────────────────────────────
const order = learningOrder();
const rank = new Map(order.map((c, i) => [c, i]));

const edges = [];
for (const [code, prereqs] of Object.entries(MATH_PREREQUISITES)) {
  for (const p of prereqs) edges.push({ from: p, to: code });
}
edges.sort((a, b) => (rank.get(a.to) - rank.get(b.to)) || a.from.localeCompare(b.from));

const crossBand = edges.filter((e) => label(e.from).band !== label(e.to).band);
const crossDomain = edges.filter((e) => label(e.from).domain !== label(e.to).domain);

const preLines = [
  '# 선수 관계 검토표 — 2022 개정 초등 수학',
  '',
  '`src/curriculum/prerequisites.mjs` 를 사람이 읽을 표로 낸 것이다. 게이트가 생성하며 손으로 고치지 않는다.',
  '',
  '**이 간선은 이 저장소가 저작한 추천 순서이고 보편 법칙이 아니다.** 교과 전문가 검토 대상이다.',
  '판정해 달라: 교육과정상 틀린 간선이 있는가. 빠진 간선이 있는가. 특히 영역·학년군을 넘는 것.',
  '',
  `- 성취기준 ${Object.keys(MATH_PREREQUISITES).length}개 · 간선 ${edges.length}개`,
  `- 학년군을 넘는 간선 ${crossBand.length}개 · 영역을 넘는 간선 ${crossDomain.length}개`,
  `- 뿌리 기준(선수 없음) ${Object.values(MATH_PREREQUISITES).filter((v) => v.length === 0).length}개`,
  '',
  '표는 학습 순서(위상 정렬)로 정렬했다. `넘김` 열의 `학년군`·`영역`이 검토 초점이다.',
  '',
  '| 후속 기준 | 후속 소주제 | 학년군 | ← | 선수 기준 | 선수 소주제 | 학년군 | 넘김 |',
  '|---|---|---|---|---|---|---|---|',
];
for (const e of edges) {
  const to = label(e.to);
  const from = label(e.from);
  const marks = [];
  if (from.band !== to.band) marks.push('학년군');
  if (from.domain !== to.domain) marks.push('영역');
  preLines.push(`| \`${e.to}\` | ${to.anchor} | ${to.band} | ← | \`${e.from}\` | ${from.anchor} | ${from.band} | ${marks.join('·') || '—' } |`);
}

preLines.push('', '## 선수가 가장 깊은 기준', '', '| 기준 | 소주제 | 선수 개수 | 후속 개수 |', '|---|---|---:|---:|');
const depth = Object.keys(MATH_PREREQUISITES)
  .map((c) => ({ code: c, a: ancestorsOf(c).length, d: dependentsOf(c).length }))
  .sort((x, y) => y.a - x.a);
for (const r of depth.slice(0, 10)) {
  preLines.push(`| \`${r.code}\` | ${label(r.code).anchor} | ${r.a} | ${r.d} |`);
}

preLines.push('', '## 후속을 가장 많이 막는 기준 (여기서 막히면 크다)', '', '| 기준 | 소주제 | 후속 개수 | 막히는 후속 |', '|---|---|---:|---|');
for (const r of [...depth].sort((x, y) => y.d - x.d).slice(0, 8)) {
  preLines.push(`| \`${r.code}\` | ${label(r.code).anchor} | ${r.d} | ${dependentsOf(r.code).map((c) => `\`${c}\``).join(' ')} |`);
}

fs.writeFileSync(path.join(outDir, 'prerequisites.md'), `${preLines.join('\n')}\n`, 'utf8');

// ── 2. 영어 성취기준 판정표 ─────────────────────────────────────────────────
const english = spine.standards.filter((s) => s.subject === 'english');
const covered = new Set(registry.all().map((g) => g.standardCode));

const engLines = [
  '# 영어 성취기준 판정표 — 2022 개정 초등 영어',
  '',
  '`REVIEW.md` §12-A 의 판정 대상이다. 게이트가 생성하며 손으로 고치지 않는다.',
  '',
  '**판정해 달라:** `판정 대상` 으로 표시한 기준이 원리적 자동채점 불가(태도·음성 산출·개방 산출)인가,',
  '아니면 자산이 오면 채점할 수 있는 것인가.',
  '',
  '근거: 국어 73개를 전수 재분류하니 38개(52%)가 원리적 불가로 드러났다. 영어는 11개만 뺐다.',
  '같은 비율이면 더 있을 것이다.',
  '',
  '| 코드 | 학년군 | 영역 | 성취기준 내용 (상위 저장소 summary) | 현재 분류 |',
  '|---|---|---|---|---|',
];
for (const st of english) {
  const manual = MANUAL_SCORING[st.code];
  let status;
  if (manual) status = `**자동채점 불가** (${manual.kind})`;
  else if (covered.has(st.code)) status = '생성기 있음';
  else status = '**판정 대상** (자산 대기로 분류돼 있음)';
  engLines.push(`| \`${st.code}\` | ${st.gradeBand} | ${st.domain} | ${st.summary} | ${status} |`);
}

const pending = english.filter((s) => !MANUAL_SCORING[s.code] && !covered.has(s.code));
engLines.push(
  '',
  `## 요약`,
  '',
  `- 전체 ${english.length}개`,
  `- 자동채점 불가로 이미 분류 ${english.filter((s) => MANUAL_SCORING[s.code]).length}개`,
  `- 생성기 있음 ${english.filter((s) => covered.has(s.code)).length}개`,
  `- **판정 대상 ${pending.length}개**`,
  '',
  '판정 대상 중 "말하거나 쓰는" 이 섞인 기준은 음성 산출과 개방 산출이 함께 있어 특히 갈린다.',
);

fs.writeFileSync(path.join(outDir, 'english.md'), `${engLines.join('\n')}\n`, 'utf8');

console.log(`선수 관계 검토표: 간선 ${edges.length}개 (학년군 넘김 ${crossBand.length} · 영역 넘김 ${crossDomain.length}) -> docs/review/prerequisites.md`);
console.log(`영어 판정표: ${english.length}개 중 판정 대상 ${pending.length}개 -> docs/review/english.md`);
