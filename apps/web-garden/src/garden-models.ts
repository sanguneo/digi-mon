import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Subject } from './api.ts';
import { GARDEN_SPOTS, growthStage, type WorldState } from './game-state.ts';
import { WORLD_CATALOGS, type CareAction } from './garden-worlds.ts';

type Point = readonly [number, number, number];
const LEAF = '#78a85b';
const CREAM = '#fff2d6';
const WOOD = '#a37450';
const INK = '#343734';

type Surface = 'organic' | 'wood' | 'satin' | 'water';
const ROUGHNESS: Record<Surface, number> = { organic: 0.92, wood: 0.84, satin: 0.42, water: 0.16 };
function material(color: string, surface: Surface) {
  const result = new THREE.MeshStandardMaterial({ color, roughness: ROUGHNESS[surface] });
  result.name = surface;
  return result;
}
function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, position: Point, scale: Point = [1, 1, 1], surface: Surface = parent.userData.surface ?? 'organic') {
  const result = new THREE.Mesh(geometry, material(color, surface));
  result.position.set(...position);
  result.scale.set(...scale);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}
function orb(parent: THREE.Object3D, color: string, position: Point, scale: Point, surface?: Surface) {
  return mesh(parent, new THREE.SphereGeometry(1, 20, 14), color, position, scale, surface);
}
function box(parent: THREE.Object3D, color: string, position: Point, scale: Point, surface?: Surface) {
  return mesh(parent, new THREE.BoxGeometry(1, 1, 1), color, position, scale, surface);
}
function cylinder(parent: THREE.Object3D, color: string, position: Point, radius: number, height: number, top = radius, surface?: Surface) {
  return mesh(parent, new THREE.CylinderGeometry(top, radius, height, 24), color, position, [1, 1, 1], surface);
}
function ring(parent: THREE.Object3D, color: string, position: Point, radius: number, tube: number) {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 10, 40), color, position);
}
function group(parent: THREE.Object3D, name: string, position: Point = [0, 0, 0]) {
  const result = new THREE.Group();
  result.name = name;
  result.userData.surface = parent.userData.surface;
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

function stroke(parent: THREE.Object3D, color: string, points: Point[], radius = 0.015, surface?: Surface) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 12, radius, 5, false), color, [0, 0, 0], [1, 1, 1], surface);
}

function leaf(parent: THREE.Object3D, name: string, position: Point, size = 1) {
  const result = group(parent, name, position);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.bezierCurveTo(0.22, 0.32, 0.62, 0.3, 1, 0.06);
  shape.bezierCurveTo(0.68, -0.22, 0.28, -0.27, 0, 0);
  mesh(result, new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.04, bevelSegments: 2, steps: 1, curveSegments: 10 }), '#559450', [0, 0, 0]);
  stroke(result, '#b1d27e', [[0.04, 0, 0.1], [0.46, 0.02, 0.12], [0.9, 0.05, 0.08]], 0.018);
  for (const x of [0.28, 0.48, 0.65]) {
    stroke(result, '#88b969', [[x, 0.02, 0.11], [x + 0.07, 0.12, 0.1]], 0.009);
    stroke(result, '#88b969', [[x, 0.02, 0.11], [x + 0.09, -0.1, 0.1]], 0.009);
  }
  result.scale.setScalar(size);
  return result;
}

