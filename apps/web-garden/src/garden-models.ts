import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Subject } from './api.ts';
import { GARDEN_SPOTS, growthStage, type WorldState } from './game-state.ts';
import { WORLD_CATALOGS } from './garden-worlds.ts';

type Point = readonly [number, number, number];
const LEAF = '#78a85b';
const CREAM = '#fff2d6';
const WOOD = '#a37450';
const INK = '#343734';

function material(color: string) { return new THREE.MeshStandardMaterial({ color, roughness: 0.8 }); }
function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, position: Point, scale: Point = [1, 1, 1]) {
  const result = new THREE.Mesh(geometry, material(color));
  result.position.set(...position);
  result.scale.set(...scale);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}
function orb(parent: THREE.Object3D, color: string, position: Point, scale: Point) {
  return mesh(parent, new THREE.SphereGeometry(1, 20, 14), color, position, scale);
}
function box(parent: THREE.Object3D, color: string, position: Point, scale: Point) {
  return mesh(parent, new THREE.BoxGeometry(1, 1, 1), color, position, scale);
}
function cylinder(parent: THREE.Object3D, color: string, position: Point, radius: number, height: number, top = radius) {
  return mesh(parent, new THREE.CylinderGeometry(top, radius, height, 24), color, position);
}
function ring(parent: THREE.Object3D, color: string, position: Point, radius: number, tube: number) {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 10, 40), color, position);
}
function group(parent: THREE.Object3D, name: string, position: Point = [0, 0, 0]) {
  const result = new THREE.Group();
  result.name = name;
  result.position.set(...position);
  parent.add(result);
  return result;
}
function flower(parent: THREE.Object3D, position: Point, color: string, size = 1) {
  const result = group(parent, 'flower', position);
  cylinder(result, LEAF, [0, 0.2, 0], 0.035, 0.4);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    orb(result, color, [Math.cos(angle) * 0.14, 0.44 + Math.sin(angle) * 0.14, 0], [0.12, 0.12, 0.06]);
  }
  orb(result, '#f7c951', [0, 0.44, 0.045], [0.09, 0.09, 0.06]);
  result.scale.setScalar(size);
  return result;
}
function plant(parent: THREE.Object3D, position: Point, height: number, color = LEAF) {
  const result = group(parent, 'plant', position);
  cylinder(result, '#508849', [0, height / 2, 0], 0.035, height);
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? -1 : 1;
    const leaf = orb(result, color, [side * 0.16, height * (0.3 + i * 0.19), 0], [0.27, 0.1, 0.13]);
    leaf.rotation.z = side * 0.5;
  }
  return result;
}

function tree(parent: THREE.Object3D, stage: number) {
  const result = group(parent, 'growing-tree', [0, 0, -0.5]);
  if (stage === 0) {
    cylinder(result, '#80ae61', [0, 0.55, 0], 0.07, 1.1);
    orb(result, '#98c977', [-0.35, 0.95, 0], [0.48, 0.16, 0.25]).rotation.z = -0.35;
    orb(result, '#78b764', [0.35, 1.15, 0], [0.48, 0.16, 0.25]).rotation.z = 0.4;
    orb(result, '#bf926b', [0, 0.02, 0], [0.65, 0.1, 0.5]);
  } else {
    const height = stage === 1 ? 1.6 : 2.15;
    cylinder(result, WOOD, [0, height / 2, 0], 0.23, height, 0.14);
    cylinder(result, WOOD, [-0.3, height * 0.7, 0], 0.11, 0.8).rotation.z = 0.7;
    cylinder(result, WOOD, [0.32, height * 0.76, 0], 0.1, 0.85).rotation.z = -0.75;
    const crown = group(result, 'canopy', [0, height, 0]);
    orb(crown, '#78a85b', [0, 0.6, 0], [1.15, 1.0, 0.95]);
    orb(crown, '#98c876', [-0.75, 0.12, 0.1], [0.85, 0.78, 0.8]);
    orb(crown, '#6d9b52', [0.75, 0.2, -0.08], [0.9, 0.8, 0.85]);
    orb(crown, '#a1cd7c', [-0.1, 0.45, 0.65], [0.88, 0.72, 0.55]);
    if (stage === 1) crown.scale.setScalar(0.73);
    if (stage >= 2) {
      for (let i = 0; i < 8; i++) {
        const angle = i * 2.4;
        const x = Math.cos(angle) * (0.6 + i % 2 * 0.45);
        const y = 0.15 + i % 3 * 0.35;
        if (stage === 2) flower(crown, [x, y, 0.78], '#f8b4b0', 0.75);
        else orb(crown, '#ed997e', [x, y + 0.1, 0.83], [0.18, 0.2, 0.18]);
      }
    }
  }
  return result;
}

