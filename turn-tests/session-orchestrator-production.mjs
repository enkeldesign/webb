import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { createRaceSessionOrchestrator } from '../turn/race/session-orchestrator.js';
import { announceSteeringCentred, centreTiltSteering, describeStartCentring, noteRecalibrate, startCentringLog } from '../turn/input/tilt-centring.js';

function element(hidden = false) {
  return { hidden, textContent: '' };
}

function createHarness({ selection = { carId: 'sedan', color: '#fff', secondaryColor: '#000' } } = {}) {
  const order = [];
  const published = [];
  const applied = [];
  const appliedOptions = [];
  const timers = [];
  let motionListener = null;
  let fullscreenRequests = 0;
  let orientationLocks = 0;
  let boostRefills = 0;
  let clock = 1000;

  class FakeDeviceMotionEvent {
    static async requestPermission() {
      order.push('permission');
      return 'granted';
    }
  }

  const bodyClasses = new Set();
  const root = {
    requestFullscreen() {
      fullscreenRequests += 1;
      order.push('fullscreen');
      return Promise.resolve();
    }
  };
  const environment = {
    DeviceMotionEvent: FakeDeviceMotionEvent,
    document: {
      documentElement: root,
      fullscreenElement: null,
      webkitFullscreenElement: null,
      body: {
        classList: {
          add(value) { bodyClasses.add(value); },
          remove(value) { bodyClasses.delete(value); },
          contains(value) { return bodyClasses.has(value); }
        }
      }
    },
    screen: {
      orientation: {
        async lock(value) {
          orientationLocks += 1;
          order.push(`orientation:${value}`);
        }
      }
    },
    performance: { now: () => clock },
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    addEventListener(type, listener, options) {
      if (type === 'devicemotion') motionListener = { listener, options };
      order.push(`listen:${type}`);
    },
    __turnAnalogGas: 0.7,
    __turnBoostActive: true,
    __turnDriftHeld: true,
    __turnDriftLockAmount: 0.8,
    __turnRefillBoost() {
      boostRefills += 1;
      order.push('refill-boost');
    }
  };
  environment.window = environment;

  const state = {
    running: false,
    sensorMode: false,
    targetRoll: 0.4,
    roll: 0,
    neutralRoll: 0,
    horizonRollReference: 0,
    targetPitch: -0.2,
    pitch: 0,
    neutralPitch: 0,
    touchGas: true,
    touchBrake: true,
    manualSteering: 0.8,
    vehicleId: 'classic',
    vehicleColor: '#123456',
    vehicleSecondaryColor: '#abcdef',
    lastFrame: 0
  };
  const elements = {
    intro: element(false),
    hud: element(true),
    controls: element(true),
    manualSteer: element(true),
    status: element(false)
  };

  const orchestrator = createRaceSessionOrchestrator({
    state,
    elements,
    environment,
    async showRaceSetup(options) {
      order.push('show-setup');
      assert.deepEqual(options.initialSelection, {
        carId: state.vehicleId,
        color: state.vehicleColor,
        secondaryColor: state.vehicleSecondaryColor
      });
      return selection;
    },
    async applyVehicleSelection(value, options) {
      applied.push(value);
      appliedOptions.push(options);
      order.push('apply-selection');
    },
    prepareRaceStartState(receivedState) {
      assert.equal(receivedState, state);
      state.prepared = true;
      order.push('prepare-race');
    },
    publishUiState(reason) {
      published.push(reason);
      order.push(`publish:${reason}`);
    },
    handleMotion(event) {
      order.push(`motion:${event.sample}`);
    },
    resize() {
      order.push('resize');
    },
    showMessage(message) {
      order.push(`message:${message}`);
    }
  });

  return {
    applied,
    appliedOptions,
    get boostRefills() { return boostRefills; },
    elements,
    environment,
    get fullscreenRequests() { return fullscreenRequests; },
    get motionListener() { return motionListener; },
    get orientationLocks() { return orientationLocks; },
    orchestrator,
    order,
    published,
    state,
    timers,
    setClock(value) { clock = value; }
  };
}

const motion = createHarness();
assert.equal(await motion.orchestrator.requestMotion(), true);
assert.equal(motion.orchestrator.route, 'session-orchestrator');
assert.equal(motion.orchestrator.getPhase(), 'racing');
assert.equal(motion.fullscreenRequests, 1);

