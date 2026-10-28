/**
 * The typing rhythm, timed from the reference site ("What I do", desktop): bursts of quick key
 * presses ("words", the hands mostly alternating, ~0.1 s apart), short pauses between them, now and
 * then a longer one (a thought), ~6 presses per second overall. A seeded random sequence of
 * strokes laid out on the time line, so the result only depends on the elapsed time (frame-rate
 * independent, the same on every run). Each stroke: the finger lifts, strikes down to the key
 * top, takes the key down with it, holds and lets go.
 *
 * sample(time) gives, per hand and finger, the wanted fingertip height over the key top under it
 * (scene units: the hover height when idle, 0 while it holds a key down) and how far that key is
 * down (0..1), plus the hand's small dip and roll with each strike and its drift between words.
 */
const RHYTHM = Object.freeze({
  word: Object.freeze([3, 8]),
  gap: Object.freeze([0.075, 0.15]),
  pause: Object.freeze([0.14, 0.36]),
  longPause: Object.freeze([0.7, 1.4]),
  longChance: 0.12,
  alternate: 0.68,
  fingers: Object.freeze([0.42, 0.36, 0.22, 0]), // index .. little finger (his short little finger rests)
  drift: Object.freeze([0.14, 0.09]), // the hands move over the keys between words (x, z)
  driftTime: 0.28,
});
/** Phase lengths (seconds) and heights (scene units: 0.01 = 1 mm). */
const STROKE = Object.freeze({ lift: 0.05, strike: 0.032, press: 0.018, hold: 0.022, release: 0.075, height: 0.05 });
const STROKE_END = STROKE.lift + STROKE.strike + STROKE.press + STROKE.hold + STROKE.release;
const AHEAD = 1.5; // seconds of strokes kept ready
const BEHIND = STROKE_END + 0.05;

/** mulberry32: a small seeded random source. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeIn = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t);
const easeOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));

/**
 * One stroke at tau seconds after it starts: [the fingertip's height over the key top under it
 * (the hover at rest, 0 while it holds the key down: it rides the key), key down 0..1, strike
 * envelope 0..1 (for the hand's dip)]. `hover` in scene units.
 */
function strokeAt(tau, hover, out) {
  const { lift, strike, press, hold, release, height } = STROKE;
  let clear = hover;
  let key = 0;
  if (tau < lift) clear = hover + height * easeOut(tau / lift);
  else if (tau < lift + strike) clear = (hover + height) * (1 - easeIn((tau - lift) / strike));
  else if (tau < lift + strike + press) key = smooth((tau - lift - strike) / press);
  else if (tau < lift + strike + press + hold) key = 1;
  else {
    const u = (tau - lift - strike - press - hold) / release;
    key = 1 - smooth(u * 1.6);
    clear = hover * smooth((u - 0.35) / 0.65);
  }
  out[0] = key > 0 ? 0 : clear;
  out[1] = key;
  out[2] = tau >= lift && tau < lift + strike + press + hold + release * 0.5 ? 1 : 0;
  return out;
}

const between = ([a, b], random) => a + (b - a) * random();

function pickFinger(random) {
  let r = random();
  for (let f = 0; f < RHYTHM.fingers.length; f += 1) {
    r -= RHYTHM.fingers[f];
    if (r < 0) return f;
  }
  return 0;
}

/**
 * @param {{ seed?: number, hover: number }} opts hover in scene units
 */
export function createTyping({ seed = 7, hover }) {
  const state = { random: seeded(seed), strokes: [], words: [], until: 0, hand: 0, start: null };
  const fingerOut = [0, 0, 0];

  function addWord(t0) {
    const count = Math.round(between(RHYTHM.word, state.random));
    const drift = [0, 1].map(() => [between([-1, 1], state.random) * RHYTHM.drift[0], between([-1, 1], state.random) * RHYTHM.drift[1]]);
    state.words.push({ t0, drift });
    let t = t0;
    for (let i = 0; i < count; i += 1) {
      if (state.random() < RHYTHM.alternate) state.hand = 1 - state.hand;
      state.strokes.push({ t0: t, hand: state.hand, finger: pickFinger(state.random) });
      t += between(RHYTHM.gap, state.random);
    }
    const long = state.random() < RHYTHM.longChance;
    return t + between(long ? RHYTHM.longPause : RHYTHM.pause, state.random);
  }

  function advance(time) {
    // a fresh schedule at the start, if time goes back, or after a long gap (no burst of old strokes)
    if (state.start === null || time < state.start || time > state.until + AHEAD * 4) {
      state.random = seeded(seed);
      state.strokes = [];
      state.words = [];
      state.start = time;
      state.until = time + 0.4;
    }
    while (state.until < time + AHEAD) state.until = addWord(state.until);
    while (state.strokes.length && state.strokes[0].t0 < time - BEHIND) state.strokes.shift();
    while (state.words.length > 2 && state.words[1].t0 < time - RHYTHM.driftTime) state.words.shift();
  }

  function driftAt(time, hand, axis) {
    const words = state.words;
    let i = words.length - 1;
    while (i > 0 && words[i].t0 > time) i -= 1;
    const now = words[i];
    const before = i > 0 ? words[i - 1].drift[hand][axis] : 0;
    return before + (now.drift[hand][axis] - before) * smooth((time - now.t0) / RHYTHM.driftTime);
  }

  /**
   * @param {number} time seconds
   * @param {Array<{ clear: number[], key: number[], dip: number, roll: number, drift: number[] }>} out per hand
   */
  function sample(time, out) {
    advance(time);
    out.forEach((hand, h) => {
      hand.clear.fill(hover);
      hand.key.fill(0);
      hand.dip = 0;
      hand.roll = 0;
      hand.drift[0] = driftAt(time, h, 0);
      hand.drift[1] = driftAt(time, h, 1);
    });
    for (let i = 0; i < state.strokes.length; i += 1) {
      const s = state.strokes[i];
      const tau = time - s.t0;
      if (tau < 0 || tau >= STROKE_END) continue;
      strokeAt(tau, hover, fingerOut);
      const hand = out[s.hand];
      // strokes are in time order: a finger follows its latest stroke
      hand.clear[s.finger] = fingerOut[0];
      hand.key[s.finger] = fingerOut[1];
      hand.dip = Math.max(hand.dip, fingerOut[2] * Math.sin(Math.PI * Math.min(1, (tau - STROKE.lift) / (STROKE_END - STROKE.lift))));
      hand.roll += fingerOut[2] * (s.finger - 1.5) / 1.5;
    }
    return out;
  }

  return { sample };
}

export { STROKE, RHYTHM };