function fish(parent: THREE.Object3D, stage: number, color = '#efaa63') {
  const result = group(parent, 'fish');
  orb(result, color, [0, 0, 0], [0.72, 0.48, 0.32]);
  orb(result, '#ffdf99', [0.2, -0.11, 0.13], [0.43, 0.27, 0.23]);
  const tail = group(result, 'tail', [-0.65, 0, 0]);
  mesh(tail, new THREE.ConeGeometry(0.4, 0.48, 3), '#e98e6c', [-0.18, 0, 0], [1, 1, 0.35]).rotation.z = Math.PI / 2;
  const fin = orb(result, '#e88a5e', [0, -0.13, 0.28], [0.18, 0.24 + stage * 0.035, 0.045]);
  fin.rotation.z = -0.6;
  orb(result, '#ef9a64', [-0.1, 0.43, 0], [0.28, 0.18 + stage * 0.035, 0.075]);
  for (const side of [-1, 1]) {
    orb(result, CREAM, [0.4, 0.13, side * 0.25], [0.18, 0.2, 0.1]);
    orb(result, INK, [0.46, 0.13, side * 0.32], [0.095, 0.12, 0.045]);
    orb(result, '#ffffff', [0.48, 0.17, side * 0.35], [0.032, 0.04, 0.022]);
  }
  if (stage >= 2) {
    for (const x of [-0.3, -0.05]) orb(result, '#fff0c5', [x, 0.04, 0], [0.07, 0.4, 0.325]);
  }
  result.scale.setScalar([0.62, 0.95, 1.22, 1.4][stage]!);
  return { result, tail };
}

function puppy(parent: THREE.Object3D, stage: number) {
  const result = group(parent, 'puppy', [0, 0, 0.2]);
  const bodyColor = '#c99568';
  const legHeight = stage === 0 ? 0.3 : 0.48;
  orb(result, bodyColor, [0, 0.85, -0.2], [0.62, 0.72, 0.88]);
  orb(result, '#f4d8af', [0, 0.9, 0.44], [0.42, 0.55, 0.21]);
  for (const x of [-0.43, 0.43]) for (const z of [-0.65, 0.47]) {
    orb(result, bodyColor, [x, legHeight, z], [0.25, legHeight, 0.3]);
    orb(result, '#f5ddb9', [x, 0.17, z + 0.09], [0.26, 0.17, 0.32]);
  }
  const head = group(result, 'head', [0, 1.6, 0.5]);
  orb(head, bodyColor, [0, 0, 0], [0.74, 0.67, 0.67]);
  for (const side of [-1, 1]) {
    const ear = orb(head, '#946344', [side * 0.66, -0.17, 0.02], [0.25, 0.61, 0.32]);
    ear.rotation.z = side * 0.17;
    orb(head, '#eeb399', [side * 0.72, -0.24, 0.24], [0.12, 0.34, 0.06]);
    orb(head, INK, [side * 0.28, 0.13, 0.6], [0.11, 0.15, 0.075]);
    orb(head, '#ffffff', [side * 0.26, 0.18, 0.66], [0.035, 0.045, 0.02]);
    orb(head, '#f7e0be', [side * 0.15, -0.22, 0.62], [0.26, 0.19, 0.18]);
    orb(head, '#de9c7c', [side * 0.48, -0.14, 0.5], [0.12, 0.07, 0.05]);
  }
  orb(head, '#594439', [0, -0.13, 0.8], [0.145, 0.105, 0.105]);
  orb(head, '#df9291', [0, -0.36, 0.7], [0.095, 0.13, 0.06]);
  const tail = group(result, 'tail', [0, 1.03, -0.94]);
  orb(tail, bodyColor, [0, 0.24, -0.17], [0.18, 0.38, 0.2]).rotation.x = -0.5;
  orb(tail, CREAM, [0, 0.47, -0.27], [0.17, 0.15, 0.17]);
  if (stage >= 1) {
    ring(result, '#719da3', [0, 1.25, 0.45], 0.43, 0.08).rotation.x = Math.PI / 2;
    orb(result, '#f4c863', [0, 1.12, 0.83], [0.1, 0.12, 0.035]);
  }
  if (stage >= 2) {
    mesh(result, new THREE.ConeGeometry(0.31, 0.4, 3), '#e48e79', [0, 0.95, 0.82], [1, 1, 0.15]).rotation.z = Math.PI;
  }
  result.scale.setScalar([0.7, 0.9, 1.08, 1.2][stage]!);
  return { result, head, tail };
}

