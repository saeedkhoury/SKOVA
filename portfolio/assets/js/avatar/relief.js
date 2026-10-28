/**
 * The relief portrait: Saeed's real cut-out photo on a finely subdivided plane,
 * pushed forward by the depth map. The head region turns around a joint at the top
 * of the neck (vertex shader); the photo colours are left as they are at rest.
 * Toward its bottom the photo darkens into a background-coloured silhouette (it still
 * hides the rim glow like a solid body) and its last rows dissolve, so the bust fades
 * out instead of ending on a hard edge when the camera pulls back.
 */
import * as THREE from 'three';
import { RELIEF_VERTEX, RELIEF_FRAGMENT } from './relief-shaders.js';

const PLANE_HEIGHT = 2; // world units; the camera framing is derived from the meta landmarks
const SEGMENTS_PER_HEIGHT = 256;
const NECK_RAMP = 0.045; // image height over which the head weight falls to 0 at meta.neckV
const PIVOT_Z_FRAC = 0.45; // the neck joint sits about halfway into the neck
// The photo darkens into the silhouette over this range of image v. Mixed in linear light, so
// it reads late: the visible fade runs from the chest pocket (v ~0.55) to v ~0.7, and the hero's
// bottom edge (v ~0.81) is already background. The photo below v ~0.64 is an extension of the
// real photo (portrait asset notes), so that is what goes dark.
const SHADE = Object.freeze({ start: 0.45, end: 0.72 });
// ...and its last rows dissolve (alpha), seen only when the camera pulls back ("What I do").
const DISSOLVE = Object.freeze({ start: 0.8, end: 0.97 });
const YAW_PIVOT_Z = 0.12; // body turn axis, roughly the middle of the torso depth
const LEAN_PIVOT_V = 0.86; // waist line for the forward lean (image v)
const LEAN_MAX = 0.05; // radians at params.lean = 1
const BREATH = Object.freeze({ amp: 0.004, hz: 0.22 });
const SWAY = Object.freeze({ amp: 0.0022, hz: 0.071, amp2: 0.0012, hz2: 0.13 });
const MAX_ANISOTROPY = 8;
const COLORS = Object.freeze({ rim: 0xc2a4ff, rim2: 0xc7a9ff, screen: 0xc8bfff, shadow: 0x0b080c });
const GRADE = Object.freeze([0.985, 0.993, 1.012]);
// Photo-safe head pose (world space, body turn included). Bigger angles expose that it is a
// photo; turns toward image-right stretch the far eye, so that side gets less room. Tightened
// for the big hero framing (head ~38% of the viewport), where any stretch shows more.
export const PORTRAIT_HEAD_LIMITS = Object.freeze({
  yaw: 0.22, yawRight: 0.15, pitch: 0.14, roll: 0.05,
  worldLeft: 0.26, worldRight: 0.16, worldDown: 0.17, worldUp: 0.12,
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isUv = (v) => Array.isArray(v) && v.length === 2 && v.every(isNum);

/**
 * Validate saeed-bust.meta.json (written by review/v2-assets/make_portrait.py).
 * @returns {object} normalized meta
 */
export function validateMeta(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('portrait meta is not an object');
  const required = ['aspect', 'headTop', 'chin', 'neckV', 'depthScale'];
  const missing = required.filter((key) => !isNum(raw[key]));
  if (missing.length) throw new Error(`portrait meta is missing ${missing.join(', ')}`);
  if (!isUv(raw.headPivot) || !isUv(raw.headRadius)) throw new Error('portrait meta needs headPivot and headRadius');
  if (raw.aspect < 0.3 || raw.aspect > 3) throw new Error('portrait meta aspect is out of range');
  if (!(raw.headTop < raw.chin && raw.chin <= raw.neckV && raw.neckV < 1)) throw new Error('portrait meta landmarks are out of order');
  return Object.freeze({
    aspect: raw.aspect,
    headTop: raw.headTop,
    chin: raw.chin,
    neckV: raw.neckV,
    depthScale: THREE.MathUtils.clamp(raw.depthScale, 0, 1),
    headPivot: raw.headPivot.slice(),
    headRadius: raw.headRadius.slice(),
  });
}

function makeTexture(image, { srgb, anisotropy }) {
  const texture = new THREE.Texture(image);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.flipY = true;
  texture.premultiplyAlpha = false; // edge colours were bled outward; premultiply happens in the shader
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function makeUniforms(meta, map, depth, size, depthImage) {
  const headCenter = [meta.headPivot[0], meta.headTop + meta.headRadius[1]];
  return {
    uMap: { value: map },
    uDepth: { value: depth },
    uDepthTexel: { value: new THREE.Vector2(1 / depthImage.naturalWidth, 1 / depthImage.naturalHeight) },
    uSize: { value: new THREE.Vector2(size.width, size.height) },
    uDepthAmp: { value: meta.depthScale * size.height },
    uPivot: { value: new THREE.Vector2(meta.headPivot[0], meta.headPivot[1]) },
    uPivotZFrac: { value: PIVOT_Z_FRAC },
    uHeadC: { value: new THREE.Vector2(headCenter[0], headCenter[1]) },
    uHeadR: { value: new THREE.Vector2(meta.headRadius[0], meta.headRadius[1]) },
    uNeck: { value: new THREE.Vector2(meta.neckV - NECK_RAMP, meta.neckV) },
    uHead: { value: new THREE.Vector3() },
    uBody: { value: new THREE.Vector4(0, 0, 0, (0.5 - LEAN_PIVOT_V) * size.height) },
    uModelRot: { value: new THREE.Matrix3() },
    uLight: { value: 0 },
    uRim: { value: 1 },
    uRimColor: { value: new THREE.Color(COLORS.rim) },
    uRimColor2: { value: new THREE.Color(COLORS.rim2) },
    uScreenPos: { value: new THREE.Vector3(2, 0, 1) },
    uScreenColor: { value: new THREE.Color(COLORS.screen) },
    uScreenLight: { value: 0 },
    uShade: { value: new THREE.Vector2(SHADE.start, SHADE.end) },
    uDissolve: { value: new THREE.Vector2(DISSOLVE.start, DISSOLVE.end) },
    uShadow: { value: new THREE.Color(COLORS.shadow) },
    uGrade: { value: new THREE.Vector3(GRADE[0], GRADE[1], GRADE[2]) },
  };
}

/** Plane covering the photo, centred on the origin. */
function makeGeometry(size, aspect) {
  const segX = Math.max(32, Math.round(SEGMENTS_PER_HEIGHT * aspect));
  return new THREE.PlaneGeometry(size.width, size.height, segX, SEGMENTS_PER_HEIGHT);
}

/**
 * @param {{ image: HTMLImageElement, depthImage: HTMLImageElement, meta: object, maxAnisotropy?: number }} opts
 */
export function createRelief({ image, depthImage, meta, maxAnisotropy = 1 }) {
  const size = { width: PLANE_HEIGHT * meta.aspect, height: PLANE_HEIGHT };
  const anisotropy = Math.max(1, Math.min(MAX_ANISOTROPY, maxAnisotropy));
  const map = makeTexture(image, { srgb: true, anisotropy });
  const depth = makeTexture(depthImage, { srgb: false, anisotropy: 1 });
  const uniforms = makeUniforms(meta, map, depth, size, depthImage);
  const geometry = makeGeometry(size, meta.aspect);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: RELIEF_VERTEX,
    fragmentShader: RELIEF_FRAGMENT,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // the shader moves vertices; the camera always frames the bust anyway

  // root -> turn (modelYaw / modelPitch about the body axis) -> mesh
  const pivot = new THREE.Vector3((meta.headPivot[0] - 0.5) * size.width, -0.5 * size.height, YAW_PIVOT_Z);
  const turn = new THREE.Group();
  turn.position.copy(pivot);
  turn.rotation.order = 'YXZ';
  mesh.position.copy(pivot).negate();
  turn.add(mesh);
  const root = new THREE.Group();
  root.name = 'relief-portrait';
  root.add(turn);

  const frame = Object.freeze({
    top: (0.5 - meta.headTop) * size.height,
    bottom: (0.5 - meta.chin) * size.height,
    centerX: (meta.headPivot[0] - 0.5) * size.width,
    halfWidth: size.width / 2,
    z: 0.5 * meta.depthScale * size.height,
  });
  const twoPi = Math.PI * 2;
  const body = { yaw: 0, pitch: 0 };

  /**
   * Per-frame update (no allocations).
   * @param {number} time seconds
   * @param {object} params stage.params
   * @param {{yaw:number,pitch:number,roll:number}} pose head pose (relative to the body)
   * @param {{ lightPosition: THREE.Vector3, lightIntensity: number } | null} screen
   */
  function update(time, params, pose, screen) {
    const breath = BREATH.amp * 0.5 * (1 - Math.cos(twoPi * BREATH.hz * time));
    const sway = SWAY.amp * Math.sin(twoPi * SWAY.hz * time) + SWAY.amp2 * Math.sin(twoPi * SWAY.hz2 * time + 1.3);
    uniforms.uBody.value.x = breath;
    uniforms.uBody.value.y = sway;
    uniforms.uBody.value.z = THREE.MathUtils.clamp(params.lean, -1, 1.5) * LEAN_MAX;
    uniforms.uHead.value.set(pose.yaw, pose.pitch, pose.roll);
    uniforms.uLight.value = THREE.MathUtils.clamp(params.light, 0, 1);
    uniforms.uRim.value = THREE.MathUtils.clamp(params.rim, 0, 1);
    turn.rotation.set(params.modelPitch, params.modelYaw, 0);
    root.updateMatrixWorld(true);
    uniforms.uModelRot.value.setFromMatrix4(mesh.matrixWorld);
    uniforms.uScreenLight.value = screen ? screen.lightIntensity : 0;
    if (screen) uniforms.uScreenPos.value.copy(screen.lightPosition);
  }

  /** World rotation of the body at the neck, so the head controller can keep the face photo-safe. */
  function bodyPose(params) {
    body.yaw = params.modelYaw || 0;
    body.pitch = (params.modelPitch || 0) + THREE.MathUtils.clamp(params.lean || 0, -1, 1.5) * LEAN_MAX;
    return body;
  }

  return {
    kind: 'portrait',
    root,
    frame,
    headLimits: PORTRAIT_HEAD_LIMITS,
    textures: [map, depth],
    update,
    bodyPose,
    dispose() {
      geometry.dispose();
      material.dispose();
      map.dispose();
      depth.dispose();
      root.removeFromParent();
    },
  };
}
