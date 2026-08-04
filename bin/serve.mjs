#!/usr/bin/env node
import http from 'node:http';
import { loadOntology } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createApp } from '../src/server/app.mjs';

const PORT = Number(process.env.PORT ?? 8787);

// 온톨로지·스파인·레지스트리는 부팅 때 한 번만 만든다. 요청마다 5MB JSON을 읽지 않는다.
const ontology = loadOntology();
const spine = buildSpine(ontology);
const registry = createRegistry();

if (spine.conflictCount > 0) {
  console.error(`스파인 불일치 ${spine.conflictCount}건 — 부팅을 중단한다`);
  process.exit(1);
}

const server = http.createServer(createApp({ spine, registry }));

server.listen(PORT, () => {
  console.log(`digi-mon 출제 백엔드  http://localhost:${PORT}`);
  console.log(`성취기준 ${spine.standardCount}개 / 생성기 ${registry.size}개`);
  console.log('');
  console.log('  GET  /health');
  console.log('  GET  /v1/subjects');
  console.log('  GET  /v1/standards?subject=math&grade=1-2&covered=true');
  console.log('  GET  /v1/generators');
  console.log('  GET  /v1/coverage');
  console.log('  POST /v1/worksheets   {seed, subject, grade, domain, count, difficulty, includeAnswers}');
  console.log('  POST /v1/items        {code, count, difficulty, seed}');
  console.log('  POST /v1/grade        {seed, ...같은옵션, responses:{1:"14"}}');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
