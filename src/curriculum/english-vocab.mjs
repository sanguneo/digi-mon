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

/**
 * [4영01-05] 문장과 뜻 짝.
 *
 * 낱말 뜻을 직접 묻는 문항은 어휘 목록이 공식 자료로 교체된 뒤에 만든다는 방침은
 * 유지한다 — 이것은 낱말이 아니라 **문장** 자산이고, 목록 교체와 독립이다.
 * 뜻(한국어)끼리 분명히 갈리는 문장만 담는다. 5차 수리에서 저작했다.
 */
export const SENTENCE_MEANINGS = [
  { en: 'I like apples.', ko: '나는 사과를 좋아합니다.' },
  { en: 'The cat is on the desk.', ko: '고양이가 책상 위에 있습니다.' },
  { en: 'She is my friend.', ko: '그 아이는 내 친구입니다.' },
  { en: 'We go to school.', ko: '우리는 학교에 갑니다.' },
  { en: 'The dog is big.', ko: '그 개는 큽니다.' },
  { en: 'I drink milk.', ko: '나는 우유를 마십니다.' },
  { en: 'Open the door.', ko: '문을 여세요.' },
  { en: 'The sun is bright.', ko: '해가 밝게 빛납니다.' },
];

/**
 * [4영02-03] 소리-철자로 단어 쓰기.
 *
 * 뜻은 단서일 뿐이고 재는 것은 철자다. 단어는 전부 학년군 목록(WORDS_G34) 안이다.
 * 뜻이 겹치는 단어를 넣으면 정답이 둘이 된다 — 표 안에서 뜻이 유일해야 한다.
 */
export const WORD_CLUES = [
  { word: 'cat', ko: '고양이' },
  { word: 'dog', ko: '개' },
  { word: 'sun', ko: '해' },
  { word: 'pen', ko: '펜' },
  { word: 'egg', ko: '달걀' },
  { word: 'red', ko: '빨강' },
  { word: 'zoo', ko: '동물원' },
  { word: 'milk', ko: '우유' },
  { word: 'book', ko: '책' },
  { word: 'fish', ko: '물고기' },
  { word: 'hand', ko: '손' },
  { word: 'tree', ko: '나무' },
];

/** [4영02-06] 행동 지시 문장. 상황(한국어)과 지시문이 일대일이다. */
export const COMMANDS = [
  { situation: '문을 열라고 할 때', en: 'Open the door.' },
  { situation: '앉으라고 할 때', en: 'Sit down.' },
  { situation: '일어서라고 할 때', en: 'Stand up.' },
  { situation: '창문을 닫으라고 할 때', en: 'Close the window.' },
  { situation: '책을 펴라고 할 때', en: 'Open your book.' },
  { situation: '이리 오라고 할 때', en: 'Come here.' },
  { situation: '잘 들으라고 할 때', en: 'Listen carefully.' },
  { situation: '손을 들라고 할 때', en: 'Raise your hand.' },
];

/** [6영02-04] 상황별 소개·묘사 문장. */
export const EXPRESSIONS = [
  { situation: '친구를 소개할 때', en: 'This is my friend.' },
  { situation: '이름을 말할 때', en: 'My name is Mina.' },
  { situation: '나이를 말할 때', en: 'I am twelve years old.' },
  { situation: '사는 곳을 말할 때', en: 'I live in Seoul.' },
  { situation: '좋아하는 과목을 말할 때', en: 'I like music.' },
  { situation: '오늘 날씨를 말할 때', en: 'It is sunny today.' },
  { situation: '가족을 소개할 때', en: 'This is my family.' },
  { situation: '학교를 소개할 때', en: 'This is my school.' },
];

/**
 * [6영02-08] 예시문 빈칸.
 *
 * PARTIAL — 글 구성은 못 재고 빈칸 채우기만 잰다. 정답과 오답은 전부 학년군
 * 어휘 목록 안의 낱말이다. 오답이 문맥에 들어맞으면 정답이 둘이 된다 —
 * 목록 안 낱말 중 문맥에 맞는 것이 정답뿐인지 확인하고 지었다.
 */
export const TEMPLATE_BLANKS = [
  { text: 'I read a ___ every day.', answer: 'book', wrong: ['milk', 'door', 'egg'] },
  { text: 'I drink ___ every morning.', answer: 'milk', wrong: ['book', 'desk', 'tree'] },
  { text: 'The ___ is bright in the sky.', answer: 'sun', wrong: ['desk', 'pen', 'door'] },
  { text: 'Open the ___, please.', answer: 'door', wrong: ['sun', 'milk', 'zoo'] },
  { text: 'My ___ teaches music at school.', answer: 'teacher', wrong: ['kite', 'apple', 'egg'] },
  { text: 'We play with a ___ in the garden.', answer: 'ball', wrong: ['milk', 'door', 'sun'] },
];

/** [4영02-08] 묻고 답하기. 오답은 짝마다 손으로 골랐다 — 형태가 비슷한 응답('It is ...')끼리 섞으면 판정이 갈린다. */
export const QA_PAIRS_G34 = [
  { q: 'What is your name?', a: 'My name is Mina.', wrong: ['I am ten years old.', 'Yes, I do.', 'It is on the desk.'] },
  { q: 'How old are you?', a: 'I am ten years old.', wrong: ['My name is Mina.', 'It is red.', 'Yes, I do.'] },
  { q: 'Do you like milk?', a: 'Yes, I do.', wrong: ['My name is Mina.', 'I am ten years old.', 'It is on the desk.'] },
  { q: 'Where is the cat?', a: 'It is on the desk.', wrong: ['My name is Mina.', 'Yes, I do.', 'I am ten years old.'] },
  { q: 'What color is this?', a: 'It is red.', wrong: ['My name is Mina.', 'I am ten years old.', 'Yes, I do.'] },
];

/** [6영02-07] 세부 정보를 묻고 답하기. */
export const QA_PAIRS_G56 = [
  { q: 'How many books do you have?', a: 'I have three books.', wrong: ['I like music.', 'It is Monday.', 'She is my teacher.'] },
  { q: 'What day is it today?', a: 'It is Monday.', wrong: ['I have three books.', 'I like music.', 'He is in the garden.'] },
  { q: 'What subject do you like?', a: 'I like music.', wrong: ['It is Monday.', 'I have three books.', 'He is in the garden.'] },
  { q: 'Where is your brother?', a: 'He is in the garden.', wrong: ['It is Monday.', 'I like music.', 'I have three books.'] },
  { q: 'When do you go to school?', a: 'I go to school in the morning.', wrong: ['I have three books.', 'It is Monday.', 'I like music.'] },
];