function tree(parent: THREE.Object3D, stage: number) {
  const result = group(parent, 'growing-tree', [0, 0, -0.5]);
  if (stage === 0) {
    cylinder(result, '#558c45', [0, 0.7, 0], 0.075, 1.4);
    leaf(result, 'leaf:left', [0, 1.0, 0], 0.95).rotation.z = Math.PI - 0.22;
    leaf(result, 'leaf:right', [0, 1.35, 0.02], 1.02).rotation.z = 0.22;
    orb(result, '#78563e', [0, 0.02, 0], [0.85, 0.13, 0.65], 'wood');
    for (let i = 0; i < 9; i++) orb(result, i % 2 ? '#aa8053' : '#c19a70', [Math.cos(i * 2.4) * 0.63, 0.13, Math.sin(i * 2.4) * 0.4], [0.1, 0.06, 0.075], 'wood');
    orb(result, '#c8a276', [-0.23, 0.16, 0.32], [0.19, 0.14, 0.12], 'wood').rotation.z = -0.4;
    result.position.z = 0.2;
  } else {
    const height = stage === 1 ? 1.6 : 2.15;
    cylinder(result, WOOD, [0, height / 2, 0], 0.23, height, 0.14, 'wood');
    cylinder(result, WOOD, [-0.3, height * 0.7, 0], 0.11, 0.8, 0.08, 'wood').rotation.z = 0.7;
    cylinder(result, WOOD, [0.32, height * 0.76, 0], 0.1, 0.85, 0.07, 'wood').rotation.z = -0.75;
    for (const x of [-0.11, 0.05, 0.14]) stroke(result, '#735238', [[x, 0.17, 0.2], [x - 0.02, 0.52, 0.21], [x * 0.6, 1.0, 0.17]], 0.013, 'wood');
    ring(result, '#805c3d', [0.01, 0.86, 0.2], 0.065, 0.014).scale.y = 1.5;
    for (const side of [-1, 1]) stroke(result, '#936c47', [[side * 0.08, 0.33, 0], [side * 0.26, 0.1, 0.15], [side * 0.48, 0.05, 0.18]], 0.065, 'wood');
    const crown = group(result, 'canopy', [0, height, 0]);
    orb(crown, '#4f8345', [0, 0.6, 0], [1.15, 1.0, 0.95]);
    orb(crown, '#79a65a', [-0.75, 0.12, 0.1], [0.85, 0.78, 0.8]);
    orb(crown, '#426f41', [0.75, 0.2, -0.08], [0.9, 0.8, 0.85]);
    orb(crown, '#8cb567', [-0.1, 0.45, 0.65], [0.88, 0.72, 0.55]);
    for (let i = 0; i < 9; i++) {
      const detail = leaf(crown, `crown-leaf:${i}`, [Math.sin(i * 2.4) * 1.05, 0.2 + i % 3 * 0.35, 0.85], 0.34);
      detail.rotation.z = i * 0.8;
    }
    if (stage === 1) crown.scale.setScalar(0.73);
    if (stage >= 2) {
      for (let i = 0; i < 8; i++) {
        const angle = i * 2.4;
        const x = Math.cos(angle) * (0.6 + i % 2 * 0.45);
        const y = 0.15 + i % 3 * 0.35;
        if (stage === 2) flower(crown, [x, y, 0.78], '#f8b4b0', 0.75);
        else {
          orb(crown, '#d97854', [x, y + 0.1, 0.83], [0.18, 0.2, 0.18]);
          cylinder(crown, '#755335', [x, y + 0.33, 0.83], 0.018, 0.12, 0.018, 'wood');
          leaf(crown, `fruit-leaf:${i}`, [x, y + 0.31, 0.85], 0.18).rotation.z = 0.5;
        }
      }
    }
  }
  return result;
}

