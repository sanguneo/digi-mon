#!/usr/bin/env node
/**
 * 저작자가 지은 자산을 사람이 읽을 표로 낸다.
 *
 * REVIEW.md §12-B 가 "저작자가 지은 자산의 내용이 맞는가" 를 최우선 검토 질문으로
 * 두면서 개수만 표로 정리했다. 정작 **내용은 소스 3파일에 흩어져 있다.**
 * 선수 관계는 검토표로 뽑아 줬는데 자산은 안 뽑았다 — "검토 요청과 검토 가능한
 * 산출물은 다르다" 는 1차 검토의 지적이 여기서 반복됐다.
 *
 * 이 표가 필요한 이유는 §5 에 있다. 정답이 규칙이 아니라 사실인 문항은 verify 가
 * 같은 표를 되읽으므로 표가 틀리면 검산도 뮤테이션도 원리적으로 못 잡는다.
 * 3차 검토가 '자다 -> 자시다' 를, 4차가 9건을 잡은 것이 그 증거다.
 *
 * 게이트가 생성하며 손으로 고치지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../src/ontology/source.mjs';
import { josaI } from '../src/engine/korean-number.mjs';
import {
  ANTONYMS,
  DIALECTS,
  HONORIFICS,
  HYPERNYMS,
  IDIOMS,
  SENTENCE_FRAMES,
  SPELLING_PAIRS,
  TENSE_CASES,
} from '../src/curriculum/korean-vocab.mjs';
import {
  CLAIM_REASONS,
  FACT_OPINION,
  FIGURATIVE,
  FIX_SENTENCES,
  INFERENCE_DIALOGUES,
  MIND_SENTENCES,
  OPINION_REASON,
  PROCEDURES,
  READING_BREAKS,
  SENSORY,
} from '../src/curriculum/korean-sentences.mjs';
import {
  COMMANDS,
  EXPRESSIONS,
  QA_PAIRS_G34,
  QA_PAIRS_G56,
  SENTENCE_CASES,
  SENTENCE_MEANINGS,
  TEMPLATE_BLANKS,
  WORD_CLUES,
} from '../src/curriculum/english-vocab.mjs';
import { ASSET_REQUIREMENTS, assetKindCounts } from '../src/curriculum/asset-requirements.mjs';

const outDir = path.join(REPO_ROOT, 'docs', 'review');
fs.mkdirSync(outDir, { recursive: true });

const esc = (v) => String(v ?? '').replaceAll('|', '\\|');
const table = (head, rows) => [
  `| ${head.join(' | ')} |`,
  `|${head.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
].join('\n');

/**
 * 검토 대상 자산 12종.
 *
 * `ask` 는 검토자가 무엇을 판정해야 하는지다. 이것을 적지 않으면 표만 주고
 * "봐 달라" 고 하는 것이 되어 검토가 얕게 나온다.
 * `risk` 는 이 표가 틀렸을 때 문항에 무슨 일이 생기는지다.
 */
