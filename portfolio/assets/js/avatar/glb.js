/**
 * GLB helpers for the 3D avatar (avatar/glb-character/): the download (with real progress, started
 * early by avatar/index.js), the lazily imported GLTFLoader, a clip sampled into a fixed base pose, bone rotations given in the
 * body's frame (whatever the rig's local axes are), and disposal.
 * The shipped model uses KHR_mesh_quantization and EXT_texture_webp, both read natively by three.js.
 */
import * as THREE from 'three';
import { fetchBlob, messageOf, resolveAsset } from './support.js';

const LOADER_FALLBACK = '../../vendor/three/examples/jsm/loaders/GLTFLoader.js';

async function importGltfLoader() {
  try {
    return await import('three/addons/loaders/GLTFLoader.js');
  } catch (first) {
    try {
      return await import(new URL(LOADER_FALLBACK, import.meta.url).href);
    } catch {
      throw new Error(`GLTFLoader could not be loaded (${messageOf(first)})`);
    }
  }
}

/**
 * Start downloading the .glb right away (real progress), before the modules that use it load.
 * @param {string} path site-relative path of the .glb
 * @param {{ baseUrl?: string, onProgress?: (fraction: number) => void, signal?: AbortSignal }} [opts]
 * @returns {{ url: string, bytes: Promise<ArrayBuffer> }}
 */
export function fetchGlb(path, { baseUrl, onProgress = () => {}, signal } = {}) {
  const url = resolveAsset(path, baseUrl);
  const bytes = fetchBlob(url, onProgress, signal).then((blob) => blob.arrayBuffer());
  bytes.catch(() => {}); // whoever awaits it handles the error; never an unhandled rejection
  return { url, bytes };
}

/**
 * @param {{ url: string, bytes: Promise<ArrayBuffer> }} source from fetchGlb()
 * @returns {Promise<{ scene: THREE.Group, animations: THREE.AnimationClip[] }>}
 */
export async function parseGlb(source) {
  const [{ GLTFLoader }, buffer] = await Promise.all([importGltfLoader(), source.bytes]);
  let gltf;
  try {
    gltf = await new GLTFLoader().parseAsync(buffer, source.url.slice(0, source.url.lastIndexOf('/') + 1));
  } catch (error) {
    throw new Error(`GLB could not be read: ${messageOf(error)}`);
  }
  const scene = gltf.scene || (gltf.scenes && gltf.scenes[0]);
  if (!scene) throw new Error('GLB has no scene');
  return { scene, animations: Array.isArray(gltf.animations) ? gltf.animations : [] };
}

/**
 * Sample a clip once at `time` and keep that pose: restore() puts every bone back on it (call it
 * first each frame, before any procedural rotation is added). The bones are left in their bind
 * pose until the first restore().
 */
export function createBasePose(model, clip, time) {
  const bones = [];
  model.traverse((node) => { if (node.isBone) bones.push(node); });
  const save = () => bones.map((bone) => ({ bone, p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone() }));
  let saved;
  if (clip) {
    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(Math.min(Math.max(0, time), clip.duration));
    saved = save();
    action.stop(); // puts the bind pose back
    mixer.uncacheRoot(model);
  } else {
    saved = save();
  }
  return {
    restore() {
      for (let i = 0; i < saved.length; i += 1) {
        const { bone, p, q, s } = saved[i];
        bone.position.copy(p);
        bone.quaternion.copy(q);
        bone.scale.copy(s);
      }
    },
  };
}

const parentQ = new THREE.Quaternion();
const frameQ = new THREE.Quaternion();
const delta = new THREE.Quaternion();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Point a bone absolutely: its orientation in `frame` becomes `rest` (captured with captureIn)
 * turned by (pitch, yaw, roll) in the frame's axes, whatever the bones above it do.
 */
export function aimBone(bone, frame, rest, pitch, yaw, roll = 0) {
  if (!bone || !bone.parent) return;
  frame.getWorldQuaternion(frameQ);
  delta.setFromEuler(euler.set(pitch, yaw, roll));
  frameQ.multiply(delta).multiply(rest); // the wanted world rotation
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(frameQ));
}

/** A node's current rotation expressed in `frame` (frame^-1 * node). */
export function captureIn(node, frame) {
  frame.updateWorldMatrix(true, true);
  const q = node.getWorldQuaternion(new THREE.Quaternion());
  return frame.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q);
}

export function collectTextures(model) {
  const textures = new Set();
  model.traverse((node) => {
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => { if (value && value.isTexture) textures.add(value); });
    });
  });
  return [...textures];
}

/** Geometries, materials, textures and skeleton bone textures of a loaded model. */
export function disposeModel(model) {
  model.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.isSkinnedMesh && node.skeleton) node.skeleton.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => { if (value && value.isTexture) value.dispose(); });
      material.dispose();
    });
  });
  model.removeFromParent();
}