// iPad Safari shows page fullscreen empty: Apple touch devices are not asked.
const iPad = createHarness();
iPad.environment.navigator = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 };
assert.equal(await iPad.orchestrator.requestMotion(), true);
assert.equal(iPad.fullscreenRequests, 0, 'An iPad never gets the empty page fullscreen');
assert.equal(motion.orientationLocks, 0, 'Starting a race preserves the chosen orientation');
assert.equal(motion.boostRefills, 1, 'Every successful race start must refill Boost exactly once');
assert.deepEqual(motion.motionListener.options, { passive: true });
motion.motionListener.listener({ sample: 'tilt' });
assert.ok(motion.order.indexOf('fullscreen') < motion.order.indexOf('permission'));
assert.ok(motion.order.indexOf('permission') < motion.order.indexOf('show-setup'));
assert.ok(motion.order.indexOf('show-setup') < motion.order.indexOf('apply-selection'));
assert.ok(motion.order.indexOf('apply-selection') < motion.order.indexOf('prepare-race'));
assert.ok(motion.order.indexOf('prepare-race') < motion.order.indexOf('refill-boost'));
assert.ok(motion.order.indexOf('refill-boost') < motion.order.indexOf('publish:race-started'));
assert.equal(motion.state.sensorMode, true);
assert.equal(motion.state.running, true);
assert.equal(motion.elements.intro.hidden, true);
assert.equal(motion.elements.hud.hidden, false);
assert.equal(motion.elements.controls.hidden, false);
assert.equal(motion.elements.manualSteer.hidden, true);
assert.deepEqual(motion.timers.map(({ delay }) => delay), [220, 300, 900]);
motion.timers[0].callback();
assert.equal(motion.state.neutralRoll, motion.state.targetRoll);
assert.equal(motion.state.horizonRollReference, motion.state.targetRoll);
assert.equal(motion.state.neutralPitch, motion.state.targetPitch);
assert.deepEqual(motion.published, ['race-started']);

// Tilt centring at the start (#1032): the race pill asks for a comfortable driving
// position, takes the neutral once the phone keeps still, and says STEERING CENTRED.
// There is no GO!: the player chooses when to start. Drive By Ear hears a level cue.
const HOLD = 'message:Hold your device in a comfortable driving position.';
const CENTRED = 'message:STEERING CENTRED';
function runSamples(harness, eachSample = () => {}, limit = 40) {
  let ran = 3;
  for (let i = 0; i < limit && ran < harness.timers.length; i += 1, ran += 1) {
    assert.equal(harness.timers[ran].delay, 100, 'The start samples the phone every 100 ms');
    eachSample(i);
    harness.timers[ran].callback();
  }
  return ran - 3;
}
assert.ok(motion.order.includes(HOLD), 'Tilt start asks for the driving grip');
assert.equal(motion.order.includes('message:GO!'), false, 'No GO!: the player chooses when to start');
motion.environment.__turnAudio = { cue(name) { motion.order.push(`cue:${name}`); } };
motion.state.mode = 'staged';
motion.state.speed = 0;
motion.state.targetRoll = 0.1;
motion.state.targetPitch = -0.05;
const steadySamples = runSamples(motion);
assert.ok(motion.order.includes(CENTRED), 'A steady phone is centred out loud');
assert.ok(motion.order.indexOf(HOLD) < motion.order.indexOf(CENTRED));
assert.ok(motion.order.includes('cue:steering-centred'), 'Drive By Ear hears the centring');
assert.equal(motion.state.neutralRoll, 0.1, 'The neutral is the pose the phone settled in');
assert.equal(motion.state.horizonRollReference, 0.1);
assert.equal(motion.state.neutralPitch, -0.05);
assert.ok(steadySamples >= 7 && steadySamples <= 9, `The hint stays up long enough to read (${steadySamples} samples)`);

const [steadyStart] = startCentringLog(motion.environment);
assert.equal(steadyStart.outcome, 'steady', 'The Admin card hears how the start was centred (#1174)');
assert.ok(Math.abs(steadyStart.fromProvisional + 0.3) < 1e-9, 'And how far that is from the 0.22 s pose');
// RECALIBRATE soon after says how far off the start left the steering.
motion.state.targetRoll = 0.15;
noteRecalibrate(motion.state, motion.environment);
assert.ok(Math.abs(steadyStart.recalibrate - 0.05) < 1e-9);
assert.match(describeStartCentring(steadyStart), /^STEADY at 0\.9 s · 17\.2° from the 0\.22 s pose · spread 0\.0° · RECALIBRATE moved it 2\.9°$/);

