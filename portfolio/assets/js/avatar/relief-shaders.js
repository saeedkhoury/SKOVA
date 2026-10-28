/**
 * GLSL for the relief portrait (three.js ShaderMaterial, WebGL2; three adds the
 * #version / precision / built-in uniform prefix).
 *
 * Image space: img = (u, v) with (0,0) at the top-left of the photo, matching
 * saeed-bust.meta.json. Toward the bottom the photo shades into a background-
 * coloured silhouette (still opaque, so it hides the rim glow the way a solid body
 * would), and its last rows dissolve so a pulled-back camera never sees an edge.
 */

const COMMON_GLSL = /* glsl */ `
uniform vec2 uHeadC;      // head ellipse centre (image uv)
uniform vec2 uHeadR;      // head ellipse radii (image uv)
uniform vec2 uNeck;       // x: v where the head weight starts to fall, y: meta.neckV (weight 0 from here down)
uniform vec3 uHead;       // yaw, pitch (+ = look down), roll

vec2 imageCoord(vec2 uv) { return vec2(uv.x, 1.0 - uv.y); }
vec2 textureCoord(vec2 img) { return vec2(img.x, 1.0 - img.y); }

float headWeight(vec2 img) {
  if (img.y >= uNeck.y) return 0.0;
  vec2 d = (img - uHeadC) / uHeadR;
  float radial = 1.0 - smoothstep(1.0, 1.3, length(d));
  float neck = 1.0 - smoothstep(uNeck.x, uNeck.y, img.y);
  return radial * neck;
}

// Ry(yaw) * Rx(pitch) * Rz(roll). +yaw turns the face to the viewer's right, +pitch tips the face down.
mat3 headRotation(vec3 a) {
  float cy = cos(a.x), sy = sin(a.x);
  float cp = cos(a.y), sp = sin(a.y);
  float cr = cos(a.z), sr = sin(a.z);
  mat3 ry = mat3(cy, 0.0, -sy,  0.0, 1.0, 0.0,  sy, 0.0, cy);
  mat3 rx = mat3(1.0, 0.0, 0.0,  0.0, cp, sp,  0.0, -sp, cp);
  mat3 rz = mat3(cr, sr, 0.0,  -sr, cr, 0.0,  0.0, 0.0, 1.0);
  return ry * rx * rz;
}
`;

