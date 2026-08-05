/**
 * 국어 문장 단위 자산.
 *
 * 지문 자산과 문장 자산은 비용이 다르다. '다음 문장은 사실인가 의견인가' 는 문장
 * 하나면 성립하고 저작권 정리가 필요 없다. '글을 읽고 중심 생각 파악' 은 지문이
 * 필요하다. 이 구분을 하지 않으면 자산 투자 우선순위를 정할 수 없다.
 *
 * 이 파일의 문장은 이 저장소가 직접 지은 것이고 어디서 가져온 것이 아니다.
 * 교과 전문가 검토 대상이다.
 *
 * 문장에 쓰는 낱말은 학년군 어휘 목록 안에 있어야 한다(check-vocabulary).
 */

/**
 * [4국02-04] 사실과 의견 구분.
 *
 * 사실은 확인할 수 있는 일, 의견은 생각·느낌·판단이다. 판정 근거를 함께 둔다 —
 * 검산이 이 표를 되읽으므로 근거가 없으면 항목이 맞는지 사람이 볼 수 없다.
 */
export const FACT_OPINION = [
  { text: '우리 학교 도서관은 2층에 있습니다.', kind: 'fact', basis: '가서 보면 확인할 수 있는 일이다' },
  { text: '가을에는 나뭇잎 색이 변합니다.', kind: 'fact', basis: '누구나 관찰해서 확인할 수 있다' },
  { text: '물은 100도에서 끓습니다.', kind: 'fact', basis: '재어 보면 확인할 수 있다' },
  { text: '우리 반 학생은 스물네 명입니다.', kind: 'fact', basis: '세어 보면 확인할 수 있다' },
  { text: '해는 동쪽에서 뜹니다.', kind: 'fact', basis: '관찰로 확인할 수 있다' },
  { text: '어제 비가 내렸습니다.', kind: 'fact', basis: '있었던 일이라 확인할 수 있다' },
  { text: '이 책은 백 쪽입니다.', kind: 'fact', basis: '세어 보면 확인할 수 있다' },
  { text: '운동장에 나무가 다섯 그루 있습니다.', kind: 'fact', basis: '세어 보면 확인할 수 있다' },

  { text: '가을이 가장 아름다운 계절입니다.', kind: 'opinion', basis: "'가장 아름답다' 는 사람마다 다르게 느낀다" },
  { text: '이 책은 정말 재미있습니다.', kind: 'opinion', basis: "'재미있다' 는 읽는 사람의 느낌이다" },
  { text: '수학은 어려운 과목입니다.', kind: 'opinion', basis: "'어렵다' 는 사람에 따라 다르다" },
  { text: '우리 반 친구들은 모두 착합니다.', kind: 'opinion', basis: "'착하다' 는 보는 사람의 판단이다" },
  { text: '아침에 운동하는 것이 좋습니다.', kind: 'opinion', basis: "'좋다' 는 생각을 나타낸다" },
  { text: '이 그림이 더 예쁩니다.', kind: 'opinion', basis: "'예쁘다' 는 느낌이라 사람마다 다르다" },
  { text: '겨울보다 여름이 낫습니다.', kind: 'opinion', basis: "'낫다' 는 비교하는 사람의 판단이다" },
  { text: '도서관은 조용해야 합니다.', kind: 'opinion', basis: "'해야 한다' 는 주장을 나타낸다" },
];

/**
 * [6국05-02] 비유적 표현.
 *
 * 직유는 '같이·처럼·듯이' 로 견주고, 은유는 견주는 말 없이 바로 이른다.
 * 비유가 아닌 문장은 사실을 그대로 적은 것이다.
 */
