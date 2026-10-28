/**
 * createGlbCharacter(): Saeed's own 3D avatar (config.avatar.glb, a rigged .glb made from his
 * avatar image) seated on the code-built office chair at the code-built desk, lit and choreographed
 * like the code-built character (it reuses character/desk.js, chair.js, lights.js, track.js,
 * scene.js and reach.js). Returns the same "subject" interface as character/index.js, so
 * avatar/index.js drives both the same way:
 *
 *   subject.root          everything to add to the scene (avatar, chair, desk set, lights)
 *   subject.environment   PMREM texture for scene.environment
 *   subject.update(dt, time, params, scene)
 *   subject.startIntro(time)  head lifts as the lights come up
 *   subject.choreo        our composition values for the scroll story (choreography.js)
 *   subject.dispose()
 *
 * The rig needs the bones Hips, Spine02, Spine01, Spine, LeftShoulder / RightShoulder, Left/RightArm,
 * Left/RightForeArm, Left/RightHand, plus the configured head and neck bones.
 */
import * as THREE from 'three';
import { createMaterials } from '../character/materials.js';
import { buildDesk } from '../character/desk.js';
import { buildChair } from '../character/chair.js';
import { createBudget } from '../character/mesher.js';
import { createEnvironment, createLights } from '../character/lights.js';
import { createTracker } from '../character/track.js';
import { createFlicker, stepDeskScene } from '../character/scene.js';
import { collectTextures, createBasePose, disposeModel, fetchGlb, parseGlb } from '../glb.js';
import { createPose } from './pose.js';
import { createArms } from './arms.js';
import { createLids } from './lids.js';
import { createBlink } from './blink.js';
import { createFingers } from './fingers.js';
import { patchMaterial } from './shader-patch.js';
import {
  BASE_POSE_TIME, CHAIR, CHOREO, DESK_DROP, DESK_LAYOUT, EXPOSURE, LIGHT_TUNING, MODEL_SCALE, PLACEMENT, TONE_MAPPING,
} from './layout.js';

const DOWNLOAD_SHARE = 0.9; // of this subject's progress; the chair mesh is the rest
const BUDGET_SLICE_MS = 10;
const VISIBLE = 0.002;
const BODY_BONES = Object.freeze({ chest: 'Spine', upper: 'Spine01', lower: 'Spine02', shoulderL: 'LeftShoulder', shoulderR: 'RightShoulder' });

const findClip = (clips, name) => (typeof name === 'string' && name ? clips.find((clip) => clip.name === name) || null : null);

function findBones(model, glb) {
  const names = { ...BODY_BONES, head: glb.headBone || 'Head', neck: glb.neckBone || 'neck' };
  const bones = {};
  Object.entries(names).forEach(([key, name]) => {
    const bone = model.getObjectByName(name);
    if (!bone) throw new Error(`the avatar has no bone named ${name}`);
    bones[key] = bone;
  });
  return bones;
}

/**
 * Sharper textures at grazing angles; one skinned mesh, so no per-pose culling surprises.
 * Returns that skinned mesh (the blink lids go on its material).
 */
function prepareModel(model, maxAnisotropy) {
  let skinned = null;
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.frustumCulled = false;
    if (node.isSkinnedMesh && !skinned) skinned = node;
    const material = node.material;
    if (material && material.map) material.map.anisotropy = maxAnisotropy;
  });
  if (!skinned) throw new Error('the avatar has no skinned mesh');
  return skinned;
}

/** Put his hips (in the seated base pose) over the scene origin. */
function centreOnHips(model, basePose) {
  basePose.restore();
  model.updateMatrixWorld(true);
  const hips = model.getObjectByName('Hips');
  if (!hips) throw new Error('the avatar has no Hips bone');
  const p = model.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
  model.position.set(-p.x, 0, -p.z);
}

function placeScene(root, params) {
  root.rotation.set(Number(params.modelPitch) || 0, Number(params.modelYaw) || 0, 0);
  const scale = PLACEMENT.scale * (Number(params.sceneScale) || 1);
  root.scale.setScalar(scale);
  root.position.set(Number(params.sceneX) || 0, PLACEMENT.y + (Number(params.sceneY) || 0) + (PLACEMENT.scale - scale) * PLACEMENT.pivotY, 0);
  root.updateMatrixWorld(true);
}

async function buildSet(materials, budget) {
  // the chair arrives with the desk set (it fades in with it), so About shows no stray chair back
  materials.chair.transparent = true;
  materials.chair.opacity = 0;
  const chair = await buildChair({ material: materials.chair, budget });
  chair.group.scale.set(...CHAIR.scale);
  chair.group.position.set(...CHAIR.at);
  return chair;
}

/**
 * @param {{ renderer: THREE.WebGLRenderer, glb: object, source?: { url: string, bytes: Promise<ArrayBuffer> },
 *   baseUrl?: string, hotspot?: Element | null, touchArea?: Element | null,
 *   onProgress?: (fraction: number) => void }} opts
 *   source: the download already started with fetchGlb() (its progress goes to the caller);
 *   without it the file is fetched here and reported through onProgress
 */
