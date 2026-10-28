/**
 * Builds the head: meshed skin, hair, beard and lips (head-shapes.js, hair-shapes.js) plus the
 * parametric features: almond eyes (sclera, dark brown iris, pupil, a small glint) set in soft
 * sockets, a hooded upper lid with a lash line (it blinks), a static lower lid, thick straight
 * brows and the closed mouth line. Everything is in head-joint space.
 */
import * as THREE from 'three';
import { meshSdf } from './mesher.js';
import { fromMeshData, paint, roundedEnds, sweep } from './geometry.js';
import { ellipsoid, mix, smin, smoothstep } from './sdf.js';
import { HEAD, SKIN_BOUNDS, depthAt, skin, skinColor, skinDepthAt } from './head-shapes.js';
import {
  BEARD_BOUNDS, HAIR_BOUNDS, beard, beardColor, hair, hairColor, headContext,
} from './hair-shapes.js';
import { PALETTE } from './palette.js';

const CELL = Object.freeze({ skin: 0.033, hair: 0.033, beard: 0.032, lips: 0.012 });
const HIDDEN = 0.012; // a vertex this deep inside another part can never be seen
const AO = Object.freeze({ step: 0.05, steps: 4, strength: 0.42 });
const IRIS = Object.freeze({ angle: 0.62, pupil: 0.25 });
/** Upper lid angles (radians about x): rest is calm and a little hooded, wide = brows raised. */
export const LID = Object.freeze({ open: -0.42, closed: 0.55, wide: -0.62, gap: 0.012, lower: 0.36, lowerGap: 0.007 });
const SIDES = Object.freeze([['L', 1], ['R', -1]]);
const LID_RGB = Object.freeze(PALETTE.skin.map((v) => v * 0.8)); // the lids sit in the socket's soft shade
const LIPS = Object.freeze({
  upper: Object.freeze({ y: 0.426, z: 0.965, rx: 0.19, ry: 0.038, rz: 0.075 }),
  lower: Object.freeze({ y: 0.36, z: 0.958, rx: 0.17, ry: 0.054, rz: 0.08 }),
  curve: 1.15, // the lips follow the round of the mouth area
  bounds: Object.freeze([[-0.27, 0.27, 0.76], [0.27, 0.5, 1.1]]),
});

async function meshPart(sdf, bounds, cell, extra, budget) {
  const data = await meshSdf(sdf, { min: bounds[0], max: bounds[1], cell, budget, ...extra });
  return fromMeshData(data);
}