export const FIGURATIVE = [
  { text: '아기 볼이 사과처럼 빨갛습니다.', kind: 'simile', vehicle: '사과', basis: "'처럼' 으로 견주었다" },
  { text: '눈이 솜처럼 부드럽습니다.', kind: 'simile', vehicle: '솜', basis: "'처럼' 으로 견주었다" },
  { text: '아이가 새같이 노래합니다.', kind: 'simile', vehicle: '새', basis: "'같이' 로 견주었다" },
  { text: '별이 보석같이 반짝입니다.', kind: 'simile', vehicle: '보석', basis: "'같이' 로 견주었다" },
  { text: '구름이 솜사탕처럼 뭉쳤습니다.', kind: 'simile', vehicle: '솜사탕', basis: "'처럼' 으로 견주었다" },
  { text: '바람이 속삭이듯이 지나갑니다.', kind: 'simile', vehicle: '속삭임', basis: "'듯이' 로 견주었다" },

  { text: '내 동생은 우리 집 햇살입니다.', kind: 'metaphor', vehicle: '햇살', basis: '견주는 말 없이 바로 이르렀다' },
  { text: '시간은 화살입니다.', kind: 'metaphor', vehicle: '화살', basis: '견주는 말 없이 바로 이르렀다' },
  { text: '교실은 작은 세상입니다.', kind: 'metaphor', vehicle: '세상', basis: '견주는 말 없이 바로 이르렀다' },
  { text: '책은 마음의 양식입니다.', kind: 'metaphor', vehicle: '양식', basis: '견주는 말 없이 바로 이르렀다' },

  { text: '오늘 날씨가 맑습니다.', kind: 'plain', vehicle: null, basis: '견주는 말도 이르는 말도 없다' },
  { text: '동생이 우유를 마셨습니다.', kind: 'plain', vehicle: null, basis: '있었던 일을 그대로 적었다' },
  { text: '학교에 늦지 않게 갔습니다.', kind: 'plain', vehicle: null, basis: '있었던 일을 그대로 적었다' },
  { text: '창문을 활짝 열었습니다.', kind: 'plain', vehicle: null, basis: '있었던 일을 그대로 적었다' },
];

/**
 * [2국02-02] 알맞게 띄어 읽기.
 *
 * 띄어 읽을 자리는 문장 구조가 정한다. `breakAfter` 는 그 어절 뒤에서 끊어 읽는다는
 * 뜻이고, 주어부·이어 주는 말·늘어놓은 말이 끝난 자리가 그 자리다.
 * `words` 는 어절 배열이고 `breakAfter` 는 0부터 센 어절 번호다.
 *
 * `alsoAcceptable` 은 **선언한 세 기준 밖이지만 교육 관행상 허용될 수 있는 자리**다.
 * 오답 선택지에서 제외한다. 4차 검토가 잡았다 — 문두 부사어 뒤('아침에 ∨')를
 * 오답으로 내면 판정이 갈리는 자리를 틀렸다고 가르치게 된다.
 * 명백히 틀린 자리(문장 끝 ∨, 목적어와 서술어 사이)만 오답으로 쓴다.
 */
export const READING_BREAKS = [
  { words: ['나는', '학교에', '갑니다'], breakAfter: 0, alsoAcceptable: [], basis: '누가 하는지를 나타내는 말 다음에서 끊어 읽는다' },
  { words: ['동생이', '우유를', '마십니다'], breakAfter: 0, alsoAcceptable: [], basis: '누가 하는지를 나타내는 말 다음에서 끊어 읽는다' },
  // '꽃이 ∨ 활짝 피었습니다' 가 정답이지만 '꽃이 활짝 ∨ 피었습니다' 도 부사어 뒤라 허용된다.
  { words: ['꽃이', '활짝', '피었습니다'], breakAfter: 0, alsoAcceptable: [1], basis: '누가 하는지를 나타내는 말 다음에서 끊어 읽는다' },
  // '비가 ∨ 와서' 는 주어부 뒤라 허용된다.
  { words: ['비가', '와서', '우산을', '썼습니다'], breakAfter: 1, alsoAcceptable: [0], basis: '이어 주는 말 다음에서 끊어 읽는다' },
  { words: ['날씨가', '추워서', '장갑을', '꼈습니다'], breakAfter: 1, alsoAcceptable: [0], basis: '이어 주는 말 다음에서 끊어 읽는다' },
  // '사과와 ∨ 배와 귤을' 처럼 나열 중간에서 끊는 것도 관행상 허용된다.
  { words: ['사과와', '배와', '귤을', '샀습니다'], breakAfter: 2, alsoAcceptable: [0, 1], basis: '늘어놓은 말이 끝난 다음에서 끊어 읽는다' },
  // '아침에 ∨' 는 문두 부사어 뒤라 허용된다. 4차 검토가 지목한 자리다.
  { words: ['아침에', '일어나서', '세수를', '했습니다'], breakAfter: 1, alsoAcceptable: [0], basis: '이어 주는 말 다음에서 끊어 읽는다' },
  // '우리는 운동장에서 ∨' 는 부사어 뒤라 허용된다.
  { words: ['우리는', '운동장에서', '공을', '찼습니다'], breakAfter: 0, alsoAcceptable: [1], basis: '누가 하는지를 나타내는 말 다음에서 끊어 읽는다' },
];

/**
 * 문항이 가르치는 메타 용어와 판단 낱말.
 *
 * '사실·의견·직유·은유' 는 그 성취기준이 가르치는 용어이고 '예쁘다·착하다' 는
 * 의견을 만드는 판단 낱말이다. 문항 선택지와 정답에 실려 나가므로 학년군 어휘
 * 목록에 있어야 한다(check-vocabulary).
 */
