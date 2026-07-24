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
  assert.ok(car.tuning.driftSpeedMultiplier < 1, `${car.name} must always be slower in DRIFT than GAS`);
  assert.ok(car.tuning.driftEngineMultiplier < 1, `${car.name} must lose engine power in DRIFT`);
  assert.ok(car.tuning.driftDragAdd > 0, `${car.name} must gain drag in DRIFT`);
}
assert.deepEqual(
  catalog.getCarDefinition('sedan').stats,
  { speed: 3, acceleration: 3, control: 3, drift: 3, boostPower: 3, boostDuration: 3 },
  'Sedan must remain the neutral 3/3/3/3/3/3 baseline'
);
assert.deepEqual(
  catalog.VEHICLE_STAT_LEGEND.map((entry) => entry.label),
  ['TOP SPEED', 'ACCELERATION', 'CONTROL', 'DRIFT', 'BOOST POWER', 'BOOST TANK'],
  'The Lot legend must expose the agreed six player-facing stat names'
);
assert.deepEqual(
  [1, 2, 3, 4, 5].map((rating) => catalog.deriveVehicleTuning({
    speed: 3,
    acceleration: 3,
    control: 3,
    drift: rating,
    boostPower: 3,
    boostDuration: 3
  }).driftSpeedMultiplier),
  [0.76, 0.8, 0.84, 0.88, 0.92],
  'DRIFT ratings must retain the agreed 24% to 8% speed penalty curve'
);

assert.ok(LAP_CHECKPOINTS.length >= 10, 'anti-shortcut checkpoint chain must stay dense');

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  copy(other) { this.x = other.x; this.y = other.y; this.z = other.z; return this; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  dot(other) { return this.x * other.x + this.y * other.y + this.z * other.z; }
}

const samples = Array.from({ length: 100 }, (_, index) => ({ point: { x: index, y: 0, z: 0 }, tangent: { x: 1, y: 0, z: 0 } }));
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
assert.equal(state.lapCheckpointIndex, 0, 'jumping past checkpoint progress while physically far from the gate must not count');

const firstCheckpointIndex = Math.round(LAP_CHECKPOINTS[0] * samples.length) % samples.length;
state.lapPreviousPosition = { x: firstCheckpointIndex - 2, z: -30 };
state.position = new Vec3(firstCheckpointIndex + 2, 0, 30);
run(1100);
assert.equal(state.lapCheckpointIndex, 1, 'a checkpoint crossed between physics samples must count');
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

const skippedGateState = {
  lapActive: true,
  lapInvalid: false,
  lapCheckpointIndex: 0,
  lapStartedAt: 0,
  lapElapsed: 0,
  position: new Vec3(secondCheckpointIndex + 2, 0, 0),
  velocity: new Vec3(10, 0, 0),
  progress: LAP_CHECKPOINTS[1],
  trackDistance: 1,
  lapPreviousPosition: { x: secondCheckpointIndex - 2, z: 0 }
};
updateLapProgressState({
  state: skippedGateState,
  nearestAfter: { sample: samples[secondCheckpointIndex] },
  samples,
  trackWidth: 27,
  now: 1350,
  beginTimedLap: () => assert.fail('crossing a later checkpoint must not restart the lap immediately'),
  completeLap: () => assert.fail('crossing a later checkpoint must not complete the lap'),
  recordGhostFrame: () => {}
});
assert.equal(skippedGateState.lapCheckpointIndex, 0, 'skipping the required checkpoint must not advance the ordered chain');
assert.equal(skippedGateState.lapInvalid, true, 'crossing a later gate must invalidate the current attempt');

assert.equal(crossedForwardGate({ x: -4, z: 10 }, { x: 4, z: 10 }, samples[0], 12), true, 'a physical gate crossing should be detected');
assert.equal(crossedForwardGate({ x: -4, z: 20 }, { x: 4, z: 20 }, samples[0], 12), false, 'crossing too far from the track must remain invalid');

state.lastProgress = 0.4;
state.progress = 0.4;
state.lapCheckpointIndex = LAP_CHECKPOINTS.length - 1;
state.lapPreviousPosition = { x: -2, z: 0 };
state.position = new Vec3(2, 0, 0);
run(1400);
assert.equal(completed, 0, 'missing one checkpoint must prevent lap completion');
assert.equal(began, 1, 'an incomplete lap must restart at the finish line');
assert.equal(state.suppressNextLapStartMessage, true, 'invalid restart must suppress a competing GO message');

