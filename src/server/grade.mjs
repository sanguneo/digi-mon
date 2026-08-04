/**
 * 채점. 저장소가 필요 없다.
 *
 * 학습지는 seed + 옵션으로 완전히 결정되므로, 채점 요청이 오면 같은 학습지를
 * 다시 만들어서 대조한다. 문항을 DB에 넣어 둘 필요가 없다.
 */

const CHOICE_LABELS = ['①', '②', '③', '④', '⑤'];

/** 표기 차이를 흡수한다. 정답 판정이 전각/공백/쉼표 때문에 갈리면 안 된다. */
export function normalizeResponse(value) {
  return String(value ?? '')
    .trim()
    .replace(/[＞]/g, '>')
    .replace(/[＜]/g, '<')
    .replace(/[，]/g, ',')
    .replace(/[×✕✖]/g, '×')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/\s*([+\-×=><])\s*/g, '$1');
}

/**
 * 선택형 응답은 라벨(①, 1, 가)로도 들어온다. 라벨이면 선택지 본문으로 바꾼다.
 */
function resolveChoiceResponse(item, raw) {
  const trimmed = String(raw ?? '').trim();
  const byLabel = item.choices.find((c) => c.label === trimmed);
  if (byLabel) return byLabel.text;
  const asIndex = Number(trimmed);
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= item.choices.length) {
    return item.choices[asIndex - 1].text;
  }
  const labelIndex = CHOICE_LABELS.indexOf(trimmed);
  if (labelIndex >= 0 && labelIndex < item.choices.length) return item.choices[labelIndex].text;
  return trimmed;
}

export function gradeItem(item, response) {
  const submitted = item.format === 'multiple-choice'
    ? resolveChoiceResponse(item, response)
    : response;
  const normalized = normalizeResponse(submitted);
  const accepted = item.answer.accepts.map(normalizeResponse);
  const answered = normalized.length > 0;
  const correct = answered && accepted.includes(normalized);

  return {
    number: item.number,
    itemId: item.id,
    standardCode: item.standardCode,
    skill: item.skill,
    difficulty: item.difficulty,
    answered,
    correct,
    submitted: response ?? null,
    expected: item.answer.display,
    solution: correct ? undefined : item.solution,
  };
}

/**
 * 학습지 전체 채점 + 성취기준별 집계.
 * 집계는 '다음에 무엇을 더 연습해야 하는가'로 이어지는 유일한 신호다.
 */
export function gradeWorksheet(worksheet, responses) {
  const byNumber = new Map(worksheet.items.map((it) => [it.number, it]));
  const results = [];

  for (const [key, value] of Object.entries(responses ?? {})) {
    const number = Number(key);
    const item = byNumber.get(number);
    if (!item) continue;
    results.push(gradeItem(item, value));
  }
  results.sort((a, b) => a.number - b.number);

  const byStandard = {};
  for (const r of results) {
    byStandard[r.standardCode] ??= { attempted: 0, correct: 0, skills: {} };
    const b = byStandard[r.standardCode];
    b.attempted += 1;
    if (r.correct) b.correct += 1;
    b.skills[r.skill] ??= { attempted: 0, correct: 0 };
    b.skills[r.skill].attempted += 1;
    if (r.correct) b.skills[r.skill].correct += 1;
  }
  for (const b of Object.values(byStandard)) {
    b.accuracy = b.attempted === 0 ? null : Number((b.correct / b.attempted).toFixed(4));
  }

  const correct = results.filter((r) => r.correct).length;
  const weakStandards = Object.entries(byStandard)
    .filter(([, b]) => b.accuracy !== null && b.accuracy < 0.6)
    .map(([code, b]) => ({ code, accuracy: b.accuracy }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return {
    seed: worksheet.seed,
    graded: results.length,
    total: worksheet.items.length,
    correct,
    accuracy: results.length === 0 ? null : Number((correct / results.length).toFixed(4)),
    byStandard,
    weakStandards,
    results,
  };
}
