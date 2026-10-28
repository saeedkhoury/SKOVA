/**
 * Lighting for the character, following the reference's verified setup:
 *  - an image-based environment (here a small code-built studio room, RoomEnvironment
 *    style, prefiltered with PMREMGenerator), environmentIntensity 0 -> 0.64 at lights-on
 *  - a lavender directional key #c7a9ff from (-0.47, -0.32, -1), intensity 0 -> 1
 *  - a lavender point light #c2a4ff at (3, 12, 4), distance 100, decay 3, whose intensity is
 *    20 x the monitor's emissive flicker while the screen is on
 * plus two soft back rims (pink / violet) that give the clay its lavender silhouette.
 */
import * as THREE from 'three';

export const LIGHTS = Object.freeze({
  environment: 0.64,
  key: Object.freeze({ color: 0xc7a9ff, intensity: 1, position: [-0.47, -0.32, -1] }),
  point: Object.freeze({ color: 0xc2a4ff, position: [3, 12, 4], distance: 100, decay: 3, perEmissive: 20 }),
  rimPink: Object.freeze({ color: 0xffb4f2, intensity: 2.8, position: [3.5, 1.6, -10] }),
  rimViolet: Object.freeze({ color: 0xb69bff, intensity: 2.0, position: [-3.5, 1.6, -10] }),
  // Ours: a neutral white key from above-left in front, so his skin reads true and the face has planes.
  front: Object.freeze({ color: 0xfff6ee, intensity: 1.5, position: [-5, 7, 8] }),
});

// Studio room: a soft neutral key in front, above and to his left (it gives the face planes, not a
// flat fill), a top light for the hair, dim neutral side fills so the sides fall off, and pink /
// violet panels behind for the coloured rim.
const PANELS = Object.freeze([
  { size: [3.4, 3.4, 0.2], position: [-3.4, 3.2, 5.6], color: 0xffffff, intensity: 6 },
  { size: [6, 0.2, 6], position: [0, 4.4, 0], color: 0xffffff, intensity: 2.6 },
  { size: [0.2, 4, 5], position: [-6.3, 1.2, 2.4], color: 0xfff0e8, intensity: 1.1 },
  { size: [0.2, 3.5, 4], position: [6.3, 1.6, 1.6], color: 0xfff0e8, intensity: 0.55 },
  { size: [4, 3, 0.2], position: [4.2, 2.4, -6.3], color: 0xff9ef0, intensity: 4.5 },
  { size: [4, 3, 0.2], position: [-4.2, 2.6, -6.3], color: 0xa585ff, intensity: 4 },
]);
const ROOM = Object.freeze({ size: [13, 9, 13], color: 0x1c1a1f, floor: 0x141117 });
const PMREM_SIGMA = 0.04;

function studioScene() {
  const scene = new THREE.Scene();
  const owned = [];
  const roomGeo = new THREE.BoxGeometry(...ROOM.size);
  const roomMat = new THREE.MeshBasicMaterial({ color: ROOM.color, side: THREE.BackSide });
  owned.push(roomGeo, roomMat);
  scene.add(new THREE.Mesh(roomGeo, roomMat));
  const floorGeo = new THREE.PlaneGeometry(ROOM.size[0], ROOM.size[2]);
  const floorMat = new THREE.MeshBasicMaterial({ color: ROOM.floor });
  owned.push(floorGeo, floorMat);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -ROOM.size[1] / 2 + 0.05;
  scene.add(floor);
  PANELS.forEach((panel) => {
    const geo = new THREE.BoxGeometry(...panel.size);
    const mat = new THREE.MeshBasicMaterial({ color: panel.color });
    mat.color.multiplyScalar(panel.intensity);
    owned.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...panel.position);
    scene.add(mesh);
  });
  return { scene, dispose: () => owned.forEach((item) => item.dispose()) };
}

