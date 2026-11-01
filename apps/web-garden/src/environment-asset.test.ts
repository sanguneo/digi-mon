import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { expect, test, vi } from 'vitest';
import { createEnvironmentInstancer, createEnvironmentAssetLoader, ENVIRONMENT_IDS, parseEnvironmentAsset } from './environment-asset.ts';
import { shippedEnvironments, readShippedAssetBytes } from './puppy-asset.test-fixture.ts';
import { disposeModel } from './garden-models.ts';

for (const subject of ['korean', 'english', 'math'] as const) {
  test(`${subject} actual environment is self-contained, identity-framed and bounded`, async () => {
    const bytes = await readShippedAssetBytes(`environment-${subject}`);
    expect(bytes.byteLength).toBeLessThanOrEqual(1_500_000);
    const data = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, new DataView(bytes).getUint32(12, true))));
    expect(data.images ?? []).toHaveLength(0); expect(data.textures ?? []).toHaveLength(0);
    expect(data.cameras ?? []).toHaveLength(0); expect(data.animations ?? []).toHaveLength(0);
    expect(data.materials.length).toBeLessThanOrEqual(3);
    const root = shippedEnvironments[subject];
    expect(root.name).toBe(`${subject}-environment`);
    expect(root.position.toArray()).toEqual([0, 0, 0]);
    expect(root.scale.toArray()).toEqual([1, 1, 1]);
    expect(root.children.map(c => c.name).sort()).toEqual([...ENVIRONMENT_IDS[subject]].sort());
    let triangles = 0;
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const geometry = object.geometry, positions = geometry.getAttribute('position');
      triangles += (geometry.index?.count ?? positions.count) / 3;
      for (const name of ['normal', 'uv', 'color']) expect(geometry.getAttribute(name).count).toBe(positions.count);
      for (const name of ['position', 'normal', 'uv', 'color']) expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
      const colors = geometry.getAttribute('color'), normals = geometry.getAttribute('normal');
      for (let i = 0; i < positions.count; i++) {
        expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 3);
        for (const value of [colors.getX(i), colors.getY(i), colors.getZ(i)]) {
          expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1);
        }
        if (colors.itemSize === 4) expect(colors.getW(i)).toBe(1);
      }
      const material = object.material as MeshStandardMaterial;
      expect(material.vertexColors).toBe(true); expect(material.color.toArray()).toEqual([1, 1, 1]);
      expect(material.roughness).toBeGreaterThanOrEqual(.18);
    });
    expect(triangles).toBeGreaterThan(4000); expect(triangles).toBeLessThanOrEqual(22_000);
    const bounds = new Box3().setFromObject(root.getObjectByName('static-environment')!);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-.76);
    expect(bounds.getSize(new Vector3()).x).toBeLessThan(10);
    expect(bounds.getSize(new Vector3()).z).toBeLessThan(10);
  });
  test(`${subject} environment clones share only within a world and release exactly once`, () => {
    const template = shippedEnvironments[subject];
    const make = createEnvironmentInstancer(subject, template), other = createEnvironmentInstancer(subject, template);
    const a = make('static-environment'), b = make('static-environment'), c = other('static-environment');
    const meshes = (root: typeof template) => { const result: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) result.push(o); }); return result; };
    const source = meshes(template.getObjectByName('static-environment')!), ma = meshes(a), mb = meshes(b), mc = meshes(c);
    for (let i = 0; i < ma.length; i++) {
      expect(ma[i]!.geometry === mb[i]!.geometry).toBe(true); expect(ma[i]!.material === mb[i]!.material).toBe(true);
      expect(ma[i]!.geometry === mc[i]!.geometry).toBe(false); expect(ma[i]!.geometry === source[i]!.geometry).toBe(false);
      expect(ma[i]!.material === source[i]!.material).toBe(false);
    }
    a.add(b); const resources = [...new Set(ma.flatMap(m => [m.geometry, ...(Array.isArray(m.material) ? m.material : [m.material])]))];
    const spies = resources.map(r => vi.spyOn(r, 'dispose')); disposeModel(a);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(meshes(c).length).toBe(ma.length); disposeModel(c);
  });
  test(`${subject} rejects incomplete parts and retry does not cache failure`, async () => {
    const bytes = await readShippedAssetBytes(`environment-${subject}`);
    const corrupted = bytes.slice(0); const raw = new Uint8Array(corrupted); const encoded = new TextEncoder().encode('static-environment');
    const offset = raw.findIndex((_, i) => encoded.every((b, j) => raw[i + j] === b));
    expect(offset).toBeGreaterThan(0);
    for (let i = 0; i < raw.length - encoded.length; i++) if (encoded.every((b, j) => raw[i + j] === b)) raw[i] = 'x'.charCodeAt(0);
    await expect(parseEnvironmentAsset(subject, corrupted)).rejects.toThrow(/required part/);
    const failure = new Error('503 environment');
    const load = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(shippedEnvironments[subject]);
    const get = createEnvironmentAssetLoader(subject, load);
    await expect(get()).rejects.toBe(failure); expect(await get()).toBe(shippedEnvironments[subject]); expect(await get()).toBe(shippedEnvironments[subject]); expect(load).toHaveBeenCalledTimes(2);
  });
}
