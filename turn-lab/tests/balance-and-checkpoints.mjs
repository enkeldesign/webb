import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  LAP_CHECKPOINTS,
  crossedForwardGate,
  updateLapProgressState
} from '../../turn/race/lap-system.js';
import { resetRaceToStage } from '../../turn/race/game-state.js';

const catalogSource = await fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

assert.equal(catalog.VEHICLE_STAT_BUDGET, 18, 'TURN vehicle stat budget must remain 18');
assert.equal(catalog.CAR_CATALOG.length, 15, 'all 15 Lot cars must remain in the catalog');
for (const car of catalog.CAR_CATALOG) {
  assert.equal(
    catalog.getVehicleStatTotal(car.stats),
    catalog.VEHICLE_STAT_BUDGET,
    `${car.name} must spend exactly ${catalog.VEHICLE_STAT_BUDGET} stat points`
  );
}
assert.deepEqual(
  catalog.getCarDefinition('sedan').stats,
  { speed: 3, acceleration: 3, control: 3, drift: 3, boostPower: 3, boostDuration: 3 },
  'Sedan must remain the neutral 3/3/3/3/3/3 baseline'
);

assert.ok(LAP_CHECKPOINTS.length >= 10, 'anti-shortcut checkpoint chain must stay dense');

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  copy(other) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }
}

const samples = Array.from({ length: 100 }, (_, index) => ({
  point: { x: index, y: 0, z: 0 },
  tangent: { x: 1, y: 0, z: 0 }
}));
const state = {
  lapActive: true,
  lapCheckpointIndex: 0,
  lapStartedAt: 0,
  lapElapsed: 0,
  position: new Vec3(70, 0, 40),
  velocity: new Vec3(10, 0, 0),
  lastProgress: 0.07,
  progress: 0.09,
  trackDistance: 1,
  lapPreviousPosition: { x: 69, z: 40 }
};

let began = 0;
let completed = 0;
const run = (now) => updateLapProgressState({
  state,
  nearestAfter: { sample: samples[Math.round(state.progress * samples.length) % samples.length] },
  samples,
  trackWidth: 27,
  now,
  beginTimedLap: () => { began += 1; },
  completeLap: () => { completed += 1; },
  recordGhostFrame: () => {}
});

run(1000);
assert.equal(
  state.lapCheckpointIndex,
  0,
  'jumping past checkpoint progress while physically far from the gate must not count'
);

const firstCheckpointIndex = Math.round(LAP_CHECKPOINTS[0] * samples.length) % samples.length;
state.lapPreviousPosition = { x: firstCheckpointIndex - 2, z: -30 };
state.position = new Vec3(firstCheckpointIndex + 2, 0, 30);
run(1100);
assert.equal(
  state.lapCheckpointIndex,
  1,
  'a checkpoint crossed between physics samples must count even when neither sampled endpoint is near the gate'
);
assert.equal(began, 0, 'the swept checkpoint regression must not accidentally cross the start line');

const secondCheckpointIndex = Math.round(LAP_CHECKPOINTS[1] * samples.length) % samples.length;
state.lapPreviousPosition = { x: secondCheckpointIndex - 2, z: 0 };
state.position = new Vec3(secondCheckpointIndex + 2, 0, 0);
state.velocity = new Vec3(-10, 0, 0);
run(1200);
assert.equal(state.lapCheckpointIndex, 1, 'crossing a checkpoint backwards must not count');

state.lapPreviousPosition = { x: secondCheckpointIndex - 2, z: 0 };
state.position = new Vec3(secondCheckpointIndex + 2, 0, 0);
state.velocity = new Vec3(10, 0, 0);
run(1300);
assert.equal(state.lapCheckpointIndex, 2, 'ordered forward swept checkpoint crossing must count');

assert.equal(
  crossedForwardGate(
    { x: -4, z: 10 },
    { x: 4, z: 10 },
    samples[0],
    12
  ),
  true,
  'a physical gate crossing should be detected from the swept car path'
);
assert.equal(
  crossedForwardGate(
    { x: -4, z: 20 },
    { x: 4, z: 20 },
    samples[0],
    12
  ),
  false,
  'crossing the gate plane too far from the track must remain invalid'
);

state.lastProgress = 0.4;
state.progress = 0.4;
state.lapCheckpointIndex = LAP_CHECKPOINTS.length - 1;
state.lapPreviousPosition = { x: -2, z: 0 };
state.position = new Vec3(2, 0, 0);
run(1400);
assert.equal(completed, 0, 'missing even one checkpoint must prevent lap completion');
assert.equal(began, 1, 'an incomplete lap must immediately restart the timed attempt at the finish line');
assert.equal(state.suppressNextLapStartMessage, true, 'invalid-lap restart must suppress a competing GO message');

