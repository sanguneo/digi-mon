/** 정수로 딱 떨어지는 원주·원넓이가 '157.00' 이 아니라 '157' 로 나오는지 확인한다. */
import { loadOntology } from '../src/ontology/source.mjs';
import { buildSpine } from '../src/ontology/spine.mjs';
import { createRegistry } from '../src/engine/registry.mjs';
import { createRng } from '../src/engine/rng.mjs';
import { generateItem } from '../src/engine/worksheet.mjs';

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const byCode = new Map(spine.standards.map((s) => [s.code, s]));
const targets = ['math.g56.rm.s03-15.circumference', 'math.g56.rm.s03-16.circle-area', 'math.g56.rm.s03-08.cylinder-parts'];

let padded = 0;
let checked = 0;
const wholeExamples = [];
for (const id of targets) {
  const g = registry.get(id);
  for (let n = 0; n < 4000; n += 1) {
    const item = generateItem(g, byCode.get(g.standardCode), createRng(`${id}|trim|${n}`), (n % 3) + 1);
    checked += 1;
    if (/\.\d*0$/.test(item.answer.value)) padded += 1;
    if (!item.answer.value.includes('.') && wholeExamples.length < 5) {
      wholeExamples.push(`${item.stem.slice(0, 44)} => ${item.answer.display}`);
    }
  }
}
console.log(`검사 ${checked}건, 뒤따르는 0이 남은 정답: ${padded}건`);
console.log('정수로 떨어진 예:');
for (const e of wholeExamples) console.log(`  ${e}`);
