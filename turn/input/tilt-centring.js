// Tilt steering's straight ahead (#1032). Device rotation steers relative to a neutral
// pose: the race start, a screen rotation, switching to device rotation and
// RECALIBRATE each take the phone as it is held now. Every one of them says so in the
// race pill (#message, a live status, so screen readers hear it) with one wording,
// RECALIBRATE blinks, and Drive By Ear adds a short level cue.

// The pill shows it in capitals; screen readers read the sentence.
export const HOLD_PHONE_MESSAGE = 'Hold your device in a comfortable driving position.';
export const STEERING_CENTRED_MESSAGE = 'STEERING CENTRED';

// Race start (#1032, #1174): a provisional neutral comes at once. Until the phone keeps
// still, the neutral follows it, so however the start ends, its neutral is the pose the
// player holds then, never one from while they were still moving into position.
export const START_PROVISIONAL_MS = 220;
const START_READ_MS = 900;
const START_GIVE_UP_MS = 2400;
const START_SAMPLE_MS = 100;
// Steady: the steering roll keeps within 0.04 rad (about 2.3°) for 300 ms, so its middle
// is within about 1.1° of the pose, inside the 2.2° a phone tilts before it steers
// (input/motion.js). Pitch does not steer, so it is not asked to keep still.
const STEADY_WINDOW = 4;
const STEADY_RAD = 0.04;
const STILL_SPEED = 0.5;
// The last few starts, for the Admin card in SETTINGS (testing/route-test-hud.js).
const START_LOG_KEY = '__turnStartCentring';
const START_LOG_LENGTH = 6;
const RECALIBRATE_AFTER_START_MS = 30000;

// Centres on the phone as held now, or on a given pose (the middle of the last few).
export function centreTiltSteering(state, { horizon = false, pose = null } = {}) {
  const roll = pose ? pose.roll : state.targetRoll;
  const pitch = pose ? pose.pitch : state.targetPitch;
  state.neutralRoll = roll;
  state.roll = state.targetRoll;
  if (horizon) state.horizonRollReference = roll;
  state.neutralPitch = pitch;
  state.pitch = state.targetPitch;
  state.steering = 0;
  state.steeringEngaged = false;
}

const BLINK_CLASS = 'is-centred-blink';
const BLINK_MS = 960;

export function announceSteeringCentred({ showMessage, environment = globalThis } = {}) {
  showMessage?.(STEERING_CENTRED_MESSAGE);
  blinkRecalibrate(environment);
  if (environment.__turnDriveByEarEnabled !== false) environment.__turnAudio?.cue?.('steering-centred');
}

// RECALIBRATE blinks with the message: that is where centring lives.
function blinkRecalibrate(environment) {
  const button = environment.document?.querySelector?.('#calibrateButton');
  if (!button) return;
  environment.clearTimeout?.(button.turnCentredBlinkTimer);
  button.classList.remove(BLINK_CLASS);
  void button.offsetWidth;
  button.classList.add(BLINK_CLASS);
  button.turnCentredBlinkTimer = environment.setTimeout?.(() => button.classList.remove(BLINK_CLASS), BLINK_MS);
}

const clockNow = (environment) => environment.performance?.now?.() ?? Date.now();
const poseOf = (state) => ({ roll: Number(state.targetRoll) || 0, pitch: Number(state.targetPitch) || 0 });

function logStart(environment, entry) {
  const log = Array.isArray(environment[START_LOG_KEY]) ? environment[START_LOG_KEY] : [];
  environment[START_LOG_KEY] = [{ ...entry, at: clockNow(environment) }, ...log].slice(0, START_LOG_LENGTH);
}

export function startCentringLog(environment = globalThis) {
  return Array.isArray(environment[START_LOG_KEY]) ? environment[START_LOG_KEY] : [];
}

// RECALIBRATE soon after a start: how far off the start left the steering.
export function noteRecalibrate(state, environment = globalThis) {
  const last = startCentringLog(environment)[0];
  if (!last || Number.isFinite(last.recalibrate) || !state.sensorMode) return;
  if (clockNow(environment) - last.at > RECALIBRATE_AFTER_START_MS) return;
  last.recalibrate = (Number(state.targetRoll) || 0) - (Number(state.neutralRoll) || 0);
}

const degrees = (rad) => `${(Math.abs(rad) * 180 / Math.PI).toFixed(1)}°`;

export function describeStartCentring(entry) {
  const parts = [
    `${entry.outcome.toUpperCase()} at ${(entry.ms / 1000).toFixed(1)} s`,
    `${degrees(entry.fromProvisional)} from the 0.22 s pose`,
    `spread ${degrees(entry.spread)}`
  ];
  if (Number.isFinite(entry.recalibrate)) parts.push(`RECALIBRATE moved it ${degrees(entry.recalibrate)}`);
  return parts.join(' · ');
}

// Runs the race-start sequence and returns a cancel function. Never holds the race:
// the car can drive from the first frame. Ends when the phone keeps still, when the car
// moves, or after 2.4 s, each time centred on the middle of the last 300 ms.
export function startTiltCentring({ state, showMessage, setTimer, clearTimer = () => {}, environment = globalThis }) {
  let cancelled = false;
  let timer = 0;
  let elapsed = START_PROVISIONAL_MS;
  let provisional = null;
  const recent = [];
  const live = () => !cancelled && state.running && state.sensorMode && !environment.__turnRacePause?.paused;
  const still = () => state.mode !== 'racing' && Math.abs(Number(state.speed) || 0) < STILL_SPEED;
  const middle = () => ({
    roll: recent.reduce((sum, pose) => sum + pose.roll, 0) / recent.length,
    pitch: recent.reduce((sum, pose) => sum + pose.pitch, 0) / recent.length
  });
  const spread = () => Math.max(...recent.map(({ roll }) => roll)) - Math.min(...recent.map(({ roll }) => roll));
  // Only the neutral moves, so the steering already under way is not reset.
  const follow = (pose) => {
    state.neutralRoll = pose.roll;
    state.horizonRollReference = pose.roll;
    state.neutralPitch = pose.pitch;
  };

  const finish = (outcome) => {
    const pose = middle();
    if (outcome === 'car moved') follow(pose);
    else centreTiltSteering(state, { horizon: true, pose });
    cancelled = true;
    logStart(environment, { outcome, ms: elapsed, roll: pose.roll, fromProvisional: pose.roll - provisional.roll, spread: spread() });
    announceSteeringCentred({ showMessage, environment });
  };

  const sample = () => {
    timer = 0;
    if (!live()) return;
    elapsed += START_SAMPLE_MS;
    recent.push(poseOf(state));
    if (recent.length > STEADY_WINDOW) recent.shift();
    if (!still()) return finish('car moved');
    if (elapsed >= START_READ_MS && recent.length === STEADY_WINDOW && spread() < STEADY_RAD) return finish('steady');
    if (elapsed >= START_GIVE_UP_MS) return finish('gave up');
    follow(middle());
    timer = setTimer(sample, START_SAMPLE_MS);
  };

  showMessage?.(HOLD_PHONE_MESSAGE, START_GIVE_UP_MS + 400);
  timer = setTimer(() => {
    timer = 0;
    if (!live()) return;
    provisional = poseOf(state);
    recent.push(provisional);
    centreTiltSteering(state, { horizon: true });
    timer = setTimer(sample, START_SAMPLE_MS);
  }, START_PROVISIONAL_MS);

  return () => {
    cancelled = true;
    if (timer) clearTimer(timer);
    timer = 0;
  };
}
