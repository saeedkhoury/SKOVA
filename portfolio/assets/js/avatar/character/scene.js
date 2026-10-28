/**
 * The desk scene's per-frame behaviour, shared by the code-built character and the GLB avatar:
 * the desk set rising and fading in (screenRise / screenOpacity), and the monitor's light turning
 * on and flickering like the reference (emissive #c8bfff, a new random intensity every ~0.2 s,
 * tweened over up to 0.6 s after up to 0.1 s). The point light follows the flicker.
 */
const SCREEN = Object.freeze({ max: 8, gateFrom: 0.8, base: 0.56, perEmissive: 0.04, glow: 0.09 });
const FLICKER = Object.freeze({ every: 0.2, maxDuration: 0.6, maxDelay: 0.1 });
const VISIBLE = 0.002;

const unit = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export function createFlicker() {
  const f = { value: 0, from: 0, to: 0, t: 0, duration: 0.3, delay: 0, sinceSample: 0, sample: Math.random() };
  return {
    /** The reference: every 0.2 s a new random n; tweens emissive to 8n over 0.6*rand s after 0.1*rand s. */
    step(dt, on) {
      if (!on) {
        f.value = 0;
        f.t = 0;
        f.from = 0;
        f.to = 0;
        return 0;
      }
      f.sinceSample += dt;
      if (f.sinceSample >= FLICKER.every) {
        f.sinceSample = 0;
        f.sample = Math.random();
      }
      f.t += dt;
      if (f.t >= f.delay + f.duration) {
        f.from = f.value;
        f.to = SCREEN.max * f.sample;
        f.duration = Math.max(0.05, FLICKER.maxDuration * Math.random());
        f.delay = FLICKER.maxDelay * Math.random();
        f.t = 0;
      }
      const k = unit((f.t - f.delay) / f.duration);
      f.value = f.from + (f.to - f.from) * k;
      return f.value;
    },
  };
}

/**
 * Desk set: rises from `drop` (model units) as params.screenRise goes 0 -> 1, fades with
 * params.screenOpacity. Returns the opacity.
 */
export function applyDesk(desk, materials, params, drop) {
  const rise = unit(params.screenRise);
  const opacity = unit(params.screenOpacity);
  desk.group.position.set(0, drop.y * (1 - rise), drop.z * (1 - rise));
  desk.group.visible = opacity > VISIBLE;
  materials.deskSet.forEach((m) => { m.opacity = opacity; });
  return opacity;
}

/** Monitor screen and glow; returns the emissive level the point light should follow. */
export function applyScreen(desk, materials, params, emissive) {
  const on = unit(params.screenLight);
  const level = SCREEN.base + SCREEN.perEmissive * emissive;
  materials.screen.opacity = on;
  materials.screen.color.setRGB(level, level * 0.97, level * 1.04);
  materials.glowSprite.opacity = on * emissive * SCREEN.glow;
  desk.glow.visible = on > VISIBLE;
  const gate = unit((on - SCREEN.gateFrom) / (1 - SCREEN.gateFrom));
  return emissive * gate;
}

/** One frame of the desk scene: desk, flicker, screen. Returns the point light's emissive. */
export function stepDeskScene({ desk, materials, params, flicker, drop, dt }) {
  const deskOpacity = applyDesk(desk, materials, params, drop);
  const emissive = flicker.step(dt, deskOpacity > VISIBLE && params.screenLight > VISIBLE);
  return applyScreen(desk, materials, params, emissive);
}
