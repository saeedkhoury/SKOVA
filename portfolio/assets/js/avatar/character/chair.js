/**
 * The office chair: the seat and back shell (an SDF from body-shapes.js, meshed) on four slim
 * splayed legs. The code-built character meshes the shell with its own body as ambient-occlusion
 * context (body.js); buildChair() makes the whole chair on its own (the GLB avatar sits on it).
 */
import * as THREE from 'three';
import { meshSdf } from './mesher.js';
import { fromMeshData, paint, rod } from './geometry.js';
import { CHAIR_LEGS, boundsFor, chair } from './body-shapes.js';

const LEG = Object.freeze({ top: 0.11, bottom: 0.07, rgb: [0.92, 0.92, 0.92] });
const SHELL = Object.freeze({ cell: 0.16, ao: { step: 0.1, steps: 4, strength: 0.45 } });

/** The four legs as meshes (model space, floor at y = 0). */
export function buildChairLegs(material) {
  return CHAIR_LEGS.map(([top, bottom]) => {
    const geometry = paint(rod(top, bottom, LEG.top, LEG.bottom), LEG.rgb);
    return new THREE.Mesh(geometry, material);
  });
}

/**
 * @param {{ material: THREE.Material, budget?: { tick(): Promise<void> } }} opts
 * @returns {Promise<{ group: THREE.Group, dispose(): void }>}
 */
export async function buildChair({ material, budget }) {
  const [min, max] = boundsFor('chair');
  const data = await meshSdf(chair, { min, max, cell: SHELL.cell, budget, ao: { ...SHELL.ao, sdf: chair } });
  const shell = new THREE.Mesh(fromMeshData(data), material);
  shell.name = 'chair';
  const group = new THREE.Group();
  group.name = 'chair';
  const parts = [shell, ...buildChairLegs(material)];
  group.add(...parts);
  return {
    group,
    dispose() {
      parts.forEach((part) => part.geometry.dispose());
      group.removeFromParent();
    },
  };
}
