/**
 * The glass screen that rises beside the portrait in "What I do": a thin rounded
 * panel with a lavender edge glow showing a project screenshot (soft scanlines and
 * vignette), a soft light haze behind it, and a flickering light that also washes
 * the near side of the portrait (relief uScreenLight).
 * Driven by stage.params: screenRise, screenOpacity, screenLight.
 */
import * as THREE from 'three';

// The panel matches the 16:10 screenshot. It sits in front of his chest on the image-right
// side (the side his body turns toward), angled toward him so the viewer still sees the page.
// Sizes are world units for a head 0.67 units tall (the portrait); placeFor(frame) rescales
// the panel to the subject's head and places it relative to it, so any GLB size works too.
const PANEL = Object.freeze({ width: 1.44, height: 0.9, radius: 0.05, bezel: 0.024 });
const REF_HEAD = 0.67;
// Offsets in head heights: x from the head's centre line, y from the chin, z from the head depth.
// size scales the panel against the head (1 = the sizes above), so it fits between him and the cards.
const PLACE = Object.freeze({ x: 1.25, y: -0.55, z: 1.0, drop: 4.3, yaw: -0.55, tilt: -0.06, size: 0.8 });
const HALO_SCALE = Object.freeze({ x: 2.0, y: 2.4 });
const LIGHT_OFFSET = 0.25; // the light source sits this far in front of the glass (portrait units)
const FLICKER = Object.freeze({ minStep: 0.1, maxStep: 0.6, smooth: 12, floor: 0.45 });
const COLORS = Object.freeze({ glow: 0xc8bfff, edge: 0xc2a4ff });

const ROUND_BOX_GLSL = /* glsl */ `
float sdRoundBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
`;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PANEL_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec2 uSize;
uniform float uRadius;
uniform float uBezel;
uniform float uOpacity;
uniform float uLight;
uniform float uTime;
uniform vec3 uGlow;
uniform vec3 uEdge;
varying vec2 vUv;
${ROUND_BOX_GLSL}
const float SCANLINES = 260.0;

