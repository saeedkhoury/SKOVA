/**
 * Materials for the character and its desk. Few on purpose:
 *  - skin: soft matte clay whose albedo is all in the vertex colours (warm tan, the painted fade,
 *    lips, tattoo), with a warm sheen for the thin, light-catching edges
 *  - polo (white pique knit, a smooth collar), trousers (stone), sneakers (white), chair: neutral matte clay
 *  - hair (black, a little glossy, fine strands), beard (rougher, browner strands), brows / lashes
 *  - eyes, the watch (steel and a dark dial), and the desk set (which fades in, so it is
 *    transparent from the start to avoid a shader recompile mid-scroll)
 * Lavender only lives in the lights and the screen glow, never in the surfaces.
 */
import * as THREE from 'three';
import { addDetail, tintSheen } from './detail.js';

export const COLORS = Object.freeze({
  polo: 0xeceae6,
  trousers: 0xcfc3ae,
  sneaker: 0xf1efec,
  chair: 0xe6e4e8,
  sclera: 0xece4dc,
  iris: 0x3b2418,
  pupil: 0x0b0706,
  mouth: 0x3a2320,
  steel: 0xc9cbd0,
  dial: 0x15171c,
  desk: 0xf4f2f7,
  deskDark: 0x1c1922,
  keycap: 0xf7f6fa,
  screenGlow: 0xc8bfff,
});
const WARM_SHEEN = 0xffc7ae;

function clay(color, { sheen = 0.1, roughness = 0.6, sheenColor = 0xffffff } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    sheen,
    sheenColor: new THREE.Color(sheenColor),
    sheenRoughness: 0.5,
    vertexColors: true,
  });
}

/** Dark hair-like clay (colour from vertex colours); env scales the studio reflections. */
function darkClay({ roughness, env, specular = 1 }) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness,
    metalness: 0,
    envMapIntensity: env,
    specularIntensity: specular,
    vertexColors: true,
  });
}

function deskPart(color, roughness) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, transparent: true, opacity: 0 });
}

function characterMaterials() {
  return {
    skin: tintSheen(clay(0xffffff, { sheen: 0.15, roughness: 0.6, sheenColor: WARM_SHEEN })),
    polo: addDetail(clay(COLORS.polo, { sheen: 0.12, roughness: 0.78 }), { kind: 'knit', freq: [150, 150, 150], bump: 0.0012, shade: 0.04, noise: 0.6 }),
    collar: clay(COLORS.polo, { sheen: 0.12, roughness: 0.74 }), // a smooth rib band, no knit
    trousers: clay(COLORS.trousers, { sheen: 0.12, roughness: 0.72 }),
    sneaker: clay(COLORS.sneaker, { sheen: 0.08, roughness: 0.55 }),
    chair: clay(COLORS.chair, { sheen: 0.08, roughness: 0.5 }),
    dark: darkClay({ roughness: 0.6, env: 0.45, specular: 0.5 }),
    brow: addDetail(darkClay({ roughness: 0.7, env: 0.4, specular: 0.4 }), { kind: 'strands', freq: [30, 120, 120], bump: 0.005, shade: 0.4, noise: 0.6 }),
    hair: addDetail(darkClay({ roughness: 0.5, env: 0.15, specular: 0.4 }), { kind: 'strands', freq: [70, 70, 14], bump: 0.004, shade: 0.55, noise: 0.6 }),
    beard: addDetail(darkClay({ roughness: 0.74, env: 0.7, specular: 0.4 }), { kind: 'strands', freq: [42, 34, 42], bump: 0.006, shade: 0.35, noise: 0.85 }),
    sclera: new THREE.MeshStandardMaterial({ color: COLORS.sclera, roughness: 0.35 }),
    iris: new THREE.MeshPhysicalMaterial({ color: COLORS.iris, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }),
    pupil: new THREE.MeshStandardMaterial({ color: COLORS.pupil, roughness: 0.2 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xf2eee8 }),
    mouth: new THREE.MeshStandardMaterial({ color: COLORS.mouth, roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: COLORS.steel, roughness: 0.28, metalness: 1 }),
    dial: new THREE.MeshStandardMaterial({ color: COLORS.dial, roughness: 0.45, metalness: 0 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe0b56a, roughness: 0.3, metalness: 1 }),
  };
}

/**
 * @returns {Record<string, THREE.Material> & { deskSet: THREE.Material[], dispose(): void }}
 */
export function createMaterials() {
  const m = {
    ...characterMaterials(),
    desk: deskPart(COLORS.desk, 0.45),
    deskDark: deskPart(COLORS.deskDark, 0.35),
    keycap: deskPart(COLORS.keycap, 0.5),
    screen: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false }),
    glow: new THREE.MeshBasicMaterial({
      color: COLORS.screenGlow,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }),
    pool: new THREE.MeshBasicMaterial({
      color: 0xd8c8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
  };
  m.deskSet = [m.desk, m.deskDark, m.keycap];
  m.dispose = () => {
    Object.values(m).forEach((value) => {
      if (value && value.isMaterial) {
        if (value.map) value.map.dispose();
        if (value.alphaMap) value.alphaMap.dispose();
        value.dispose();
      }
    });
  };
  return m;
}