// #1174: a hand's tremor still counts as steady, and pitch, which does not steer, is
// not asked to keep still.
const hand = createHarness();
await hand.orchestrator.requestMotion();
hand.timers[0].callback();
hand.state.mode = 'staged';
hand.state.speed = 0;
const handSamples = runSamples(hand, (i) => {
  hand.state.targetRoll = 0.1 + (i % 2 ? 0.015 : -0.015);
  hand.state.targetPitch = -0.2 + (i % 2 ? 0.06 : -0.06);
});
assert.equal(startCentringLog(hand.environment)[0].outcome, 'steady', 'Normal hand tremor is steady');
assert.ok(handSamples <= 9, `Centred once the hint has been read (${handSamples} samples)`);
assert.ok(Math.abs(hand.state.neutralRoll - 0.1) < 1e-9, 'On the middle of the last 300 ms');

// Until then the neutral follows the phone, so driving off early keeps the pose the
// phone is held in then, not one from while it was still moving into position.
const driving = createHarness();
await driving.orchestrator.requestMotion();
driving.timers[0].callback();
driving.state.mode = 'staged';
driving.state.speed = 0;
driving.state.targetRoll = -0.3;
runSamples(driving, (i) => {
  if (i > 0) assert.notEqual(driving.state.neutralRoll, 0.4, 'The 0.22 s pose is not kept while the phone moves');
  if (i === 4) driving.state.mode = 'racing';
});
assert.ok(driving.order.includes(CENTRED), 'Driving off early still says the steering is centred');
assert.equal(driving.state.neutralRoll, -0.3, 'Once the car moves, the neutral is the pose it was driven off in');
assert.equal(startCentringLog(driving.environment)[0].outcome, 'car moved');

const restless = createHarness();
await restless.orchestrator.requestMotion();
restless.timers[0].callback();
restless.state.mode = 'staged';
restless.state.speed = 0;
const restlessSamples = runSamples(restless, (i) => { restless.state.targetRoll = i % 2 ? 0.2 : -0.2; });
assert.ok(restless.order.includes(CENTRED), 'A phone that never keeps still is centred all the same');
assert.ok(Math.abs(restless.state.neutralRoll) < 1e-9, 'Never steady: centred on the middle of the last 300 ms');
assert.equal(restlessSamples, 22, 'The start gives up waiting after about two and a half seconds');
assert.equal(restless.order.filter((entry) => entry === CENTRED).length, 1, 'Said once');
assert.equal(startCentringLog(restless.environment)[0].outcome, 'gave up');

