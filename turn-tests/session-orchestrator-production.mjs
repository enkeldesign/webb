import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { createRaceSessionOrchestrator } from '../turn/race/session-orchestrator.js';
import { announceSteeringCentred } from '../turn/input/tilt-centring.js';

function element(hidden = false) {
  return { hidden, textContent: '' };
}

function createHarness({ selection = { carId: 'sedan', color: '#fff', secondaryColor: '#000' } } = {}) {
  const order = [];
  const published = [];
  const applied = [];
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
    async applyVehicleSelection(value) {
      applied.push(value);
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

const driving = createHarness();
await driving.orchestrator.requestMotion();
driving.timers[0].callback();
driving.state.mode = 'racing';
driving.state.targetRoll = -0.3;
runSamples(driving);
assert.ok(driving.order.includes(CENTRED), 'Driving off early still says the steering is centred');
assert.equal(driving.state.neutralRoll, 0.4, 'Once the car moves, the start neutral stays');

const restless = createHarness();
await restless.orchestrator.requestMotion();
restless.timers[0].callback();
restless.state.mode = 'staged';
restless.state.speed = 0;
const restlessSamples = runSamples(restless, (i) => { restless.state.targetRoll = i % 2 ? 0.2 : -0.2; });
assert.ok(restless.order.includes(CENTRED), 'A phone that never keeps still is centred all the same');
assert.equal(restless.state.neutralRoll, 0.4, 'Never steady: the start neutral stands, as before');
assert.equal(restlessSamples, 14, 'The start gives up waiting after about a second and a half');
assert.equal(restless.order.filter((entry) => entry === CENTRED).length, 1, 'Said once');

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