export const RELIEF_VERTEX = /* glsl */ `
uniform sampler2D uDepth;
uniform vec2 uSize;        // photo width, height (world units)
uniform float uDepthAmp;   // meta.depthScale * height
uniform vec2 uPivot;       // head joint (image uv)
uniform float uPivotZFrac; // joint depth as a fraction of the surface depth there
uniform vec4 uBody;        // x: breath (0..), y: sway angle, z: lean angle, w: lean pivot y
${COMMON_GLSL}

varying vec2 vImg;
varying float vHeadW;
varying vec3 vWorldPos;

const float DEPTH_LOD = 1.0;  // 2x2 depth texels: hides the 8-bit dithering in the mesh
const float TURN_LOD = 2.6;   // the head turns on a smoother copy of the depth: spreads the stretch
const float PIVOT_LOD = 3.0;
const float LEAN_SPAN = 0.9;  // world units over which the lean bend ramps in
const float BREATH_X = 0.35;  // chest widens a third as much as it rises

void main() {
  vec2 img = imageCoord(uv);
  vImg = img;
  vec2 tuv = textureCoord(img);
  float depth = textureLod(uDepth, tuv, DEPTH_LOD).r * uDepthAmp;
  vec3 p = vec3(position.xy, depth);

  float w = headWeight(img);
  vHeadW = w;
  if (w > 0.0) {
    // Rotate the smooth depth about the neck joint and keep the fine detail on top of it, so
    // steep depth at the face outline cannot fold the photo over itself.
    float turnDepth = textureLod(uDepth, tuv, TURN_LOD).r * uDepthAmp;
    float pivotDepth = textureLod(uDepth, vec2(uPivot.x, 1.0 - uPivot.y), PIVOT_LOD).r * uDepthAmp;
    vec3 pivot = vec3((uPivot.x - 0.5) * uSize.x, (0.5 - uPivot.y) * uSize.y, pivotDepth * uPivotZFrac);
    vec3 turned = pivot + headRotation(uHead * w) * (vec3(p.xy, turnDepth) - pivot);
    p = vec3(turned.xy, turned.z + depth - turnDepth);
  }

  // Lean: the upper body bends forward about a horizontal axis at the waist.
  float leanW = smoothstep(uBody.w, uBody.w + LEAN_SPAN, p.y);
  float la = uBody.z * leanW;
  vec2 rel = vec2(p.y - uBody.w, p.z);
  p.y = uBody.w + rel.x * cos(la) - rel.y * sin(la);
  p.z = rel.x * sin(la) + rel.y * cos(la);

  // Breathing and sway, anchored at the photo's bottom edge.
  float bottom = -0.5 * uSize.y;
  float h = p.y - bottom;
  p.y = bottom + h * (1.0 + uBody.x);
  p.x *= 1.0 + uBody.x * BREATH_X * clamp(h, 0.0, 1.0);
  p.x -= h * uBody.y;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const RELIEF_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uDepth;
uniform vec2 uDepthTexel;   // 1 / depth texture size
uniform vec2 uSize;
uniform float uDepthAmp;
uniform mat3 uModelRot;     // model rotation (world)
uniform float uLight;       // lights-on intro, 0..1
uniform float uRim;         // rim strength multiplier, 0..1
uniform vec3 uRimColor;
uniform vec3 uRimColor2;
uniform vec3 uScreenPos;    // world position of the glass screen's light
uniform vec3 uScreenColor;
uniform float uScreenLight; // flickering screen light, 0..1
uniform vec2 uShade;        // image v range over which the photo darkens into the back-lit silhouette
uniform vec2 uDissolve;     // image v range over which the photo's last rows fade out (alpha)
uniform vec3 uShadow;       // silhouette colour (the page background, linear)
uniform vec3 uGrade;        // very light cool grade (multiplier)
${COMMON_GLSL}

varying vec2 vImg;
varying float vHeadW;
varying vec3 vWorldPos;

const float ALPHA_CUT = 0.02;
const float OPAQUE_SCALE = 255.0 / 250.0; // interior alpha is 254: treat >= 250 as fully opaque
const float DARK_LEVEL = 0.003;   // photo exposure with the lights off (linear: encodes to ~4% perceived)
const float NORMAL_SPREAD = 2.5;  // texels; the 8-bit depth is dithered, so take wide differences
const float NORMAL_LOD = 0.75;
const float EDGE_LOD = 3.0;       // blurred alpha (~8 px): marks the silhouette band
const float RIM_OFF = 0.2;        // share of the rim visible while the lights are still off (a faint edge)
const float RIM_GAIN = 0.9;
const float RIM_WRAP = 0.2;
const float RIM_RIGHT = 0.7;      // the right-hand rim light is the weaker one
const vec3 RIM_DIR_L = vec3(-0.80, 0.50, -0.33);
const vec3 RIM_DIR_R = vec3(0.82, 0.42, -0.38);
const float SCREEN_WRAP = 0.2;
const float SCREEN_FALLOFF = 0.45;
const float SCREEN_DIFFUSE = 1.7;
const float SCREEN_SHEEN = 0.05;  // faint lavender sheen even on the black jacket
const float SCREEN_EDGE = 0.6;

vec3 depthNormal(vec2 uv) {
  vec2 e = uDepthTexel * NORMAL_SPREAD;
  float l = textureLod(uDepth, uv - vec2(e.x, 0.0), NORMAL_LOD).r;
  float r = textureLod(uDepth, uv + vec2(e.x, 0.0), NORMAL_LOD).r;
  float b = textureLod(uDepth, uv - vec2(0.0, e.y), NORMAL_LOD).r;
  float t = textureLod(uDepth, uv + vec2(0.0, e.y), NORMAL_LOD).r;
  float dzdx = (r - l) * uDepthAmp / (2.0 * e.x * uSize.x);
  float dzdy = (t - b) * uDepthAmp / (2.0 * e.y * uSize.y);
  return normalize(vec3(-dzdx, -dzdy, 1.0));
}

void main() {
  vec2 img = vImg;
  vec2 tuv = textureCoord(img);
  vec4 tex = texture2D(uMap, tuv);
  float a = min(1.0, tex.a * OPAQUE_SCALE) * (1.0 - smoothstep(uDissolve.x, uDissolve.y, img.y));
  if (a < ALPHA_CUT) discard;

  vec3 n = depthNormal(tuv);
  if (vHeadW > 0.0) n = headRotation(uHead * vHeadW) * n;
  n = normalize(uModelRot * n);
  vec3 v = normalize(cameraPosition - vWorldPos);
  float shade = smoothstep(uShade.x, uShade.y, img.y);

  // Rim: lavender light from behind-left and behind-right, only in the silhouette band.
  float edge = 1.0 - smoothstep(0.5, 0.98, textureLod(uMap, tuv, EDGE_LOD).a);
  float facing = 1.0 - clamp(dot(n, v), 0.0, 1.0);
  float rimL = clamp(dot(n, normalize(RIM_DIR_L)) + RIM_WRAP, 0.0, 1.0);
  float rimR = clamp(dot(n, normalize(RIM_DIR_R)) + RIM_WRAP, 0.0, 1.0);
  vec3 rim = (uRimColor * rimL + uRimColor2 * rimR * RIM_RIGHT) * edge * (0.3 + 0.7 * facing);
  rim *= RIM_GAIN * mix(RIM_OFF, 1.0, uLight) * mix(0.5, 1.0, uRim) * (1.0 - shade);

  vec3 albedo = tex.rgb;
  vec3 lit = albedo * mix(DARK_LEVEL, 1.0, uLight) * mix(vec3(1.0), uGrade, uLight);

  // Screen light: a soft side light from the glass panel, strongest on the near side.
  vec3 toScreen = uScreenPos - vWorldPos;
  float dist2 = max(dot(toScreen, toScreen), 1e-4);
  float lambert = clamp((dot(n, toScreen * inversesqrt(dist2)) + SCREEN_WRAP) / (1.0 + SCREEN_WRAP), 0.0, 1.0);
  float screenTerm = uScreenLight * lambert / (1.0 + SCREEN_FALLOFF * dist2);
  vec3 screenLit = uScreenColor * screenTerm * (albedo * SCREEN_DIFFUSE + SCREEN_SHEEN + edge * SCREEN_EDGE) * (1.0 - shade);

  vec3 color = mix(lit, uShadow, shade) + rim + screenLit;
  vec3 encoded = linearToOutputTexel(vec4(color, 1.0)).rgb;
  gl_FragColor = vec4(encoded * a, a);
}
`;
