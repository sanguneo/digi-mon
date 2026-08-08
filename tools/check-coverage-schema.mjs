#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

export function validateCoverageArtifact(schema, artifact) {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
  });
  const validate = ajv.compile(schema);
  const valid = validate(artifact);
  return {
    valid,
    errors: valid ? [] : (validate.errors ?? []),
  };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'coverage.schema.json'), 'utf8'));
  const artifact = JSON.parse(fs.readFileSync(path.join(root, 'data', 'coverage', 'coverage.json'), 'utf8'));
  const result = validateCoverageArtifact(schema, artifact);
  if (!result.valid) {
    for (const error of result.errors) {
      console.error(`${error.instancePath || '/'} ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`커버리지 스키마 검사: 기준 ${artifact.totalStandards}개, 생성기 ${artifact.generatedFrom.generatorCount}개`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
