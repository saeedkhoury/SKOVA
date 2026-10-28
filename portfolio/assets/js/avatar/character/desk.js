/**
 * The desk set that rises in "What I do": a white desk on slim legs, a monitor whose
 * screen shows a project screenshot with a flickering lavender glow, a keyboard whose
 * keys press under the typing hands, and a phone. Plus the soft contact shadow under
 * the chair (always on). Model space, in front of the character (+z). The default layout fits the
 * code-built character; the GLB avatar passes its own (avatar/glb-character/layout.js).
 */
import * as THREE from 'three';
import { roundedBox, shadowTexture } from './geometry.js';

export const DESK = Object.freeze({
  top: Object.freeze({ size: [9.4, 0.18, 4.4], at: [0.4, 7.7, 3.85] }),
  legs: Object.freeze({ x: 4.3, z: [2.0, 5.7], size: [0.26, 0.12] }),
  keyboard: Object.freeze({ size: [3.7, 0.1, 1.2], at: [0, 7.84, 2.98], cols: 15, rows: 5, pitch: [0.235, 0.225] }),
  keycap: Object.freeze({ size: [0.185, 0.07, 0.185] }),
  // Angled between him and the camera's view in "What I do", so both can see the screen.
  monitor: Object.freeze({ at: [2.1, 10.75, 4.75], size: [5.4, 3.4, 0.14], screen: [5.18, 3.2], yaw: 1.1, tilt: 0.06, base: [1.8, 1.0] }),
  phone: Object.freeze({ at: [-2.75, 7.81, 3.25], size: [0.52, 0.05, 1.0], yaw: 0.35 }),
  shadow: Object.freeze({ size: [9, 7.5], at: [0.3, 0.02, 1.8] }),
  pool: Object.freeze({ size: [12, 8], at: [0.2, 0.01, 1.2] }),
  // Fingertip targets [x, z] of the two typing fingers of each hand (see body-shapes POSE).
  keys: Object.freeze([[0.58, 3.3], [0.4, 3.18], [-0.58, 3.3], [-0.4, 3.18]]),
});
const KEY_TRAVEL = 0.035; // layout.keyTravel overrides it
/** Height of the desk's top surface. */
const surfaceOf = (layout) => layout.top.at[1] + layout.top.size[1] / 2;

function mesh(geometry, material, position, owned) {
  owned.push(geometry);
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  return m;
}

function buildTable(layout, materials, owned) {
  const group = new THREE.Group();
  const { size, at } = layout.top;
  group.add(mesh(roundedBox(...size, 0.06, 3), materials.desk, at, owned));
  const { legs } = layout;
  const legGeo = roundedBox(legs.size[0], at[1] - 0.08, legs.size[1], 0.05, 2);
  owned.push(legGeo);
  [-1, 1].forEach((s) => {
    legs.z.forEach((z) => {
      const leg = new THREE.Mesh(legGeo, materials.desk);
      leg.position.set(at[0] + s * legs.x, (at[1] - 0.08) / 2, z);
      group.add(leg);
    });
    const foot = mesh(roundedBox(0.3, 0.1, legs.z[1] - legs.z[0] + 0.4, 0.04, 2), materials.desk,
      [at[0] + s * legs.x, 0.05, (legs.z[0] + legs.z[1]) / 2], owned);
    group.add(foot);
  });
  return group;
}

function buildMonitor(layout, materials, screenTexture, owned) {
  const { at, size, screen, yaw, tilt } = layout.monitor;
  const surface = surfaceOf(layout);
  const monitor = new THREE.Group();
  monitor.position.set(...at);
  monitor.rotation.set(-tilt, Math.PI + yaw, 0, 'YXZ'); // the screen faces back toward him
  monitor.add(mesh(roundedBox(...size, 0.05, 3), materials.desk, [0, 0, 0], owned));
  monitor.add(mesh(roundedBox(size[0] * 0.8, size[1] * 0.75, 0.22, 0.08, 3), materials.desk, [0, -0.05, -0.12], owned));
  monitor.add(mesh(new THREE.PlaneGeometry(size[0] - 0.06, size[1] - 0.06), materials.deskDark, [0, 0, size[2] / 2 + 0.002], owned)); // bezel
  materials.screen.map = screenTexture;
  materials.screen.needsUpdate = true;
  const screenMesh = mesh(new THREE.PlaneGeometry(...screen), materials.screen, [0, 0, size[2] / 2 + 0.006], owned);
  monitor.add(screenMesh);
  const rise = at[1] - (surface + 0.01); // monitor centre above the desk
  const neck = mesh(new THREE.CylinderGeometry(0.1, 0.12, rise - 0.6, 12), materials.desk, [0, -rise / 2 - 0.3, -0.18], owned);
  monitor.add(neck);
  const stand = new THREE.Group();
  stand.position.set(at[0], surface + 0.02, at[2]);
  stand.rotation.y = Math.PI + yaw;
  stand.add(mesh(roundedBox(layout.monitor.base[0], 0.07, layout.monitor.base[1], 0.03, 2), materials.desk, [0, 0, -0.18], owned));
  return { monitor, stand, screenMesh };
}

