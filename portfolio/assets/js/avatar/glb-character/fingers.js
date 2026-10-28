/**
 * Finger curl for the GLB avatar, whose hands have one bone each (no finger bones). In the
 * hand bone's bind-pose frame (metres; +y runs from the wrist to the fingertips) the fingers lie
 * side by side along `across` and the palm faces `toward` (both in the plane of palm * x and z,
 * measured on the mesh: the hand is turned a little on its bone). Every point past the knuckle line
 * bends toward the palm like a bending beam: a finger point at s = y - knuckle (along the finger)
 * and d (its height over the fingers' centre line, toward the palm) goes to
 *   y' = knuckle + sin(a) / k - d sin(a),  w' = centre + (1 - cos(a)) / k + d cos(a),  a = k s,  k = curl / length
 * with its normal turned by a. Each of the four fingers has its own curl (blended smoothly across
 * the hand, so the skin between them never tears); the thumb never curls. The same maths runs in
 * the vertex shader (before skinning) and on the CPU (touch.js), so the typing code knows exactly
 * where each fingertip is.
 */
import * as THREE from 'three';
import { bindToNode } from './shader-patch.js';

/**
 * Measured on saeed-avatar.glb (review/avatar-3d/hand-lab.html and hand-lab.py: slices of each
 * hand's vertices).
 * palm: the side of the bone's x the palm is on; across: the fingers' row direction as
 * (palm * x, z) (its normal, toward the palm, is (across[1], -across[0])); centre: the fingers'
 * centre line along that normal; fingers: index to little finger, along `across`. The knuckle line
 * arches like a real hand's: it lies `arc` * (distance from the middle finger)^2 nearer the wrist.
 */
export const HANDS = Object.freeze({
  Left: Object.freeze({ palm: 1, across: [0.2539, 0.9672], knuckle: 0.135, arc: 6, length: 0.09, centre: -0.003, fingers: [0.019, -0.005, -0.027, -0.05] }),
  Right: Object.freeze({ palm: -1, across: [0.3668, 0.9303], knuckle: 0.128, arc: 6, length: 0.085, centre: 0.0006, fingers: [0.03, 0.008, -0.015, -0.04] }),
});
/** The thumb rests closer along the hand (a typist's relaxed thumb): its tip moves `tuck` back. */
export const THUMB_TUCK = Object.freeze({ tuck: 0.012, from: 0.08, to: 0.155 });
const FINGER_WIDTH = 0.0075; // the blend between neighbouring fingers' curls (metres, gaussian width)
// the thumb: further toward the palm than any finger (toward > from), and before the y band ends
const THUMB = Object.freeze({ from: 0.022, to: 0.03, endFrom: 0.15, endTo: 0.165 });
export const HAND_THUMB = THUMB;
const SIDES = Object.freeze(['Left', 'Right']);

const VERTEX_PARS = /* glsl */`
uniform mat4 fingerToHand[2];
uniform mat4 fingerFromHand[2];
uniform vec4 fingerShape[2]; // knuckle, length, centre, palm sign
uniform vec3 fingerAcross[2]; // across (palm * x, z), knuckle arc
uniform vec4 fingerCurl[2];
uniform vec4 fingerAt[2];
uniform float fingerBone[2];
uniform float fingerTuck;

float fingerCurlAt(vec4 curls, vec4 at, float along) {
  vec4 d = (vec4(along) - at) / ${FINGER_WIDTH.toFixed(4)};
  vec4 w = exp(-d * d) + 1e-4;
  return dot(curls, w) / dot(w, vec4(1.0));
}

// bends one point (hand frame, metres): the fingers curl, the thumb tucks in. Returns the curl's
// turn angle (radians, for the normal).
float fingerBend(inout vec3 p, vec4 shape, vec3 across, vec4 curls, vec4 at) {
  float px = shape.w * p.x;
  float along = across.x * px + across.y * p.z;
  float toward = across.y * px - across.x * p.z;
  float thumb = smoothstep(${THUMB.from.toFixed(3)}, ${THUMB.to.toFixed(3)}, toward) * (1.0 - smoothstep(${THUMB.endFrom.toFixed(3)}, ${THUMB.endTo.toFixed(3)}, p.y));
  float curl = fingerCurlAt(curls, at, along) * (1.0 - thumb);
  float knuckle = shape.x - across.z * (along - at.y) * (along - at.y);
  float s = p.y - knuckle;
  float y = p.y;
  float w = toward - fingerTuck * thumb * smoothstep(${THUMB_TUCK.from.toFixed(3)}, ${THUMB_TUCK.to.toFixed(3)}, p.y);
  float a = 0.0;
  if (s > 0.0 && curl > 1e-4) {
    float k = curl / shape.y;
    a = k * s;
    float d = w - shape.z;
    y = knuckle + sin(a) / k - d * sin(a);
    w = shape.z + (1.0 - cos(a)) / k + d * cos(a);
  }
  px = across.x * along + across.y * w;
  p = vec3(shape.w * px, y, across.y * along - across.x * w);
  return a;
}

// turns a direction (hand frame) by the bend angle a, in the plane of y and the palm normal
vec3 fingerTurn(vec3 v, float a, float palm, vec3 across) {
  float px = palm * v.x;
  float along = across.x * px + across.y * v.z;
  float toward = across.y * px - across.x * v.z;
  float c = cos(a);
  float s = sin(a);
  float y = v.y * c - toward * s;
  float w = v.y * s + toward * c;
  return vec3(palm * (across.x * along + across.y * w), y, across.y * along - across.x * w);
}
`;

