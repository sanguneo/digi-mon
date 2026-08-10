export function buildSpine(corpus) {
  if (corpus === null || typeof corpus !== 'object' || Array.isArray(corpus)) {
    throw new Error('저장소 코퍼스 객체가 필요하다');
  }
  if (
    corpus.spine?.corpus?.schema !== 'digi-mon/curriculum-corpus@1'
    || !Array.isArray(corpus.spine.standards)
  ) {
    throw new Error('검증된 내부 성취기준 스파인이 필요하다');
  }
  return corpus.spine;
}
