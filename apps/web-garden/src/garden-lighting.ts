import * as THREE from 'three';
import type { Subject } from './api.ts';

// A small, local light rig, not an HDR download. The four broad softboxes are
// integrated once into GGX roughness levels; they add no per-frame geometry or
// draw calls. Keep this modest: the companions are matte, not chrome ornaments.
export const STUDIO_PROBE_SIZE = 128;
export type WorldLightPreset = 'daylight' | 'warm-side';

export function createStudioProbeScene() {
  const scene = new THREE.Scene();
  scene.name = 'companion-studio-probe';
  scene.background = new THREE.Color('#5d6570');
  const geometry = new THREE.PlaneGeometry(1, 1);
  const panels = [
    { position: [-5, 6, 6], size: [5, 6], color: '#fff1dc', intensity: 4.2 },
    { position: [6, 3, 1], size: [3, 5], color: '#dbeefa', intensity: 1.8 },
    { position: [-1, 4, -6], size: [4, 5], color: '#fff7e9', intensity: 3.1 },
    { position: [0, 9, 0], size: [7, 7], color: '#f1f6ff', intensity: 1.4 },
  ] as const;
  for (const [index, panel] of panels.entries()) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(panel.color).multiplyScalar(panel.intensity),
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `softbox-${index}`;
    mesh.position.fromArray(panel.position);
    mesh.scale.set(panel.size[0], panel.size[1], 1);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }
  let disposed = false;
  return {
    scene,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      for (const panel of scene.children) (panel as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material.dispose();
      scene.clear();
    },
  };
}

export function createWorldLighting(renderer: THREE.WebGLRenderer, scene: THREE.Scene, subject: Subject) {
  const source = createStudioProbeScene();
  const generator = new THREE.PMREMGenerator(renderer);
  let environment: THREE.WebGLRenderTarget;
  try {
    environment = generator.fromScene(source.scene, 0.045, 0.1, 40, { size: STUDIO_PROBE_SIZE });
  } finally {
    // Temporary render targets, shader programs and authoring geometry do not
    // survive initialization. The returned probe has its own explicit owner.
    generator.dispose();
    source.dispose();
  }
  environment.texture.name = 'companion-studio-ibl';
  scene.environment = environment.texture;

  const key = new THREE.DirectionalLight('#fff1dd', 3.0);
  key.name = 'companion-key';
  key.position.set(-5, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 24 });
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 2.25;
  // Lower ambient fill retains readable cheek, fin and leaf curvature. The
  // probe supplies broad reflected light where the old flat hemisphere did not.
  const ambient = new THREE.HemisphereLight('#f5f7ff', subject === 'english' ? '#637e80' : '#71805d', 0.55);
  ambient.name = 'companion-bounce';
  const fill = new THREE.DirectionalLight('#d5e9fa', 0.55);
  fill.name = 'companion-fill';
  fill.position.set(6, 3, 4);
  const rim = new THREE.DirectionalLight('#fff5dc', 1.05);
  rim.name = 'companion-rim';
  rim.position.set(1, 5, -6);
  scene.add(key, ambient, fill, rim);
  let disposed = false;
  const setPreset = (preset: WorldLightPreset) => {
    if (disposed) return;
    const warm = preset === 'warm-side';
    key.position.set(warm ? 5 : -5, warm ? 4 : 8, 6);
    key.color.set(warm ? '#ffd4a3' : '#fff1dd');
    key.intensity = warm ? 2.8 : 3.0;
    fill.position.set(warm ? -6 : 6, 3, 4);
    fill.intensity = warm ? 0.7 : 0.55;
    ambient.intensity = warm ? 0.45 : 0.55;
    scene.environmentIntensity = subject === 'english' ? 0.42 : 0.34;
    // Rotate the same filtered map: a changed view-light direction changes
    // specular response without allocating another probe or animating a clock.
    scene.environmentRotation.y = warm ? -1.1 : 0;
    key.shadow.needsUpdate = true;
  };
  setPreset('daylight');
  return {
    setPreset,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (scene.environment === environment.texture) scene.environment = null;
      environment.dispose();
      key.shadow.dispose();
      scene.remove(key, ambient, fill, rim);
    },
  };
}
