/**
 * 결정적 JSON 직렬화. fingerprint 계산의 원시 함수다.
 *
 * 객체 키를 정렬해 직렬화하므로 같은 내용이면 프로퍼티 삽입 순서와 무관하게
 * 같은 문자열이 나온다. 이 함수가 바뀌면 이미 발급된 학습지의 지문값이 전부
 * 어긋나 채점이 깨진다. 고칠 일이 생기면 test/engine/fingerprint-pin.test.mjs
 * 가 먼저 실패해야 정상이다.
 *
 * worksheet.mjs 와 worksheet-forms.mjs 에 같은 함수가 두 벌 있었다. 한쪽만
 * 고쳐지면 학습지 지문과 form set 지문이 조용히 갈리므로 한 곳으로 모았다.
 */
export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
