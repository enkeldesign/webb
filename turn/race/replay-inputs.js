// What a lap keeps besides its trajectory (#1217), so SPECTATE can show how it was driven.
// The trajectory (replay-system.js) alone places the car; these only say what the player
// was doing and how the lap was set up. Laps recorded before them have neither, and
// SPECTATE shows no controls for them.
//
// inputs: each control is one bit of a mask, kept as [milliseconds into the lap, mask]
// each time the mask changes: a few hundred pairs for a whole lap. Steering is already in
// the trajectory's frames, so it is not repeated here.
// setup: how the lap was set up as it began, beside the car the lap already names.
// controls: how it was steered and the side the drive pad was on. build: the car's setup:
// its SHIFT profile, and the perks it ran (#1219). More parts can join either under the
// same version, and a lap without them simply has none; the version changes only when a
// part already kept changes meaning.
import { getVehiclePerk } from '../vehicle/perks.js';

export const REPLAY_CONTROL = Object.freeze({
  GAS: 1,
  DRIFT: 2,
  BOOST: 4,
  BRAKE: 8,
  REVERSE: 16,
  LOCK: 32,
  // SHIFT is on.
  SHIFT: 64,
  // The thumb is in the SHIFT bubble, toggling it.
  SHIFT_PRESS: 128
});

export const REPLAY_INPUTS_VERSION = 1;
export const REPLAY_SETUP_VERSION = 1;
const ALL_CONTROLS = 255;
const readableTracks = new WeakMap();

export function beginReplayInputs(state) {
  state.inputRecording = [];
  state.lapSetup = null;
}

// Rides the replay recorder's step (main.js): one comparison, and a new pair only when
// the controls change. Times share the trajectory's lap clock. The lap's setup is taken
// once, with its first controls.
export function recordReplayInputs(state, mask, setup = null) {
  const changes = state.inputRecording;
  if (!Array.isArray(changes) || state.lapActive !== true) return false;
  const controls = mask & ALL_CONTROLS;
  if (changes.length) {
    if (changes[changes.length - 1] === controls) return false;
  } else if (typeof setup === 'function') {
    state.lapSetup = setup();
  }
  changes.push(Math.max(0, Math.round((Number(state.lapElapsed) || 0) * 1000)), controls);
  return true;
}

const perkId = (id) => (getVehiclePerk(id) ? id : '');

// The perks a lap ran, or null when it ran none: the car's own once unlocked, and the
// perk installed beside it (perk-runtime.js). What ran then, never the car's setup now.
function lapPerks(perks) {
  const original = perkId(perks?.original);
  const installed = perkId(perks?.installed);
  if (!original && !installed) return null;
  return { ...(original ? { original } : {}), ...(installed ? { installed } : {}) };
}

// A lap's setup as the replay keeps it. steering: 'tilt', or 'screen' for on-screen
// steering and keys. hand: the drive pad's side. shift: the car's SHIFT profile (the
// stats it reduces and by how much), when it can SHIFT. perks: the perks running as the
// lap began.
export function replaySetup({ steering = 'screen', hand = 'right', shift = null, perks = null } = {}) {
  const build = {};
  if (Array.isArray(shift?.reducedStats)) {
    build.shift = {
      reducedStats: shift.reducedStats.filter((key) => typeof key === 'string'),
      amount: Number(shift.amount) || 1
    };
  }
  const ran = lapPerks(perks);
  if (ran) build.perks = ran;
  return {
    version: REPLAY_SETUP_VERSION,
    controls: { steering: steering === 'tilt' ? 'tilt' : 'screen', hand: hand === 'left' ? 'left' : 'right' },
    build
  };
}

// The track a finished lap keeps, or null when nothing was recorded.
export function lapReplayInputs(state) {
  const changes = state.inputRecording;
  if (!Array.isArray(changes) || changes.length < 2) return null;
  return { version: REPLAY_INPUTS_VERSION, changes };
}

// The setup a finished lap keeps, or null when none was taken.
export function lapReplaySetup(state) {
  const setup = state.lapSetup;
  return setup && typeof setup === 'object' ? setup : null;
}

// A lap's track checked once: the changes when SPECTATE can trust them, else null.
export function readableReplayInputs(lap) {
  const inputs = lap?.inputs;
  if (!inputs || typeof inputs !== 'object') return null;
  if (readableTracks.has(inputs)) return readableTracks.get(inputs);
  const changes = inputs.version === REPLAY_INPUTS_VERSION && Array.isArray(inputs.changes)
    ? inputs.changes
    : null;
  let readable = changes && changes.length >= 2 && changes.length % 2 === 0 ? changes : null;
  for (let index = 0; readable && index < changes.length; index += 2) {
    const time = changes[index];
    const mask = changes[index + 1];
    if (!Number.isInteger(time) || time < 0 || (index && time < changes[index - 2])
      || !Number.isInteger(mask) || mask < 0 || mask > ALL_CONTROLS) readable = null;
  }
  readableTracks.set(inputs, readable);
  return readable;
}

// What SPECTATE shows of a lap's setup, in the setup's own shape. A part a lap does not
// have reads as the default and parts this release does not know are left alone, so laps
// from before and after a part joins both read. A setup of another version reads as none.
export function readableReplaySetup(lap) {
  const setup = lap?.setup?.version === REPLAY_SETUP_VERSION ? lap.setup : {};
  const controls = setup.controls || {};
  const shift = setup.build?.shift;
  const perks = lapPerks(setup.build?.perks);
  return {
    controls: {
      steering: controls.steering === 'tilt' ? 'tilt' : 'screen',
      hand: controls.hand === 'left' ? 'left' : 'right'
    },
    build: {
      shift: Array.isArray(shift?.reducedStats) ? shift : null,
      perks: perks ? { original: perks.original || '', installed: perks.installed || '' } : null
    }
  };
}

// The controls held at a moment of the lap (seconds in), from its checked changes.
export function replayControlsAt(changes, seconds) {
  const time = (Number(seconds) || 0) * 1000;
  let low = 0;
  let high = changes.length / 2 - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (changes[middle * 2] <= time) low = middle;
    else high = middle - 1;
  }
  return changes[low * 2 + 1];
}