function fish(parent: THREE.Object3D, stage: number, color = '#dd8848') {
  const result = group(parent, 'fish');
  result.userData.surface = 'satin';
  orb(result, color, [0, 0, 0], [0.72, 0.48, 0.32]);
  orb(result, '#ffdf99', [0.2, -0.11, 0.13], [0.43, 0.27, 0.23]);
  const tail = group(result, 'tail', [-0.65, 0, 0]);
  const fan = new THREE.Shape();
  fan.moveTo(0, 0); fan.quadraticCurveTo(-0.24, 0.15, -0.6, 0.43);
  fan.bezierCurveTo(-0.72, 0.26, -0.53, 0.1, -0.64, 0);
  fan.bezierCurveTo(-0.53, -0.1, -0.72, -0.26, -0.6, -0.43);
  fan.quadraticCurveTo(-0.24, -0.15, 0, 0);
  mesh(tail, new THREE.ExtrudeGeometry(fan, { depth: 0.05, bevelSize: 0.035, bevelThickness: 0.025, bevelSegments: 2, steps: 1, curveSegments: 10 }), '#cf694f', [0, 0, -0.025]);
  for (const y of [-0.3, -0.15, 0, 0.15, 0.3]) stroke(tail, '#f5b174', [[-0.04, 0, 0.06], [-0.28, y * 0.45, 0.06], [-0.56, y, 0.06]], 0.013);
  const fin = group(result, 'pectoral-fin', [0, -0.13, 0.28]);
  orb(fin, '#cb7250', [0, -0.1, 0], [0.2, 0.25 + stage * 0.035, 0.045]);
  for (const x of [-0.09, 0, 0.09]) stroke(fin, '#f0ae73', [[0, 0.05, 0.04], [x, -0.23, 0.04]], 0.01);
  fin.rotation.z = -0.6;
  const mouth = group(result, 'mouth', [0.68, -0.05, 0]);
  orb(mouth, '#884838', [0, 0, 0], [0.05, 0.075, 0.13]);
  for (const side of [-1, 1]) {
    stroke(result, '#b56543', [[0.22, 0.22, side * 0.305], [0.13, 0.06, side * 0.33], [0.23, -0.1, side * 0.305]], 0.02);
    for (let i = 0; i < 6; i++) {
      const x = -0.44 + i % 3 * 0.18, y = 0.05 + Math.floor(i / 3) * 0.19;
      stroke(result, '#efbc7b', [[x, y + 0.07, side * 0.285], [x - 0.035, y, side * 0.31], [x, y - 0.06, side * 0.285]], 0.011);
    }
  }
  orb(result, '#ef9a64', [-0.1, 0.43, 0], [0.28, 0.18 + stage * 0.035, 0.075]);
  for (const side of [-1, 1]) {
    orb(result, CREAM, [0.4, 0.13, side * 0.25], [0.18, 0.2, 0.1]);
    orb(result, INK, [0.46, 0.13, side * 0.32], [0.095, 0.12, 0.045]);
    orb(result, '#ffffff', [0.48, 0.17, side * 0.35], [0.032, 0.04, 0.022]);
  }
  if (stage >= 2) {
    for (const x of [-0.3, -0.05]) orb(result, '#fff0c5', [x, 0.04, 0], [0.07, 0.4, 0.325]);
  }
  result.scale.setScalar([0.82, 1.02, 1.27, 1.48][stage]!);
  return { result, tail, fin, mouth };
}

