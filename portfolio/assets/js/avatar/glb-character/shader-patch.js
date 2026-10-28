/**
 * Small additions to the GLB avatar's own material shader (three.js onBeforeCompile), shared by
 * the blink lids (lids.js) and the finger curl (fingers.js). Each patch brings its uniforms and
 * a list of edits ([stage, anchor, code]: the code goes right after the anchor line). One program
 * for them all (one cache key), and dispose() gives the material back its own hooks.
 */
import * as THREE from 'three';

/** Geometry (pre-skinning) position to `node`'s space, from any bone in the bind pose. */
export function bindToNode(node, mesh) {
  node.updateWorldMatrix(true, false);
  mesh.skeleton.bones[0].updateWorldMatrix(true, false);
  return new THREE.Matrix4().copy(node.matrixWorld).invert()
    .multiply(mesh.skeleton.bones[0].matrixWorld).multiply(mesh.skeleton.boneInverses[0]);
}

function inject(source, anchor, code) {
  if (!source.includes(anchor)) throw new Error(`avatar shader: anchor ${anchor} missing`);
  return source.replace(anchor, `${anchor}\n${code}`);
}

/**
 * @param {THREE.Material} material the skinned mesh's MeshStandardMaterial
 * @param {Array<{ key: string, uniforms: object, edits: Array<['vertex' | 'fragment', string, string]> }>} patches
 * @returns {{ dispose(): void }}
 */
export function patchMaterial(material, patches) {
  if (!material || !material.isMeshStandardMaterial) throw new Error('avatar shader: the avatar needs a standard material');
  const previous = { compile: material.onBeforeCompile, key: material.customProgramCacheKey };
  const key = `glb-avatar:${patches.map((p) => p.key).join('+')}`;
  material.onBeforeCompile = (shader) => {
    patches.forEach((patch) => {
      Object.assign(shader.uniforms, patch.uniforms);
      patch.edits.forEach(([stage, anchor, code]) => {
        if (stage === 'vertex') shader.vertexShader = inject(shader.vertexShader, anchor, code);
        else shader.fragmentShader = inject(shader.fragmentShader, anchor, code);
      });
    });
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
  return {
    dispose() {
      material.onBeforeCompile = previous.compile;
      material.customProgramCacheKey = previous.key;
    },
  };
}