function buildKeyboard(layout, materials, owned) {
  const { size, at, cols, rows, pitch } = layout.keyboard;
  const group = new THREE.Group();
  group.add(mesh(roundedBox(...size, 0.04, 2), materials.deskDark, at, owned));
  const capGeo = roundedBox(...layout.keycap.size, 0.03, 1);
  owned.push(capGeo);
  const caps = new THREE.InstancedMesh(capGeo, materials.keycap, cols * rows);
  const rest = [];
  const m = new THREE.Matrix4();
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      const p = new THREE.Vector3(at[0] + (c - (cols - 1) / 2) * pitch[0], at[1] + 0.085, at[2] + (r - (rows - 1) / 2) * pitch[1]);
      rest.push(p);
      caps.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
    }
  }
  caps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(caps);
  const keys = layout.keys.map(([x, z]) => {
    let best = 0;
    rest.forEach((p, i) => { if (Math.hypot(p.x - x, p.z - z) < Math.hypot(rest[best].x - x, rest[best].z - z)) best = i; });
    return best;
  });
  const half = [size[0] / 2, size[2] / 2];
  const info = Object.freeze({
    capTop: at[1] + 0.085 + layout.keycap.size[1] / 2, // key tops (desk group space)
    box: Object.freeze({ x0: at[0] - half[0], x1: at[0] + half[0], z0: at[2] - half[1], z1: at[2] + half[1] }),
    cols, rows, origin: Object.freeze([rest[0].x, rest[0].z]), pitch: Object.freeze([...pitch]),
  });
  return { group, caps, rest, keys, info };
}

function buildPhone(layout, materials, owned) {
  const { at, size, yaw } = layout.phone;
  const phone = new THREE.Group();
  phone.position.set(...at);
  phone.rotation.y = yaw;
  phone.add(mesh(roundedBox(...size, 0.04, 2), materials.deskDark, [0, 0, 0], owned));
  return phone;
}

function glowSprite(materials) {
  const sprite = new THREE.Sprite(materials.glowSprite);
  sprite.scale.set(7.5, 5.5, 1);
  return sprite;
}

/**
 * @param {{ materials: object, screenTexture: THREE.Texture | null, layout?: typeof DESK }} opts
 */
export function buildDesk({ materials, screenTexture, layout = DESK }) {
  const owned = [];
  const group = new THREE.Group();
  group.name = 'desk';
  const table = buildTable(layout, materials, owned);
  const { monitor, stand, screenMesh } = buildMonitor(layout, materials, screenTexture, owned);
  const keyboard = buildKeyboard(layout, materials, owned);
  const glowTexture = shadowTexture(128, '200,191,255');
  materials.glowSprite = new THREE.SpriteMaterial({
    map: glowTexture, color: 0xc8bfff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const glow = glowSprite(materials);
  const facing = new THREE.Vector3(0, 0, 1).applyEuler(monitor.rotation);
  glow.position.copy(monitor.position).addScaledVector(facing, 0.7);
  group.add(table, monitor, stand, keyboard.group, buildPhone(layout, materials, owned), glow);
  const shadowTex = shadowTexture();
  materials.shadow.map = shadowTex;
  materials.shadow.needsUpdate = true;
  const shadowGeo = new THREE.PlaneGeometry(...layout.shadow.size);
  owned.push(shadowGeo);
  const shadow = new THREE.Mesh(shadowGeo, materials.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(...layout.shadow.at);
  shadow.renderOrder = -1;
  // A soft lavender pool of light on the floor (the dark contact shadow alone vanishes on the dark page).
  const poolTex = shadowTexture(128, '210,190,255');
  materials.pool.map = poolTex;
  materials.pool.needsUpdate = true;
  const poolGeo = new THREE.PlaneGeometry(...layout.pool.size);
  owned.push(poolGeo);
  const pool = new THREE.Mesh(poolGeo, materials.pool);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(...layout.pool.at);
  pool.renderOrder = -2;
  shadow.add(pool);
  pool.position.set(layout.pool.at[0] - layout.shadow.at[0], layout.shadow.at[2] - layout.pool.at[2], 0);
  pool.rotation.x = 0;
  const m = new THREE.Matrix4();
  const travel = Number.isFinite(layout.keyTravel) ? layout.keyTravel : KEY_TRAVEL;
  const pressed = new Map(); // key index -> amount, for pressAt()
  const placeKey = (index, amount) => {
    const p = keyboard.rest[index];
    keyboard.caps.setMatrixAt(index, m.makeTranslation(p.x, p.y - travel * amount, p.z));
  };
  const { top } = layout;
  return {
    group,
    shadow,
    screenMesh,
    glow,
    textures: [glowTexture, shadowTex, poolTex].concat(screenTexture ? [screenTexture] : []),
    /** Rest positions (desk group space) of the four typing keys, in pressKeys() order. */
    keyPositions: keyboard.keys.map((index) => keyboard.rest[index].clone()),
    /** Press amounts (0..1) for the four typing keys. */
    pressKeys(amounts) {
      keyboard.keys.forEach((index, k) => placeKey(index, amounts[k]));
      keyboard.caps.instanceMatrix.needsUpdate = true;
    },
    /**
     * The keyboard and desk top for hands that find their own keys (desk group space): key tops,
     * the keyboard's footprint and key grid, the desk top's height and footprint, the key travel.
     */
    surfaces: Object.freeze({
      keyboard: keyboard.info,
      travel,
      deskTop: surfaceOf(layout),
      desk: Object.freeze({ x0: top.at[0] - top.size[0] / 2, x1: top.at[0] + top.size[0] / 2, z0: top.at[2] - top.size[2] / 2, z1: top.at[2] + top.size[2] / 2 }),
    }),
    /** Press keys by index: amounts is a Map of key index -> 0..1; keys left out come back up. */
    pressAt(amounts) {
      pressed.forEach((_, index) => { if (!amounts.has(index)) placeKey(index, 0); });
      pressed.clear();
      amounts.forEach((amount, index) => {
        placeKey(index, amount);
        pressed.set(index, amount);
      });
      keyboard.caps.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      owned.forEach((g) => g.dispose());
      keyboard.caps.dispose();
      group.removeFromParent();
      shadow.removeFromParent();
    },
  };
}
