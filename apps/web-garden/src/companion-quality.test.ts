import { Box3, Mesh, MeshStandardMaterial, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { expect, test } from 'vitest';
import { EMPTY_GAME_STATE } from './game-state.ts';
import { CARE_DURATION, disposeModel } from './garden-models.ts';
import { buildWorldModel } from './puppy-asset.test-fixture.ts';
import { worldFraming } from './garden-renderer.ts';
import { WORLDS } from './garden-worlds.ts';

// Geometry/camera checks complement (not replace) real browser visual review.
// Use conservative companion bounds, excluding scenery and hidden growth stages.
for (const subject of ['korean', 'english', 'math'] as const) {
  test(`${subject} keeps distinct opaque organic/satin surface response instead of one flat material`, () => {
    const model = buildWorldModel(subject, { ...EMPTY_GAME_STATE.worlds[subject], growthMilestones: [1, 2, 3] });
    const actor = model.root.getObjectByName(subject === 'korean' ? 'growing-tree' : subject === 'english' ? 'fish' : 'puppy')!;
    const materials = new Set<MeshStandardMaterial>();
    actor.traverse(object => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        expect(material).toBeInstanceOf(MeshStandardMaterial);
        materials.add(material as MeshStandardMaterial);
        expect(material.transparent).toBe(false);
        expect((material as MeshStandardMaterial).metalness).toBe(0);
      }
    });
    const roughness = [...materials].map(material => material.roughness);
    expect(Math.max(...roughness) - Math.min(...roughness)).toBeGreaterThanOrEqual(0.2);
    expect(Math.min(...roughness)).toBeGreaterThanOrEqual(0.18);
    disposeModel(model.root);
  });

  for (const stage of [0, 1, 2, 3]) {
    test(`${subject} stage ${stage} stays inside phone/tablet/desktop camera frames during care`, () => {
      const model = buildWorldModel(subject, { ...EMPTY_GAME_STATE.worlds[subject], growthMilestones: ([1, 2, 3] as const).slice(0, stage) }, { batch: true });
      const actorName = subject === 'korean' ? 'growing-tree' : subject === 'english' ? 'fish' : 'puppy';
      const actors = model.root.children.filter(object => object.name === actorName);
      for (const aspect of [343 / 280, 688 / 510, 980 / 510]) {
        const framing = worldFraming(subject, stage, aspect);
        const camera = new PerspectiveCamera(38, aspect, 0.1, 80);
        const target = new Vector3(0, framing.targetY, 0.25);
        camera.position.setFromSpherical(new Spherical(framing.distance, framing.polar, 0.24)).add(target);
        camera.lookAt(target); camera.updateMatrixWorld(true);
        for (const action of WORLDS[subject].care) {
          // Same runtime, authored pivots and times as the live renderer, no mock art.
          model.startCare(action.id, 0);
          for (const time of [0, 1.4, 2.8, CARE_DURATION]) {
            model.animate(time); model.root.updateMatrixWorld(true);
            for (const actor of actors) {
              const box = new Box3();
              actor.traverseVisible(object => {
                if (object instanceof Mesh) box.union(new Box3().setFromObject(object));
              });
              for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
                const projected = new Vector3(x, y, z).project(camera);
                expect(Math.abs(projected.x)).toBeLessThan(0.96);
                expect(Math.abs(projected.y)).toBeLessThan(0.96);
                expect(projected.z).toBeGreaterThan(-1);
                expect(projected.z).toBeLessThan(1);
              }
            }
          }
        }
      }
      disposeModel(model.root);
    });
  }
}
