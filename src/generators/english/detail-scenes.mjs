/**
 * 주어진 말의 세부 정보를 골라 답하는 5~6학년 대화 자산.
 * 같은 질문에 가능한 답을 여러 개 제시하되, 앞말의 수·장소·시간·과목이
 * 정답을 하나로 결정한다. 기존 내용 어휘만 쓰며 새 어휘를 승인하지 않는다.
 */
export const DETAIL_SCENES = [
  {
    kind: 'quantity', context: 'I have three pens and two books.',
    q: 'How many pens do you have?', a: 'I have three pens.',
    wrong: ['I have two pens.', 'I have three books.', 'I have two books.'],
    contentWords: ['pen', 'book'],
  },
  {
    kind: 'location', context: 'My brother is in the garden. My friend is in the library.',
    q: 'Where is your friend?', a: 'My friend is in the library.',
    wrong: ['My friend is in the garden.', 'My friend is in the kitchen.', 'My friend is at school.'],
    contentWords: ['garden', 'friend', 'library', 'kitchen', 'school'],
  },
  {
    kind: 'time', context: 'I read in the morning. I play music in the evening.',
    q: 'When do you play music?', a: 'I play music in the evening.',
    wrong: ['I play music in the morning.', 'I read in the morning.', 'I read in the evening.'],
    contentWords: ['morning', 'music', 'evening'],
  },
  {
    kind: 'subject', context: 'I like music. My friend likes science.',
    q: 'What subject does your friend like?', a: 'My friend likes science.',
    wrong: ['My friend likes music.', 'My friend likes history.', 'My friend likes English.'],
    contentWords: ['music', 'friend', 'science', 'history'],
  },
];
