/** Measure actual shipped assets and whole scenes; no browser or image output.
 * Run: node apps/web-garden/art/quality/measure-world-budgets.mjs [--write]
 * --write explicitly refreshes the exact regression fixture after an art revision.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { Mesh } from 'three';

const root = fileURLToPath(new URL('../../', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
const subjects = ['korean', 'english', 'math'];
const templates = [];
try {
  const { buildWorldModel, disposeModel } = await vite.ssrLoadModule('/src/garden-models.ts');
  const { EMPTY_GAME_STATE, GARDEN_SPOTS } = await vite.ssrLoadModule('/src/game-state.ts');
  const { WORLD_CATALOGS, WORLDS } = await vite.ssrLoadModule('/src/garden-worlds.ts');
  const { parsePropAsset } = await vite.ssrLoadModule('/src/prop-asset.ts');
  const bytes = async (name) => {
    const data = await readFile(new URL(`../../public/models/${name}.glb`, import.meta.url));
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  };
  const summarize = (root, visibleOnly = false) => {
    const meshes = [];
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (visibleOnly) for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return;
      meshes.push(object);
    });
    return [
      meshes.reduce((sum, object) => sum + (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3, 0),
      meshes.length,
      new Set(meshes.map(object => object.geometry)).size,
      new Set(meshes.flatMap(object => Array.isArray(object.material) ? object.material : [object.material])).size,
    ];
  };
  const result = {};
  for (const subject of subjects) {
    const name = { korean: 'tree', english: 'fish', math: 'puppy' }[subject];
    const module = await vite.ssrLoadModule(`/src/${name}-asset.ts`);
    const parse = module[`parse${name[0].toUpperCase() + name.slice(1)}Asset`];
    const primary = await parse(await bytes(name));
    const propTemplate = await parsePropAsset(subject, await bytes(`props-${subject}`));
    templates.push(primary, propTemplate);
    result[subject] = [];
    for (const stage of [0, 1, 2, 3]) {
      const entry = {};
      for (const catalog of [false, true]) {
        const world = { ...EMPTY_GAME_STATE.worlds[subject],
          growthMilestones: [1, 2, 3].slice(0, stage),
          placements: catalog ? Object.fromEntries(WORLD_CATALOGS[subject].map((item, i) => [item.id, GARDEN_SPOTS[i % GARDEN_SPOTS.length].id])) : {},
        };
        const model = buildWorldModel(subject, world, { batch: true, [`${name}Template`]: primary, propTemplate });
        const full = summarize(model.root);
        // Independent ceilings remain meaningful even when the exact fixture changes.
        assert.ok(full[0] <= 115_000, `${subject} stage${stage}: >115k resident triangles`);
        assert.ok(full[1] <= 36 && full[3] <= 14, `${subject}: unbounded submissions/materials`);
        const measurement = { full, idle: summarize(model.root, true), active: {},
          actors: model.root.children.filter(object => ['growing-tree', 'fish', 'puppy'].includes(object.name)).map(object => summarize(object)),
        };
        for (const care of WORLDS[subject].care) {
          model.startCare(care.id, 0); model.animate(1.4);
          measurement.active[care.id] = summarize(model.root, true);
        }
        entry[catalog ? 'catalog' : 'empty'] = measurement;
        disposeModel(model.root);
      }
      result[subject].push(entry);
    }
  }
  if (process.argv.includes('--write')) {
    await writeFile(new URL('../../src/prop-budgets.test-fixture.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify(result, null, 2));
  for (const template of templates) disposeModel(template);
} finally {
  await vite.close();
}
