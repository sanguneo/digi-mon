/** 학습지를 사람이 읽는 텍스트로 렌더한다. 인쇄·PDF 변환의 중간 표현이다. */

/** 작도 문항은 빈 칸 대신 그릴 자리를 준다. */
const DRAW_BOX = [
  '    ┌──────────────────────────────┐',
  '    │                              │',
  '    │                              │',
  '    │                              │',
  '    └──────────────────────────────┘',
];

function renderItem(item, { showAnswer = false } = {}) {
  const lines = [`${String(item.number).padStart(2)}. ${item.instruction ?? ''}`.trimEnd()];
  if (item.stem.trim().length > 0) lines.push(`    ${item.stem}`);

  if (item.figure) {
    lines.push(`    [그림 ${item.figure.kind}] ${item.figure.altText}`);
  }
  if (item.choices) {
    lines.push(`    ${item.choices.map((c) => `${c.label} ${c.text}`).join('   ')}`);
  }

  if (item.scoring === 'manual') {
    lines.push(...DRAW_BOX);
    if (showAnswer) {
      lines.push('    채점 기준 (사람이 확인):');
      for (const r of item.answer.rubric) lines.push(`      · ${r}`);
    }
    return lines.join('\n');
  }

  if (showAnswer) {
    lines.push(`    답: ${item.answer.display}`);
    for (const step of item.solution) lines.push(`      · ${step}`);
  } else {
    lines.push('    답: ______________');
  }
  return lines.join('\n');
}

export function renderWorksheet(worksheet) {
  const out = [];
  out.push(`${worksheet.title}`);
  out.push(`${'='.repeat(Math.max(20, worksheet.title.length * 2))}`);
  out.push(`문항 ${worksheet.produced}개   난이도 ${Object.entries(worksheet.difficultyHistogram).map(([k, v]) => `${k}:${v}`).join(' ')}   seed ${worksheet.seed}`);
  out.push(`성취기준 ${worksheet.standardsUsed.join(' ')}`);
  out.push('');
  for (const item of worksheet.items) {
    out.push(renderItem(item));
    out.push('');
  }
  return out.join('\n');
}

export function renderAnswerKey(worksheet) {
  const out = [];
  out.push(`${worksheet.title} — 정답과 풀이`);
  out.push(`${'='.repeat(Math.max(20, worksheet.title.length * 2))}`);
  out.push(`seed ${worksheet.seed} (같은 seed 로 동일한 학습지를 다시 만들 수 있다)`);
  out.push('');
  for (const item of worksheet.items) {
    out.push(renderItem(item, { showAnswer: true }));
    out.push(`      ${item.standardCode} ${item.skill} (난이도 ${item.difficulty})`);
    out.push('');
  }
  return out.join('\n');
}
