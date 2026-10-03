// Tilt steering's straight ahead (#1032). Device rotation steers relative to a neutral
// pose: the race start, a screen rotation, switching to device rotation and
// RECALIBRATE each take the phone as it is held now. Every one of them says so in the
// GO! pill (#message, a live status, so screen readers hear it) with one wording, and
// Drive By Ear adds a short level cue.

export const HOLD_PHONE_MESSAGE = 'HOLD THE PHONE THE WAY YOU WANT TO DRIVE';
export const STEERING_CENTRED_MESSAGE = 'STEERING CENTRED';

// Race start: the provisional neutral comes at once, as before; the final one waits
// for the phone to keep still, so the player has time to read the hint and settle.
export const START_PROVISIONAL_MS = 220;
const START_READ_MS = 900;
const START_GIVE_UP_MS = 1600;
const START_SAMPLE_MS = 100;
const STEADY_SAMPLES = 3;
const STEADY_RAD = 0.02;
const STILL_SPEED = 0.5;

export function centreTiltSteering(state, { horizon = false } = {}) {
  state.neutralRoll = state.targetRoll;
  state.roll = state.targetRoll;
  if (horizon) state.horizonRollReference = state.targetRoll;
  state.neutralPitch = state.targetPitch;
  state.pitch = state.targetPitch;
  state.steering = 0;
  state.steeringEngaged = false;
}

export function announceSteeringCentred({ showMessage, environment = globalThis } = {}) {
  showMessage?.(STEERING_CENTRED_MESSAGE);
  if (environment.__turnDriveByEarEnabled !== false) environment.__turnAudio?.cue?.('steering-centred');
}

// Runs the race-start sequence and returns a cancel function. Never holds the race:
// the car can drive from the first frame. Once it moves, the neutral it has stays.
export function startTiltCentring({ state, showMessage, setTimer, clearTimer = () => {}, environment = globalThis }) {
  let cancelled = false;
  let timer = 0;
  let steady = 0;
  let last = null;
  let elapsed = START_PROVISIONAL_MS;
  const live = () => !cancelled && state.running && state.sensorMode && !environment.__turnRacePause?.paused;
  const still = () => state.mode !== 'racing' && Math.abs(Number(state.speed) || 0) < STILL_SPEED;

  const finish = (centre) => {
    if (centre && still()) centreTiltSteering(state, { horizon: true });
    cancelled = true;
    announceSteeringCentred({ showMessage, environment });
  };

  const sample = () => {
    timer = 0;
    if (!live()) return;
    elapsed += START_SAMPLE_MS;
    const pose = [Number(state.targetRoll) || 0, Number(state.targetPitch) || 0];
    steady = last && Math.abs(pose[0] - last[0]) < STEADY_RAD && Math.abs(pose[1] - last[1]) < STEADY_RAD ? steady + 1 : 0;
    last = pose;
    if (!still()) return finish(false);
    if (elapsed >= START_READ_MS && steady >= STEADY_SAMPLES) return finish(true);
    // Never steady: the start's own neutral stands, as before.
    if (elapsed >= START_GIVE_UP_MS) return finish(false);
    timer = setTimer(sample, START_SAMPLE_MS);
  };

  showMessage?.(HOLD_PHONE_MESSAGE, START_GIVE_UP_MS + 400);
  timer = setTimer(() => {
    timer = 0;
    if (!live()) return;
    centreTiltSteering(state, { horizon: true });
    last = [Number(state.targetRoll) || 0, Number(state.targetPitch) || 0];
    timer = setTimer(sample, START_SAMPLE_MS);
  }, START_PROVISIONAL_MS);

  return () => {
    cancelled = true;
    if (timer) clearTimer(timer);
    timer = 0;
  };
}
