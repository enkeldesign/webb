// TURN's race clock (#985): performance.now() without the time a race spent paused.
//
// Everything that times a race reads this clock: the frame loop (and through it lap
// times, rivals, ghosts and scoring), the drive controls' timestamps and the scoring
// windows. A pause freezes it and a resume thaws it, so the paused interval never
// reaches race time and there is nothing to shift afterwards. Outside a pause it is
// performance.now() less the pauses so far.
//
// Modules import this file under different build URLs, so the clock lives on
// globalThis: every copy of the module reads the same one.

const KEY = Symbol.for('turn.race-clock');

function clock() {
  globalThis[KEY] ||= { pausedTotal: 0, frozenAt: null, last: -Infinity };
  return globalThis[KEY];
}

function wallNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

// Race time now, or for a wall-clock timestamp such as a frame's. It never runs
// backwards: a frame stamped just before a resume reads as the moment of the pause.
export function raceNow(wall = wallNow()) {
  const state = clock();
  const time = (state.frozenAt ?? wall) - state.pausedTotal;
  state.last = Math.max(state.last, time);
  return state.last;
}

export function freezeRaceClock() {
  const state = clock();
  if (state.frozenAt === null) state.frozenAt = wallNow();
}

// Returns how long the clock was frozen, in milliseconds.
export function thawRaceClock() {
  const state = clock();
  if (state.frozenAt === null) return 0;
  const paused = Math.max(0, wallNow() - state.frozenAt);
  state.pausedTotal += paused;
  state.frozenAt = null;
  return paused;
}

export function raceClockFrozen() {
  return clock().frozenAt !== null;
}
