/**
 * The painted eyes of saeed-avatar.glb, measured for the blink lids (lids.js). Model space in
 * metres: the bind pose with the model at the origin, x to his left, y up, z forward (where he faces).
 *
 * Each eye is the region between two curves over the corner-to-corner axis:
 *   u = (p - center) . axis / half           -1 at one corner, +1 at the other
 *   v = (p - center) . (axis turned +90deg)  metres up from the axis
 *   top(u)    = sqrt(1 - u^2) * (t0 + t1 u + t2 u^2 + t3 u^3)   (upper lash line)
 *   bottom(u) = -sqrt(1 - u^2) * (b0 + b1 u + b2 u^2 + b3 u^3)  (lower edge of the white)
 * fitted to the painted eye (lash line, white and iris) on an orthographic front render of the
 * texture (0.2 mm per pixel), then grown by `margin` all round so it covers every painted pixel.
 * Points with z < zMin (the back of the head behind the same x, y) are never eyes. `ball` (centre,
 * radius) is the sphere through the face surface across the eye: the closed lid is lit as part of it.
 * Measured and checked with review/avatar-3d/eye-lab.html (overlays, front and 3/4 renders).
 */
export const EYES = Object.freeze([
  Object.freeze({ // his right eye (x < 0)
    center: [-0.0893, 1.4746], axis: [0.99258, 0.12159], half: 0.0403,
    top: [0.00941, -0.00225, 0.00428, 0.00267], bottom: [0.03566, 0.00051, -0.00561, 0.00929], zMin: 0.11,
    ball: [-0.08, 1.4616, 0.1222, 0.042],
  }),
  Object.freeze({ // his left eye
    center: [0.0423, 1.4795], axis: [0.99884, -0.04825], half: 0.04145,
    top: [0.00904, 0.00086, -0.00003, -0.00259], bottom: [0.03401, -0.00263, -0.00245, 0.00086], zMin: 0.13,
    ball: [0.0387, 1.467, 0.1297, 0.047],
  }),
]);

/** Shared lid look (metres): grow the fitted outline by this much; lash line thickness at the middle. */
export const LID = Object.freeze({
  margin: 0.0019,
  lash: 0.0032,
  // skin is sampled this far above the upper lash line, at three points along the eye
  skinAbove: 0.007,
  skinAt: Object.freeze([-0.6, 0, 0.6]),
});
