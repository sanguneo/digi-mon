import * as THREE from 'three';
import { afterEach, expect, test, vi } from 'vitest';
import { createStudioProbeScene, createWorldLighting, STUDIO_PROBE_SIZE } from './garden-lighting.ts';

const { fromScene, disposeGenerator } = vi.hoisted(() => ({ fromScene: vi.fn(), disposeGenerator: vi.fn() }));
vi.mock('three', async () => {
  const three = await vi.importActual<typeof import('three')>('three');
  return { ...three, PMREMGenerator: class {
    fromScene = fromScene;
    dispose = disposeGenerator;
  } };
});
afterEach(() => { vi.restoreAllMocks(); fromScene.mockReset(); disposeGenerator.mockClear(); });

test('local studio contains only broad inward-facing light cards and releases its shared geometry exactly once', () => {
  const probe = createStudioProbeScene();
  expect(probe.scene.children).toHaveLength(4);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const object of probe.scene.children) {
    expect(object).toBeInstanceOf(THREE.Mesh);
    const panel = object as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    geometries.add(panel.geometry); materials.add(panel.material);
    const face = new THREE.Vector3(0, 0, 1).applyQuaternion(panel.quaternion);
    expect(face.dot(panel.position.clone().normalize())).toBeLessThan(-0.99);
    expect(panel.material.map).toBeNull();
    expect(panel.material.toneMapped).toBe(false);
    expect(Math.max(...panel.material.color.toArray())).toBeGreaterThan(1);
  }
  expect(geometries.size).toBe(1);
  const disposal = [...geometries, ...materials].map((resource) => vi.spyOn(resource, 'dispose'));
  probe.dispose(); probe.dispose();
  expect(probe.scene.children).toHaveLength(0);
  for (const disposed of disposal) expect(disposed).toHaveBeenCalledTimes(1);
});

test.each(['korean', 'english', 'math'] as const)('%s probe is generated once, reused across frames, and disposed separately from model materials', (subject) => {
  const target = new THREE.WebGLRenderTarget(384, 512);
  const targetDisposal = vi.spyOn(target, 'dispose');
  fromScene.mockReturnValue(target);
  const scene = new THREE.Scene();
  const lighting = createWorldLighting({} as THREE.WebGLRenderer, scene, subject);
  expect(fromScene).toHaveBeenCalledTimes(1);
  expect(fromScene.mock.calls[0]!.slice(1)).toEqual([0.045, 0.1, 40, { size: STUDIO_PROBE_SIZE }]);
  expect(disposeGenerator).toHaveBeenCalledTimes(1);
  expect(scene.environment).toBe(target.texture);
  expect(scene.environmentIntensity).toBeGreaterThan(0);
  expect(scene.environmentIntensity).toBeLessThan(0.5);
  expect(scene.children.every((object) => object instanceof THREE.Light)).toBe(true);
  const key = scene.getObjectByName('companion-key') as THREE.DirectionalLight;
  const shadowDisposal = vi.spyOn(key.shadow, 'dispose');
  expect(scene.children.filter((object) => object.castShadow)).toEqual([key]);
  expect(key.shadow.mapSize.toArray()).toEqual([1024, 1024]);
  expect(key.shadow.radius).toBeGreaterThan(1);
  lighting.dispose(); lighting.dispose();
  expect(targetDisposal).toHaveBeenCalledTimes(1);
  expect(shadowDisposal).toHaveBeenCalledTimes(1);
  expect(scene.environment).toBeNull();
  expect(scene.children).toHaveLength(0);
});

test('failed GPU probe generation disposes temporary geometry and generator before propagating failure', () => {
  const failure = new Error('GPU unavailable');
  fromScene.mockImplementation(() => { throw failure; });
  const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
  const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose');
  const scene = new THREE.Scene();
  expect(() => createWorldLighting({} as THREE.WebGLRenderer, scene, 'math')).toThrow(failure);
  expect(disposeGenerator).toHaveBeenCalledTimes(1);
  expect(geometryDispose).toHaveBeenCalledTimes(1);
  expect(materialDispose).toHaveBeenCalledTimes(4);
  expect(scene.environment).toBeNull();
  expect(scene.children).toHaveLength(0);
});

test('view presets change the actual shadow projection and reflection direction without rebuilding the probe', () => {
  const target = new THREE.WebGLRenderTarget(384, 512);
  fromScene.mockReturnValue(target);
  const scene = new THREE.Scene();
  const lighting = createWorldLighting({} as THREE.WebGLRenderer, scene, 'math');
  const key = scene.getObjectByName('companion-key') as THREE.DirectionalLight;
  scene.updateMatrixWorld(true); key.shadow.updateMatrices(key);
  const daylightShadow = key.shadow.matrix.clone();
  const daylightPosition = key.position.clone();
  lighting.setPreset('warm-side');
  scene.updateMatrixWorld(true); key.shadow.updateMatrices(key);
  expect(key.position.equals(daylightPosition)).toBe(false);
  expect(key.shadow.matrix.equals(daylightShadow)).toBe(false);
  expect(key.shadow.needsUpdate).toBe(true);
  expect(scene.environmentRotation.y).toBe(-1.1);
  expect(scene.environment).toBe(target.texture);
  lighting.setPreset('daylight');
  scene.updateMatrixWorld(true); key.shadow.updateMatrices(key);
  expect(key.shadow.matrix.equals(daylightShadow)).toBe(true);
  expect(scene.environmentRotation.y).toBe(0);
  expect(fromScene).toHaveBeenCalledTimes(1);
  lighting.dispose();
});

test('real Three PMREM schedules a bounded one-time 128-face probe and restores renderer state', async () => {
  const three = await vi.importActual<typeof import('three')>('three');
  const render = vi.fn();
  const setRenderTarget = vi.fn();
  // Exercise Three's real target allocation/filter scheduling. Only the GPU
  // draw boundary is absent: this is not a shader-compile or frame-time claim.
  const renderer = {
    getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    xr: { enabled: true }, autoClear: true, toneMapping: three.ACESFilmicToneMapping,
    getClearColor: (color: THREE.Color) => color.set('#ffffff'),
    state: { buffers: { depth: { getReversed: () => false } } },
    setRenderTarget, render,
  };
  const source = createStudioProbeScene();
  const generator = new three.PMREMGenerator(renderer as unknown as THREE.WebGLRenderer);
  const target = generator.fromScene(source.scene, 0.045, 0.1, 40, { size: STUDIO_PROBE_SIZE });
  expect([target.width, target.height]).toEqual([384, 512]);
  expect(target.texture.type).toBe(three.HalfFloatType);
  expect(target.texture.format).toBe(three.RGBAFormat);
  expect(target.texture.generateMipmaps).toBe(false);
  expect(target.width * target.height * 4 * 2).toBe(1_572_864);
  expect(render).toHaveBeenCalledTimes(32);
  expect(setRenderTarget).toHaveBeenLastCalledWith(null, 0, 0);
  expect(renderer.xr.enabled).toBe(true);
  expect(renderer.autoClear).toBe(true);
  expect(renderer.toneMapping).toBe(three.ACESFilmicToneMapping);
  generator.dispose(); source.dispose(); target.dispose();
});
