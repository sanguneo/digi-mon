/** Export the actual Three world graph for offline Blender review, not GPU QA. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('Pass an output directory');
await mkdir(output, { recursive: true });
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
try {
 const { buildWorldModel, disposeModel } = await vite.ssrLoadModule('/src/garden-models.ts');
 const { EMPTY_GAME_STATE, GARDEN_SPOTS } = await vite.ssrLoadModule('/src/game-state.ts');
 const { WORLD_CATALOGS, WORLDS } = await vite.ssrLoadModule('/src/garden-worlds.ts');
 const { parsePropAsset } = await vite.ssrLoadModule('/src/prop-asset.ts');
 const { parseEnvironmentAsset } = await vite.ssrLoadModule('/src/environment-asset.ts');
 const bytes = async name => { const b = await readFile(`${root}/public/models/${name}.glb`); return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength); };
 for(const subject of ['korean','english','math']) {
  const name={korean:'tree',english:'fish',math:'puppy'}[subject];
  const mod=await vite.ssrLoadModule(`/src/${name}-asset.ts`);
  const primary=await mod[`parse${name[0].toUpperCase()+name.slice(1)}Asset`](await bytes(name));
  const propTemplate=await parsePropAsset(subject,await bytes(`props-${subject}`));
  const environmentTemplate=parseEnvironmentAsset?await parseEnvironmentAsset(subject,await bytes(`environment-${subject}`)):undefined;
  const views = [[0,false,null],[3,false,null],[3,true,null]];
  if (process.argv.includes('--care')) for (const action of WORLDS[subject].care) views.push([3,false,action.id]);
  for(const [stage,catalog,care] of views) {
   const world={...EMPTY_GAME_STATE.worlds[subject],growthMilestones:[1,2,3].slice(0,stage),placements:catalog?Object.fromEntries(WORLD_CATALOGS[subject].map((item,i)=>[item.id,GARDEN_SPOTS[i%8].id])):{}};
   const model=buildWorldModel(subject,world,{batch:true,[`${name}Template`]:primary,propTemplate,environmentTemplate});
   if (care) { model.startCare(care,0); model.animate(1.4); }
   const result=await new GLTFExporter().parseAsync(model.root,{binary:true,onlyVisible:true});
   const target=`${output}/${subject}-${stage}${catalog?'-catalog':''}${care?'-'+care:''}.glb`;
   await writeFile(target,Buffer.from(result)); console.log(target);
   disposeModel(model.root);
  }
  disposeModel(primary);disposeModel(propTemplate);if(environmentTemplate)disposeModel(environmentTemplate);
 }
} finally {await vite.close();}