/** Prefiltered environment texture for scene.environment. */
export function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = studioScene();
  try {
    const target = pmrem.fromScene(studio.scene, PMREM_SIGMA);
    return target;
  } finally {
    studio.dispose();
    pmrem.dispose();
  }
}

function directional(def, target) {
  const light = new THREE.DirectionalLight(def.color, 0);
  light.position.set(...def.position);
  light.target = target;
  return light;
}

const LIGHT_NAMES = Object.freeze(['key', 'point', 'rimPink', 'rimViolet', 'front']);
const DESK_RIM_FROM = 0.5; // the pink rim starts moving once the desk is this far up

/** 0 until the desk is half up, 1 when it is up (smooth). */
function deskShare(rise) {
  const t = Math.min(1, Math.max(0, ((Number(rise) || 0) - DESK_RIM_FROM) / (1 - DESK_RIM_FROM)));
  return t * t * (3 - 2 * t);
}

/** LIGHTS with per-light overrides merged in (colour, intensity, position, ...). */
function tuned(overrides) {
  const out = { environment: overrides.environment ?? LIGHTS.environment };
  LIGHT_NAMES.forEach((name) => { out[name] = { ...LIGHTS[name], ...(overrides[name] || {}) }; });
  return out;
}

/**
 * @param {THREE.Object3D} target what the directional lights aim at (the character root)
 * @param {{ offset?: number[], environment?: number } & Record<string, object>} [overrides] the GLB
 *   avatar's tuning: per-light { color, intensity, position }, an offset that moves every light
 *   with its subject (directions stay the reference's), and rimPinkDesk { intensity, position }:
 *   where the pink rim goes once the desk is up (update's `rise`)
 */
export function createLights(target, overrides = {}) {
  const L = tuned(overrides);
  const key = directional(L.key, target);
  const rimPink = directional(L.rimPink, target);
  const rimViolet = directional(L.rimViolet, target);
  const front = directional(L.front, target);
  const desk = overrides.rimPinkDesk || null;
  const pinkFrom = new THREE.Vector3(...L.rimPink.position);
  const pinkTo = desk ? new THREE.Vector3(...desk.position) : pinkFrom;
  const p = L.point;
  const point = new THREE.PointLight(p.color, 0, p.distance, p.decay);
  point.position.set(...p.position);
  const group = new THREE.Group();
  group.name = 'character-lights';
  group.add(key, rimPink, rimViolet, front, point);
  if (Array.isArray(overrides.offset)) group.position.set(...overrides.offset);
  return {
    group,
    /**
     * @param {THREE.Scene} scene
     * @param {number} light 0..1 lights-on progress
     * @param {number} rim 0..1 (scroll: the back glow fades as the camera pulls back)
     * @param {number} emissive the monitor's current emissive intensity (0 when off)
     * @param {number} [rise] 0..1 how far the desk is up (moves the pink rim when rimPinkDesk is set)
     */
    update(scene, light, rim, emissive, rise = 0) {
      // The ambient share ramps slower than the lights, so the first half second stays dark.
      scene.environmentIntensity = L.environment * light * light;
      key.intensity = L.key.intensity * light;
      front.intensity = L.front.intensity * light;
      const back = light * (0.85 + 0.15 * rim); // the 3D rims stay at the desk; only the DOM glow fades
      const atDesk = desk ? deskShare(rise) : 0;
      const pink = desk ? L.rimPink.intensity + (desk.intensity - L.rimPink.intensity) * atDesk : L.rimPink.intensity;
      rimPink.intensity = pink * back;
      if (desk) rimPink.position.lerpVectors(pinkFrom, pinkTo, atDesk);
      rimViolet.intensity = L.rimViolet.intensity * back;
      point.intensity = p.perEmissive * emissive;
    },
    dispose() {
      group.removeFromParent();
      [key, rimPink, rimViolet, front, point].forEach((light) => light.dispose());
    },
  };
}