// #1174: a pause during the start does not lose the centring. A race pauses only once
// the car is moving (race-pause.js), so nothing runs while paused and RESUME finishes the
// start as driving off does: on the pose the player races on in, without asking for the
// grip again. A resume that centred the steering itself (a rotation's 3-2-1 ends in
// RECALIBRATE) leaves nothing to finish.
function pausableHarness() {
  const harness = createHarness();
  const raceListeners = new Set();
  const listen = harness.environment.addEventListener;
  harness.environment.addEventListener = (type, listener, options) => {
    if (type === 'turn:ui-state-change') raceListeners.add(listener);
    return listen(type, listener, options);
  };
  harness.environment.removeEventListener = (type, listener) => {
    if (type === 'turn:ui-state-change') raceListeners.delete(listener);
  };
  harness.environment.__turnRacePause = { paused: false };
  harness.raceChange = (reason) => {
    harness.environment.__turnRacePause.paused = reason === 'race-paused';
    for (const listener of [...raceListeners]) listener({ detail: { reason } });
  };
  harness.driveOff = () => {
    harness.state.mode = 'racing';
    harness.state.speed = 8;
  };
  harness.raceListeners = raceListeners;
  harness.runLatest = (limit = 40) => {
    let ran = 0;
    while (ran < limit && harness.timers.at(-1)?.delay === 100 && !harness.timers.at(-1).ran) {
      const next = harness.timers.at(-1);
      next.ran = true;
      next.callback();
      ran += 1;
    }
    return ran;
  };
  return harness;
}
{
  // Driven off and paused before the 0.22 s pose.
  const early = pausableHarness();
  await early.orchestrator.requestMotion();
  early.state.targetRoll = 0.1;
  early.driveOff();
  early.raceChange('race-paused');
  const scheduled = early.timers.length;
  early.timers[0].callback();
  assert.equal(early.timers.length, scheduled, 'Paused before the 0.22 s pose: nothing is taken or scheduled');
  assert.equal(early.order.includes(CENTRED), false);
  early.state.targetRoll = 0.25;
  early.raceChange('race-resumed');
  assert.equal(early.timers.at(-1).delay, 220, 'RESUME takes up the centring again');
  early.timers.at(-1).callback();
  assert.equal(early.runLatest(), 1, 'The car is moving, so it finishes at once');
  assert.equal(early.order.filter((entry) => entry === HOLD).length, 1, 'Without asking for the grip again');
  assert.equal(early.order.filter((entry) => entry === CENTRED).length, 1, 'STEERING CENTRED, once');
  assert.equal(early.state.neutralRoll, 0.25, 'On the pose the player races on in');
  assert.equal(startCentringLog(early.environment)[0].outcome, 'car moved');
  assert.equal(early.raceListeners.size, 0, 'Done, it stops listening');

  // Driven off and paused between two samples, before the start saw the car move.
  const midway = pausableHarness();
  await midway.orchestrator.requestMotion();
  midway.state.mode = 'staged';
  midway.state.speed = 0;
  midway.state.targetRoll = 0.1;
  midway.timers[0].callback();
  midway.timers[3].callback();
  midway.driveOff();
  midway.raceChange('race-paused');
  const during = midway.timers.length;
  midway.timers.at(-1).callback();
  assert.equal(midway.timers.length, during, 'Paused mid-way: the sampling stops');
  assert.equal(midway.order.includes(CENTRED), false);
  midway.state.targetRoll = -0.2;
  midway.raceChange('race-resumed');
  midway.timers.at(-1).callback();
  midway.runLatest();
  assert.equal(midway.order.filter((entry) => entry === CENTRED).length, 1, 'RESUME finishes the centring');
  assert.equal(midway.state.neutralRoll, -0.2, 'On the pose held after RESUME, not the one before the pause');

  const rotated = pausableHarness();
  await rotated.orchestrator.requestMotion();
  rotated.timers[0].callback();
  rotated.driveOff();
  rotated.raceChange('race-paused');
  rotated.raceChange('race-resumed');
  // The rotation resume's RECALIBRATE (main.js calibrate) centres the steering itself.
  centreTiltSteering(rotated.state);
  const afterRecalibrate = rotated.timers.length;
  rotated.timers.at(-1).callback();
  assert.equal(rotated.timers.length, afterRecalibrate, 'Already centred by the resume: the start ends quietly');
  assert.equal(rotated.order.includes(CENTRED), false, 'RECALIBRATE said it, not the start');
  assert.equal(rotated.raceListeners.size, 0);

  const left = pausableHarness();
  await left.orchestrator.requestMotion();
  left.driveOff();
  left.raceChange('race-paused');
  left.raceChange('race-pause-ended');
  assert.equal(left.raceListeners.size, 0, 'RESTART LAP or LEAVE RACE from the pause ends the start centring');
}

// RECALIBRATE blinks with every STEERING CENTRED, and the blink ends by itself.
{
  const classes = new Set();
  const blinkTimers = [];
  const button = {
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    offsetWidth: 80
  };
  const said = [];
  announceSteeringCentred({
    showMessage: (text) => said.push(text),
    environment: {
      document: { querySelector: (selector) => (selector === '#calibrateButton' ? button : null) },
      setTimeout: (callback, delay) => blinkTimers.push({ callback, delay }),
      clearTimeout() {},
      __turnDriveByEarEnabled: false
    }
  });
  assert.deepEqual(said, ['STEERING CENTRED']);
  assert.ok(classes.has('is-centred-blink'), 'RECALIBRATE blinks with STEERING CENTRED');
  assert.equal(blinkTimers.length, 1);
  blinkTimers[0].callback();
  assert.equal(classes.has('is-centred-blink'), false, 'The blink ends by itself');
}

const cancelled = createHarness({ selection: null });
assert.equal(await cancelled.orchestrator.useManualMode(), false);
assert.equal(cancelled.orchestrator.getPhase(), 'idle');
assert.equal(cancelled.state.running, false);
assert.equal(cancelled.boostRefills, 0, 'Cancelling setup must not refill Boost because no race starts');
assert.equal(cancelled.elements.intro.hidden, false);
assert.deepEqual(cancelled.applied, []);

const deferred = createHarness({ selection: null });
assert.equal(await deferred.orchestrator.selectVehicle({ carId: 'police' }, { persist: false }), true);
assert.deepEqual(deferred.appliedOptions, [{ persist: false }],
  'The real session handoff must preserve the preview’s non-persistent selection option');
