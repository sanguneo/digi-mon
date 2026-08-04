/**
 * 결정적 시드 난수. 같은 시드 -> 같은 학습지.
 * 무한 생성이지만 재현 가능해야 한다(채점표 재발급, 오류 문항 추적).
 */

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed) {
  let state = (typeof seed === 'number' ? seed >>> 0 : fnv1a32(String(seed))) || 0x9e3779b9;

  /** mulberry32 */
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const api = {
    seed: String(seed),
    float: next,
    /** [min, max] 정수 */
    int(min, max) {
      if (max < min) throw new Error(`int 범위 오류: ${min}..${max}`);
      return min + Math.floor(next() * (max - min + 1));
    },
    bool(p = 0.5) {
      return next() < p;
    },
    pick(arr) {
      if (!Array.isArray(arr) || arr.length === 0) throw new Error('pick: 빈 배열');
      return arr[Math.floor(next() * arr.length)];
    },
    /** 가중 선택. entries: [[value, weight], ...] */
    weighted(entries) {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [value, w] of entries) {
        r -= w;
        if (r <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    /** 조건을 만족하는 값을 얻을 때까지 재시도. 무한 루프를 막고 실패를 드러낸다. */
    until(produce, predicate, tries = 200) {
      for (let i = 0; i < tries; i += 1) {
        const v = produce();
        if (predicate(v)) return v;
      }
      throw new Error(`until: ${tries}회 내에 조건을 만족하는 값을 만들지 못했다`);
    },
  };
  return api;
}
