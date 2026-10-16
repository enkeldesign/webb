// A lap's controls (#1217), recorded beside its trajectory so SPECTATE can show how the
// lap was driven. The trajectory (replay-system.js) alone places the car; this track only
// says what the player was doing. Each control is one bit of a mask, and the lap keeps
// [milliseconds into the lap, mask] each time the mask changes: a few hundred pairs for a
// whole lap. Steering is already in the trajectory's frames, so it is not repeated here.
// Laps recorded before this have no track, and SPECTATE shows no controls for them.
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
  SHIFT_PRESS: 128,
  // This car can SHIFT, so holding GAS shows the SHIFT bubble.
  SHIFT_READY: 256,
  // Steered by tilting the device, not on screen or by keys.
  TILT: 512,
  // The controls were laid out for the left hand.
  LEFT_HANDED: 1024
});

export const REPLAY_INPUTS_VERSION = 1;
const ALL_CONTROLS = 2047;
const readableTracks = new WeakMap();

export function beginReplayInputs(state) {
  state.inputRecording = [];
}

// Rides the replay recorder's step (main.js): one comparison, and a new pair only when
// the controls change. Times share the trajectory's lap clock.
export function recordReplayInputs(state, mask) {
  const changes = state.inputRecording;
  if (!Array.isArray(changes) || state.lapActive !== true) return false;
  const controls = mask & ALL_CONTROLS;
  if (changes.length && changes[changes.length - 1] === controls) return false;
  changes.push(Math.max(0, Math.round((Number(state.lapElapsed) || 0) * 1000)), controls);
  return true;
}

// The track a finished lap keeps, or null when nothing was recorded.
export function lapReplayInputs(state) {
  const changes = state.inputRecording;
  if (!Array.isArray(changes) || changes.length < 2) return null;
  return { version: REPLAY_INPUTS_VERSION, changes };
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