const SECTIONS = [
  {
    id: 'fact-opinion',
    title: '사실과 의견 문장',
    code: '[4국02-04]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '판정이 갈리는 문장이 있는가. `근거`가 그 판정을 실제로 뒷받침하는가.',
    risk: '판정이 갈리는 문장을 내면 아이가 옳게 답해도 오답이 된다.',
    head: ['문장', '분류', '판정 근거'],
    rows: FACT_OPINION.map((s) => [s.text, s.kind === 'fact' ? '사실' : '의견', s.basis]),
  },
  {
    id: 'figurative',
    title: '비유 표현 문장',
    code: '[6국05-02]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '직유·은유 분류가 맞는가. `견준 대상`이 맞는가. `비유 아님`이 정말 비유가 아닌가.',
    risk: '은유를 직유로 적으면 난이도 2 이상 문항의 정답이 틀린다.',
    head: ['문장', '분류', '견준 대상', '판정 근거'],
    rows: FIGURATIVE.map((s) => [
      s.text,
      { simile: '직유', metaphor: '은유', plain: '비유 아님' }[s.kind],
      s.vehicle ?? '—',
      s.basis,
    ]),
  },
  {
    id: 'reading-breaks',
    title: '띄어 읽을 자리',
    code: '[2국02-02]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '`정답 자리`가 국어 교육상 맞는가. **`허용 자리`가 정말 허용되는가** — 여기 없는 자리는 오답 선택지로 나간다. 판정 기준 세 가지(주어부·이어 주는 말·나열 끝)가 타당한가.',
    risk: '허용 자리를 빠뜨리면 관행상 옳은 자리를 틀렸다고 가르친다. 4차 검토가 이 부류를 잡았다.',
    head: ['문장', '정답 자리(어절 뒤)', '허용 자리', '판정 근거'],
    rows: READING_BREAKS.map((s) => [
      s.words.join(' '),
      `${s.words[s.breakAfter]} 뒤`,
      (s.alsoAcceptable ?? []).length === 0 ? '없음' : s.alsoAcceptable.map((i) => `${s.words[i]} 뒤`).join(', '),
      s.basis,
    ]),
  },
  {
    id: 'spelling',
    title: '맞춤법 짝',
    code: '[2국03-01]',
    file: 'src/curriculum/korean-vocab.mjs',
    ask: '`오표기`가 실제로 아이들이 흔히 틀리는 표기인가. `설명`이 맞는가.',
    risk: '오표기는 오답 선택지로 나간다. 실제로는 맞는 표기를 오표기로 적으면 정답이 둘이 된다.',
    head: ['바른 표기', '오표기', '설명'],
    rows: SPELLING_PAIRS.map((p) => [p.correct, p.wrong, p.note]),
  },
  {
    id: 'honorifics',
    title: '높임 표현 짝',
    code: '[4국04-04]',
    file: 'src/curriculum/korean-vocab.mjs',
    ask: '높임말이 맞는가. **주체 높임과 객체 높임이 섞여 있다** — 오답 풀이 이 표 안에서만 뽑히므로 지금은 안전하지만 분류가 맞는지 봐 달라.',
    risk: '3차 검토가 `자다 -> 자시다`(먹다의 높임말)를 잡았다. 정답이 선택지에 없는 문항이 나가고 있었다.',
    head: ['보통말', '높임말', '높임 종류'],
    // 진지·연세·성함·댁은 주체·객체 높임이 아니라 높임 어휘(존칭 명사)다 — 5차 검토 지적.
    rows: HONORIFICS.map((h) => [
      h.plain,
      h.honorific,
      ['드리다', '모시다', '여쭈다', '뵙다'].includes(h.honorific) ? '객체'
        : ['진지', '연세', '성함', '댁'].includes(h.honorific) ? '어휘(명사)' : '주체',
    ]),
  },
  {
    id: 'dialects',
    title: '표준어와 방언',
    code: '[6국04-02]',
    file: 'src/curriculum/korean-vocab.mjs',
    ask: '지역 표기가 사전에서 확인되는가. **4차에서 교체한 네 건**(감자/감재, 바다/바당, 김치/짐치, 어머니/어멍)을 특히 봐 달라 — 저작자가 스스로 검증하지 못해 교체한 것이 둘 있다.',
    risk: '방언은 지역민에게 사실성이 바로 노출된다. 표준어가 중복되면 역방향 문항의 정답이 둘이 된다.',
    head: ['표준어', '방언', '지역'],
    rows: DIALECTS.map((d) => [d.standard, d.dialect, d.region]),
  },
  {
    id: 'idioms',
    title: '관용 표현',
    code: '[6국04-03]',
    file: 'src/curriculum/korean-vocab.mjs',
    ask: '뜻풀이가 맞는가. 초등 수준에 적절한 표현인가.',
    risk: '두 표현이 같은 뜻이면 선택형에서 정답이 둘이 된다. 4차 검토가 부부 맥락 표현 하나를 걸러냈다.',
    head: ['관용 표현', '뜻'],
    rows: IDIOMS.map((i) => [i.idiom, i.meaning]),
  },
  {
    id: 'antonyms',
    title: '반대말',
    code: '[2국04-02]·[4국04-01]',
    file: 'src/curriculum/korean-vocab.mjs',
    ask: '반대말 관계가 맞는가. 학년 수준에 맞는가.',
    risk: '반대말이 아닌 짝을 넣으면 정답이 없는 문항이 된다.',
    head: ['낱말', '반대말'],
    rows: ANTONYMS.map((a) => [a[0], a[1]]),
  },
  {
    id: 'hypernyms',
    title: '포함 관계',
    code: '[4국04-01]',
    file: 'src/curriculum/korean-vocab.mjs',
    ask: '상위어와 하위어 관계가 맞는가. 하위어가 그 상위어에 정말 속하는가.',
    risk: '분류가 어긋나면 정답이 둘이 되거나 없어진다.',
    head: ['상위어', '하위어'],
    rows: HYPERNYMS.map((h) => [h.general, h.specific.join(', ')]),
  },
  {
    id: 'tense',
    title: '시제 사례',
    code: '[6국04-05]',
    file: 'src/curriculum/korean-vocab.mjs',
    ask: '시간 부사어와 서술어 시제가 맞게 짝지어졌는가. `오답 후보`가 정말 틀린 표현인가. 문맥 어절이 서술어와 어울리는가. (5차에서 현재 행 3개를 뺐다 — 현재형은 예정 미래를 나타내 판정이 갈린다)',
    risk: '오답 후보가 실은 맞는 표현이면 정답이 둘이 된다.',
    head: ['시간 부사어', '문맥', '시제', '알맞은 서술어', '오답 후보'],
    rows: TENSE_CASES.map((t) => [t.adverb, t.frame, t.tense, t.form, (t.wrong ?? []).join(', ')]),
  },
  {
    id: 'sentence-frames',
    title: '문장 성분 틀',
    code: '[4국04-03]',
    file: 'src/curriculum/korean-vocab.mjs',
    ask: '주어와 서술어가 호응하는가. 생물·무생물에 맞는 서술어인가.',
    risk: '호응이 어긋난 문장을 정답 예시로 쓰면 문법 문항이 틀린 문장을 가르친다.',
    head: ['문장', '주어', '서술어'],
    // 조사를 하드코딩하지 않는다. 이 저장소가 계속 잡아온 부류다(REVIEW.md §6).
    rows: SENTENCE_FRAMES.map((f) => [`${f.subject}${josaI(f.subject)} ${f.predicate}`, f.subject, f.predicate]),
  },
  {
    id: 'english-sentences',
    title: '영어 예문',
    code: '[6영02-03]',
    file: 'src/curriculum/english-vocab.mjs',
    ask: '문장 종류(평서·의문·감탄) 분류가 맞는가. **부호가 하나로 확정되는가.** 낱말이 학년군 수준인가.',
    risk: '4차 검토가 명령문 두 개를 잡았다 — 명령문은 마침표도 옳아 정답이 둘이었다. 대체한 감탄문이 영어로 자연스러운지도 봐 달라.',
    head: ['문장', '종류', '규칙'],
    rows: SENTENCE_CASES.map((s) => [s.correct, s.kind, s.rule]),
  },
  // ── 5차 수리에서 저작한 자산 — 아직 아무도 검토하지 않았다 ─────────────────
  {
    id: 'sensory',
    title: '감각적 표현 문장',
    code: '[4국05-04]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '감각 표현(의성어·의태어) 판정과 `무엇을 흉내`가 맞는가. 오답 낱말이 감각 표현으로 읽힐 여지는 없는가.',
    risk: '감각 표현이 아닌 것을 정답으로 적으면 문학 문항이 틀린 개념을 가르친다.',
    head: ['문장', '감각 표현', '무엇을 흉내', '오답 낱말', '판정 근거'],
    rows: SENSORY.map((s) => [s.text, s.word, s.sense, s.others.join(', '), s.basis]),
  },
  {
    id: 'mind',
    title: '인물의 마음 문장',
    code: '[2국02-03]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '문장이 그 마음 하나로만 읽히는가. 마음 낱말 4개(기쁘다·슬프다·무섭다·고맙다) 중 둘 이상이 어울리는 문장은 없는가.',
    risk: '두 마음이 다 어울리면 아이가 옳게 답해도 오답이 된다.',
    head: ['문장', '마음', '판정 근거'],
    rows: MIND_SENTENCES.map((s) => [s.text, s.feeling, s.basis]),
  },
  {
    id: 'opinion-reason',
    title: '의견과 이유 짝',
    code: '[4국03-03]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '이유가 그 의견만 뒷받침하는가 — **다른 의견의 이유로도 그럴듯하면 오답이 정답이 된다.**',
    risk: '이유끼리 주제가 겹치면 정답이 둘이 된다.',
    head: ['의견', '이유'],
    rows: OPINION_REASON.map((p) => [p.opinion, p.reason]),
  },
  {
    id: 'fix-sentences',
    title: '고쳐쓰기 문장 짝',
    code: '[6국03-05]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '오표기가 실제 낱말이 아닌가(실제 낱말이면 그 선택지도 바른 문장이 된다). 규칙 설명이 맞는가.',
    risk: '오표기가 우연히 다른 뜻의 바른 표기면 정답이 둘이 된다.',
    head: ['바른 문장', '오표기 1(맞춤법)', '오표기 2(띄어쓰기)', '규칙'],
    rows: FIX_SENTENCES.map((f) => [f.right, f.wrongs[0], f.wrongs[1], f.rule]),
  },
  {
    id: 'procedures',
    title: '절차 단계',
    code: '[4국03-02]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '단계 순서가 상식으로 확정되는가 — 순서를 바꿔도 말이 되는 절차면 배열 문항의 정답이 갈린다.',
    risk: '순서가 갈리는 절차를 넣으면 옳은 배열이 오답 처리된다.',
    head: ['절차', '단계 (순서대로)'],
    rows: PROCEDURES.map((p) => [p.title, p.steps.join(' → ')]),
  },
  {
    id: 'inference-dialogues',
    title: '추론 대화',
    code: '[6국01-01]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '대화의 근거로 정답이 유일하게 확정되는가. 오답 중 대화와 양립하는 것은 없는가.',
    risk: '복수 해석이 가능하면 추론 문항의 정답이 갈린다 — 이 부류의 위험이 원래 가장 높다.',
    head: ['대화', '물음', '정답', '오답', '판정 근거'],
    rows: INFERENCE_DIALOGUES.map((d) => [d.lines.join(' / '), d.question, d.answer, d.wrong.join(' · '), d.basis]),
  },
  {
    id: 'claim-reasons',
    title: '주장과 근거',
    code: '[6국01-02]',
    file: 'src/curriculum/korean-sentences.mjs',
    ask: '타당한 근거가 정말 타당한가. 무관 진술이 다른 주장을 그럴듯하게 뒷받침하지 않는가.',
    risk: '무관 진술이 어떤 주장과 이어지면 정답이 둘이 된다.',
    head: ['주장', '타당한 근거', '무관 진술'],
    rows: CLAIM_REASONS.map((c) => [c.claim, c.valid, c.invalid.join(' · ')]),
  },
  {
    id: 'sentence-meanings',
    title: '영어 문장과 뜻',
    code: '[4영01-05]',
    file: 'src/curriculum/english-vocab.mjs',
    ask: '번역이 맞는가. 뜻(한국어)끼리 분명히 갈리는가.',
    risk: '뜻이 겹치면 정답이 둘이 된다.',
    head: ['영어 문장', '뜻'],
    rows: SENTENCE_MEANINGS.map((s) => [s.en, s.ko]),
  },
  {
    id: 'word-clues',
    title: '영어 단어와 뜻 단서',
    code: '[4영02-03]',
    file: 'src/curriculum/english-vocab.mjs',
    ask: '뜻이 표 안에서 유일한가. 단어가 학년군 목록 안인가.',
    risk: '뜻이 겹치는 단어가 있으면 철자 문항의 정답이 둘이 된다.',
    head: ['단어', '뜻'],
    rows: WORD_CLUES.map((c) => [c.word, c.ko]),
  },
  {
    id: 'commands',
    title: '행동 지시 문장',
    code: '[4영02-06]',
    file: 'src/curriculum/english-vocab.mjs',
    ask: '상황과 지시문이 일대일인가. 지시문이 영어로 자연스러운가.',
    risk: '두 상황에 다 어울리는 지시문이 있으면 정답이 둘이 된다.',
    head: ['상황', '지시문'],
    rows: COMMANDS.map((c) => [c.situation, c.en]),
  },
  {
    id: 'expressions',
    title: '소개·묘사 문장',
    code: '[6영02-04]',
    file: 'src/curriculum/english-vocab.mjs',
    ask: '상황과 문장이 일대일인가. 문장이 영어로 자연스러운가.',
    risk: '두 상황에 다 어울리는 문장이 있으면 정답이 둘이 된다.',
    head: ['상황', '문장'],
    rows: EXPRESSIONS.map((c) => [c.situation, c.en]),
  },
  {
    id: 'template-blanks',
    title: '예시문 빈칸',
    code: '[6영02-08]',
    file: 'src/curriculum/english-vocab.mjs',
    ask: '오답 낱말이 문맥에 들어맞지 않는가 — **학년군 목록 안 낱말 중 문맥에 맞는 것이 정답뿐인가.**',
    risk: '오답이 문맥에 맞으면 정답이 둘이 된다.',
    head: ['예시문', '정답', '오답'],
    rows: TEMPLATE_BLANKS.map((t) => [t.text, t.answer, t.wrong.join(', ')]),
  },
  {
    id: 'qa-g34',
    title: '묻고 답하기 (3-4)',
    code: '[4영02-08]',
    file: 'src/curriculum/english-vocab.mjs',
    ask: '오답 응답이 그 물음의 답으로 읽힐 여지가 없는가 — 형태가 비슷한 응답이 특히 위험하다.',
    risk: '오답이 물음에 그럴듯하면 정답이 둘이 된다.',
    head: ['물음', '정답 응답', '오답 응답'],
    rows: QA_PAIRS_G34.map((p) => [p.q, p.a, p.wrong.join(' · ')]),
  },
  {
    id: 'qa-g56',
    title: '세부 정보 묻고 답하기 (5-6)',
    code: '[6영02-07]',
    file: 'src/curriculum/english-vocab.mjs',
    ask: '오답 응답이 그 물음의 답으로 읽힐 여지가 없는가.',
    risk: '오답이 물음에 그럴듯하면 정답이 둘이 된다.',
    head: ['물음', '정답 응답', '오답 응답'],
    rows: QA_PAIRS_G56.map((p) => [p.q, p.a, p.wrong.join(' · ')]),
  },
];

