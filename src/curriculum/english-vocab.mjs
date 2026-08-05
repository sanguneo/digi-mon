/**
 * 영어 문자·어휘 자산.
 *
 * 이 목록은 이 저장소가 시드한 것이고 공식 어휘 목록이 아니다. 2022 개정 별표의
 * 어휘 목록으로 교체·확장할 자리이며 교과 전문가 검토 대상이다.
 *
 * 여기 담은 것은 문자 인식 문항에 필요한 최소 자산이다. 듣기·읽기 이해 문항에
 * 필요한 음성·지문 자산은 아직 없고, 그 사실은 SUBJECT_STRATEGY 에 적혀 있다.
 */

/** 알파벳 26자. 대소문자 짝과 순서는 계산으로 확정된다. */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * 대소문자를 헷갈리기 쉬운 짝.
 * 모양이 닮아 초기 문자 인식에서 자주 틀린다. 난이도 3에 쓴다.
 */
export const CONFUSABLE_LETTERS = ['B', 'D', 'P', 'Q', 'G', 'C', 'M', 'N', 'U', 'V', 'W', 'I', 'L', 'J'];

/** 소문자만 볼 때 헷갈리는 짝(b/d, p/q, n/u). */
export const CONFUSABLE_LOWER = ['b', 'd', 'p', 'q', 'n', 'u', 'm', 'w', 'i', 'l'];

/**
 * 3~4학년 기초 어휘. 문자 인식 문항의 예시 낱말로만 쓴다.
 * 뜻을 묻는 문항은 어휘 목록이 공식 자료로 교체된 뒤에 만든다.
 */
export const WORDS_G34 = [
  'apple', 'book', 'cat', 'dog', 'egg', 'fish', 'girl', 'hand', 'ice', 'jump',
  'kite', 'lion', 'milk', 'nose', 'open', 'pen', 'queen', 'red', 'sun', 'tree',
  'umbrella', 'van', 'water', 'box', 'yellow', 'zoo', 'ball', 'desk', 'door', 'face',
];

/** 5~6학년 어휘. 3~4학년 어휘를 포함한다. */
export const WORDS_G56 = [
  'family', 'friend', 'school', 'teacher', 'student', 'morning', 'evening', 'together',
  'library', 'market', 'garden', 'kitchen', 'winter', 'summer', 'spring', 'autumn',
  'science', 'music', 'history', 'question', 'answer', 'picture', 'letter', 'number',
];

export const WORDS_BY_BAND = {
  '3-4': [...WORDS_G34],
  '5-6': [...WORDS_G34, ...WORDS_G56],
};

export function englishWordsFor(gradeBand) {
  const list = WORDS_BY_BAND[gradeBand];
  if (!list) throw new Error(`영어 어휘 목록이 없는 학년군: ${gradeBand}`);
  return list;
}

/**
 * 문장 부호와 문장 첫 글자 대문자를 다루는 예문.
 *
 * [6영02-03] 은 '알파벳 대소문자와 문장 부호를 문장에서 바르게 사용' 이다.
 * 규칙은 셋이다. 문장 첫 글자는 대문자, 고유명사는 대문자, 문장 끝에 부호.
 * 규칙이라 정답이 계산으로 확정된다.
 */
export const SENTENCE_CASES = [
  { correct: 'I like apples.', kind: 'statement', rule: '문장 끝에 마침표를 쓴다' },
  { correct: 'She is my friend.', kind: 'statement', rule: '문장 끝에 마침표를 쓴다' },
  { correct: 'We go to school.', kind: 'statement', rule: '문장 끝에 마침표를 쓴다' },
  { correct: 'The cat is on the desk.', kind: 'statement', rule: '문장 끝에 마침표를 쓴다' },
  { correct: 'My father reads a book.', kind: 'statement', rule: '문장 끝에 마침표를 쓴다' },
  { correct: 'What is your name?', kind: 'question', rule: '묻는 문장 끝에 물음표를 쓴다' },
  { correct: 'How old are you?', kind: 'question', rule: '묻는 문장 끝에 물음표를 쓴다' },
  { correct: 'Where is the library?', kind: 'question', rule: '묻는 문장 끝에 물음표를 쓴다' },
  { correct: 'Do you like music?', kind: 'question', rule: '묻는 문장 끝에 물음표를 쓴다' },
  { correct: 'Can you help me?', kind: 'question', rule: '묻는 문장 끝에 물음표를 쓴다' },
  /**
   * 감탄문만 느낌표가 확정된다.
   *
   * 처음에는 'Look at the sun!' 과 'Be careful!' 을 썼는데 둘 다 명령문이라
   * 마침표도 옳다. 문장 부호 문항에서 정답이 둘이 되는 것을 4차 검토가 잡았다.
   * What/How 로 시작하는 감탄문형만 쓴다. accepts 에 마침표를 더하는 방식은 쓰지
   * 않는다 — kind 라벨과 rule 문구가 거짓이 된다.
   *
   * 낱말은 학년군 목록 안에서만 고른다(check-vocabulary 가 판정한다).
   */
  { correct: 'What a picture!', kind: 'exclamation', rule: '느낌을 나타내는 문장 끝에 느낌표를 쓴다' },
  { correct: 'What a garden!', kind: 'exclamation', rule: '느낌을 나타내는 문장 끝에 느낌표를 쓴다' },
  { correct: 'What a friend!', kind: 'exclamation', rule: '느낌을 나타내는 문장 끝에 느낌표를 쓴다' },
];

/** 문장 끝 부호와 이름. */
export const END_MARKS = {
  statement: { mark: '.', name: 'period' },
  question: { mark: '?', name: 'question mark' },
  exclamation: { mark: '!', name: 'exclamation mark' },
};
