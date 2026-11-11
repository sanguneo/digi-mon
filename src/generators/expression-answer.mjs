/**
 * '식을 쓰고 답을 구하시오' 문항의 응답 표기.
 *
 * 답 칸이 하나라서 학생은 식과 답을 한 줄에 함께 쓴다('□ - 19 = 1, □ = 20', '8 + 4 = 12, 12개').
 * 지시문이 식과 답을 둘 다 요구하므로 이 표기를 정답으로 받는다. 답만 쓴 표기와 답이 들어 있는
 * 식만 쓴 표기는 호출자가 따로 넣는다.
 *
 * @param {string[]} expressions 식 표기들(□가 있는 식이면 □ = 답 꼴도 만든다)
 * @param {number | string} value 답의 수
 * @param {string} [unit] 답에 붙이는 단위
 * @returns {string[]}
 */
export function expressionAnswerForms(expressions, value, unit = '') {
  const answers = unit ? [`${value}`, `${value}${unit}`] : [`${value}`];
  return expressions.flatMap((expr) => [
    ...answers.map((answer) => `${expr}, ${answer}`),
    ...(expr.includes('□') ? answers.map((answer) => `${expr}, □ = ${answer}`) : []),
    ...answers.map((answer) => `${expr} / 답 ${answer}`),
  ]);
}
