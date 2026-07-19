import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  LAP_CHECKPOINTS,
  updateLapProgressState
} from '../../turn/race/lap-system.js';

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
  trackDistance: 1
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
state.position = new Vec3(samples[firstCheckpointIndex].point.x, 0, 0);
run(1100);
assert.equal(state.lapCheckpointIndex, 1, 'driving through the physical checkpoint gate must count');

const secondCheckpointIndex = Math.round(LAP_CHECKPOINTS[1] * samples.length) % samples.length;
state.position = new Vec3(samples[secondCheckpointIndex].point.x, 0, 0);
state.velocity = new Vec3(-10, 0, 0);
run(1200);
assert.equal(state.lapCheckpointIndex, 1, 'crossing a checkpoint backwards must not count');

state.velocity = new Vec3(10, 0, 0);
run(1300);
assert.equal(state.lapCheckpointIndex, 2, 'ordered forward checkpoint crossing must count');

state.lastProgress = 0.9;
state.progress = 0.1;
state.lapCheckpointIndex = LAP_CHECKPOINTS.length - 1;
state.position = new Vec3(0, 0, 0);
run(1400);
assert.equal(completed, 0, 'missing even one checkpoint must prevent lap completion');
assert.equal(began, 1, 'an incomplete shortcut lap must restart the timed attempt');

const [carModelsSource, mainSource] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8')
]);
assert.match(carModelsSource, /const TIRE_COLOR = 0x17191c/, 'asset vehicle wheels must be forced to a dark tire colour');
assert.match(carModelsSource, /material\.transparent = false/, 'ghost materials must be solid');
assert.match(carModelsSource, /material\.opacity = 1/, 'ghost materials must be fully opaque');
assert.match(carModelsSource, /ghost \? ghostColor : requestedColor/, 'ghost body paint must use the lighter precursor colour');
assert.match(mainSource, /const ghostCar = makeCar\(0x38d9ff, 1\)/, 'procedural ghost fallback must also be solid');
assert.match(mainSource, /const car = makeCar\(0x38d9ff, 1\)/, 'additional procedural rival fallbacks must also be solid');

console.log('TURN balance and anti-shortcut regression passed.');
