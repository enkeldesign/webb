import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { createRaceSessionOrchestrator } from '../turn/race/session-orchestrator.js';

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
    __turnDriftHeld: true
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
assert.equal(motion.orientationLocks, 1);
assert.deepEqual(motion.motionListener.options, { passive: true });
motion.motionListener.listener({ sample: 'tilt' });
assert.ok(motion.order.indexOf('fullscreen') < motion.order.indexOf('permission'));
assert.ok(motion.order.indexOf('permission') < motion.order.indexOf('show-setup'));
assert.ok(motion.order.indexOf('show-setup') < motion.order.indexOf('apply-selection'));
assert.ok(motion.order.indexOf('apply-selection') < motion.order.indexOf('prepare-race'));
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

const cancelled = createHarness({ selection: null });
assert.equal(await cancelled.orchestrator.useManualMode(), false);
assert.equal(cancelled.orchestrator.getPhase(), 'idle');
assert.equal(cancelled.state.running, false);
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
assert.equal(await lotCancelled.orchestrator.openLotFromRace(), false);
assert.equal(lotCancelled.state.running, true);
assert.equal(lotCancelled.state.lastFrame, 4321);
assert.equal(lotCancelled.state.touchGas, false);
assert.equal(lotCancelled.environment.__turnAnalogGas, 0);
assert.equal(lotCancelled.environment.__turnBoostActive, false);
assert.equal(lotCancelled.environment.__turnDriftHeld, false);
assert.deepEqual(lotCancelled.published, ['lot-open', 'lot-cancelled']);
assert.equal(lotCancelled.orchestrator.getPhase(), 'racing');

const leaveRace = createHarness({ selection: null });
leaveRace.state.running = true;
leaveRace.elements.hud.hidden = false;
leaveRace.elements.controls.hidden = false;
assert.equal(leaveRace.orchestrator.leaveRace(), true);
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
const nextMain = await fs.readFile(new URL('../turn-next/main.js', import.meta.url), 'utf8');
const productionApp = await fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8');
const nextApp = await fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8');

assert.match(productionMain, /createRaceSessionOrchestrator/);
assert.match(productionMain, /showRaceSetup: showTheLot/);
assert.match(productionMain, /motionButton\.addEventListener\('click', raceSession\.requestMotion\)/);
assert.match(productionMain, /manualButton\.addEventListener\('click', raceSession\.useManualMode\)/);
assert.match(productionMain, /openLot: raceSession\.openLotFromRace/);
assert.doesNotMatch(productionMain, /async function requestMotion\(|async function openLotFromRace\(|async function startGame\(/);
assert.equal(nextMain, productionMain, 'TURN NEXT main must mirror canonical production main');
assert.match(productionApp, /turnSessionLifecycle = 'orchestrator-m7'/);
assert.match(productionApp, /installM8HomeNavigation\(\)/);
assert.ok(
  productionApp.indexOf('installDisplayLifecycleBridge({ platform: webPlatform })')
    < productionApp.indexOf("withBuild('./main.js')")
);
assert.match(nextApp, /new URL\('\/turn\/app\.js'/);
assert.doesNotMatch(nextApp, /createRaceSessionOrchestrator|installM8HomeNavigation/);

console.log('TURN production M7 race-session orchestration and NEXT parity passed.');