state.suppressNextLapStartMessage = false;
state.lastProgress = 0.4;
state.progress = 0.4;
state.lapCheckpointIndex = LAP_CHECKPOINTS.length;
state.lapPreviousPosition = { x: -2, z: 0 };
state.position = new Vec3(2, 0, 0);
run(1500);
assert.equal(completed, 1, 'the physical start gate must complete a full checkpoint chain without relying on progress wrap');

state.lapActive = false;
state.lastProgress = 0.4;
state.progress = 0.4;
state.lapPreviousPosition = { x: -2, z: 0 };
state.position = new Vec3(2, 0, 0);
run(1600);
assert.equal(began, 2, 'the first physical forward start-line crossing must begin timing even when nearest-track progress does not wrap');

const doubleTriggerState = {
  lapActive: false,
  lapCheckpointIndex: 0,
  lapStartedAt: 0,
  lapElapsed: 0,
  position: new Vec3(-1, 0, 0),
  velocity: new Vec3(10, 0, 0),
  lastProgress: 0.96,
  progress: 0.02,
  trackDistance: 1,
  lapPreviousPosition: { x: -2, z: 0 }
};
let doubleTriggerStarts = 0;
const runDoubleTrigger = (now) => updateLapProgressState({
  state: doubleTriggerState,
  nearestAfter: { sample: samples[0] },
  samples,
  trackWidth: 27,
  now,
  beginTimedLap: () => {
    doubleTriggerStarts += 1;
    doubleTriggerState.lapActive = true;
    doubleTriggerState.lapCheckpointIndex = 0;
  },
  completeLap: () => {},
  recordGhostFrame: () => {}
});

runDoubleTrigger(1700);
assert.equal(
  doubleTriggerStarts,
  0,
  'nearest-track progress wrapping before the painted line must not start a lap early'
);
doubleTriggerState.lastProgress = 0.02;
doubleTriggerState.progress = 0.03;
doubleTriggerState.position = new Vec3(1, 0, 0);
runDoubleTrigger(1800);
assert.equal(
  doubleTriggerStarts,
  1,
  'one physical start-line crossing must create exactly one lap start after an early progress wrap'
);

const resetState = {
  position: new Vec3(999, 0, 999),
  velocity: new Vec3(4, 0, 2),
  competitorLaps: [{}, {}],
  lapPreviousPosition: { x: -999, z: -999 },
  lapCheckpointIndex: 7,
  lapStartedAt: 1234,
  lapElapsed: 9,
  recording: [{ t: 1 }],
  lapActive: true,
  mode: 'racing'
};
resetRaceToStage({ state: resetState, samples, showFeedback: false });
assert.deepEqual(
  resetState.lapPreviousPosition,
  { x: resetState.position.x, z: resetState.position.z },
  'reset must clear stale gate history so the next start crossing is measured from the reset position'
);
assert.equal(resetState.lapCheckpointIndex, 0, 'reset must clear checkpoint progress');
assert.equal(resetState.lapActive, false, 'reset must return to staged pre-lap state');

const [carModelsSource, mainSource, lapSystemSource] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8')
]);
assert.match(carModelsSource, /const TIRE_COLOR = 0x17191c/, 'asset vehicle wheels must be forced to a dark tire colour');
assert.match(carModelsSource, /material\.transparent = false/, 'ghost materials must be solid');
assert.match(carModelsSource, /material\.opacity = 1/, 'ghost materials must be fully opaque');
assert.match(carModelsSource, /ghost \? ghostColor : requestedColor/, 'ghost body paint must use the lighter precursor colour');
assert.match(mainSource, /const ghostCar = makeCar\(0x38d9ff, 1\)/, 'procedural ghost fallback must also be solid');
assert.match(mainSource, /const car = makeCar\(0x38d9ff, 1\)/, 'additional procedural rival fallbacks must also be solid');
assert.match(lapSystemSource, /crossedForwardGate/, 'production lap registration must use swept physical gates');
assert.match(lapSystemSource, /CHECKPOINT_GATE_HALF_WIDTH_FACTOR = 1\.05/, 'checkpoint gates must allow broad grass and verge racing lines');
assert.match(lapSystemSource, /START_GATE_HALF_WIDTH_FACTOR = 0\.82/, 'start and finish must keep the established narrower crossing gate');
assert.match(lapSystemSource, /turn:lap-invalid/, 'an incomplete checkpoint chain must report an invalid lap instead of failing silently');
assert.doesNotMatch(lapSystemSource, /crossedStartByProgress/, 'start and finish must not retain the retired progress-wrap fallback');

console.log('TURN forgiving swept lap gates, single-source start line and anti-shortcut regression passed.');
