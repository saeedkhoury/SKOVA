/**
 * Meshes the body parts (body-shapes.js) and hangs them on the rig: the polo (torso, collar,
 * short sleeves), the skin in the open collar, neck, bare arms (a tattoo sleeve on the right
 * forearm), hands, trousers, sneakers, the office chair, and the watch and bracelet.
 */
import * as THREE from 'three';
import { meshSdf } from './mesher.js';
import { fromMeshData } from './geometry.js';
import {
  boundsFor, bodyContext, chair, chestSkin, collar, forearm, hand, legs, neck, shoes, sleeve, torso, upperArm,
} from './body-shapes.js';
import { buildChairLegs } from './chair.js';
import { forearmColor, neckColor, skinFlat, soleColor } from './body-paint.js';
import { buildAccessories } from './accessories.js';

const AO = Object.freeze({ step: 0.1, steps: 4, strength: 0.45 });
const HIDDEN = 0.05; // parts that move a little keep a margin before triangles are dropped
const SEAM = 0.003; // the open-collar skin keeps only what stands off the neck's own surface
const COLLAR_UNDERSIDE = 0.012; // collar triangles deeper than this inside the polo are never seen

/** Parts: [name, joint, sdf factory, bounds, cell, material key, extra]. */
function partList() {
  const list = [
    ['torso', 'chest', () => torso, boundsFor('torso'), 0.09, 'polo'],
    ['collar', 'chest', () => collar, boundsFor('collar'), 0.022, 'collar'], // fine cells: a thin, clean band
    ['chestSkin', 'chest', () => chestSkin, boundsFor('chestSkin'), 0.05, 'skin', { color: neckColor }],
    ['neck', 'neck', () => neck, boundsFor('neck'), 0.06, 'skin', { color: neckColor }],
    ['legs', 'hips', () => legs, boundsFor('legs'), 0.15, 'trousers'],
    ['shoes', 'hips', () => shoes, boundsFor('shoes'), 0.1, 'sneaker', { color: soleColor }],
    ['chair', 'root', () => chair, boundsFor('chair'), 0.16, 'chair'],
  ];
  [['L', 1], ['R', -1]].forEach(([suffix, s]) => {
    list.push([`sleeve${suffix}`, `upperArm${suffix}`, () => sleeve(s), boundsFor('sleeve', s), 0.065, 'polo']);
    list.push([`upperArm${suffix}`, `upperArm${suffix}`, () => upperArm(s), boundsFor('upperArm', s), 0.06, 'skin', { color: skinFlat }]);
    list.push([`forearm${suffix}`, `forearm${suffix}`, () => forearm(s), boundsFor('forearm', s), 0.056, 'skin', { color: forearmColor(s) }]);
    list.push([`hand${suffix}`, `hand${suffix}`, () => hand(s), boundsFor('hand', s), 0.045, 'skin', { color: skinFlat }]);
  });
  return list;
}

/** Hide the inside of joints: torso under the sleeves, arm tops inside the sleeves, and so on. */
function cullFor(name, sdfs) {
  const below = (f, k) => (x, y, z) => f(x, y, z) + k;
  const others = {
    torso: [sdfs.sleeveL, sdfs.sleeveR, sdfs.neck, below(sdfs.legs, 0.12)],
    collar: [sdfs.neck, below(sdfs.torso, COLLAR_UNDERSIDE - HIDDEN)], // its underside lies on the polo
    chestSkin: [sdfs.torso, below(sdfs.neck, -(SEAM + HIDDEN))],
    neck: [sdfs.torso, sdfs.chestSkin],
    sleeveL: [sdfs.torso],
    sleeveR: [sdfs.torso],
    upperArmL: [sdfs.sleeveL, sdfs.torso],
    upperArmR: [sdfs.sleeveR, sdfs.torso],
    forearmL: [sdfs.upperArmL],
    forearmR: [sdfs.upperArmR],
    handL: [sdfs.forearmL],
    handR: [sdfs.forearmR],
    legs: [sdfs.torso, sdfs.chair],
  }[name];
  if (!others) return undefined;
  return (x, y, z) => others.some((f) => f(x, y, z) < -HIDDEN);
}

/**
 * @param {{ rig: object, materials: object, budget: object, onStep?: () => void }} opts
 * @returns {Promise<{ geometries: THREE.BufferGeometry[], meshes: Record<string, THREE.Mesh> }>}
 */
export async function buildBody({ rig, materials, budget, onStep = () => {} }) {
  const parts = partList();
  const sdfs = Object.fromEntries(parts.map(([name, , factory]) => [name, factory()]));
  const geometries = [];
  const meshes = {};
  for (const [name, jointName, , bounds, cell, materialKey, extra = {}] of parts) {
    const data = await meshSdf(sdfs[name], {
      min: bounds[0],
      max: bounds[1],
      cell,
      budget,
      ao: { ...AO, sdf: bodyContext },
      cull: cullFor(name, sdfs),
      ...extra,
    });
    const geometry = fromMeshData(data);
    const mesh = new THREE.Mesh(geometry, materials[materialKey]);
    mesh.name = name;
    rig.attach(jointName, mesh, geometry);
    geometries.push(geometry);
    meshes[name] = mesh;
    onStep();
  }
  buildChairLegs(materials.chair).forEach((leg) => {
    geometries.push(leg.geometry);
    rig.attach('root', leg);
  });
  const accessories = buildAccessories(materials);
  accessories.items.forEach(([jointName, mesh, geometry]) => rig.attach(jointName, mesh, geometry));
  geometries.push(...accessories.geometries);
  return { geometries, meshes };
}