void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = sdRoundBox(p, uSize * 0.5, uRadius);
  float aa = max(fwidth(d), 1e-4);
  float body = 1.0 - smoothstep(-aa, aa, d);
  if (body * uOpacity < 0.003) discard;

  vec2 inner = uSize * 0.5 - uBezel;
  float dIn = sdRoundBox(p, inner, uRadius * 0.6);
  float content = 1.0 - smoothstep(-aa, aa, dIn);
  vec2 suv = p / (inner * 2.0) + 0.5;
  vec3 shot = uHasMap > 0.5 ? texture2D(uMap, suv).rgb : mix(vec3(0.03, 0.02, 0.06), vec3(0.12, 0.08, 0.2), suv.y);
  float scan = 0.93 + 0.07 * sin((suv.y * SCANLINES + uTime * 1.5) * 3.14159);
  float vignette = smoothstep(0.95, 0.3, length((suv - 0.5) * vec2(1.0, 1.3)));
  float power = 0.1 + 0.9 * uLight;
  vec3 screenCol = shot * scan * mix(0.5, 1.0, vignette) * power + uGlow * 0.05 * uLight;

  vec3 glass = vec3(0.025, 0.02, 0.04);
  float edgeGlow = exp(-abs(d) * 110.0) * (0.25 + 1.1 * uLight);
  float sheen = 0.05 * smoothstep(0.25, 0.0, abs(vUv.x - vUv.y * 0.6 - 0.15));
  vec3 color = mix(glass, screenCol, content) + uEdge * edgeGlow + vec3(sheen);
  float alpha = body * uOpacity * mix(0.78, 1.0, content);
  vec3 encoded = linearToOutputTexel(vec4(color, 1.0)).rgb;
  gl_FragColor = vec4(encoded * alpha, alpha);
}
`;

const HALO_FRAGMENT = /* glsl */ `
uniform vec2 uSize;
uniform vec2 uPanel;
uniform float uIntensity;
uniform vec3 uGlow;
varying vec2 vUv;
${ROUND_BOX_GLSL}
const float FALLOFF = 6.0;
const float STRENGTH = 0.38;
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = max(sdRoundBox(p, uPanel * 0.5, 0.06), 0.0);
  // Window the glow so it reaches exactly 0 before the plane's edges (no visible rectangle).
  float edgeFade = 1.0 - smoothstep(0.55, 0.98, length((vUv - 0.5) * 2.0));
  float g = exp(-d * FALLOFF) * edgeFade * uIntensity * STRENGTH;
  if (g < 0.002) discard;
  vec3 encoded = linearToOutputTexel(vec4(uGlow, 1.0)).rgb;
  gl_FragColor = vec4(encoded * g, g);
}
`;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

function panelMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uHasMap: { value: texture ? 1 : 0 },
      uSize: { value: new THREE.Vector2(PANEL.width, PANEL.height) },
      uRadius: { value: PANEL.radius },
      uBezel: { value: PANEL.bezel },
      uOpacity: { value: 0 },
      uLight: { value: 0 },
      uTime: { value: 0 },
      uGlow: { value: new THREE.Color(COLORS.glow) },
      uEdge: { value: new THREE.Color(COLORS.edge) },
    },
    vertexShader: VERTEX,
    fragmentShader: PANEL_FRAGMENT,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function haloMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: new THREE.Vector2(PANEL.width * HALO_SCALE.x, PANEL.height * HALO_SCALE.y) },
      uPanel: { value: new THREE.Vector2(PANEL.width, PANEL.height) },
      uIntensity: { value: 0 },
      uGlow: { value: new THREE.Color(COLORS.glow) },
    },
    vertexShader: VERTEX,
    fragmentShader: HALO_FRAGMENT,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/** Screenshot texture for the panel (sRGB, mipmapped). */
export function makeScreenTexture(image, maxAnisotropy = 1) {
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  texture.needsUpdate = true;
  return texture;
}

/**
 * @param {{ texture: THREE.Texture | null }} opts
 */
export function createScreen({ texture = null } = {}) {
  const panelGeometry = new THREE.PlaneGeometry(PANEL.width, PANEL.height);
  const haloGeometry = new THREE.PlaneGeometry(PANEL.width * HALO_SCALE.x, PANEL.height * HALO_SCALE.y);
  const panelMat = panelMaterial(texture);
  const haloMat = haloMaterial();
  const panel = new THREE.Mesh(panelGeometry, panelMat);
  const halo = new THREE.Mesh(haloGeometry, haloMat);
  panel.renderOrder = 2;
  halo.renderOrder = 1;
  halo.position.z = -0.02;
  const group = new THREE.Group();
  group.name = 'glass-screen';
  group.rotation.set(PLACE.tilt, PLACE.yaw, 0, 'YXZ');
  group.add(halo, panel);
  group.visible = false;

  const lightPosition = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const anchor = new THREE.Vector3(PLACE.x * REF_HEAD, PLACE.y * REF_HEAD, PLACE.z * REF_HEAD);
  const layout = { drop: PLACE.drop * REF_HEAD, lightOffset: LIGHT_OFFSET };
  const flicker = { value: 0, target: 0, timer: 0 };
  const api = { group, lightPosition, lightIntensity: 0, textures: texture ? [texture] : [] };

  /** Size and place the panel for a subject: frame = { top, bottom, centerX, z } of its head. */
  api.placeFor = (frame) => {
    const head = Math.max(1e-3, frame.top - frame.bottom);
    const k = (head / REF_HEAD) * PLACE.size;
    anchor.set(frame.centerX + PLACE.x * head, frame.bottom + PLACE.y * head, frame.z + PLACE.z * head);
    layout.drop = PLACE.drop * head;
    layout.lightOffset = LIGHT_OFFSET * k;
    group.scale.setScalar(k);
  };

  function stepFlicker(dt, on) {
    if (!on) {
      flicker.value = 0;
      flicker.timer = 0;
      return;
    }
    flicker.timer -= dt;
    if (flicker.timer <= 0) {
      flicker.target = Math.random();
      flicker.timer = FLICKER.minStep + Math.random() * (FLICKER.maxStep - FLICKER.minStep);
    }
    flicker.value += (flicker.target - flicker.value) * (1 - Math.exp(-dt * FLICKER.smooth));
  }

  /** Per-frame update (no allocations). */
  api.update = (dt, time, params) => {
    const opacity = clamp01(params.screenOpacity);
    const light = clamp01(params.screenLight);
    const rise = easeOutCubic(clamp01(params.screenRise));
    group.visible = opacity > 0.002 && rise > 0.001;
    group.position.set(anchor.x, anchor.y - (1 - rise) * layout.drop, anchor.z);
    stepFlicker(dt, group.visible && light > 0.001);
    const intensity = light * (FLICKER.floor + (1 - FLICKER.floor) * flicker.value);
    panelMat.uniforms.uOpacity.value = opacity;
    panelMat.uniforms.uLight.value = intensity;
    panelMat.uniforms.uTime.value = time;
    haloMat.uniforms.uIntensity.value = intensity * opacity;
    group.updateMatrixWorld(true);
    normal.set(0, 0, 1).applyQuaternion(group.quaternion);
    lightPosition.copy(group.position).addScaledVector(normal, layout.lightOffset);
    api.lightIntensity = group.visible ? intensity * opacity : 0;
  };

  api.dispose = () => {
    panelGeometry.dispose();
    haloGeometry.dispose();
    panelMat.dispose();
    haloMat.dispose();
    if (texture) texture.dispose();
    group.removeFromParent();
  };
  return api;
}