// before the skinning: bend the position, normal and tangent of the finger vertices
const VERTEX_BEND = /* glsl */`
vec3 fingerPosition = position;
float fingerWeight = 0.0;
float fingerAngle = 0.0;
int fingerHand = 0;
#ifdef USE_SKINNING
for (int h = 0; h < 2; h++) {
  float w = dot(vec4(equal(skinIndex, vec4(fingerBone[h]))), skinWeight);
  if (w > 0.001) {
    vec3 p = (fingerToHand[h] * vec4(position, 1.0)).xyz;
    float a = fingerBend(p, fingerShape[h], fingerAcross[h], fingerCurl[h], fingerAt[h]);
    fingerPosition = mix(position, (fingerFromHand[h] * vec4(p, 1.0)).xyz, w);
    fingerWeight = w;
    fingerAngle = a;
    fingerHand = h;
  }
}
if (fingerAngle > 0.0) {
  mat3 toHand = mat3(fingerToHand[fingerHand]);
  mat3 fromHand = mat3(fingerFromHand[fingerHand]);
  float palm = fingerShape[fingerHand].w;
  vec3 across = fingerAcross[fingerHand];
  objectNormal = normalize(mix(objectNormal, fromHand * fingerTurn(toHand * objectNormal, fingerAngle, palm, across), fingerWeight));
  #ifdef USE_TANGENT
  objectTangent = normalize(mix(objectTangent, fromHand * fingerTurn(toHand * objectTangent, fingerAngle, palm, across), fingerWeight));
  #endif
}
#endif
`;

/** Bind-pose geometry -> hand frame in metres (the bone frame carries the rig's scale). */
function handFrame(model, mesh, bone) {
  const toBone = bindToNode(bone, mesh);
  model.updateWorldMatrix(true, false);
  const inModel = new THREE.Matrix4().copy(model.matrixWorld).invert().multiply(bone.matrixWorld);
  const metres = new THREE.Vector3().setFromMatrixColumn(inModel, 0).length();
  return { toHand: new THREE.Matrix4().makeScale(metres, metres, metres).multiply(toBone), metres };
}

/**
 * @param {{ model: THREE.Object3D, mesh: THREE.SkinnedMesh }} opts call in the bind pose
 * @returns {{ mesh: THREE.SkinnedMesh, patch: object, hands: Array<object>, setCurls(i: number, curls: number[]): void,
 *   setTuck(amount: number): void }}
 *   hands[i] (Left, Right): index (bone index), bone, shape (HANDS), metres (hand frame unit),
 *   toHand (geometry -> hand frame metres), width (the finger blend)
 */
export function createFingers({ model, mesh }) {
  const bones = mesh.skeleton.bones;
  const hands = SIDES.map((name) => {
    const index = bones.findIndex((b) => b.name === `${name}Hand`);
    if (index < 0) throw new Error(`fingers: the avatar has no ${name}Hand bone`);
    const { toHand, metres } = handFrame(model, mesh, bones[index]);
    return { name, index, bone: bones[index], shape: HANDS[name], toHand, metres, width: FINGER_WIDTH };
  });
  const uniforms = {
    fingerToHand: { value: hands.map((h) => h.toHand) },
    fingerFromHand: { value: hands.map((h) => h.toHand.clone().invert()) },
    fingerShape: { value: hands.map((h) => new THREE.Vector4(h.shape.knuckle, h.shape.length, h.shape.centre, h.shape.palm)) },
    fingerAcross: { value: hands.map((h) => new THREE.Vector3(...h.shape.across, h.shape.arc)) },
    fingerCurl: { value: hands.map(() => new THREE.Vector4()) },
    fingerAt: { value: hands.map((h) => new THREE.Vector4(...h.shape.fingers)) },
    fingerBone: { value: hands.map((h) => h.index) },
    fingerTuck: { value: 0 },
  };
  return {
    mesh,
    hands,
    patch: {
      key: 'fingers6',
      uniforms,
      edits: [
        ['vertex', '#include <common>', VERTEX_PARS],
        ['vertex', '#include <beginnormal_vertex>', VERTEX_BEND],
        ['vertex', '#include <begin_vertex>', 'transformed = fingerPosition;'],
      ],
    },
    /** @param {number} i 0 left, 1 right @param {ArrayLike<number>} curls four fingers, radians */
    setCurls(i, curls) {
      uniforms.fingerCurl.value[i].set(curls[0], curls[1], curls[2], curls[3]);
    },
    /** How far the thumbs are tucked in, 0 (as modelled) .. 1 (typing, THUMB_TUCK). */
    setTuck(amount) {
      uniforms.fingerTuck.value = THUMB_TUCK.tuck * Math.min(1, Math.max(0, amount));
    },
  };
}
