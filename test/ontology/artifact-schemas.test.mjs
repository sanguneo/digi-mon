import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

for (const name of [
  'item.schema.json',
  'worksheet.schema.json',
  'grading-result.schema.json',
]) {
  test(`${name} is a versioned JSON Schema`, () => {
    const schema = JSON.parse(readFileSync(path.join(ROOT, 'schema', name), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.match(schema.$id, /digi-mon/);
    assert.equal(schema.type, 'object');
    assert.ok(Array.isArray(schema.required));
  });
}

