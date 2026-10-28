/**
 * Where everything sits for the GLB avatar. Scene units are decimetres: the model (metres) is
 * scaled by 10, so the desk set's real-world sizes from desk.js (keycaps 1.85 cm, a 37 cm
 * keyboard) stay true. Floor at y = 0, he faces +z, his hips at x = z = 0 once seated.
 *
 * The avatar has a stylized big head and short legs, so his desk and chair are lower than the
 * code-built character's (desk.js DESK) and the scene is framed with its own placement.
 */

/** Model metres to scene units. */
export const MODEL_SCALE = 10;

/**
 * Scene to world: with the reference camera (fov 14.5 at (0, 13.1, 24.7), zoom 1.1) his head
 * (hair top to beard) fills ~45% of a 1440 x 900 viewport with the hair ~21% from the top, like
 * the reference's bust. sceneScale grows the scene around `pivotY` (scene units, near the hair top).
 */
export const PLACEMENT = Object.freeze({ scale: 0.5, y: 7.8, pivotY: 13 });

/** The idle clip is sampled once, here (seconds): he sits upright, hands on his knees. */
export const BASE_POSE_TIME = 0.3;

/** The code-built office chair, lowered to his seat height (body-shapes.js chair, scene units). */
export const CHAIR = Object.freeze({ scale: [1, 0.732, 1], at: [0, 0, -0.35] });

/**
 * The desk set rises from here (scene units) as the camera pulls back (params.screenRise): from
 * below and in front of him, on a slant that keeps its top clear of his knees and feet all the way.
 */
export const DESK_DROP = Object.freeze({ y: -6, z: 10 });

const SURFACE = 5.48; // desk top surface: the slab clears his thighs by 1 cm
const TOP_THICK = 0.16;
// His arms are short for the desk height, so he types like the reference: elbows near the desk's
// front edge, forearms just over the desk, wrists over the keyboard's front edge. The keyboard is
// sized to his big hands (six rows) and sits far enough in for his forearms; the monitor behind it.
const FRONT_EDGE = 3.25;
const TOP_DEPTH = 5.6;
const KEYBOARD = Object.freeze({ front: 3.8, size: [4.1, 0.1, 1.62], rows: 6, cols: 15, pitch: [0.26, 0.245] });
const KEYBOARD_Z = KEYBOARD.front + KEYBOARD.size[2] / 2;

/** desk.js layout for him (same shape as desk.js DESK). */
export const DESK_LAYOUT = Object.freeze({
  top: Object.freeze({ size: [10.6, TOP_THICK, TOP_DEPTH], at: [0.5, SURFACE - TOP_THICK / 2, FRONT_EDGE + TOP_DEPTH / 2] }),
  legs: Object.freeze({ x: 4.9, z: [FRONT_EDGE + 0.4, FRONT_EDGE + TOP_DEPTH - 0.4], size: [0.26, 0.12] }),
  keyboard: Object.freeze({ size: KEYBOARD.size, at: [0, SURFACE + 0.05, KEYBOARD_Z], cols: KEYBOARD.cols, rows: KEYBOARD.rows, pitch: KEYBOARD.pitch }),
  keycap: Object.freeze({ size: [0.205, 0.07, 0.195] }),
  keyTravel: 0.015, // 1.5 mm
  // in front of him and turned toward him, its back to the viewer at "What I do" (like the reference)
  monitor: Object.freeze({ at: [0.7, 9.5, 7.3], size: [6.6, 4.0, 0.14], screen: [6.38, 3.8], yaw: 0.35, tilt: 0.06, base: [2.0, 1.1] }),
  phone: Object.freeze({ at: [-3.3, SURFACE + 0.03, KEYBOARD_Z + 0.2], size: [0.72, 0.05, 1.4], yaw: 0.35 }),
  shadow: Object.freeze({ size: [10, 9.5], at: [0.3, 0.02, 2.4] }),
  pool: Object.freeze({ size: [13, 10], at: [0.2, 0.01, 2.0] }),
  // the code-built character's four fixed typing keys (unused here: his fingers find their keys)
  keys: Object.freeze([[0.7, KEYBOARD_Z], [0.5, KEYBOARD_Z], [-0.7, KEYBOARD_Z], [-0.5, KEYBOARD_Z]]),
});