state.suppressNextLapStartMessage = false;
state.lapInvalid = false;
state.lastProgress = 0.4;
state.progress = 0.4;
state.lapCheckpointIndex = LAP_CHECKPOINTS.length;
state.lapPreviousPosition = { x: -2, z: 0 };
state.position = new Vec3(2, 0, 0);
run(1500);
assert.equal(completed, 1, 'the physical start gate must complete a full checkpoint chain');

state.lapActive = false;
state.lastProgress = 0.4;
state.progress = 0.4;
state.lapPreviousPosition = { x: -2, z: 0 };
state.position = new Vec3(2, 0, 0);
run(1600);
assert.equal(began, 2, 'the first physical forward crossing must begin timing');

const resetState = {
  position: new Vec3(999, 0, 999),
  velocity: new Vec3(4, 0, 2),
  competitorLaps: [{}, {}],
  lapPreviousPosition: { x: -999, z: -999 },
  lapCheckpointIndex: 7,
  lapInvalid: true,
  lapStartedAt: 1234,
  lapElapsed: 9,
  recording: [{ t: 1 }],
  lapActive: true,
  mode: 'racing'
};
resetRaceToStage({ state: resetState, samples, showFeedback: false });
assert.deepEqual(resetState.lapPreviousPosition, { x: resetState.position.x, z: resetState.position.z }, 'reset must clear stale gate history');
assert.equal(resetState.lapCheckpointIndex, 0, 'reset must clear checkpoint progress');
assert.equal(resetState.lapInvalid, false, 'Restart Lap must clear invalid-lap state');
assert.equal(resetState.lapActive, false, 'reset must return to staged pre-lap state');

const [carModelsSource, mainSource, lapSystemSource, gameStateSource, physicsSource, lotSource] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/game-state.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8')
]);
assert.match(carModelsSource, /const TIRE_COLOR = 0x17191c/, 'asset vehicle wheels must be dark');
assert.match(carModelsSource, /material\.transparent = false/, 'ghost materials must be solid');
assert.match(carModelsSource, /material\.opacity = 1/, 'ghost materials must be opaque');
assert.match(carModelsSource, /ghost \? ghostColor : requestedColor/, 'ghost body paint must use the lighter colour');
assert.match(mainSource, /const ghostCar = makeCar\(0x38d9ff, 1\)/, 'procedural ghost fallback must be solid');
assert.match(mainSource, /const car = makeCar\(0x38d9ff, 1\)/, 'additional rival fallbacks must be solid');
assert.match(lapSystemSource, /crossedForwardGate/, 'production lap registration must use swept gates');
assert.match(lapSystemSource, /crossedLaterCheckpointGate/, 'passing a later gate must expose invalidity');
assert.match(lapSystemSource, /state\.lapInvalid = true/, 'skipped route detection must persist invalidity');
assert.match(lapSystemSource, /CHECKPOINT_GATE_HALF_WIDTH_FACTOR = 1\.05/, 'checkpoint gates must allow broad racing lines');
assert.match(lapSystemSource, /START_GATE_HALF_WIDTH_FACTOR = 0\.82/, 'start and finish must remain narrower');
assert.match(lapSystemSource, /turn:lap-invalid/, 'an incomplete chain must report invalidity');
assert.doesNotMatch(lapSystemSource, /crossedStartByProgress/, 'start and finish must not retain progress-wrap fallback');
assert.match(gameStateSource, /state\.lapInvalid = false/, 'race staging must clear invalid-lap status');
assert.match(physicsSource, /driftHeld \? effectiveMaxSpeed \* driftSpeedMultiplier/, 'production physics must enforce the DRIFT speed ceiling');
assert.match(lotSource, /WHAT DO THE STATS MEAN\?/, 'The Lot must expose a discoverable stat legend');
assert.match(lotSource, /VEHICLE_STAT_LEGEND/, 'The Lot must render the shared stat definitions');

console.log('TURN stat legend, mandatory drift penalty and anti-shortcut regression passed.');