const lines = [
  '# 저작자가 지은 자산 검토표',
  '',
  '`REVIEW.md` §12-B의 판정 대상이다. **게이트가 원리적으로 못 닿는 영역이다.**',
  '',
  '정답이 규칙이 아니라 **사실**인 문항은 `verify`가 같은 표를 되읽는다. 표의 항목이 틀리면',
  '검산도 뮤테이션 테스트도 못 잡는다. 3차 검토가 `자다 → 자시다`를, 4차 검토가 9건을 잡은',
  '것이 그 증거다. 구조는 `check-fact-tables`가 보지만 **내용의 참·거짓은 사람이 봐야 한다.**',
  '',
  '이 표의 문장·낱말은 전부 이 저장소가 직접 지은 것이고 어디서 가져온 것이 아니다.',
  '게이트가 생성하며 손으로 고치지 않는다.',
  '',
  `## 목차`,
  '',
  ...SECTIONS.map((s) => `- [${s.title}](#${s.id}) — ${s.rows.length}항목 · \`${s.code}\``),
  '',
  `합계 **${SECTIONS.reduce((n, s) => n + s.rows.length, 0)}항목**`,
  '',
  '---',
  '',
];

for (const s of SECTIONS) {
  lines.push(
    `<a id="${s.id}"></a>`,
    '',
    `## ${s.title}`,
    '',
    `- 성취기준 \`${s.code}\` · ${s.rows.length}항목 · \`${s.file}\``,
    `- **판정해 달라:** ${s.ask}`,
    `- **틀리면:** ${s.risk}`,
    '',
    table(s.head, s.rows),
    '',
  );
}