export async function createGlbCharacter({ renderer, glb, source = null, baseUrl, hotspot = null, touchArea = null, onProgress = () => {} }) {
  if (!renderer) throw new Error('createGlbCharacter needs a renderer');
  if (!glb || typeof glb.url !== 'string' || !glb.url) throw new Error('config.avatar.glb.url is missing');
  const materials = createMaterials();
  const owned = { model: null, chair: null, desk: null, env: null, lights: null, tracker: null, lids: null, patch: null };
  try {
    const download = source || fetchGlb(glb.url, { baseUrl, onProgress: (p) => onProgress(p * DOWNLOAD_SHARE) });
    const loaded = await parseGlb(download);
    onProgress(DOWNLOAD_SHARE);
    owned.model = loaded.scene;
    const model = owned.model;
    const mesh = prepareModel(model, renderer.capabilities.getMaxAnisotropy());
    const bones = findBones(model, glb);
    const holder = new THREE.Group();
    holder.name = 'avatar';
    holder.scale.setScalar(MODEL_SCALE);
    holder.add(model);
    const root = new THREE.Group();
    root.name = 'avatar-scene';
    owned.chair = await buildSet(materials, createBudget(BUDGET_SLICE_MS));
    owned.desk = buildDesk({ materials, screenTexture: null, layout: DESK_LAYOUT });
    root.add(holder, owned.chair.group, owned.desk.group, owned.desk.shadow);
    root.updateMatrixWorld(true);
    owned.tracker = createTracker({ hotspot, touchArea });
    // captured in the bind pose: the upright head and the hands' typing orientation
    const pose = createPose({ bones, frame: holder, tracker: owned.tracker });
    const fingers = createFingers({ model, mesh });
    const arms = createArms({ model, frame: holder, desk: owned.desk, fingers });
    owned.lids = createLids({ model, mesh });
    owned.patch = patchMaterial(mesh.material, [owned.lids.patch, fingers.patch]);
    const clip = findClip(loaded.animations, glb.idleClip);
    if (!clip) throw new Error(`the avatar has no animation named ${glb.idleClip}`); // it would stand, not sit
    const basePose = createBasePose(model, clip, BASE_POSE_TIME);
    centreOnHips(model, basePose);
    owned.env = createEnvironment(renderer);
    owned.lights = createLights(root, LIGHT_TUNING);
    onProgress(1);
    return makeSubject({ root, model, materials, pose, arms, basePose, owned });
  } catch (error) {
    disposeOwned(owned, materials);
    throw error;
  }
}

function disposeOwned(owned, materials) {
  if (owned.tracker) owned.tracker.destroy();
  if (owned.patch) owned.patch.dispose();
  if (owned.lights) owned.lights.dispose();
  if (owned.desk) owned.desk.dispose();
  if (owned.chair) owned.chair.dispose();
  if (owned.env) owned.env.dispose();
  if (owned.model) disposeModel(owned.model);
  materials.dispose();
}

const unit = (value) => Math.min(1, Math.max(0, Number(value) || 0));

/** The chair fades in with the desk set (params.screenOpacity). */
function showChair(chair, materials, opacity) {
  const o = unit(opacity);
  materials.chair.opacity = o;
  chair.group.visible = o > VISIBLE;
}

function makeSubject({ root, model, materials, pose, arms, basePose, owned }) {
  const { desk, lights, env } = owned;
  const flicker = createFlicker();
  const blink = createBlink();
  const group = new THREE.Group();
  group.name = 'glb-character';
  group.add(root, lights.group);
  const state = { still: false };
  return {
    kind: 'glb',
    root: group,
    environment: env.texture,
    /** Model and desk textures (the screenshot joins them once it arrives). */
    get textures() { return [...collectTextures(model), ...desk.textures]; },
    /** The blink lids (QA and still renders read or set them between frames). */
    lids: owned.lids,
    exposure: EXPOSURE,
    toneMapping: TONE_MAPPING,
    choreo: CHOREO,
    update(dt, time, params, scene) {
      placeScene(root, params);
      basePose.restore();
      pose.update(dt, time, params);
      owned.lids.set(blink.update(time, pose.headSpeed));
      const emissive = stepDeskScene({ desk, materials, params, flicker, drop: DESK_DROP, dt });
      const rise = Number(params.screenRise) || 0;
      showChair(owned.chair, materials, params.screenOpacity);
      arms.update(time, rise, state.still);
      lights.update(scene, unit(params.light), unit(params.rim), emissive, rise);
    },
    startIntro(time) {
      pose.startIntro(time);
      blink.lightsOn(time);
    },
    /** Make the hidden desk set visible for one compile pass (update() hides it again). */
    revealForCompile() {
      desk.group.visible = true;
      desk.glow.visible = true;
      owned.chair.group.visible = true;
    },
    /** The monitor's screenshot (arrives after the build; null keeps a plain glowing screen). */
    setScreenTexture(texture) {
      if (!texture) return;
      materials.screen.map = texture;
      materials.screen.needsUpdate = true;
      desk.textures.push(texture);
    },
    setStill(on) {
      state.still = Boolean(on);
      pose.setStill(on);
      blink.setStill(on);
      if (state.still) owned.lids.set(0);
      owned.tracker.settle();
    },
    dispose() {
      disposeOwned(owned, materials);
      group.removeFromParent();
    },
  };
}
