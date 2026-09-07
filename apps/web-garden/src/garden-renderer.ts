import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Subject } from './api.ts';
import { growthStage, type WorldState } from './game-state.ts';
import type { CareEvent } from './garden-worlds.ts';
import { buildWorldModel, disposeModel } from './garden-models.ts';

export type CameraAction = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'home';

export function worldFraming(subject: Subject, stage: number, aspect: number) {
  const base = subject === 'korean' ? [10.4, 11.0, 12.0, 12.6] : [10.6, 11.2, 12.0, 12.6];
  return {
    distance: base[stage]! * THREE.MathUtils.clamp(1.05 / aspect, 1, 1.25),
    targetY: subject === 'english' ? 1.8 : subject === 'korean' ? [0.95, 1.3, 1.6, 1.6][stage]! : 1.05 + stage * 0.12,
    polar: subject === 'english' ? 1.2 : 1.14,
  };
}

export function createWorldRenderer(canvas: HTMLCanvasElement, subject: Subject, world: WorldState, onLost: () => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(subject === 'english' ? '#c6e3df' : '#e6ecd7');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.minDistance = 8;
  controls.maxDistance = 22;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.enabled = false;
  canvas.style.touchAction = 'pan-y';
  controls.target.set(0, worldFraming(subject, growthStage(world), 1).targetY, 0.25);
  const light = new THREE.DirectionalLight('#fff0d9', 2.8);
  light.position.set(-5, 9, 6);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 25 });
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.04;
  scene.add(light, new THREE.HemisphereLight('#fff9ed', '#738367', 1.55));
  const fill = new THREE.DirectionalLight('#c4e9f0', 0.8);
  fill.position.set(5, 4, -4); scene.add(fill);
  let currentWorld = world;
  let model = buildWorldModel(subject, world, { batch: true });
  let activeCare: CareEvent | null = null;
  let careTransition = '';
  const careState = (phase: 'idle' | 'approach' | 'respond' | 'settle' | 'settled') => {
    const key = `${canvas.dataset.careId ?? '0'}:${phase}`;
    if (key === careTransition) return;
    careTransition = key;
    canvas.dataset.careState = phase;
    const detail = { id: Number(canvas.dataset.careId ?? 0), action: canvas.dataset.careAction, phase };
    canvas.dispatchEvent(new CustomEvent('garden-care-phase', { detail }));
    if (phase === 'settled') canvas.dispatchEvent(new CustomEvent('garden-care-finished', { detail }));
  };
  scene.add(model.root);
  let disposed = false;
  let lost = false;
  let motion = false;
  let intersecting = true;
  let frame = 0;
  let elapsed = 0;
  let lastTime: number | null = null;
  let homeDistance = worldFraming(subject, growthStage(world), 1).distance;
  const spherical = new THREE.Spherical();

  const draw = () => {
    if (disposed || lost) return;
    renderer.render(scene, camera);
  };
  const animate = (time: number) => {
    frame = 0;
    if (disposed || lost || !motion || document.hidden || !intersecting) return;
    if (lastTime !== null) elapsed += Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    const phase = model.animate(elapsed);
    if (activeCare) {
      careState(phase === 'idle' ? 'settled' : phase);
      if (phase === 'idle') activeCare = null;
    }
    draw();
    frame = requestAnimationFrame(animate);
  };
  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
    if (motion && !document.hidden && intersecting && !lost && !disposed) frame = requestAnimationFrame(animate);
  };
  const home = () => {
    spherical.set(homeDistance, worldFraming(subject, growthStage(currentWorld), camera.aspect).polar, 0.24);
    camera.position.setFromSpherical(spherical).add(controls.target);
    controls.update();
    draw();
  };
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height || disposed) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    // Frame the companion first; zoom-out still exposes every island placement.
    const framing = worldFraming(subject, growthStage(currentWorld), camera.aspect);
    const offset = camera.position.clone().sub(controls.target);
    controls.target.y = framing.targetY;
    if (offset.length() > 0) camera.position.copy(offset.multiplyScalar(framing.distance / homeDistance)).add(controls.target);
    homeDistance = framing.distance;
    controls.update();
    draw();
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    schedule();
    onLost();
  };
  controls.addEventListener('change', draw);
  canvas.addEventListener('webglcontextlost', contextLost);
  document.addEventListener('visibilitychange', schedule);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    intersecting = entry?.isIntersecting ?? false;
    schedule();
  });
  intersectionObserver.observe(canvas);
  home();
  resize();
  canvas.dataset.renderer = 'three-webgl';
  canvas.dataset.world = subject;
  canvas.dataset.stage = String(model.root.userData.stage);
  canvas.dataset.careId = '0';
  careState('idle');

  return {
    update(next: WorldState) {
      // Care/history updates do not rebuild or allocate any geometry.
      const sameArt = growthStage(next) === growthStage(currentWorld) && next.placements === currentWorld.placements;
      currentWorld = next;
      if (sameArt) return;
      if (activeCare) { activeCare = null; careState('settled'); }
      scene.remove(model.root);
      disposeModel(model.root);
      model = buildWorldModel(subject, next, { batch: true });
      scene.add(model.root);
      canvas.dataset.stage = String(model.root.userData.stage);
      model.animate(elapsed);
      resize();
    },
    care(event: CareEvent) {
      if (disposed || lost || event.subject !== subject || event.id <= Number(canvas.dataset.careId)) return;
      activeCare = motion ? event : null;
      canvas.dataset.careId = String(event.id);
      canvas.dataset.careAction = event.action;
      model.startCare(event.action, elapsed, !motion);
      careState(motion ? 'approach' : 'settled');
      draw();
    },
    setMotion(enabled: boolean) {
      motion = enabled;
      canvas.dataset.motion = enabled ? 'on' : 'off';
      schedule();
      draw();
    },
    setGestures(enabled: boolean) {
      controls.enabled = enabled;
      canvas.style.touchAction = enabled ? 'none' : 'pan-y';
    },
    camera(action: CameraAction) {
      if (action === 'home') { home(); return; }
      spherical.setFromVector3(camera.position.clone().sub(controls.target));
      if (action === 'left') spherical.theta -= Math.PI / 8;
      if (action === 'right') spherical.theta += Math.PI / 8;
      if (action === 'up') spherical.phi -= Math.PI / 12;
      if (action === 'down') spherical.phi += Math.PI / 12;
      if (action === 'in') spherical.radius *= 0.85;
      if (action === 'out') spherical.radius /= 0.85;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
      camera.position.setFromSpherical(spherical).add(controls.target);
      controls.update();
      draw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      canvas.removeEventListener('webglcontextlost', contextLost);
      controls.removeEventListener('change', draw);
      controls.dispose();
      disposeModel(model.root);
      light.shadow.dispose();
      scene.clear();
      renderer.dispose();
      if (!lost) renderer.forceContextLoss();
      delete canvas.dataset.renderer;
    },
  };
}

export type WorldRenderer = ReturnType<typeof createWorldRenderer>;