export const SENTENCE_META_WORDS = [
  '사실', '의견', '질문', '명령', '직유', '은유', '비유',
  ...FACT_OPINION.filter((s) => s.kind === 'opinion')
    .map((s) => /'([^']+)'/.exec(s.basis)?.[1])
    .filter((w) => typeof w === 'string'),
  ...FIGURATIVE.map((s) => s.vehicle).filter((v) => v !== null),
];

/**
 * 어절 끝에 붙을 수 있는 조사. 긴 것부터 떼어 낸다.
 *
 * 복합 조사('에는' = 에 + 는)는 한 번에 떼어야 한다 — 한 겹만 떼면 '가을에는'이
 * '가을에'로 남아 어절 조각이 어휘 목록에 들어간다. 4차 검토가 실측으로 잡았다.
 * '처럼'·'같이'도 조사다 — 빠뜨리면 '사과처럼'이 통째로 들어가고, '같이'가 없는
 * 채 '이'만 떼면 '새같이'가 '새같'이라는 쓰레기 어간이 된다.
 */
const TRAILING_PARTICLES = [
  '에서는', '에게는', '으로는', '보다는', '까지는', '부터는', '와는', '과는', '에는',
  '처럼', '같이', '에서', '으로', '에게', '까지', '부터', '보다',
  '와', '과', '은', '는', '이', '가', '을', '를', '로', '도', '만', '의', '에',
];

/**
 * 조사가 붙었을 때 한 글자로 남는 낱말(명사·대명사·의존명사).
 *
 * '비가' 의 '가' 를 떼면 '비' 가 남는다. 한 글자 어간은 조사가 붙은 어절과 구별할
 * 방법이 없어 일반 규칙으로는 못 다룬다. 그렇다고 어절을 그대로 목록에 넣으면
 * 다른 생성기가 '비가' 를 낱말로 뽑아 조사를 또 붙여 '비가가' 를 만든다.
 * 실제로 그 사고가 났고 한국어 게이트가 잡았다. 그래서 목록으로 둔다.
 *
 * 이 목록이 자산의 문장을 못 따라가면 어절이 새어 들어간다 — '공을'·'배와'·'귤을'이
 * 그렇게 들어갔다(4차 검토 실측). 문장을 추가할 때 한 글자 낱말이 있으면 여기 함께 넣는다.
 */
const ONE_SYLLABLE_NOUNS = [
  '비', '눈', '물', '불', '꽃', '옷', '밥', '책', '집', '해', '달', '별', '산', '강', '길', '손', '발', '말',
  '공', '배', '귤', '색', '볼', '새', '나', '것', '솜',
];

function stripTrailingParticle(word) {
  // '-듯이'는 조사가 아니라 어미다('속삭이듯이'). 떼면 활용 어간('속삭이')이 남아
  // 낱말이 아니게 된다. '갑니다' 같은 활용형을 통째로 두는 관행에 맞춰 통째로 둔다.
  if (word.endsWith('듯이')) return word;
  for (const p of [...TRAILING_PARTICLES].sort((a, b) => b.length - a.length)) {
    if (!word.endsWith(p)) continue;
    const stem = word.slice(0, -p.length);
    if ([...stem].length >= 2) return stem;
    // 한 글자 어간은 목록에 있는 낱말일 때만 떼어 낸다.
    if (ONE_SYLLABLE_NOUNS.includes(stem)) return stem;
  }
  return word;
}

/**
 * 이 자산이 쓰는 낱말을 학년군 어휘로 넘긴다.
 *
 * 어절을 그대로 넘기면 안 된다. '공을'·'나무가' 같은 어절이 낱말 목록에 들어가면
 * 다른 생성기가 그걸 낱말로 뽑아 조사를 또 붙여 '공을을'·'나무가가' 를 만든다.
 * 실제로 그 사고가 났고 한국어 게이트가 잡았다.
 *
 * 어휘 게이트는 조사를 떼고 목록과 맞추므로 어절을 넣을 필요도 없다.
 * 조사를 떼어 낸 형태만 넘긴다.
 */
export function sentenceAssetWords() {
  const out = new Set();
  const add = (text) => {
    for (const w of String(text).split(/\s+/)) {
      const bare = w.replace(/[.,?!]/g, '');
      if (bare.length === 0) continue;
      out.add(stripTrailingParticle(bare));
    }
  };
  for (const s of FACT_OPINION) add(s.text);
  for (const s of FIGURATIVE) add(s.text);
  for (const s of READING_BREAKS) add(s.words.join(' '));
  for (const w of SENTENCE_META_WORDS) out.add(w);
  return [...out];
}