function bowl(parent: THREE.Object3D, position: Point, food: boolean) {
  const result = group(parent, 'bowl', position);
  cylinder(result, '#83bac6', [0, 0.14, 0], 0.4, 0.26, 0.47);
  cylinder(result, food ? '#9b7150' : '#aedfe8', [0, 0.28, 0], 0.37, 0.025);
  if (food) for (let i = 0; i < 7; i++) orb(result, '#c89a68', [Math.cos(i * 2.4) * 0.23, 0.32, Math.sin(i * 2.4) * 0.23], [0.07, 0.05, 0.07]);
  return result;
}

function decoration(parent: THREE.Object3D, id: string) {
  const result = group(parent, `decoration:${id}`);
  switch (id) {
    case 'moon-chair':
      box(result, '#edcb88', [0, 0.42, 0], [1.1, 0.12, 0.5]);
      box(result, '#f6db9d', [0, 0.78, -0.2], [1.1, 0.55, 0.12]);
      for (const x of [-0.42, 0.42]) for (const z of [-0.17, 0.17]) cylinder(result, WOOD, [x, 0.2, z], 0.05, 0.4);
      break;
    case 'dandelion-pot':
      cylinder(result, '#de9d7f', [0, 0.23, 0], 0.23, 0.45, 0.33);
      flower(result, [0, 0.42, 0], '#fff1b3', 1.1);
      break;
    case 'tiny-pond':
      orb(result, '#c6c1a6', [0, 0.03, 0], [0.7, 0.12, 0.55]);
      orb(result, '#8bced6', [0, 0.12, 0], [0.59, 0.035, 0.44]);
      break;
    case 'cloud-balloon':
      cylinder(result, '#b6a17b', [0, 0.85, 0], 0.025, 1.7);
      for (const x of [-0.3, 0, 0.3]) orb(result, '#fffaf0', [x, 1.65 + (x === 0 ? 0.15 : 0), 0], [0.35, 0.3, 0.25]);
      break;
    case 'reading-cat':
      orb(result, '#e6be87', [0, 0.32, 0], [0.29, 0.35, 0.23]);
      orb(result, '#e6be87', [0, 0.73, 0.05], [0.28, 0.25, 0.24]);
      for (const x of [-0.18, 0.18]) {
        mesh(result, new THREE.ConeGeometry(0.13, 0.26, 3), '#e6be87', [x, 0.98, 0.05]);
        orb(result, INK, [x * 0.6, 0.77, 0.27], [0.026, 0.04, 0.02]);
      }
      box(result, '#8db7a0', [0, 0.36, 0.32], [0.55, 0.08, 0.32]).rotation.x = 0.3;
      break;
    case 'rainbow-flag': case 'paw-flag':
      cylinder(result, WOOD, [0, 0.68, 0], 0.035, 1.36);
      for (let i = 0; i < 3; i++) box(result, ['#e89986', '#f4d277', '#8fbaa2'][i]!, [0.27, 1.2 - i * 0.13, 0], [0.54, 0.13, 0.04]);
      if (id === 'paw-flag') orb(result, CREAM, [0.28, 1.09, 0.045], [0.09, 0.1, 0.03]);
      break;
    case 'picnic-basket': case 'treasure-chest':
      box(result, id === 'picnic-basket' ? '#bd9261' : '#9b7652', [0, 0.26, 0], [0.75, 0.5, 0.5]);
      ring(result, '#e3bd76', [0, 0.6, 0], 0.24, 0.045);
      if (id === 'treasure-chest') box(result, '#f2d380', [0, 0.27, 0.27], [0.13, 0.19, 0.05]);
      break;
    case 'strawberry-patch':
      box(result, WOOD, [0, 0.09, 0], [0.85, 0.18, 0.6]);
      for (const x of [-0.26, 0, 0.26]) {
        plant(result, [x, 0.13, 0], 0.42);
        orb(result, '#df7b74', [x, 0.22, 0.2], [0.12, 0.14, 0.11]);
      }
      break;
    case 'mushroom-home': case 'puppy-house':
      if (id === 'mushroom-home') {
        cylinder(result, CREAM, [0, 0.4, 0], 0.4, 0.8);
        orb(result, '#d99581', [0, 0.85, 0], [0.66, 0.34, 0.6]);
        for (const x of [-0.3, 0, 0.3]) orb(result, CREAM, [x, 1.1, 0.1], [0.09, 0.025, 0.07]);
      } else {
        box(result, '#e7bd86', [0, 0.53, 0], [1.05, 1.05, 0.9]);
        mesh(result, new THREE.CylinderGeometry(0.82, 0.82, 1.05, 3), '#a67865', [0, 1.15, 0]).rotation.x = Math.PI / 2;
      }
      orb(result, '#705945', [0, 0.27, 0.46], [0.22, 0.32, 0.03]);
      break;
    case 'bird-bath': case 'pebble-fountain':
      cylinder(result, '#b9b7a1', [0, 0.32, 0], 0.16, 0.64);
      orb(result, '#c7c8b2', [0, 0.62, 0], [0.5, 0.1, 0.4]);
      orb(result, '#9edce4', [0, 0.69, 0], [0.43, 0.025, 0.34]);
      if (id === 'pebble-fountain') orb(result, '#a7dde1', [0, 0.88, 0], [0.08, 0.23, 0.08]);
      else orb(result, '#eac484', [0.32, 0.82, 0], [0.13, 0.13, 0.12]);
      break;
    case 'firefly-lantern':
      cylinder(result, WOOD, [0, 0.55, 0], 0.04, 1.1);
      orb(result, '#f7dc8b', [0, 1.0, 0], [0.25, 0.34, 0.25]);
      break;
    case 'shell-arch':
      for (let i = 0; i < 7; i++) {
        const angle = i / 6 * Math.PI;
        const shell = orb(result, i % 2 ? '#f1cfbb' : '#fff0dc', [Math.cos(angle) * 0.3, 0.16 + Math.sin(angle) * 0.36, 0], [0.12, 0.38, 0.18]);
        shell.rotation.z = Math.PI / 2 - angle;
      }
      orb(result, CREAM, [0, 0.15, 0.24], [0.14, 0.14, 0.14]);
      break;
    case 'ribbon-kelp':
      for (const x of [-0.25, 0, 0.25]) plant(result, [x, 0, 0], 0.8 + (x === 0 ? 0.4 : 0), '#64a69a');
      break;
    case 'coral-garden':
      for (let i = 0; i < 5; i++) {
        const coral = cylinder(result, i % 2 ? '#ecb09e' : '#d99493', [(i - 2) * 0.17, 0.3, 0], 0.065, 0.5 + i % 2 * 0.35);
        coral.rotation.z = (i - 2) * 0.2;
        orb(result, '#eeb7a3', [(i - 2) * 0.22, 0.57 + i % 2 * 0.15, 0], [0.12, 0.13, 0.12]);
      }
      break;
    case 'bubble-rock':
      orb(result, '#a8babc', [0, 0.2, 0], [0.5, 0.27, 0.38]);
      for (let i = 0; i < 4; i++) orb(result, '#d7f5f1', [Math.sin(i) * 0.15, 0.5 + i * 0.3, 0], [0.09, 0.09, 0.09]);
      break;
    case 'star-lamp':
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        const arm = orb(result, '#f5d68f', [Math.sin(angle) * 0.2, 0.35 + Math.cos(angle) * 0.2, 0], [0.1, 0.27, 0.1]);
        arm.rotation.z = -angle;
      }
      break;
    case 'puppy-ball':
      orb(result, '#cbd883', [0, 0.3, 0], [0.3, 0.3, 0.3]);
      ring(result, CREAM, [0, 0.3, 0], 0.3, 0.018).rotation.y = 0.4;
      break;
    case 'soft-bed':
      orb(result, '#b5b5cb', [0, 0.13, 0], [0.7, 0.16, 0.55]);
      ring(result, '#c7c5da', [0, 0.24, 0], 0.5, 0.13).rotation.x = Math.PI / 2;
      break;
    case 'flower-hoop':
      ring(result, '#e4c57e', [0, 0.68, 0], 0.58, 0.055);
      for (const x of [-0.4, 0, 0.4]) flower(result, [x, 0.82, 0], '#edb4af', 0.65);
      break;
    case 'water-bowl': bowl(result, [0, 0, 0], false); break;
  }
  return result;
}

