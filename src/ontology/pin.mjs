const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * Deliberate compatibility decision, not a cache of the current manifest.
 * Updating this object means the four ontology documents have been reviewed together.
 */
export const EXPECTED_UPSTREAM_PIN = Object.freeze({
  taxonomyVersion: 'kr-full-depth-v0.4',
  files: Object.freeze({
    'curriculum-standards.json': Object.freeze({ sha256: 'aaaebb939c17fcc11a808fef3ae8164823425f74bfe8092a4a66941cb8c33335' }),
    'topics.json': Object.freeze({ sha256: '80aa059ed305ce4cbeb0df45436c0b204a42cd208204c1cc1e5332c70c4bf5f3' }),
    'dependencies.json': Object.freeze({ sha256: 'e09a6137bb70edf2a0b0928c05a4bd3f102c80845846ff13b10767ef4ceafe2c' }),
    'clusters.json': Object.freeze({ sha256: '6f98f583fa1f9afa1ae4498e9e49cfa6ebbda845701ba161fdae0daaa1e03fdb' }),
  }),
});

export function assertPinnedManifest(manifest, pin = EXPECTED_UPSTREAM_PIN) {
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest.json 최상위 객체가 필요하다');
  if (manifest.taxonomyVersion !== pin.taxonomyVersion) {
    throw new Error(`업스트림 taxonomyVersion pin 불일치: expected ${pin.taxonomyVersion}, got ${manifest.taxonomyVersion ?? 'missing'}`);
  }
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
    throw new Error('manifest.json files 객체가 필요하다');
  }
  for (const [file, expected] of Object.entries(pin.files)) {
    const actual = manifest.files[file]?.sha256;
    if (typeof actual !== 'string' || !SHA256_RE.test(actual)) {
      throw new Error(`manifest.json ${file} sha256 가 필수다`);
    }
    if (actual !== expected.sha256) {
      throw new Error(`업스트림 pin 해시 불일치: ${file}`);
    }
  }
  return pin;
}