function named(name, geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

function capGeometry(radius, thetaStart, thetaLength, heightSegments = 10) {
  const g = new THREE.SphereGeometry(radius, 32, heightSegments, 0, Math.PI * 2, thetaStart, thetaLength);
  g.rotateX(Math.PI / 2); // the cap around +y now faces +z (forward)
  return g;
}

/** Lips: a thin upper lip and a fuller lower lip, curved around the mouth area. */
function lips(x, y, z) {
  const lz = z + LIPS.curve * x * x;
  const u = LIPS.upper;
  const l = LIPS.lower;
  const bow = 0.008 * Math.exp(-(((Math.abs(x) - 0.05) / 0.04) ** 2));
  const upper = ellipsoid(x, y - bow, lz, 0, u.y, u.z, u.rx, u.ry, u.rz);
  const lower = ellipsoid(x, y, lz, 0, l.y, l.z, l.rx, l.ry, l.rz);
  return smin(upper, lower, 0.012);
}

function lipColor(x, y, z, nx, ny, nz, out) {
  const upper = smoothstep(0.385, 0.405, y);
  const corner = smoothstep(0.12, 0.2, Math.abs(x));
  for (let i = 0; i < 3; i += 1) out[i] = mix(PALETTE.lip[i] * (1 - 0.18 * upper), PALETTE.skin[i], corner * 0.5);
}

function eyeGeometries() {
  const r = HEAD.eye.r;
  return {
    sclera: new THREE.SphereGeometry(r, 32, 20),
    iris: capGeometry(r * 1.004, 0, IRIS.angle, 8),
    pupil: capGeometry(r * 1.008, 0, IRIS.pupil, 6),
    glint: new THREE.SphereGeometry(r * 0.05, 10, 6),
    upperLid: paint(new THREE.SphereGeometry(r + LID.gap, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), LID_RGB),
    lowerLid: paint(new THREE.SphereGeometry(r + LID.lowerGap, 40, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), LID_RGB),
    lash: paint(new THREE.TorusGeometry(r + LID.gap + 0.002, 0.017, 8, 48, Math.PI).rotateX(Math.PI / 2), PALETTE.brow),
  };
}

function buildEye(materials, geometries) {
  const eye = new THREE.Object3D();
  const r = HEAD.eye.r;
  [
    [geometries.sclera, materials.sclera],
    [geometries.iris, materials.iris],
    [geometries.pupil, materials.pupil],
    [geometries.glint, materials.glint],
  ].forEach(([geometry, material]) => eye.add(new THREE.Mesh(geometry, material)));
  eye.children[3].position.set(-0.24 * r, 0.22 * r, 0.93 * r); // stays inside the lid when it closes
  return eye;
}

function buildLid(materials, geometries) {
  const lid = new THREE.Object3D();
  lid.add(new THREE.Mesh(geometries.upperLid, materials.skin), new THREE.Mesh(geometries.lash, materials.dark));
  lid.rotation.x = LID.open;
  return lid;
}

/** A line of points laid on a surface (projected from the front) plus an offset. */
function onSurface(sdf, points, lift) {
  return points.map(([x, y]) => [x, y, depthAt(sdf, x, y) + lift]);
}

/** Thick, mostly straight brows: low inner end, a slight arch at two thirds, a tapering tail. */
function browGeometry(side) {
  const pts = [[0.07, 1.285], [0.19, 1.31], [0.32, 1.335], [0.45, 1.348], [0.57, 1.334], [0.66, 1.3]];
  const line = pts.map(([x, y]) => [x * side, y, skinDepthAt(x * side, y) + 0.012]);
  const thick = (t) => mix(0.088, 0.032, Math.pow(t, 1.2));
  const g = sweep(line, {
    width: (t) => roundedEnds(1, 0.1)(t) * thick(t),
    height: roundedEnds(0.04, 0.12),
    roundness: 2.0,
    steps: 40,
  });
  return paint(g, PALETTE.brow);
}

/** The closed mouth line between the lips: a calm, slightly lopsided hint of a smile. */
function mouthGeometry() {
  const half = HEAD.mouth.halfWidth;
  const y = HEAD.mouth.y - 0.007;
  const line = [[-half, y + 0.026], [-half * 0.55, y + 0.004], [0, y - 0.003], [half * 0.55, y + 0.005], [half, y + 0.032]];
  return sweep(onSurface((x, y, z) => Math.min(lips(x, y, z), skin(x, y, z)), line, -0.004), { width: roundedEnds(0.016, 0.25), height: roundedEnds(0.02, 0.25), steps: 28, radial: 10 });
}

/** Eyes, lids and brows for both sides, as named joints. */
function buildFeatures(materials, owned) {
  const geometries = eyeGeometries();
  owned.push(...Object.values(geometries));
  const eyes = new THREE.Object3D();
  eyes.name = 'eyes';
  const lids = new THREE.Object3D();
  lids.name = 'lids';
  const brows = new THREE.Object3D();
  brows.name = 'brows';
  const joints = { eyes, lids, brows };
  SIDES.forEach(([suffix, s]) => {
    const at = new THREE.Vector3(HEAD.eye.x * s, HEAD.eye.y, HEAD.eye.z);
    const eye = buildEye(materials, geometries);
    eye.name = `eye${suffix}`;
    eye.position.copy(at);
    eyes.add(eye);
    const lid = buildLid(materials, geometries);
    lid.name = `lid${suffix}`;
    lid.position.copy(at);
    lids.add(lid);
    const lower = new THREE.Mesh(geometries.lowerLid, materials.skin);
    lower.name = `lowerLid${suffix}`;
    lower.position.copy(at);
    lower.rotation.x = LID.lower;
    lids.add(lower);
    const browGeo = browGeometry(s);
    owned.push(browGeo);
    browGeo.computeBoundingBox();
    const center = browGeo.boundingBox.getCenter(new THREE.Vector3());
    browGeo.translate(-center.x, -center.y, -center.z);
    const brow = new THREE.Mesh(browGeo, materials.brow);
    brow.name = `brow${suffix}`;
    brow.position.copy(center);
    brow.userData.rest = center.clone();
    brows.add(brow);
    joints[`eye${suffix}`] = eye;
    joints[`lid${suffix}`] = lid;
    joints[`brow${suffix}`] = brow;
  });
  return { joints };
}

/**
 * @param {{ materials: object, budget: object, beard?: boolean, hair?: string, onStep?: () => void }} opts
 * @returns {Promise<{ meshes: THREE.Object3D[], joints: Record<string, THREE.Object3D>, geometries: THREE.BufferGeometry[], triangles: number }>}
 */
export async function buildFace({ materials, budget, beard: withBeard = true, hair: hairStyle = 'fade', onStep = () => {} }) {
  const owned = [];
  const withHair = hairStyle !== 'none';
  const ao = { ...AO, sdf: headContext(withBeard, withHair) };
  const covered = (x, y, z) => (withHair && hair(x, y, z) < -HIDDEN) || (withBeard && beard(x, y, z) < -HIDDEN) || lips(x, y, z) < -HIDDEN;
  const insideSkin = (x, y, z) => skin(x, y, z) < -HIDDEN;
  const skinGeo = await meshPart(skin, SKIN_BOUNDS, CELL.skin, { ao, color: skinColor, cull: covered }, budget);
  onStep();
  owned.push(skinGeo);
  const meshes = [named('skin', skinGeo, materials.skin)];
  if (withHair) {
    const hairGeo = await meshPart(hair, HAIR_BOUNDS, CELL.hair, { color: hairColor, ao: { ...ao, strength: 0.32 }, cull: insideSkin }, budget);
    owned.push(hairGeo);
    meshes.push(named('hair', hairGeo, materials.hair));
  }
  onStep();
  if (withBeard) {
    const beardGeo = await meshPart(beard, BEARD_BOUNDS, CELL.beard, { color: beardColor, ao: { ...ao, strength: 0.28 }, cull: insideSkin }, budget);
    owned.push(beardGeo);
    meshes.push(named('beard', beardGeo, materials.beard));
  }
  const lipGeo = await meshPart(lips, LIPS.bounds, CELL.lips, {
    color: lipColor, cull: (x, y, z) => insideSkin(x, y, z) || (withBeard && beard(x, y, z) < -HIDDEN),
  }, budget);
  onStep();
  const mouth = mouthGeometry();
  owned.push(lipGeo, mouth);
  meshes.push(named('lips', lipGeo, materials.skin), named('mouth', mouth, materials.mouth));
  const { joints } = buildFeatures(materials, owned);
  const triangles = owned.reduce((sum, g) => sum + (g.index ? g.index.count / 3 : g.getAttribute('position').count / 3), 0);
  return { meshes, joints, geometries: owned, triangles };
}
