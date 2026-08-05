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
  // ── 국어: 태도·글 산출·음성 상호작용 ─────────────────────────────────────
  '[2국01-05]': {
    reason: '듣기·말하기에 대한 흥미와 관심을 갖는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[2국02-05]': {
    reason: '읽기에 흥미를 가지고 즐겨 읽는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[2국05-04]': {
    reason: '시·노래·이야기에 흥미를 갖는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[2국06-01]': {
    reason: '일상 매체와 매체 자료에 관심을 갖는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[4국02-06]': {
    reason: '바람직한 읽기 습관과 읽기 자신감을 갖는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[4국03-05]': {
    reason: '쓰기 과정을 점검하며 자신감을 갖는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[4국05-05]': {
    reason: '재미와 감동을 느끼며 작품을 즐기는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6국02-05]': {
    reason: '긍정적 읽기 동기와 적극적 읽기 참여의 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6국03-06]': {
    reason: '글을 독자와 공유하는 적극적 쓰기 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6국05-06]': {
    reason: '작품을 삶과 연관 지어 성찰하는 태도 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6국06-04]': {
    reason: '자신의 매체 이용 양상을 성찰하는 기준이다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[2국03-02]': {
    reason: '생각과 느낌을 문장으로 표현하는 산출 과제다. 정답이 하나가 아니다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[2국03-03]': {
    reason: '주변 소재를 소개하는 글쓰기 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[2국03-04]': {
    reason: '겪은 일을 자유롭게 쓰는 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[2국05-03]': {
    reason: '작품 속 인물을 상상해 다양한 방식으로 표현하는 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[2국06-02]': {
    reason: '일상 경험과 생각을 글과 그림으로 표현하는 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[4국03-04]': {
    reason: '마음을 전하는 글쓰기 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[4국06-02]': {
    reason: '매체를 활용해 발표 자료를 만드는 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[6국03-03]': {
    reason: '체험한 일에 대한 감상 글쓰기 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[6국03-04]': {
    reason: '독자와 매체를 고려한 내용 생성과 표현 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[6국05-05]': {
    reason: '경험을 시·소설·극·수필로 표현하는 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[6국06-03]': {
    reason: '복합양식 자료를 제작하는 산출 과제다.',
    kind: 'open-production',
    hasGenerator: false,
  },
  '[2국01-02]': {
    reason: '바르고 고운 말로 감정을 나누는 대화 수행이다. 상호작용은 정답 대조가 안 된다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[2국01-03]': {
    reason: '집중해서 듣고 말차례를 지키는 대화 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[2국01-04]': {
    reason: '경험과 생각을 바른 자세로 발표하는 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[2국02-01]': {
    reason: '글자·단어·문장을 정확히 소리 내어 읽는 음성 산출 과제다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[4국01-03]': {
    reason: '준언어·비언어 표현을 활용하는 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[4국01-04]': {
    reason: '상대 입장을 이해하고 예의를 지키는 대화 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[4국01-05]': {
    reason: '자료를 정리해 발표하는 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[4국01-06]': {
    reason: '의견과 이유를 제시하며 생각을 교환하는 토의 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[4국02-01]': {
    reason: '글의 의미를 파악하며 유창하게 읽는 음성 산출 과제다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[6국01-03]': {
    reason: '질문하며 적극적으로 듣고 말하는 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[6국01-04]': {
    reason: '면담 절차와 상대·매체를 고려한 면담 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[6국01-05]': {
    reason: '핵심 정보를 선별해 매체를 활용하여 발표하는 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[6국01-06]': {
    reason: '협력적 토의에서 의견을 비교하고 조정하는 수행이다.',
    kind: 'speech-interaction',
    hasGenerator: false,
  },
  '[6국01-07]': {
    reason: '절차와 규칙을 지키며 토론하는 수행이다.',
    kind: 'speech-interaction',
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
  '[4영01-04]': {
    reason: '소리 내어 읽기는 음성 산출이다. 발음의 정확성은 사람이 듣고 판정한다. 국어 [2국02-01] 과 같은 분류다.',
    kind: 'speech-production',
    hasGenerator: false,
  },
  '[6영01-02]': {
    reason: '강세·리듬·억양에 맞게 소리 내어 읽는 음성 산출이다. 국어 [4국02-01] 과 같은 분류다.',
    kind: 'speech-production',
    hasGenerator: false,
  },
  '[4영01-09]': {
    reason: '공감하며 듣기는 정서 태도 기준이다. 공감했는지를 정답 문자열로 대조할 수 없다. 국어 [2국05-04] 와 같은 분류다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6영01-09]': {
    reason: '공감하며 듣거나 읽는 정서 태도 기준이다. 국어 [4국05-05] 와 같은 분류다.',
    kind: 'disposition',
    hasGenerator: false,
  },
  '[6영02-06]': {
    reason: '자신의 감정·의견·경험·계획에는 정답이 없다. 개방 산출이다. 국어 [2국03-02] 와 같은 분류다.',
    kind: 'open-production',
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
      // [4영02-05]·[4영02-07] 은 자동채점 불가로 옮기지 않았다. 다만 답을 제약하는
      // 설계가 없으면 개방 산출이 되어 재분류 대상이 된다. 이 조건이 선행이다.
      '표현 문항은 그림·실물을 제시해 답을 제약하는 설계가 선행 조건이다',
      '학년군별 어휘·표현 목록 (2022 개정 별표 기준)',
      '듣기 문항용 음성 자산',
      '표현 문항의 허용 답안 범위 정의',
    ],
  },
};


/**
 * 문장 단위 자산으로 열 수 있는 후보.
 *
 * 지문 자산과 문장 자산은 비용이 다르다. '다음 문장은 사실인가 의견인가' 는 문장
 * 하나면 성립하고 저작권 정리도 필요 없다. '글을 읽고 중심 생각 파악' 은 지문이 필요하다.
 * 이 구분을 하지 않으면 자산 투자 우선순위를 정할 수 없다.
 *
 * 여기 있다는 것은 '가능성 있는 후보' 라는 뜻이고, 실제로 열린 것은 covered 에 나타난다.
 */
export const SENTENCE_LEVEL_CANDIDATES = {
  '[2국03-01]': '글자와 단어를 바르게 쓰기 — 맞춤법·받침 표기는 규칙과 어휘 목록으로 판정된다. 자산 없이 가능.',
  '[2국02-02]': '알맞게 띄어 읽기 — 띄어 읽을 자리를 문장 구조로 판정할 수 있다. 짧은 문장 자산이면 된다.',
  '[4국02-04]': '사실과 의견 구분 — 문장 하나로 성립한다. 지문이 아니라 문장 목록이면 된다.',
  '[6국05-02]': '비유적 표현 — 비유가 쓰인 문장을 고르는 형태면 문장 목록으로 가능하다.',
  '[4국03-01]': '중심 문장과 뒷받침 문장 — 쓰기는 불가하지만 주어진 문단에서 중심 문장을 찾는 것은 자동채점된다. 부분 자동화 후보.',
  '[6국02-02]': '생략·함축 추론 — 짧은 대화 두세 줄이면 성립한다. 긴 지문이 아니다.',
};

export function isManualScoring(code) {
  return Object.hasOwn(MANUAL_SCORING, code);
}

/**
 * 부분만 자동 채점되는 성취기준.
 *
 * 기준 전체는 수행·산출이지만 그 안에 문자열로 대조할 수 있는 하위 기능이 있는
 * 경우다. 커버리지 분모에는 넣는다 — 잴 수 있는 부분이 있으므로 못 하는 것이
 * 아니다. 대신 무엇을 재고 무엇을 안 재는지 나눠 적는다.
 *
 * 처음에는 수학 3건뿐이었고 국어·영어는 auto 아니면 manual 로만 갈랐다. 그래서
 * '주어진 글에서 의견과 이유 가려내기' 처럼 잴 수 있는 부분이 있는 기준까지
 * 통째로 자동채점 불가로 밀어 넣었다. 3차 검토가 이 구조 문제를 지적했다.
 */
export const PARTIAL_SCORING = {
  // ── 수학 ──────────────────────────────────────────────────────────────
  '[2수03-02]': {
    scored: '쌓기나무의 개수와 위치를 묻는 문항',
    notScored: '직접 쌓아 만들고 그 모양을 설명하는 활동',
  },
  '[2수02-02]': {
    scored: '주어진 규칙의 다음 항을 찾는 문항',
    notScored: '자신이 규칙을 정해 배열하는 활동',
  },
  '[2수04-01]': {
    scored: '정해진 기준으로 분류해 개수를 세는 문항',
    notScored: '자신이 분류 기준을 정하는 활동',
  },

  // ── 국어 ──────────────────────────────────────────────────────────────
  '[4국03-01]': {
    scored: '주어진 문단에서 중심 문장과 뒷받침 문장을 가려내는 문항',
    notScored: '문단을 직접 쓰는 활동',
  },
  '[4국03-02]': {
    // ordering 형식이 이미 있으므로 절차 배열은 문자열로 대조된다.
    scored: '주어진 절차를 순서대로 배열하는 문항',
    notScored: '절차와 결과가 드러나는 글을 직접 쓰는 활동',
  },
  '[4국03-03]': {
    scored: '주어진 글에서 의견과 그 이유를 가려내는 문항',
    notScored: '의견을 담은 글을 직접 쓰는 활동',
  },
  '[6국03-05]': {
    scored: '맞춤법·띄어쓰기가 틀린 문장을 바르게 고치는 문항',
    notScored: '글 전체의 흐름을 고쳐 쓰는 활동',
  },

  // ── 영어 ──────────────────────────────────────────────────────────────
  '[6영02-08]': {
    scored: '예시문의 빈칸을 채워 목적에 맞는 문장을 완성하는 문항',
    notScored: '글을 직접 구성해 쓰는 활동',
  },
};

export function scoringModeOf(code) {
  if (isManualScoring(code)) return 'manual';
  if (Object.hasOwn(PARTIAL_SCORING, code)) return 'partial';
  return 'auto';
}