function puppy(parent: THREE.Object3D, stage: number) {
  const result = group(parent, 'puppy', [0, 0, 0.2]);
  const bodyColor = '#b98051';
  const legHeight = stage === 0 ? 0.3 : 0.48;
  orb(result, bodyColor, [0, 0.85, -0.2], [0.62, 0.72, 0.88]);
  orb(result, '#f4d8af', [0, 0.9, 0.44], [0.42, 0.55, 0.21]);
  for (const x of [-0.43, 0.43]) for (const z of [-0.65, 0.47]) {
    orb(result, bodyColor, [x, legHeight, z], [0.25, legHeight, 0.3]);
    orb(result, '#f5ddb9', [x, 0.17, z + 0.09], [0.26, 0.17, 0.32]);
    for (const toe of [-0.09, 0.09]) stroke(result, '#c69c74', [[x + toe, 0.22, z + 0.37], [x + toe, 0.12, z + 0.4]], 0.011);
  }
  const head = group(result, 'head', [0, 1.6, 0.5]);
  orb(head, bodyColor, [0, 0, 0], [0.74, 0.67, 0.67]);
  for (const side of [-1, 1]) {
    const ear = orb(head, '#946344', [side * 0.66, -0.17, 0.02], [0.25, 0.61, 0.32]);
    ear.rotation.z = side * 0.17;
    orb(head, '#eeb399', [side * 0.72, -0.24, 0.24], [0.12, 0.34, 0.06]);
    orb(head, INK, [side * 0.28, 0.13, 0.6], [0.11, 0.15, 0.075], 'satin');
    stroke(head, '#704932', [[side * 0.15, 0.32, 0.58], [side * 0.27, 0.36, 0.57], [side * 0.38, 0.31, 0.54]], 0.035);
    for (let i = 0; i < 3; i++) orb(head, '#90623f', [side * (0.22 + i % 2 * 0.065), -0.23 + Math.floor(i / 2) * 0.065, 0.785], [0.018, 0.018, 0.012]);
    stroke(head, '#bd885c', [[side * 0.69, -0.05, 0.3], [side * 0.74, -0.32, 0.29], [side * 0.63, -0.55, 0.19]], 0.015);
    orb(head, '#ffffff', [side * 0.26, 0.18, 0.66], [0.035, 0.045, 0.02]);
    orb(head, '#f7e0be', [side * 0.15, -0.22, 0.62], [0.26, 0.19, 0.18]);
    orb(head, '#de9c7c', [side * 0.48, -0.14, 0.5], [0.12, 0.07, 0.05]);
  }
  orb(head, '#49392f', [0, -0.13, 0.8], [0.145, 0.105, 0.105], 'satin');
  orb(head, '#a4846a', [-0.035, -0.095, 0.89], [0.04, 0.018, 0.012], 'satin');
  stroke(head, '#795039', [[-0.16, -0.3, 0.77], [0, -0.33, 0.8], [0.16, -0.3, 0.77]], 0.014);
  for (const x of [-0.14, 0, 0.14]) orb(head, '#d9ac78', [x, 0.57 + (x === 0 ? 0.07 : 0), 0.1], [0.13, 0.16, 0.23]).rotation.z = x * -2;
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

function bowl(parent: THREE.Object3D, position: Point, water: boolean) {
  const result = group(parent, 'bowl', position);
  cylinder(result, '#6395a3', [0, 0.14, 0], 0.4, 0.26, 0.47, 'satin');
  cylinder(result, water ? '#79bccb' : '#3f6970', [0, 0.26, 0], 0.37, 0.025, 0.37, water ? 'water' : 'satin');
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
      orb(result, '#63a8b8', [0, 0.12, 0], [0.59, 0.035, 0.44], 'water');
      stroke(result, '#c4e8df', [[-0.36, 0.15, 0.1], [-0.08, 0.16, 0.24], [0.25, 0.15, 0.17]], 0.012, 'water');
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
        const gable = new THREE.Shape();
        gable.moveTo(-0.66, 0); gable.lineTo(0, 0.56); gable.lineTo(0.66, 0); gable.closePath();
        const roof = mesh(result, new THREE.ExtrudeGeometry(gable, { depth: 1.1, bevelEnabled: false, steps: 1 }), '#9a624e', [0, 1.02, -0.55], [1, 1, 1], 'wood');
        roof.name = 'gable-roof';
        stroke(result, '#e5bc86', [[-0.64, 1.03, 0.57], [0, 1.58, 0.57], [0.64, 1.03, 0.57]], 0.045, 'wood');
        for (const y of [0.25, 0.5, 0.75]) box(result, '#c69968', [0, y, 0.456], [1.04, 0.015, 0.012], 'wood');
        for (const z of [-0.32, -0.05, 0.22]) stroke(result, '#ae7759', [[-0.64, 1.04, z], [0, 1.59, z], [0.64, 1.04, z]], 0.012, 'wood');
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
    case 'water-bowl': bowl(result, [0, 0, 0], true); break;
  }
  return result;
}

export const CARE_DURATION = 3.6;
export type CarePhase = 'idle' | 'approach' | 'respond' | 'settle';
type CarePose = { action: CareAction; time: number; reach: number; touch: number; acknowledge: number };
const ramp = (time: number, from: number, to: number) => THREE.MathUtils.smoothstep(time, from, to);

