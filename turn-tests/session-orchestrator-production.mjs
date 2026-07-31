import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { createRaceSessionOrchestrator } from '../turn/race/session-orchestrator.js';

function element(hidden = false) {
  return { hidden, textContent: '' };
}

function bodyClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

function createHarness({ selections = [{ carId: 'sedan', color: '#fff', secondaryColor: '#000' }] } = {}) {
  const order = [];
  const timers = [];
  const published = [];
  const applied = [];
  let selectionIndex = 0;
  let fullscreenRequests = 0;
  let orientationLocks = 0;
  let motionListener = null;
  let clock = 1000;

  class FakeDeviceMotionEvent {
    static async requestPermission() {
      order.push('permission');
      return 'granted';
    }
  }

  const root = {
    requestFullscreen() {
      fullscreenRequests += 1;
      order.push('fullscreen');
      return Promise.resolve();
    }
  };
  const classList = bodyClassList();
  const environment = {
    DeviceMotionEvent: FakeDeviceMotionEvent,
    document: {
      documentElement: root,
      fullscreenElement: null,
      webkitFullscreenElement: null,
      body: { classList }
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
      return selections[selectionIndex++] ?? null;
    },
    async applyVehicleSelection(selection) {
      applied.push(selection);
      order.push('apply-selection');
    },
    prepareRaceStartState(receivedState) {
      assert.equal(receivedState, state);
      receivedState.prepared = true;
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
    classList,
    elements,
    environment,
    get clock() { return clock; },
    set clock(value) { clock = value; },
    get fullscreenRequests() { return fullscreenRequests; },
    get motionListener() { return motionListener; },
    get orientationLocks() { return orientationLocks; },
    orchestrator,
    order,
    published,
    state,
    timers
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
assert.ok(motion.order.indexOf('fullscreen') < motion.order.indexOf('permission'), 'Fullscreen must stay inside the launch gesture');
assert.ok(motion.order.indexOf('permission') < motion.order.indexOf('show-setup'));
assert.ok(motion.order.indexOf('show-setup') < motion.order.indexOf('apply-selection'));
assert.ok(motion.order.indexOf('apply-selection') < motion.order.indexOf('prepare-race'));
assert.equal(motion.state.sensorMode, true);
assert.equal(motion.state.running, true);
assert.equal(motion.state.prepared, true);
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

const cancelled = createHarness({ selections: [null] });
assert.equal(await cancelled.orchestrator.useManualMode(), false);
assert.equal(cancelled.orchestrator.getPhase(), 'idle');
assert.equal(cancelled.state.running, false);
assert.equal(cancelled.state.sensorMode, false);
assert.equal(cancelled.elements.intro.hidden, false);
assert.deepEqual(cancelled.applied, []);

const manual = createHarness();
manual.state.roll = 1;
manual.state.targetRoll = 1;
manual.state.neutralRoll = 1;
manual.state.horizonRollReference = 1;
manual.state.pitch = 1;
manual.state.targetPitch = 1;
manual.state.neutralPitch = 1;
assert.equal(await manual.orchestrator.useManualMode(), true);
assert.equal(manual.state.sensorMode, false);
for (const key of ['roll', 'targetRoll', 'neutralRoll', 'horizonRollReference', 'pitch', 'targetPitch', 'neutralPitch']) {
  assert.equal(manual.state[key], 0, `Manual launch must reset ${key}`);
}
assert.equal(manual.elements.manualSteer.hidden, false);

const lotCancelled = createHarness({ selections: [null] });
lotCancelled.state.running = true;
lotCancelled.clock = 4321;
assert.equal(await lotCancelled.orchestrator.openLotFromRace(), false);
assert.equal(lotCancelled.state.running, true);
assert.equal(lotCancelled.state.lastFrame, 4321);
assert.equal(lotCancelled.state.touchGas, false);
assert.equal(lotCancelled.state.touchBrake, false);
assert.equal(lotCancelled.state.manualSteering, 0);
assert.equal(lotCancelled.environment.__turnAnalogGas, 0);
assert.equal(lotCancelled.environment.__turnBoostActive, false);
assert.equal(lotCancelled.environment.__turnDriftHeld, false);
assert.deepEqual(lotCancelled.published, ['lot-open', 'lot-cancelled']);
assert.equal(lotCancelled.orchestrator.getPhase(), 'racing');

const lotAccepted = createHarness();
lotAccepted.state.running = true;
assert.equal(await lotAccepted.orchestrator.openLotFromRace(), true);
assert.deepEqual(lotAccepted.published, ['lot-open', 'race-started']);
assert.equal(lotAccepted.state.running, true);
assert.equal(lotAccepted.orchestrator.getPhase(), 'racing');

const deferredMotion = createHarness({ selections: [] });
const motionAccess = await deferredMotion.orchestrator.prepareMotionAccess();
assert.equal(motionAccess.mode, 'motion');
assert.equal(deferredMotion.state.sensorMode, true);
assert.equal(deferredMotion.orchestrator.getPhase(), 'authorizing');
assert.equal(deferredMotion.fullscreenRequests, 1);
assert.ok(deferredMotion.order.indexOf('fullscreen') < deferredMotion.order.indexOf('permission'));
assert.equal(deferredMotion.order.includes('show-setup'), false, 'M8 must not open setup while requesting motion access');
await motionAccess.fullscreenPromise;

const deferredManual = createHarness({ selections: [] });
deferredManual.state.roll = 1;
deferredManual.state.targetRoll = 1;
deferredManual.state.neutralRoll = 1;
deferredManual.state.horizonRollReference = 1;
deferredManual.state.pitch = 1;
deferredManual.state.targetPitch = 1;
deferredManual.state.neutralPitch = 1;
const manualAccess = deferredManual.orchestrator.prepareManualAccess();
assert.equal(manualAccess.mode, 'manual');
assert.equal(deferredManual.state.sensorMode, false);
assert.equal(deferredManual.order.includes('show-setup'), false, 'M8 manual access must not open setup');
for (const key of ['roll', 'targetRoll', 'neutralRoll', 'horizonRollReference', 'pitch', 'targetPitch', 'neutralPitch']) {
  assert.equal(deferredManual.state[key], 0, 'Deferred manual access must reset ' + key);
}

const selectionOnly = createHarness({ selections: [] });
const selectedCar = { carId: 'suv', color: '#112233', secondaryColor: '#445566' };
assert.equal(await selectionOnly.orchestrator.selectVehicle(selectedCar), true);
assert.deepEqual(selectionOnly.applied, [selectedCar]);
assert.equal(await selectionOnly.orchestrator.selectVehicle(null), false);

const leaveRace = createHarness({ selections: [] });
leaveRace.state.running = true;
leaveRace.elements.hud.hidden = false;
leaveRace.elements.controls.hidden = false;
leaveRace.elements.manualSteer.hidden = false;
assert.equal(leaveRace.orchestrator.leaveRace(), true);
assert.equal(leaveRace.orchestrator.getPhase(), 'home');
assert.equal(leaveRace.state.running, false);
assert.equal(leaveRace.state.touchGas, false);
assert.equal(leaveRace.state.touchBrake, false);
assert.equal(leaveRace.state.manualSteering, 0);
assert.equal(leaveRace.environment.__turnAnalogGas, 0);
assert.equal(leaveRace.environment.__turnBoostActive, false);
assert.equal(leaveRace.environment.__turnDriftHeld, false);
assert.equal(leaveRace.elements.intro.hidden, true);
assert.equal(leaveRace.elements.hud.hidden, true);
assert.equal(leaveRace.elements.controls.hidden, true);
assert.equal(leaveRace.elements.manualSteer.hidden, true);
assert.deepEqual(leaveRace.published, ['home-open']);

const unavailable = createHarness({ selections: [] });
delete unavailable.environment.DeviceMotionEvent;
delete unavailable.environment.window.DeviceMotionEvent;
assert.equal(await unavailable.orchestrator.requestMotion(), false);
assert.match(unavailable.elements.status.textContent, /Motion sensors are not available.*Manual mode still works/);

assert.throws(() => createRaceSessionOrchestrator(), /requires state/);
assert.throws(() => createRaceSessionOrchestrator({ state: {} }), /elements\.intro/);

const productionMain = await fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8');
const nextMain = await fs.readFile(new URL('../turn-next/main.js', import.meta.url), 'utf8');
const nextApp = await fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8');
const generator = await fs.readFile(new URL('../turn-next/scripts/build-parity-main.mjs', import.meta.url), 'utf8');

assert.match(productionMain, /async function requestMotion\(\)/, 'Production keeps its proven launch path during M7');
assert.match(productionMain, /async function openLotFromRace\(\)/);
assert.doesNotMatch(productionMain, /createRaceSessionOrchestrator/);
assert.match(nextMain, /Generated from turn\/main\.js/);
assert.match(nextMain, /createRaceSessionOrchestrator/);
assert.match(nextMain, /session-orchestrator\.js\?source=20260729-r118-m8/);
assert.match(nextMain, /showRaceSetup: showTheLot/);
assert.match(nextMain, /motionButton\.addEventListener\('click', raceSession\.requestMotion\)/);
assert.match(nextMain, /manualButton\.addEventListener\('click', raceSession\.useManualMode\)/);
assert.match(nextMain, /openLot: raceSession\.openLotFromRace/);
assert.match(nextApp, /turnHomeLifecycle = 'home-m8'/);
assert.doesNotMatch(nextMain, /async function requestMotion\(\)|async function openLotFromRace\(\)|async function startGame\(/);
assert.match(nextApp, /main\.js\?source=\$\{buildKey\}-m8/);
assert.ok(
  nextApp.indexOf('installDisplayLifecycleBridge({ platform: webPlatform })')
    < nextApp.indexOf("new URL(`./main.js?source=${buildKey}-m8`"),
  'M5 and M6 must install before the M7 session runtime'
);
assert.match(generator, /replaceRangeRequired/);
assert.match(generator, /raceSession = createRaceSessionOrchestrator/);

console.log('TURN NEXT Platform M7–M8 race-session orchestration passed.');
