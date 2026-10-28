/**
 * When the avatar blinks (the lids themselves are drawn by lids.js). Like a person: a blink every
 * 2 to 6 s at random, now and then a quick double blink; each blink closes fast (ease-in), holds
 * for a moment and opens more slowly (ease-out), 155 to 170 ms in all. He also blinks when his
 * head turns quickly (a saccade blink) and as the lights come on. Driven by the stage's elapsed
 * time, so it is frame-rate independent and pauses with the render loop.
 */
const BLINK = Object.freeze({
  close: 0.055,
  hold: Object.freeze([0.015, 0.03]),
  open: 0.085,
  gap: Object.freeze([2, 6]),
  double: 0.16, // chance that a blink is followed by a second one right away
  doubleGap: Object.freeze([0.06, 0.14]),
  rest: 0.4, // no extra blink (head turn, lights) sooner than this after the last one ends
  saccade: 1.6, // head turning faster than this (radians per second) blinks
  saccadeCooldown: 1.5,
  lights: 0.85, // seconds after the lights start coming on
});

const between = ([min, max], random) => min + (max - min) * random();
const easeIn = (t) => t * t * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);

/**
 * @param {{ random?: () => number }} [opts] random: 0..1 source (tests pass a seeded one)
 */
export function createBlink({ random = Math.random } = {}) {
  const state = {
    start: -Infinity, hold: 0, end: -Infinity, next: null, doubleNext: false,
    saccadeAt: -Infinity, still: false, value: 0,
  };

  function begin(time) {
    state.start = time;
    state.hold = between(BLINK.hold, random);
    state.end = time + BLINK.close + state.hold + BLINK.open;
    const second = state.doubleNext;
    state.doubleNext = !second && random() < BLINK.double;
    state.next = state.end + (state.doubleNext ? between(BLINK.doubleGap, random) : between(BLINK.gap, random));
  }

  function curve(time) {
    const t = time - state.start;
    if (t < 0 || time >= state.end) return 0;
    if (t < BLINK.close) return easeIn(t / BLINK.close);
    if (t < BLINK.close + state.hold) return 1;
    return 1 - easeOut((t - BLINK.close - state.hold) / BLINK.open);
  }

  const blinking = (time) => time >= state.start && time < state.end;
  const rested = (time) => time - state.end >= BLINK.rest;

  return {
    /** 0 open .. 1 closed, for this frame. */
    get value() { return state.value; },
    /**
     * @param {number} time seconds (the stage's elapsed time)
     * @param {number} [headSpeed] how fast the head turns (radians per second)
     */
    update(time, headSpeed = 0) {
      if (state.still) {
        state.value = 0;
        return 0;
      }
      // the first blink, or one that was due long ago (a late start over the lit still): not at once
      if (state.next === null || state.next < time - 1) state.next = time + between(BLINK.gap, random) * 0.5;
      // a fast turn right after a blink waits for the rest, and only a turn that blinks starts the cooldown
      const saccade = headSpeed > BLINK.saccade && time - state.saccadeAt > BLINK.saccadeCooldown && rested(time);
      if (!blinking(time) && (time >= state.next || saccade)) {
        if (saccade) state.saccadeAt = time;
        begin(time);
      }
      state.value = curve(time);
      return state.value;
    },
    /** Blink as the lights come on (the intro starts at `time`). */
    lightsOn(time) {
      if (!state.still) state.next = time + BLINK.lights;
    },
    /** Still renders: eyes open, no blinking. */
    setStill(on) {
      state.still = Boolean(on);
      if (state.still) state.value = 0;
    },
  };
}

export { BLINK };