// 자산 요구도 함께 낸다 — 아직 아무도 검토하지 않았다.
const counts = assetKindCounts();
lines.push(
  '---',
  '',
  '<a id="asset-requirements"></a>',
  '',
  '## 자산 요구 (미충족 성취기준)',
  '',
  `- ${Object.keys(ASSET_REQUIREMENTS).length}항목 · \`src/curriculum/asset-requirements.mjs\``,
  '- **판정해 달라:** `조달 성격` 배정이 맞는가. `필요 자산`이 그 성취기준을 열기에 **충분한가.**',
  '  특히 `sentence`로 분류한 것이 정말 지문 없이 성립하는가 — 그것이 다음에 열 대상이다.',
  '- **틀리면:** 자산 조달 우선순위가 어긋난다. `passage`는 저작권 판단이 선행하므로 비용이 다르다.',
  '',
  `조달 성격별: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `\`${k}\` ${v}`).join(' · ')}`,
  '',
  table(
    ['코드', '조달 성격', '필요 자산', '비고'],
    Object.entries(ASSET_REQUIREMENTS)
      .sort((a, b) => a[1].kind.localeCompare(b[1].kind) || a[0].localeCompare(b[0]))
      .map(([code, r]) => [`\`${code}\``, r.kind, r.need, r.note ?? '—']),
  ),
  '',
);

fs.writeFileSync(path.join(outDir, 'assets.md'), `${lines.join('\n')}\n`, 'utf8');

console.log(`자산 검토표: ${SECTIONS.length}종 ${SECTIONS.reduce((n, s) => n + s.rows.length, 0)}항목`);
console.log(`자산 요구: ${Object.keys(ASSET_REQUIREMENTS).length}항목 -> docs/review/assets.md`);
