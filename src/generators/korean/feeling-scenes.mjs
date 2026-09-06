/**
 * 저학년 마음 짐작하기용 직접 지은 짧은 이야기와 대화.
 * 상황만으로 마음을 단정하지 않고 행동·말의 근거를 함께 제시한다.
 * 정답 어휘는 기존 MIND_FEELINGS만 쓴다. 새 학년군 어휘를 승인하지 않는다.
 */
export const FEELING_SCENES = [
  {
    sceneId: 'finished-puzzle', presentation: 'narrative',
    text: '수아는 여러 번 해도 못 맞추던 퍼즐을 끝까지 맞췄습니다. 수아는 활짝 웃으며 손뼉을 쳤습니다.',
    feeling: '기쁘다', evidence: '활짝 웃으며 손뼉을 쳤습니다',
    basis: '하고 싶던 일을 해내고 웃으며 손뼉을 치는 모습에서 기쁜 마음을 알 수 있다.',
  },
  {
    sceneId: 'sprouting-seed', presentation: 'dialogue',
    text: '지우: "내가 심은 씨앗에서 드디어 싹이 났어!"\n동생: "왜 그렇게 웃어?"\n지우는 웃으며 화분을 바라보았습니다.',
    feeling: '기쁘다', evidence: '웃으며 화분을 바라보았습니다',
    basis: '기다리던 싹이 나서 웃는 지우의 모습에서 기쁜 마음을 짐작할 수 있다.',
  },
  {
    sceneId: 'moving-friend', presentation: 'narrative',
    text: '서연이의 단짝 친구가 먼 곳으로 이사를 갑니다. 서연이는 친구와 찍은 사진을 보며 눈물을 흘렸습니다.',
    feeling: '슬프다', evidence: '사진을 보며 눈물을 흘렸습니다',
    basis: '친구와 헤어지게 되어 사진을 보며 우는 모습에서 슬픈 마음을 알 수 있다.',
  },
  {
    sceneId: 'broken-snowman', presentation: 'dialogue',
    text: '민준: "밤사이에 눈사람이 무너졌어. 동생과 힘들게 만들었는데……."\n민준이는 무너진 눈사람 옆에서 눈물을 닦았습니다.',
    feeling: '슬프다', evidence: '눈사람 옆에서 눈물을 닦았습니다',
    basis: '정성껏 만든 눈사람이 무너져 우는 민준이의 모습에서 슬픈 마음을 짐작할 수 있다.',
  },
  {
    sceneId: 'sudden-thunder', presentation: 'narrative',
    text: '밤에 천둥이 크게 울렸습니다. 유나는 몸을 떨며 이불 속에 숨고 엄마를 불렀습니다.',
    feeling: '무섭다', evidence: '몸을 떨며 이불 속에 숨고',
    basis: '큰 천둥 소리에 몸을 떨고 숨는 모습에서 무서운 마음을 알 수 있다.',
  },
  {
    sceneId: 'barking-dog', presentation: 'dialogue',
    text: '건우: "큰 개가 나를 보고 짖어. 가까이 못 가겠어."\n건우는 뒷걸음질 치며 아빠 뒤로 숨었습니다.',
    feeling: '무섭다', evidence: '뒷걸음질 치며 아빠 뒤로 숨었습니다',
    basis: '짖는 개에게 가지 못하고 뒤로 숨는 건우의 모습에서 무서운 마음을 짐작할 수 있다.',
  },
  {
    sceneId: 'lent-crayons', presentation: 'narrative',
    text: '아린이는 색연필을 집에 두고 왔습니다. 친구가 색연필을 빌려주자 아린이는 "네 덕분에 그림을 끝냈어."라고 말했습니다.',
    feeling: '고맙다', evidence: '네 덕분에 그림을 끝냈어',
    basis: '친구의 도움으로 그림을 마치고 친구 덕분이라고 말하는 모습에서 고마운 마음을 알 수 있다.',
  },
  {
    sceneId: 'found-notebook', presentation: 'dialogue',
    text: '시우: "공책을 못 찾아서 한참 찾았어."\n친구: "책상 아래에 있길래 가져왔어."\n시우: "네가 찾아 주어서 이제 공부할 수 있겠어!"',
    feeling: '고맙다', evidence: '네가 찾아 주어서 이제 공부할 수 있겠어',
    basis: '공책을 찾아 준 친구의 도움을 생각하는 시우의 말에서 고마운 마음을 짐작할 수 있다.',
  },
];