assert.equal(await deferred.orchestrator.selectVehicle({ carId: 'sedan' }), true);
assert.equal(deferred.appliedOptions[1], undefined,
  'Normal vehicle selections keep the existing persistent default');
const motionAccess = await deferred.orchestrator.prepareMotionAccess();
assert.equal(motionAccess.mode, 'motion');
assert.equal(deferred.order.includes('show-setup'), false);
assert.ok(deferred.order.indexOf('fullscreen') < deferred.order.indexOf('permission'));
await motionAccess.fullscreenPromise;

const manual = createHarness();
for (const key of ['roll', 'targetRoll', 'neutralRoll', 'horizonRollReference', 'pitch', 'targetPitch', 'neutralPitch']) {
  manual.state[key] = 1;
}
const manualAccess = manual.orchestrator.prepareManualAccess();
assert.equal(manualAccess.mode, 'manual');
assert.equal(manual.state.sensorMode, false);
for (const key of ['roll', 'targetRoll', 'neutralRoll', 'horizonRollReference', 'pitch', 'targetPitch', 'neutralPitch']) {
  assert.equal(manual.state[key], 0, `Manual access must reset ${key}`);
}

const lotCancelled = createHarness({ selection: null });
lotCancelled.state.running = true;
lotCancelled.setClock(4321);
assert.equal(await lotCancelled.orchestrator.openGarageFromRace(), false);
assert.equal(lotCancelled.state.running, true);
assert.equal(lotCancelled.state.lastFrame, 4321);
assert.equal(lotCancelled.state.touchGas, false);
assert.equal(lotCancelled.environment.__turnAnalogGas, 0);
assert.equal(lotCancelled.environment.__turnBoostActive, false);
assert.equal(lotCancelled.environment.__turnDriftHeld, false);
assert.equal(lotCancelled.environment.__turnDriftLockAmount, 0);
assert.deepEqual(lotCancelled.published, ['lot-open', 'lot-cancelled']);
assert.equal(lotCancelled.orchestrator.getPhase(), 'racing');

const leaveRace = createHarness({ selection: null });
leaveRace.state.running = true;
leaveRace.elements.hud.hidden = false;
leaveRace.elements.controls.hidden = false;
let leaveSilenced = 0;
leaveRace.environment.__turnAudio = { silence() { leaveSilenced += 1; } };
assert.equal(leaveRace.orchestrator.leaveRace(), true);
assert.equal(leaveSilenced, 1, 'Leaving the race silences the engine and the other driving sounds');
assert.equal(leaveRace.orchestrator.getPhase(), 'home');
assert.equal(leaveRace.state.running, false);
assert.equal(leaveRace.elements.intro.hidden, true);
assert.equal(leaveRace.elements.hud.hidden, true);
assert.equal(leaveRace.elements.controls.hidden, true);
assert.deepEqual(leaveRace.published, ['home-open']);

const unavailable = createHarness({ selection: null });
delete unavailable.environment.DeviceMotionEvent;
assert.equal(await unavailable.orchestrator.requestMotion(), false);
assert.match(unavailable.elements.status.textContent, /Motion sensors are not available.*Manual mode still works/);

assert.throws(() => createRaceSessionOrchestrator(), /requires state/);
assert.throws(() => createRaceSessionOrchestrator({ state: {} }), /elements\.intro/);

const productionMain = await fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8');
const productionApp = await fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8');

assert.match(productionMain, /createRaceSessionOrchestrator/);
assert.match(productionMain, /showRaceSetup: showGarageSetup/);
assert.match(productionMain, /motionButton\.addEventListener\('click', raceSession\.requestMotion\)/);
assert.match(productionMain, /manualButton\.addEventListener\('click', raceSession\.useManualMode\)/);
assert.match(productionMain, /openGarage: raceSession\.openGarageFromRace/);
assert.doesNotMatch(productionMain, /async function requestMotion\(|async function openGarageFromRace\(|async function startGame\(/);
assert.match(productionApp, /turnSessionLifecycle = 'orchestrator-m7'/);
assert.match(productionApp, /installM8HomeNavigation\(\)/);
assert.ok(
  productionApp.indexOf('installDisplayLifecycleBridge({ platform: webPlatform })')
    < productionApp.indexOf("withBuild('./main.js')")
);

console.log('TURN production M7 race-session orchestration passed.');
