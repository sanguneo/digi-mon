/**
 * AI 문항 작성 프롬프트.
 *
 * 문장 규칙은 general-good-writing 스킬의 한국어·영어 지침
 * (references/ko/README.md, references/en/README.md)에서 문항에 해당하는 것만 옮겼다.
 * 프롬프트로 다 막을 수는 없다. 게이트(src/authoring/gates.mjs)와 GGW 린터가 다시 거른다.
 * 문구를 바꾸면 PROMPT_VERSION 을 올린다. 코퍼스 문항의 provenance 에 남는다.
 */
import { AUTHORED_DIFFICULTY_NOTE } from '../generators/authored.mjs';

export const PROMPT_VERSION = 'digi-mon/authoring-prompt@1';

/** 영어 문항에 쓸 수 있는 사람 이름. 공식 어휘가 아니므로 이 목록만 허용한다. */
export const ENGLISH_NAMES = ['Mina', 'Minsu', 'Jiho', 'Yuna', 'Tom', 'Amy'];

const KOREAN_STYLE = [
  '발문(instruction)은 "~고르시오." 로 끝나는 한 문장이다. 교과서 문항 말투를 쓴다.',
  '지문(stem)의 문장은 "~습니다/~ㅂ니다" 체로, 초등학생이 소리 내어 읽어도 자연스러운 우리말로 쓴다.',
  '풀이(solution)는 "~다." 로 끝나는 짧은 문장 1~3개다. 왜 그 답인지 근거를 문항 안의 말로 든다.',
  '번역투를 쓰지 않는다: "~에 있어서", "~를 통해", "~하는 것은 ~하기 때문이다", "~되어지다", 영어식 수동태.',
  '"A가 아니라 B" 식으로 부정했다가 다시 정의하는 문장, "정말·매우·다양한" 같은 꾸밈말 남발, 맺음 요약을 쓰지 않는다.',
  '조사는 앞말의 받침에 맞춘다(사과는, 책은, 바다를, 연필을). 작은따옴표 뒤 조사는 붙여 쓴다(\'졸졸\'로).',
  '문장 부호는 마침표·물음표·느낌표·쉼표·작은따옴표·큰따옴표만 쓴다. 줄표(—)와 화살표, 마크다운을 쓰지 않는다.',
];

const ENGLISH_STYLE = [
  '영어 문장은 아래 낱말 목록 안의 낱말과 그 규칙 굴절형(-s, -ed, -ing)만 쓴다. 목록 밖 낱말은 쓰지 않는다.',
  `사람 이름이 필요하면 ${ENGLISH_NAMES.join(', ')} 만 쓴다. 요일·나라·도시 이름은 쓰지 않는다.`,
  '영어 문장은 초등 교과서 수준의 짧은 문장(8단어 이하)이다.',
  '발문·풀이는 우리말로 쓰고, 위 국어 문장 규칙을 따른다.',
];

const ITEM_RULES = [
  '모든 문항은 선택형이다. 정답(answer) 하나와 오답(distractors) 정확히 세 개를 준다.',
  '정답은 하나만 성립해야 한다. 오답은 문항의 근거로 분명히 틀린 것이어야 한다. 정답과 뜻이 겹치는 오답을 내지 않는다.',
  '선택지 네 개는 서로 다른 문자열이고, 길이와 꼴이 비슷해서 생김새로 정답을 알 수 없어야 한다.',
  '발문과 지문에 정답 문자열을 그대로 쓰지 않는다. 지문에서 고르는 문항(지문 속 낱말 고르기)이면 오답도 지문에 있는 말로 만든다.',
  '같은 묶음 안에서 지문을 되풀이하지 않는다.',
  `난이도(difficulty)는 1, 2, 3 중 하나다. ${AUTHORED_DIFFICULTY_NOTE}`,
];

function bullet(lines) {
  return lines.map((line) => `- ${line}`).join('\n');
}

/**
 * @param {object} p
 * @param {object} p.standard 스파인 성취기준 레코드
 * @param {number} p.count 이번 요청에서 받을 후보 수
 * @param {string[]} p.vocabulary 학년군 어휘(국어) 또는 공식 어휘(영어)
 * @param {object[]} p.examples 같은 성취기준의 기존 문항 표본 {instruction, stem, answer, distractors}
 * @param {string[]} [p.avoidStems] 이미 코퍼스에 있는 지문. 겹치지 않게 한다
 */
export function buildMessages({ standard, count, vocabulary, examples, avoidStems = [] }) {
  const subjectRules = standard.subject === 'english'
    ? `${bullet(KOREAN_STYLE)}\n${bullet(ENGLISH_STYLE)}`
    : bullet(KOREAN_STYLE);
  const vocabLabel = standard.subject === 'english'
    ? '쓸 수 있는 영어 낱말(2022 개정 초등 권장 어휘)'
    : `${standard.gradeBand}학년군 어휘(선택지가 낱말 하나일 때는 이 목록 안에서 고른다)`;
  const system = [
    '너는 2022 개정 교육과정 초등 문항을 쓰는 교과서 집필자다.',
    '결과는 JSON 객체 하나로만 답한다. 설명 문장을 붙이지 않는다.',
  ].join('\n');
  const user = [
    `성취기준: ${standard.code} ${standard.summary}`,
    `교과: ${standard.subjectKorean} / 학년군: ${standard.gradeBand} / 영역: ${standard.domain}`,
    '',
    `이 성취기준을 평가하는 선택형 문항 ${count}개를 새로 써라.`,
    '',
    '문항 규칙:',
    bullet(ITEM_RULES),
    '',
    '문장 규칙:',
    subjectRules,
    '',
    `${vocabLabel}:`,
    vocabulary.join(', '),
    '',
    '같은 성취기준의 기존 문항(형식 참고용, 같은 지문을 쓰지 않는다):',
    JSON.stringify(examples, null, 0),
    ...(avoidStems.length > 0 ? ['', '이미 있는 지문(다시 쓰지 않는다):', avoidStems.join(' / ')] : []),
    '',
    '출력 형식:',
    '{"items":[{"difficulty":1,"instruction":"...","stem":"...","answer":"...","distractors":["...","...","..."],"solution":["..."]}]}',
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
