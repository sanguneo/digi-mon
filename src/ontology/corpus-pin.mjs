const SHA256_RE = /^[0-9a-f]{64}$/;

export const EXPECTED_CORPUS_PIN = Object.freeze({
  schema: 'digi-mon/corpus-pin@1',
  revision: 1,
  standardCount: 248,
  files: Object.freeze({
    'data/spine/standards.json': Object.freeze({
      sha256: '31501533d03a115a4310ccab3e180175c8467daa085f6d26e367322528aa24c7',
    }),
    'reference/[별책5] 국어과 교육과정.md': Object.freeze({
      sha256: 'dd8b285e39c103b7e1f31919de0e7572fd687fe2bf8536967fe5af1514d9bde3',
    }),
    'reference/[별책8] 수학과 교육과정.md': Object.freeze({
      sha256: 'aad680ac9af95179cf29766c0629d09ebca28c85fc6becfbe024d84b747af67b',
    }),
    'reference/[별책14] 영어과 교육과정.md': Object.freeze({
      sha256: 'ccb6cfbf425aa36be3ac089e42ca76b1aaa117fb52ad9483901f4a8155e4af11',
    }),
  }),
});

export function assertPinnedCorpus(integrity, pin = EXPECTED_CORPUS_PIN) {
  if (!Array.isArray(integrity)) throw new Error('코퍼스 무결성 배열이 필요하다');
  const byFile = new Map(integrity.map((entry) => [entry.file, entry]));
  for (const [file, expected] of Object.entries(pin.files)) {
    const actual = byFile.get(file)?.sha256;
    if (typeof actual !== 'string' || !SHA256_RE.test(actual)) {
      throw new Error(`코퍼스 ${file} sha256이 필요하다`);
    }
    if (actual !== expected.sha256) throw new Error(`코퍼스 고정 해시 불일치: ${file}`);
  }
  if (byFile.size !== Object.keys(pin.files).length) {
    throw new Error('코퍼스 무결성 파일 목록이 고정 계약과 다르다');
  }
  return pin;
}
