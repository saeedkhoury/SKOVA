/**
 * The character's skeleton: plain Object3D joints with readable names, built at the
 * rest (typing) pose. Every rest rotation is zero, so a joint's place in model space is
 * just the sum of the positions above it, and meshes modelled in model space are moved
 * into a joint by subtracting that joint's model position.
 *
 *   root > hips > spine > chest > neck > head (> eyes, lids, brows)
 *                         chest > shoulderL/R > upperArmL/R > forearmL/R > handL/R
 */
import * as THREE from 'three';
import { POSE, sided } from './body-shapes.js';

const SIDES = Object.freeze([['L', 1], ['R', -1]]);

function joint(name, modelPos, parent, parentModelPos) {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.set(
    modelPos[0] - parentModelPos[0],
    modelPos[1] - parentModelPos[1],
    modelPos[2] - parentModelPos[2],
  );
  node.userData.model = modelPos.slice();
  node.userData.rest = node.position.clone();
  parent.add(node);
  return node;
}

/**
 * @returns {{ root: THREE.Group, joints: Record<string, THREE.Object3D>,
 *   attach(name: string, object: THREE.Object3D, geometry?: THREE.BufferGeometry): void }}
 */
export function createRig() {
  const root = new THREE.Group();
  root.name = 'root';
  root.rotation.order = 'XYZ';
  const origin = [0, 0, 0];
  const j = {};
  j.root = root;
  j.hips = joint('hips', POSE.hips, root, origin);
  j.spine = joint('spine', POSE.spine, j.hips, POSE.hips);
  j.chest = joint('chest', POSE.chest, j.spine, POSE.spine);
  j.neck = joint('neck', POSE.neck, j.chest, POSE.chest);
  j.head = joint('head', POSE.head, j.neck, POSE.neck);
  SIDES.forEach(([suffix, s]) => {
    const shoulder = sided(POSE.shoulder, s);
    const upper = sided(POSE.upperArm, s);
    const fore = sided(POSE.forearm, s);
    const wrist = sided(POSE.hand, s);
    j[`shoulder${suffix}`] = joint(`shoulder${suffix}`, shoulder, j.chest, POSE.chest);
    j[`upperArm${suffix}`] = joint(`upperArm${suffix}`, upper, j[`shoulder${suffix}`], shoulder);
    j[`forearm${suffix}`] = joint(`forearm${suffix}`, fore, j[`upperArm${suffix}`], upper);
    j[`hand${suffix}`] = joint(`hand${suffix}`, wrist, j[`forearm${suffix}`], fore);
  });

  return {
    root,
    joints: j,
    /**
     * Put an object under a joint. A geometry modelled in model space is moved into the
     * joint's space; objects already built in joint space pass no geometry.
     */
    attach(name, object, geometry = null) {
      const target = j[name];
      if (!target) throw new Error(`unknown joint ${name}`);
      if (geometry && target !== root) {
        const m = target.userData.model;
        geometry.translate(-m[0], -m[1], -m[2]);
        geometry.computeBoundingSphere();
      }
      target.add(object);
    },
  };
}
