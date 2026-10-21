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
// How many times each race's steering has been centred, so a start that waits out a
// pause can tell whether its resume already centred it.
const centrings = new WeakMap();
const centringsOf = (state) => centrings.get(state) || 0;

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
  centrings.set(state, centringsOf(state) + 1);
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

const poseOf = (state) => ({ roll: Number(state.targetRoll) || 0, pitch: Number(state.targetPitch) || 0 });

// Runs the race-start sequence and returns a cancel function. Never holds the race:
// the car can drive from the first frame. Ends when the phone keeps still, when the car
// moves, or after 2.4 s, each time centred on the middle of the last 300 ms.
// Nothing runs while the race is paused (#1174). A race pauses only once the car is
// moving, so RESUME finishes the start as driving off does: on the pose the player races
// on in, without asking for the grip again. A resume that centred the steering itself
// (after a rotation, its 3-2-1 ends in RECALIBRATE) leaves nothing to finish.
export function startTiltCentring({ state, showMessage, setTimer, clearTimer = () => {}, environment = globalThis }) {
  let cancelled = false;
  let timer = 0;
  let elapsed = START_PROVISIONAL_MS;
  let recent = [];
  const ended = () => cancelled || !state.running || !state.sensorMode;
  const paused = () => environment.__turnRacePause?.paused === true;
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
  const holdTimer = () => {
    if (timer) clearTimer(timer);
    timer = 0;
  };

  function stop() {
    cancelled = true;
    holdTimer();
    environment.removeEventListener?.('turn:ui-state-change', onRaceChange);
  }

  const finish = (outcome) => {
    const pose = middle();
    if (outcome === 'car moved') follow(pose);
    else centreTiltSteering(state, { horizon: true, pose });
    stop();
    announceSteeringCentred({ showMessage, environment });
  };

  const sample = () => {
    timer = 0;
    if (ended()) return stop();
    if (paused()) return;
    elapsed += START_SAMPLE_MS;
    recent.push(poseOf(state));
    if (recent.length > STEADY_WINDOW) recent.shift();
    if (!still()) return finish('car moved');
    if (elapsed >= START_READ_MS && recent.length === STEADY_WINDOW && spread() < STEADY_RAD) return finish('steady');
    if (elapsed >= START_GIVE_UP_MS) return finish('gave up');
    follow(middle());
    timer = setTimer(sample, START_SAMPLE_MS);
  };

  const begin = ({ resumed = false } = {}) => {
    elapsed = START_PROVISIONAL_MS;
    recent = [];
    const centredBefore = centringsOf(state);
    const ask = () => showMessage?.(HOLD_PHONE_MESSAGE, START_GIVE_UP_MS + 400);
    if (!resumed) ask();
    timer = setTimer(() => {
      timer = 0;
      if (ended()) return stop();
      if (paused()) return;
      if (resumed) {
        if (centringsOf(state) !== centredBefore) return stop();
        if (still()) ask();
      }
      recent.push(poseOf(state));
      centreTiltSteering(state, { horizon: true });
      timer = setTimer(sample, START_SAMPLE_MS);
    }, START_PROVISIONAL_MS);
  };

  function onRaceChange(event) {
    const reason = event?.detail?.reason;
    if (reason === 'race-paused') holdTimer();
    else if (reason === 'race-pause-ended') stop();
    else if (reason === 'race-resumed' && !ended()) {
      holdTimer();
      begin({ resumed: true });
    }
  }

  environment.addEventListener?.('turn:ui-state-change', onRaceChange);
  begin();
  return stop;
}