export function buildWorldModel(subject: Subject, world: WorldState, { batch = false } = {}) {
  const root = new THREE.Group();
  root.name = `world:${subject}`;
  const stage = growthStage(world);
  root.userData.stage = stage;
  const animated: ((time: number, care: CarePose | null) => void)[] = [];
  // Pools are built once. Hidden care props retain their own batch coordinate frame.
  const moving = new Set<THREE.Object3D>();
  const careProps = new Map<CareAction, THREE.Group>();
  const prop = (action: CareAction) => {
    const result = group(root, `care:${action}`);
    result.visible = false;
    moving.add(result); careProps.set(action, result);
    return result;
  };
  const aquarium = subject === 'english';
  if (aquarium) {
    box(root, '#75a8ab', [0, -0.35, 0], [8.9, 0.65, 6.4]);
    box(root, '#f3d9a4', [0, -0.01, 0], [8.55, 0.14, 6.1]);
    for (const x of [-4.3, 4.3]) for (const z of [-3.05, 3.05]) {
      box(root, '#b7e4de', [x, 2.1, z], [0.07, 4.25, 0.07]);
    }
    for (const y of [0, 4.2]) {
      for (const x of [-4.3, 4.3]) box(root, '#b7e4de', [x, y, 0], [0.09, 0.09, 6.15]);
      // A cutaway viewing face: no upper front rail can intersect the fish silhouette.
      for (const z of y === 0 ? [-3.05, 3.05] : [-3.05]) box(root, '#8cb8b5', [0, y, z], [8.65, 0.06, 0.06]);
    }
    // Subtle back and side glass; leave the front visually open so fish stay legible.
    const glass = new THREE.MeshStandardMaterial({ color: '#6faeaf', transparent: true, opacity: 0.18, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide });
    glass.name = 'glass';
    for (const x of [-4.3, 4.3]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 4.2), glass);
      pane.position.set(x, 2.1, 0); pane.rotation.y = Math.PI / 2; root.add(pane);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4.2), glass);
    back.position.set(0, 2.1, -3.05); root.add(back);
    for (let i = 0; i < 3 + stage; i++) plant(root, [-3.4 + i * 1.15, 0.08, -2.4], 1.0 + i % 3 * 0.36, '#67a897');
    const swimmer = fish(root, stage);
    moving.add(swimmer.result); moving.add(swimmer.tail); moving.add(swimmer.fin); moving.add(swimmer.mouth);
    swimmer.result.position.set(0, 2.0, 0.55);
    const food = prop('feed');
    const morsels = group(food, 'care-morsels'); moving.add(morsels);
    for (let i = 0; i < 5; i++) orb(morsels, '#9b643c', [(i % 2 - 0.5) * 0.11, i * 0.085, 0], [0.055, 0.055, 0.055], 'wood');
    const bubbles = prop('play');
    bubbles.userData.surface = 'water';
    for (let i = 0; i < 5; i++) {
      ring(bubbles, '#c6f3ed', [Math.sin(i * 1.6) * 0.3, i * 0.3, 0], 0.12 + i % 2 * 0.07, 0.014);
      orb(bubbles, '#e5fff4', [Math.sin(i * 1.6) * 0.3 - 0.055, i * 0.3 + 0.07, 0.02], [0.026, 0.04, 0.02]);
    }
    animated.push((time, care) => {
      const reach = care?.reach ?? 0, touch = care?.touch ?? 0, ack = care?.acknowledge ?? 0;
      const feeding = care?.action === 'feed';
      const targetX = feeding ? 1.15 - 0.68 * swimmer.result.scale.x : 0.9;
      swimmer.result.position.set(
        THREE.MathUtils.lerp(Math.sin(time * 0.35) * 0.75, targetX, reach),
        THREE.MathUtils.lerp(2.0 + Math.sin(time * 0.7) * 0.09, feeding ? 2.55 : 2.2 + Math.sin((care?.time ?? 0) * 2) * 0.24, reach),
        THREE.MathUtils.lerp(0.55, 0.75, reach),
      );
      swimmer.result.rotation.y = Math.sin(time * 0.35) * -0.25 * (1 - reach) - ack * 0.48;
      swimmer.result.rotation.z = feeding ? touch * 0.07 : touch * 0.16;
      swimmer.tail.rotation.y = Math.sin(time * (reach ? 7 : 2.6)) * (0.2 + reach * 0.18);
      swimmer.fin.rotation.z = -0.6 + Math.sin(time * 3) * 0.08 + ack * 0.4;
      swimmer.mouth.scale.y = 1 + touch * (1.4 + Math.sin((care?.time ?? 0) * 15) * 0.7);
      food.position.set(1.15, 2.55 - 0.05 * swimmer.result.scale.x, 0.75);
      morsels.position.y = (1 - ramp(care?.time ?? 0, 0, 1)) * 0.6;
      morsels.scale.setScalar(1 - ramp(care?.time ?? 0, 1.25, 1.95));
      bubbles.position.set(1.25, 1.0 + (care?.time ?? 0) * 0.37, 0.75);
      bubbles.scale.setScalar(1 - ramp(care?.time ?? 0, 2.6, CARE_DURATION));
    });
    if (stage >= 2) {
      const friend = fish(root, 0, '#9cb8d0');
      moving.add(friend.result); moving.add(friend.tail); moving.add(friend.fin); moving.add(friend.mouth);
      friend.result.position.set(-2.2, 1.15, -0.8);
      animated.push((time) => { friend.result.position.x = -2.0 + Math.sin(time * 0.45) * 0.5; friend.tail.rotation.y = Math.sin(time * 3) * 0.2; });
    }
    if (stage === 3) decoration(root, 'coral-garden').position.set(2.9, 0.1, -2);
    // A waterline only on the back; highlights never span the viewing face.
    stroke(root, '#b7ddd2', [[-4.15, 3.85, -3], [0, 3.87, -3], [4.15, 3.85, -3]], 0.018, 'water');
  } else {
    cylinder(root, '#aa8b62', [0, -0.4, 0], 4.75, 0.7, 4.85, 'wood');
    cylinder(root, '#adc18d', [0, -0.025, 0], 4.85, 0.12);
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
      const crown = growing.getObjectByName('canopy');
      const leaves = ['leaf:left', 'leaf:right'].map((name) => growing.getObjectByName(name)).filter((entry): entry is THREE.Object3D => !!entry);
      if (crown) moving.add(crown);
      for (const entry of leaves) moving.add(entry);
      const water = prop('water');
      const can = group(water, 'care-tool', [-1.25, 1.45, 0.55]); moving.add(can);
      can.userData.surface = 'satin';
      cylinder(can, '#699eae', [0, 0, 0], 0.25, 0.43);
      cylinder(can, '#699eae', [0.34, 0.1, 0], 0.055, 0.65).rotation.z = -0.85;
      ring(can, '#699eae', [-0.25, 0.08, 0], 0.2, 0.04);
      const drops = group(water, 'care-drops'); moving.add(drops);
      for (let i = 0; i < 7; i++) orb(drops, '#69afc7', [-0.85 + i % 3 * 0.17, 0.2 + i * 0.12, 0.55], [0.04, 0.085, 0.04], 'water');
      const sun = prop('sunlight');
      orb(sun, '#edbf56', [0, 0, 0], [0.32, 0.32, 0.14]);
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        stroke(sun, '#e5b34d', [[Math.cos(angle) * 0.43, Math.sin(angle) * 0.43, 0], [Math.cos(angle) * 0.58, Math.sin(angle) * 0.58, 0]], 0.035);
      }
      sun.position.set(1.65, stage === 0 ? 2.2 : 3.35, 0);
      animated.push((time, care) => {
        const lift = care?.reach ?? 0;
        growing.rotation.z = Math.sin(time * 0.6) * 0.012 + lift * 0.035;
        leaves.forEach((entry, i) => { entry.rotation.z = (i === 0 ? Math.PI - 0.22 : 0.22) + (i === 0 ? -1 : 1) * lift * 0.38; });
        if (crown) { crown.rotation.z = lift * 0.045; crown.position.y = (stage === 1 ? 1.6 : 2.15) + lift * 0.1; }
        can.rotation.z = -0.3 - (care?.touch ?? 0) * 0.4;
        can.position.x = -1.25 - ramp(care?.time ?? 0, 2.4, CARE_DURATION) * 0.3;
        drops.position.y = -((care?.time ?? 0) % 0.6) * 0.6;
        drops.scale.y = 1 - ramp(care?.time ?? 0, 1.8, 2.4);
        water.scale.setScalar(1 - ramp(care?.time ?? 0, 2.6, CARE_DURATION));
        sun.scale.setScalar(1 - ramp(care?.time ?? 0, 2.6, CARE_DURATION));
      });
      for (let i = 0; i <= stage; i++) plant(root, [-2.6 + i * 0.55, 0.1, -0.8], 0.45 + stage * 0.2);
      const pond = decoration(root, 'tiny-pond'); pond.position.set(2.9, 0.03, 0.15); pond.scale.setScalar(1.25);
    } else {
      const dog = puppy(root, stage);
      moving.add(dog.result); moving.add(dog.head); moving.add(dog.tail);
      const food = prop('feed');
      const scale = dog.result.scale.x;
      bowl(root, [0.9, 0.09, 1.6], false);
      for (let i = 0; i < 9; i++) orb(food, '#a87340', [Math.cos(i * 2.4) * 0.25, i % 2 * 0.04, Math.sin(i * 2.4) * 0.25], [0.07, 0.055, 0.07], 'wood');
      food.position.set(0.9, 0.41, 1.6);
      const brush = prop('brush');
      box(brush, '#ac7953', [0, 0, 0], [0.38, 0.14, 0.52], 'wood');
      cylinder(brush, '#ac7953', [0, 0.03, -0.43], 0.065, 0.44, 0.065, 'wood').rotation.x = Math.PI / 2;
      for (let i = 0; i < 12; i++) cylinder(brush, '#f0ddbd', [-0.12 + i % 3 * 0.12, -0.13, -0.17 + Math.floor(i / 3) * 0.11], 0.013, 0.16);
      const ball = prop('play'); decoration(ball, 'puppy-ball');
      animated.push((time, care) => {
        const reach = care?.reach ?? 0, touch = care?.touch ?? 0, ack = care?.acknowledge ?? 0;
        const feeding = care?.action === 'feed', playing = care?.action === 'play', brushing = care?.action === 'brush';
        dog.result.position.set(feeding ? 0.9 * reach : playing ? -0.95 * reach : 0,
          playing ? Math.sin((care?.time ?? 0) * Math.PI * 4) ** 2 * 0.06 * reach : 0,
          0.2 + (feeding ? (1.6 - 1.02 * scale - 0.2) * reach : playing ? 1.0 * reach : 0));
        dog.result.rotation.y = playing ? -0.38 * reach * (1 - ack) : 0;
        dog.tail.rotation.z = Math.sin(time * (care ? 9 : 2.6)) * (care ? 0.55 : 0.22);
        dog.head.position.y = THREE.MathUtils.lerp(1.6, 0.36 / scale + 0.62, feeding ? touch : 0);
        dog.head.rotation.x = feeding ? touch * (0.65 + Math.sin((care?.time ?? 0) * 14) * 0.045) : playing ? touch * 0.24 : -ack * 0.08;
        dog.head.rotation.z = Math.sin(time * 0.6) * 0.025 + (brushing ? -0.18 * touch : 0.08 * ack);
        food.scale.setScalar(1 - ramp(care?.time ?? 0, 1.25, 2.15));
        brush.position.set(0.93 * scale, 1.7 * scale, 0.2 + 0.85 * scale + Math.sin((care?.time ?? 0) * 8) * 0.13);
        brush.rotation.z = -0.8;
        brush.scale.setScalar(scale * (1 - ramp(care?.time ?? 0, 2.4, CARE_DURATION)));
        const flight = ramp(care?.time ?? 0, 0, 1.1);
        ball.position.set(1.2 - flight * 2.3, 0.08 + Math.sin(flight * Math.PI) * 0.75, 2.25 + flight * 0.55);
        ball.rotation.y = -flight * 4;
        ball.scale.setScalar(1 - ramp(care?.time ?? 0, 2.8, CARE_DURATION));
      });
      if (stage >= 1) decoration(root, 'puppy-ball').position.set(-1.7, 0.1, 1.25);
      if (stage === 3) decoration(root, 'flower-hoop').position.set(-2.1, 0.1, -1.8);
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
  let response: { action: CareAction; started: number } | null = null;
  const animate = (time: number): CarePhase => {
    const age = response ? Math.max(0, time - response.started) : 0;
    if (response && age >= CARE_DURATION - 1e-9) response = null;
    const pose: CarePose | null = response ? {
      action: response.action, time: age,
      reach: ramp(age, 0, 0.9) * (1 - ramp(age, 2.6, CARE_DURATION)),
      touch: ramp(age, 0.8, 1.2) * (1 - ramp(age, 2.05, 2.6)),
      acknowledge: ramp(age, 2.05, 2.55) * (1 - ramp(age, 2.9, CARE_DURATION)),
    } : null;
    for (const [action, object] of careProps) object.visible = pose?.action === action;
    for (const update of animated) update(time, pose);
    return !pose ? 'idle' : age < 1.2 ? 'approach' : age < 2.6 ? 'respond' : 'settle';
  };
  animate(0);
  return {
    root, animate,
    startCare(action: CareAction, time: number, staticFeedback = false) {
      response = staticFeedback ? null : { action, started: time };
      animate(time);
      // Static acknowledgment is a completed pose, not an active effect or timer.
      if (staticFeedback) {
        const actor = root.getObjectByName(subject === 'korean' ? 'growing-tree' : subject === 'english' ? 'fish' : 'head')!;
        actor.rotation.z += subject === 'english' ? 0.08 : -0.06;
      }
    },
  };
}