export function buildWorldModel(subject: Subject, world: WorldState, { batch = false } = {}) {
  const root = new THREE.Group();
  root.name = `world:${subject}`;
  const stage = growthStage(world);
  root.userData.stage = stage;
  const animated: ((time: number) => void)[] = [];
  // Batch only within these independently moving coordinate systems.
  const moving = new Set<THREE.Object3D>();
  const aquarium = subject === 'english';
  if (aquarium) {
    box(root, '#75a8ab', [0, -0.35, 0], [8.9, 0.65, 6.4]);
    box(root, '#f3d9a4', [0, -0.01, 0], [8.55, 0.14, 6.1]);
    for (const x of [-4.3, 4.3]) for (const z of [-3.05, 3.05]) {
      box(root, '#b7e4de', [x, 2.1, z], [0.07, 4.25, 0.07]);
    }
    for (const y of [0, 4.2]) {
      for (const x of [-4.3, 4.3]) box(root, '#b7e4de', [x, y, 0], [0.09, 0.09, 6.15]);
      for (const z of [-3.05, 3.05]) box(root, '#b7e4de', [0, y, z], [8.65, 0.09, 0.09]);
    }
    // Subtle back and side glass; leave the front visually open so fish stay legible.
    const glass = new THREE.MeshStandardMaterial({ color: '#aee5e5', transparent: true, opacity: 0.13, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide });
    for (const x of [-4.3, 4.3]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 4.2), glass);
      pane.position.set(x, 2.1, 0); pane.rotation.y = Math.PI / 2; root.add(pane);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4.2), glass);
    back.position.set(0, 2.1, -3.05); root.add(back);
    for (let i = 0; i < 3 + stage; i++) plant(root, [-3.4 + i * 1.15, 0.08, -2.4], 1.0 + i % 3 * 0.36, '#67a897');
    const swimmer = fish(root, stage);
    moving.add(swimmer.result); moving.add(swimmer.tail);
    swimmer.result.position.set(0, 2.0, 0.3);
    animated.push((time) => {
      swimmer.result.position.x = Math.sin(time * 0.35) * 1.25;
      swimmer.result.position.y = 2.0 + Math.sin(time * 0.7) * 0.12;
      swimmer.result.rotation.y = Math.sin(time * 0.35) * -0.45;
      swimmer.tail.rotation.y = Math.sin(time * 2.6) * 0.24;
    });
    if (stage >= 2) {
      const friend = fish(root, 0, '#9cb8d0');
      moving.add(friend.result); moving.add(friend.tail);
      friend.result.position.set(-2.2, 1.15, -0.8);
      animated.push((time) => { friend.result.position.x = -2.0 + Math.sin(time * 0.45) * 0.5; friend.tail.rotation.y = Math.sin(time * 3) * 0.2; });
    }
    if (stage === 3) decoration(root, 'coral-garden').position.set(2.9, 0.1, -2);
    if (world.lastCare === 'feed') for (let i = 0; i < 6; i++) orb(root, '#c99864', [-0.8 + i * 0.25, 3.2 + i % 2 * 0.15, 0.4], [0.05, 0.05, 0.05]);
    if (world.lastCare === 'play') for (let i = 0; i < 7; i++) {
      const bubble = ring(root, '#dcf7f4', [1.8 + Math.sin(i) * 0.35, 0.7 + i * 0.4, 0.7], 0.09 + i % 3 * 0.045, 0.015);
      moving.add(bubble);
      animated.push((time) => { bubble.position.y = 0.6 + (i * 0.4 + time * 0.23) % 3.1; });
    }
  } else {
    cylinder(root, '#c7ad83', [0, -0.4, 0], 4.75, 0.7, 4.85);
    cylinder(root, '#a3c583', [0, -0.025, 0], 4.85, 0.12);
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      orb(root, '#87ae69', [Math.cos(angle) * 4.15, 0.08, Math.sin(angle) * 4.15], [0.55, 0.16, 0.4]);
    }
    for (let i = 0; i < 7; i++) orb(root, '#e9d8b1', [1.1 + Math.sin(i * 0.5) * 0.55, 0.065, 2.9 - i * 0.75], [0.32, 0.045, 0.2]);
    for (let i = 0; i < 6; i++) flower(root, [-3.4 + i * 0.35, 0.1, 1.4 + i % 2 * 0.4], i % 2 ? '#f6d999' : '#f1b7b0', 0.7);
    for (let i = 0; i < 9; i++) {
      const x = -3.6 + i * 0.9;
      cylinder(root, '#e7d7b4', [x, 0.38, -2.9], 0.055, 0.75);
    }
    box(root, '#e7d7b4', [0, 0.42, -2.9], [7.3, 0.11, 0.07]);
    if (subject === 'korean') {
      const growing = tree(root, stage);
      moving.add(growing);
      animated.push((time) => { growing.rotation.z = Math.sin(time * 0.6) * 0.015; });
      for (let i = 0; i <= stage; i++) plant(root, [-2.6 + i * 0.55, 0.1, -0.8], 0.45 + stage * 0.2);
      const pond = decoration(root, 'tiny-pond'); pond.position.set(2.9, 0.03, 0.15); pond.scale.setScalar(1.25);
      if (world.lastCare === 'water') {
        const can = group(root, 'watering-can', [-1.4, 1.25, 0.2]);
        cylinder(can, '#8ebfca', [0, 0, 0], 0.23, 0.4);
        cylinder(can, '#8ebfca', [0.32, 0.1, 0], 0.06, 0.6).rotation.z = -0.8;
        ring(can, '#8ebfca', [-0.23, 0.08, 0], 0.17, 0.04);
        for (let i = 0; i < 5; i++) {
          const drop = orb(root, '#8bc4df', [-0.9 + i * 0.16, 0.6 + i % 2 * 0.25, 0.2], [0.045, 0.09, 0.045]);
          moving.add(drop);
          animated.push((time) => { drop.position.y = 0.2 + (i * 0.15 + 1 - time * 0.4 % 1) % 0.8; });
        }
      }
      if (world.lastCare === 'sunlight') {
        orb(root, '#f5d17d', [2.2, 3.4, -1.8], [0.45, 0.45, 0.45]);
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;
          orb(root, '#f7d990', [2.2 + Math.cos(angle) * 0.7, 3.4 + Math.sin(angle) * 0.7, -1.8], [0.07, 0.07, 0.07]);
        }
      }
    } else {
      const dog = puppy(root, stage);
      moving.add(dog.result); moving.add(dog.head); moving.add(dog.tail);
      animated.push((time) => {
        dog.tail.rotation.z = Math.sin(time * 2.6) * 0.26;
        dog.head.rotation.z = Math.sin(time * 0.6) * 0.035;
        if (world.lastCare === 'play') {
          dog.result.position.x = Math.sin(time * 0.7) * 0.75;
          dog.result.position.y = Math.abs(Math.sin(time * 2.1)) * 0.09;
          dog.result.rotation.y = Math.sin(time * 0.7) * 0.3;
        }
      });
      bowl(root, [1.7, 0.09, 0.65], world.lastCare === 'feed');
      if (stage >= 1) decoration(root, 'puppy-ball').position.set(-1.7, 0.1, 1.25);
      if (stage === 3) decoration(root, 'flower-hoop').position.set(-2.1, 0.1, -1.8);
      if (world.lastCare === 'brush') for (let i = 0; i < 5; i++) {
        const sparkle = mesh(root, new THREE.OctahedronGeometry(0.09), '#f5d68f', [-0.9 + i * 0.4, 2.35 + i % 2 * 0.3, 0.2]);
        moving.add(sparkle);
        animated.push((time) => { sparkle.rotation.y = time * 0.6; });
      }
      if (world.lastCare === 'play') {
        const ball = decoration(root, 'puppy-ball'); ball.position.set(1.1, 0.1, 1.65);
        moving.add(ball);
        animated.push((time) => { ball.position.x = Math.sin(time * 0.7 + 0.5) * 1.4; ball.position.y = Math.abs(Math.sin(time * 1.4)) * 0.35 + 0.1; });
      }
    }
  }
  // Stable named spots map to real x/z positions; multiple items at one spot get a
  // deterministic fan-out rather than covering each other or deleting an old placement.
  const occupants = new Map<string, number>();
  for (const item of WORLD_CATALOGS[subject]) {
    const spotId = world.placements[item.id];
    if (!spotId) continue;
    const index = GARDEN_SPOTS.findIndex((spot) => spot.id === spotId);
    const positions: Point[] = [[-2.8, 0.1, -0.3], [2.7, 0.1, 0.8], [-0.65, 0.1, 2.1], [0, 0.1, -2.2], [-2.7, 0.1, 1.8], [2.8, 0.1, -1.7], [0.7, 0.1, 2.55], [2.6, 0.1, 2.25]];
    const position = positions[index]!;
    const slot = occupants.get(spotId) ?? 0;
    occupants.set(spotId, slot + 1);
    const art = decoration(root, item.id);
    art.scale.setScalar(0.78);
    art.position.set(position[0] + (slot % 3 - 1) * 0.42, position[1], position[2] - Math.floor(slot / 3) * 0.5);
  }
  if (batch) batchStaticMeshes(root, moving);
  return { root, animate: (time: number) => { for (const update of animated) update(time); } };
}