/**
 * In the hero his hands rest on his thighs from the sides (body frame, metres, left hand first; the
 * seated clip's thighs): upper arms hanging relaxed from his shoulders, a little away from his
 * body, elbows bent and turned a little out (swivel, radians around the shoulder-to-wrist line),
 * palms on the thighs, fingers along them and draped over them (curl).
 */
export const REST = Object.freeze({
  wrists: Object.freeze([[0.2, 0.555, 0.235], [-0.2, 0.555, 0.235]]),
  swivel: -0.3,
  hand: Object.freeze({ yaw: 0.05, pitch: 0.4, roll: 0.3 }),
  curl: 0.45,
});

/** Typing: wrist targets (the desk's space once in place, left hand first) and the hand's pose. */
export const ARMS = Object.freeze({
  // the wrists' first guess; their height is then set so the fingertips rest on the key tops
  wrists: Object.freeze([[1.25, SURFACE + 0.8, KEYBOARD.front - 0.75], [-1.25, SURFACE + 0.8, KEYBOARD.front - 0.75]]),
  // the hands go onto the keyboard over this part of the desk's rise (params.screenRise): up and
  // over the keys before the rising desk reaches their height
  reachFrom: 0.55,
  reachTo: 0.9,
  // where the elbows point at the keys (body frame: x out to his side, y up, z forward): down
  // beside him, a little out and back, like a relaxed typist (arms.js aimElbow)
  elbow: Object.freeze([0.85, -1, -0.1]),
  // fingers forward, turned in (yaw) and down (pitch); palm down, the thumb side up a little (roll)
  hand: Object.freeze({ yaw: 0.3, pitch: 0, roll: 0.05 }),
  curl: 0.45, // resting finger curl (radians, fingers.js)
  hover: 0.004, // resting fingertips this far over the key tops (0.4 mm)
  thumbHover: 0.02, // the thumbs over the front keys (2 mm)
  contact: 0.005, // a striking fingertip this close to the key top presses it
  palmClear: 0.02, // palm, thumb and cuff at least this far over the keys or desk
  touchFrom: 0.6, // share of the reach after which the fingers find the keys
  tap: Object.freeze({ pitch: 0.006, roll: 0.01, dip: 0.008 }), // the hand's small dip and roll with each strike
});

/**
 * Lights: the reference set from character/lights.js, moved up with him (offset) so their
 * directions stay the same, a warm neutral front key so his skin reads the warm tan of his
 * avatar image, and the screen's point light beside the monitor.
 */
export const LIGHT_TUNING = Object.freeze({
  offset: [0, PLACEMENT.y - 1.55, 0],
  environment: 0.85,
  front: Object.freeze({ color: 0xfff0e4, intensity: 1.35, position: [-1.6, 5.5, 9] }),
  rimPink: Object.freeze({ intensity: 3.6, position: [4.6, 6, -9] }),
  // at the desk (params.screenRise) the pink rim moves round to his back, shoulders and legs
  rimPinkDesk: Object.freeze({ intensity: 4.5, position: [5.5, 7, -6] }),
  rimViolet: Object.freeze({ intensity: 3, position: [-4.6, 8, -9] }),
  point: Object.freeze({ position: [2.4, 6.6, 4.2] }),
});

/** Tone mapping for the textured model: PBR Neutral keeps the skin's warm hue (ACES greys it). */
export const TONE_MAPPING = 'neutral';
export const EXPOSURE = 1.04;

/**
 * How far he leans toward the desk while typing (params.lean, pose.js): a little, so he sits upright
 * like a relaxed typist, back straight and elbows beside him (the reference's 0.6 hunched him).
 * Used by both scroll stories (choreography.js via CHOREO.t2, choreography-compact.js).
 */
export const TYPING_LEAN = 0.3;

/**
 * Our own composition values for the scroll story (choreography.js CHARACTER.t2): at "What I do"
 * the seated scene grows to fill the left half, the title over his hair.
 */
export const CHOREO = Object.freeze({ t2: Object.freeze({ sceneX: -5, sceneY: 0, sceneScale: 1.75, lean: TYPING_LEAN }) });
