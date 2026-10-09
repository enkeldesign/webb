// Tutorial steering help (#1133): the stronger, deliberate assist for players who cannot
// steer on their own. Chosen in SETTINGS (also reachable from PAUSED mid-lap), it steers
// TURN TUTORIAL's teaching lap through the bends while the player keeps GAS, BOOST and
// DRIFT. It is a bounded tutorial assist, not a driver: it aims at a point a little
// further along the road, and input/motion.js blends the player's own steering in.
export const STEERING_HELP_STORAGE_KEY = 'turn-tutorial-steering-help-v1';
export const STEERING_HELP_CHANGED_EVENT = 'turn:steering-help-changed';

const GAIN = 4;
let sessionChoice = null;

function storageOf(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

export function loadSteeringHelp(storage) {
  try {
    const stored = storageOf(storage)?.getItem(STEERING_HELP_STORAGE_KEY);
    if (stored === 'on' || stored === 'off') return stored === 'on';
  } catch (_) {}
  return sessionChoice === true;
}

// Without storage the choice still holds for this visit.
export function saveSteeringHelp(on, storage, events = globalThis) {
  const enabled = on === true;
  sessionChoice = enabled;
  try {
    storageOf(storage)?.setItem(STEERING_HELP_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (_) {}
  events?.dispatchEvent?.(new CustomEvent(STEERING_HELP_CHANGED_EVENT, { detail: Object.freeze({ enabled }) }));
  return enabled;
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

// The steering (-1..1, TURN's yaw convention) that points the car at the road ahead,
// or null when there is nothing to aim at.
export function steeringHelpTarget({ state, samples }) {
  const count = samples?.length || 0;
  const index = state?.nearestTrackIndex;
  if (!count || !Number.isInteger(index) || !samples[index]?.point || !state.position) return null;
  const forwardSpeed = (Number(state.velocity?.x) || 0) * Math.sin(state.heading)
    + (Number(state.velocity?.z) || 0) * Math.cos(state.heading);
  if (forwardSpeed < 0) return null;

  const lookAhead = Math.min(30, Math.max(10, 8 + forwardSpeed * 0.45));
  let aim = samples[index].point;
  let travelled = 0;
  for (let step = 1; step < count && travelled < lookAhead; step += 1) {
    const next = samples[(index + step) % count].point;
    travelled += Math.hypot(next.x - aim.x, next.z - aim.z);
    aim = next;
  }
  const wanted = Math.atan2(aim.x - state.position.x, aim.z - state.position.z);
  return Math.max(-1, Math.min(1, wrapAngle(wanted - state.heading) * GAIN));
}