// All opaque model primitives use the same surface settings. Bake their original
// linear material colors and local transforms into one draw per moving frame of
// reference, without changing tessellation, normals, shadows, or transparent sort.
function batchStaticMeshes(root: THREE.Group, moving: Set<THREE.Object3D>) {
  const batches = new Map<THREE.Object3D, THREE.BufferGeometry[]>();
  const removed: THREE.Mesh[] = [];
  const collect = (object: THREE.Object3D, owner: THREE.Object3D, parentMatrix: THREE.Matrix4) => {
    object.updateMatrix();
    const boundary = moving.has(object);
    const matrix = boundary ? new THREE.Matrix4() : parentMatrix.clone().multiply(object.matrix);
    if (boundary) owner = object;
    if (object instanceof THREE.Mesh && !boundary
      && object.material instanceof THREE.MeshStandardMaterial && !object.material.transparent) {
      const geometry = object.geometry.clone().applyMatrix4(matrix);
      const colors = new Float32Array(geometry.getAttribute('position').count * 3);
      const { r, g, b } = object.material.color;
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = r; colors[i + 1] = g; colors[i + 2] = b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const entries = batches.get(owner) ?? [];
      entries.push(geometry);
      batches.set(owner, entries);
      removed.push(object);
    }
    for (const child of object.children) collect(child, owner, matrix);
  };
  for (const child of root.children) collect(child, root, new THREE.Matrix4());
  const surface = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  for (const [owner, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    for (const entry of geometries) entry.dispose();
    if (!geometry) throw new Error('World primitives must have compatible geometry attributes');
    const merged = new THREE.Mesh(geometry, surface);
    merged.name = 'static-batch';
    merged.castShadow = true;
    merged.receiveShadow = true;
    merged.matrixAutoUpdate = false;
    owner.add(merged);
  }
  const geometries = new Set(removed.map((object) => object.geometry));
  const materials = new Set(removed.flatMap((object) => Array.isArray(object.material) ? object.material : [object.material]));
  for (const object of removed) object.removeFromParent();
  // A resource still used by glass or a moving particle belongs to the live model.
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.delete(object.geometry);
    for (const entry of Array.isArray(object.material) ? object.material : [object.material]) materials.delete(entry);
  });
  for (const entry of geometries) entry.dispose();
  for (const entry of materials) entry.dispose();
}

export function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      for (const entry of Array.isArray(object.material) ? object.material : [object.material]) materials.add(entry);
    }
  });
  for (const entry of geometries) entry.dispose();
  for (const entry of materials) entry.dispose();
  root.clear();
}
