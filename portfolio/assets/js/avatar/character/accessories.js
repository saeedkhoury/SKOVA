/**
 * Small accessories built from three.js primitives, in model space (rig.attach moves them into
 * their joint): the steel watch with a dark dial on his left wrist and a thin gold bracelet on his
 * right wrist (11.jpg).
 */
import * as THREE from 'three';
import { forearmFrame } from './body-shapes.js';

const WATCH = Object.freeze({ at: 0.86, ring: 0.27, band: 0.05, bandWidth: 0.16, dial: 0.15, dialDepth: 0.07 });
const BRACELET = Object.freeze({ at: 0.95, ring: 0.255, wire: 0.017 });

/** A ring of rectangular section around the forearm axis at u (0 elbow .. 1 wrist). */
function placeOnArm(geometry, s, u, lift = 0) {
  const { E, axis, length } = forearmFrame(s);
  const center = new THREE.Vector3(E[0] + axis[0] * length * u, E[1] + axis[1] * length * u, E[2] + axis[2] * length * u);
  const along = new THREE.Vector3(...axis);
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(along, -along.y).normalize();
  const side = new THREE.Vector3().crossVectors(along, up);
  const basis = new THREE.Matrix4().makeBasis(side, up, along);
  geometry.applyMatrix4(basis);
  geometry.translate(center.x + up.x * lift, center.y + up.y * lift, center.z + up.z * lift);
  return geometry;
}

function watchBand() {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, WATCH.ring + WATCH.band, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, WATCH.ring, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: WATCH.bandWidth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 28 });
  g.translate(0, 0, -WATCH.bandWidth / 2);
  return g;
}

/**
 * @param {Record<string, THREE.Material>} materials
 * @returns {{ items: Array<[string, THREE.Mesh, THREE.BufferGeometry]>, geometries: THREE.BufferGeometry[] }}
 *   items: [joint name, mesh, geometry in model space]
 */
export function buildAccessories(materials) {
  const band = placeOnArm(watchBand(), 1, WATCH.at);
  const caseGeo = placeOnArm(new THREE.CylinderGeometry(WATCH.dial + 0.03, WATCH.dial + 0.035, WATCH.dialDepth, 36), 1, WATCH.at, WATCH.ring + WATCH.band + WATCH.dialDepth / 2 - 0.01);
  const dialGeo = placeOnArm(new THREE.CylinderGeometry(WATCH.dial, WATCH.dial, 0.012, 36), 1, WATCH.at, WATCH.ring + WATCH.band + WATCH.dialDepth - 0.006);
  const bracelet = placeOnArm(new THREE.TorusGeometry(BRACELET.ring, BRACELET.wire, 8, 48), -1, BRACELET.at);
  const items = [
    ['forearmL', new THREE.Mesh(band, materials.steel), band],
    ['forearmL', new THREE.Mesh(caseGeo, materials.steel), caseGeo],
    ['forearmL', new THREE.Mesh(dialGeo, materials.dial), dialGeo],
    ['forearmR', new THREE.Mesh(bracelet, materials.gold), bracelet],
  ];
  items.forEach(([, mesh], i) => { mesh.name = ['watchBand', 'watchCase', 'watchDial', 'bracelet'][i]; });
  return { items, geometries: [band, caseGeo, dialGeo, bracelet] };
}
