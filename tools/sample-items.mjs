/** 성취기준별 문항 표본을 뽑아 눈으로 확인한다. node tools/sample-items.mjs [코드접두어] */
import { loadOntology } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';

const prefix = process.argv[2] ?? '';
const spine = buildSpine(loadOntology());
const registry = createRegistry();
const byCode = new Map(spine.standards.map((s) => [s.code, s]));

for (const g of registry.all()) {
  if (!g.standardCode.includes(prefix)) continue;
  const standard = byCode.get(g.standardCode);
  console.log(`\n■ ${g.standardCode} ${g.skill}  [${g.id}]`);
  for (const difficulty of [1, 3]) {
    const item = generateItem(g, standard, createRng(`${g.id}|sample|${difficulty}`), difficulty);
    const head = item.stem || `(그림: ${item.figure?.altText ?? ''})`;
    console.log(`  d${difficulty}  ${head}`);
    if (item.choices) console.log(`        ${item.choices.map((c) => `${c.label}${c.text}`).join('  ')}`);
    console.log(`        답 ${item.answer.display}`);
  }
}
