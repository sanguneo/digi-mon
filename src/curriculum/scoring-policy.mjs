/**
 * 자동 채점이 원리적으로 불가능한 성취기준.
 *
 * 2022 개정 교육과정에는 '그릴 수 있다', '만들고 설명할 수 있다', '자신이 정한
 * 기준으로' 같은 수행·산출 과제가 섞여 있다. 이런 기준은 문항을 낼 수는 있어도
 * 정답 문자열 대조로 채점할 수 없다. 커버리지 100%를 주장하려고 이걸 억지로
 * 객관식으로 바꾸면 성취기준이 요구하는 능력을 측정하지 않는 문항이 된다.
 *
 * 그래서 분모에서 빼되 숨기지 않는다. 커버리지 원장이 이 목록을 그대로 드러낸다.
 */
export const MANUAL_SCORING = {
  '[2수03-04]': {
    reason: '사각형·삼각형·원을 직접 그리는 작도 수행 과제다. 문항은 생성하지만 그린 결과는 사람이 본다.',
    kind: 'construction',
    // 문항을 만들 수 없는 것이 아니라 자동 채점을 할 수 없는 것이다.
    // 작도 문항은 생성해 학습지에 싣고, 채점 기준만 사람에게 넘긴다.
    hasGenerator: true,
  },
  '[4국04-05]': {
    reason: '언어를 소통과 관계 형성의 수단으로 이해하는 태도 기준이다. 정답이 규칙으로 정해지지 않는다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6국04-01]': {
    reason: '매체 표현의 효과를 평가하는 기준이다. 평가는 근거가 여러 갈래로 갈려 정답 대조로 채점할 수 없다.',
    kind: 'evaluation',
    hasGenerator: false,
  },
  // ── 영어: 태도·음성 산출·창의 수행 ───────────────────────────────────────
  // '영어 0/40' 은 분모가 틀린 셈이다. 자산이 없어서 못 하는 것과 원리적으로
  // 정답 대조가 안 되는 것을 섞어 세면, 자산을 다 갖춰도 100%가 되지 않는다.
  '[4영01-08]': {
    reason: '다양한 매체의 담화를 흥미를 가지고 듣거나 읽는 태도 기준이다. 흥미는 정답으로 대조할 수 없다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[4영01-10]': {
    reason: '문화 자료를 존중의 태도로 듣거나 읽는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6영01-08]': {
    reason: '담화나 글을 흥미와 자신감을 가지고 듣거나 읽는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6영01-10]': {
    reason: '문화 자료를 포용의 태도로 듣거나 읽는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[4영02-10]': {
    reason: '의사소통 활동에 흥미와 자신감을 가지고 예절을 지키며 참여하는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6영02-10]': {
    reason: '의사소통 활동에 협력적으로 참여하는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[4영02-01]': {
    reason: '강세·리듬·억양에 맞게 따라 말하는 음성 산출 과제다. 발음은 사람이 듣고 판정한다.',
    kind: 'speech-production',
    hasGenerator: false,
  },
  '[6영02-01]': {
    reason: '강세·리듬·억양에 맞게 말하는 음성 산출 과제다.',
    kind: 'speech-production',
    hasGenerator: false,
  },
  '[4영02-09]': {
    reason: '매체와 전략을 활용해 창의적으로 의미를 표현하는 수행 과제다. 창의성은 정답이 하나가 아니다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[6영02-09]': {
    reason: '창의적으로 의미를 생성하고 표현하는 수행 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[6영02-08]': {
    reason: '예시문을 참고해 목적에 맞는 글을 쓰는 수행 과제다. 글은 정답 문자열로 채점할 수 없다.',
    kind: 'open-production',
    hasGenerator: false,
  },
};

/**
 * 교과별 문항 생성 전략.
 *
 * 수학만 파라메트릭 무한 생성이 가능하다. 수·연산·도형은 파라미터를 바꾸면
 * 새 문항이 되고 답을 계산으로 검산할 수 있다.
 *
 * 국어·영어는 원리적으로 안 된다. '읽기' 문항은 지문이 있어야 성립하고, 지문은
 * 파라미터를 바꿔 만들 수 없다. 어휘·문법 문항도 어휘 목록과 예문 자산이 먼저
 * 있어야 한다. 없는 것을 있는 척 만들면 3~4학년에게 낼 수 없는 지문이 나오거나
 * 정답이 여러 개인 문항이 나온다. 그래서 이 저장소는 두 교과를 비워 두고,
 * 그 사유를 커버리지 데이터에 남긴다.
 */
export const SUBJECT_STRATEGY = {
  math: {
    strategy: 'parametric',
    generatable: true,
    basis: '수·연산·도형·측정은 파라미터를 바꾸면 새 문항이 되고, 답을 역연산·불변식으로 검산할 수 있다.',
  },
  korean: {
    // 영역마다 다르다. 문법은 규칙이라 되고, 나머지는 자산이 있어야 한다.
    strategy: 'mixed',
    generatable: 'partial',
    generatableDomains: ['문법'],
    blockedDomains: ['듣기·말하기', '읽기', '쓰기', '문학', '매체'],
    basis: '문법은 규칙(자모·사전순서·받침·문장부호·높임·호응)이라 파라메트릭으로 된다. 읽기·문학·쓰기는 지문이 있어야 성립하고 지문은 파라미터로 만들 수 없다.',
    blockedBy: [
      '학년군별 지문 자산 (길이·어휘 수준·저작권 정리)',
      '학년군별 어휘 목록과 예문',
      '문법 항목별 오답 유형 정의',
    ],
  },
  english: {
    // 영어도 영역마다 다르다. 문자 인식(대소문자·알파벳 순서·문장부호)은 계산으로
    // 확정되므로 음성·지문 자산 없이 지금 된다. 듣기·읽기 이해는 자산이 있어야 한다.
    strategy: 'mixed',
    generatable: 'partial',
    generatableDomains: ['이해', '표현'],
    generatableTopics: ['알파벳 대소문자', '알파벳 순서', '문장 첫 글자 대문자', '문장 부호'],
    basis: '문자 인식은 유니코드 계산으로 확정되어 자산이 필요 없다. 듣기·읽기 이해는 음성·지문 자산이 있어야 하고, 태도·음성 산출·창의 수행 기준 11개는 원리적으로 정답 대조가 안 되어 자동채점 분모에서 빠진다.',
    blockedBy: [
      '학년군별 어휘·표현 목록 (2022 개정 별표 기준)',
      '듣기 문항용 음성 자산',
      '표현 문항의 허용 답안 범위 정의',
    ],
  },
};

export function isManualScoring(code) {
  return Object.hasOwn(MANUAL_SCORING, code);
}

/**
 * 부분 자동화 성취기준.
 * 기준 전체를 자동 채점할 수는 없지만, 하위 능력 일부는 자동 채점이 가능하다.
 * 예: '쌓기나무로 모양을 만들고 설명한다'에서 '쌓기나무 개수 세기'는 자동 채점된다.
 * 이 목록은 커버리지를 100%로 세되, 무엇을 덜 재고 있는지 남긴다.
 */
export const PARTIAL_SCORING = {
  '[2수03-02]': '쌓기나무 개수·위치 파악만 자동 채점한다. 직접 쌓아 만들고 설명하는 활동은 사람이 본다.',
  '[2수02-02]': '주어진 규칙의 다음 항을 찾는 부분만 자동 채점한다. 자신이 규칙을 정해 배열하는 활동은 사람이 본다.',
  '[2수04-01]': '정해진 기준으로 분류해 개수를 세는 부분만 자동 채점한다. 자신이 기준을 정하는 활동은 사람이 본다.',
};

export function scoringModeOf(code) {
  if (isManualScoring(code)) return 'manual';
  if (Object.hasOwn(PARTIAL_SCORING, code)) return 'partial';
  return 'auto';
}