// Bake linear colors/transforms per moving frame AND material role. Color variation
// is free; wood, fur, water and fish retain distinct light response after batching.
function batchStaticMeshes(root: THREE.Group, moving: Set<THREE.Object3D>) {
  const batches = new Map<THREE.Object3D, Map<string, THREE.BufferGeometry[]>>();
  const surfaces = new Map<string, THREE.MeshStandardMaterial>();
  const removed: THREE.Mesh[] = [];
  const collect = (object: THREE.Object3D, owner: THREE.Object3D, parentMatrix: THREE.Matrix4) => {
    object.updateMatrix();
    const boundary = moving.has(object);
    const matrix = boundary ? new THREE.Matrix4() : parentMatrix.clone().multiply(object.matrix);
    if (boundary) owner = object;
    if (object instanceof THREE.Mesh && !boundary
      && object.material instanceof THREE.MeshStandardMaterial && !object.material.transparent) {
      const geometry = object.geometry.clone().applyMatrix4(matrix);
      if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i));
      const colors = new Float32Array(geometry.getAttribute('position').count * 3);
      const { r, g, b } = object.material.color;
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = r; colors[i + 1] = g; colors[i + 2] = b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const role = object.material.name;
      if (!surfaces.has(role)) {
        const surface = object.material.clone();
        surface.color.set('#ffffff'); surface.vertexColors = true;
        surfaces.set(role, surface);
      }
      const byRole = batches.get(owner) ?? new Map<string, THREE.BufferGeometry[]>();
      const entries = byRole.get(role) ?? [];
      entries.push(geometry); byRole.set(role, entries);
      batches.set(owner, byRole);
      removed.push(object);
    }
    for (const child of object.children) collect(child, owner, matrix);
  };
  for (const child of root.children) collect(child, root, new THREE.Matrix4());
  for (const [owner, byRole] of batches) for (const [role, geometries] of byRole) {
    const surface = surfaces.get(role)!;
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
