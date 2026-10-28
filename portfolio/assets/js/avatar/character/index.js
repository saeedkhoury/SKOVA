/**
 * createCharacter(): the code-built clay character of Saeed (no model file). Builds the meshes
 * from distance functions while the loader runs, rigs them, adds the desk set, the
 * lights and the studio environment, and returns a "subject" that avatar/index.js
 * drives with the stage params every frame.
 *
 *   subject.root          everything to add to the scene (character + lights)
 *   subject.environment   PMREM texture for scene.environment
 *   subject.update(dt, time, params, scene)
 *   subject.startIntro(time)  head lifts as the lights come up; blinking 2.5 s later
 *   subject.dispose()
 */
import * as THREE from 'three';
import { createBudget } from './mesher.js';
import { createMaterials } from './materials.js';
import { buildFace } from './face.js';
import { buildBody } from './body.js';
import { buildDesk } from './desk.js';
import { createRig } from './rig.js';
import { createEnvironment, createLights } from './lights.js';
import { createTracker } from './track.js';
import { createAnimator } from './animate.js';
import { createFlicker, stepDeskScene } from './scene.js';

// Model to world: the head (hair top to beard bottom) is ~2.8 model units; at this scale and height
// the verified camera (fov 14.5 at (0, 13.1, 24.7)) shows it at ~47% of a 1440 x 900 viewport,
// with the hair top ~22% from the top (like the reference's bust).
export const PLACEMENT = Object.freeze({ scale: 0.93, y: 1.55 });
// sceneScale shrinks the whole scene around this model height (mid seated figure), so the head
// drops a little under the "What I do" title while the chair legs lift off the bottom edge.
const SCENE_PIVOT_Y = 6.5;
const DESK_DROP = Object.freeze({ y: -10, z: 2 });
const BUDGET_SLICE_MS = 10;
const STEPS = 19; // progress steps: 3 head parts + 15 body parts + finishing

/**
 * @param {{ renderer: THREE.WebGLRenderer, screenTexture?: THREE.Texture | null,
 *   options?: { beard?: boolean, hair?: string, outfit?: 'polo' }, hotspot?: Element | null, touchArea?: Element | null,
 *   onProgress?: (fraction: number) => void }} opts
 */
export async function createCharacter({ renderer, screenTexture = null, options = {}, hotspot = null, touchArea = null, onProgress = () => {} }) {
  if (!renderer) throw new Error('createCharacter needs a renderer');
  const budget = createBudget(BUDGET_SLICE_MS);
  let done = 0;
  const step = () => { done += 1; onProgress(Math.min(1, done / STEPS)); };
  const materials = createMaterials();
  const owned = { geometries: [], env: null, tracker: null, lights: null, desk: null };
  try {
    const rig = createRig();
    const face = await buildFace({ materials, budget, beard: options.beard !== false, hair: options.hair || 'fade', onStep: step });
    owned.geometries.push(...face.geometries);
    face.meshes.forEach((m) => rig.attach('head', m));
    rig.attach('head', face.joints.eyes);
    rig.attach('head', face.joints.lids);
    rig.attach('head', face.joints.brows);
    const body = await buildBody({ rig, materials, budget, onStep: step });
    owned.geometries.push(...body.geometries);
    owned.desk = buildDesk({ materials, screenTexture });
    rig.root.add(owned.desk.group, owned.desk.shadow);
    rig.root.scale.setScalar(PLACEMENT.scale);
    rig.root.position.y = PLACEMENT.y;
    owned.env = createEnvironment(renderer);
    owned.lights = createLights(rig.root);
    owned.tracker = createTracker({ hotspot, touchArea });
    const joints = { ...rig.joints, ...face.joints };
    const animator = createAnimator({ joints, tracker: owned.tracker, desk: owned.desk });
    const flicker = createFlicker();
    const group = new THREE.Group();
    group.name = 'character';
    group.add(rig.root, owned.lights.group);
    step();
    const { tracker, lights, desk, env } = owned;
    return {
      kind: 'character',
      root: group,
      joints,
      environment: env.texture,
      textures: desk.textures,
      update(dt, time, params, scene) {
        rig.root.rotation.set(Number(params.modelPitch) || 0, Number(params.modelYaw) || 0, 0);
        const scale = PLACEMENT.scale * (Number(params.sceneScale) || 1);
        rig.root.scale.setScalar(scale);
        rig.root.position.set(Number(params.sceneX) || 0, PLACEMENT.y + (Number(params.sceneY) || 0) + (PLACEMENT.scale - scale) * SCENE_PIVOT_Y, 0);
        animator.update(dt, time, params);
        const pointEmissive = stepDeskScene({ desk, materials, params, flicker, drop: DESK_DROP, dt });
        lights.update(scene, Math.min(1, Math.max(0, params.light)), Math.min(1, Math.max(0, params.rim)), pointEmissive);
      },
      startIntro(time) { animator.startIntro(time); },
      /** Make the hidden desk set visible for one compile pass (update() hides it again). */
      revealForCompile() {
        desk.group.visible = true;
        desk.glow.visible = true;
      },
      /** The monitor's screenshot (arrives after the build; null keeps a plain glowing screen). */
      setScreenTexture(texture) {
        if (!texture) return;
        materials.screen.map = texture;
        materials.screen.needsUpdate = true;
        desk.textures.push(texture);
      },
      setStill(on) {
        animator.setStill(on);
        tracker.settle();
      },
      dispose() {
        tracker.destroy();
        lights.dispose();
        desk.dispose();
        owned.geometries.forEach((g) => g.dispose());
        env.dispose();
        materials.dispose();
        group.removeFromParent();
      },
    };
  } catch (error) {
    if (owned.tracker) owned.tracker.destroy();
    if (owned.lights) owned.lights.dispose();
    if (owned.desk) owned.desk.dispose();
    owned.geometries.forEach((g) => g.dispose());
    if (owned.env) owned.env.dispose();
    materials.dispose();
    throw error;
  }
}
