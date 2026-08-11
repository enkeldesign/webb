import assert from 'node:assert/strict';

import { CAR_CATALOG, deriveVehicleTuning } from '../../turn/vehicle/catalog.js';
import {
  OVERDRIVE_BUILD_SECONDS,
  OVERDRIVE_MAX_SPEED_MULTIPLIER,
  getOverdriveSpeedMultiplier,
  getVehicleSpeedLimit,
  updateVehicleOverdriveState,
  vehicleHasOverdrive,
  vehicleIgnoresOffRoadPenalty
} from '../../turn/vehicle/physics.js';

const driftTunings = [1, 2, 3, 4, 5].map((drift) => deriveVehicleTuning({
  speed: 3,
  acceleration: 3,
  control: 3,
  drift,
  boostPower: 3,
  boostDuration: 3
}));

assert.deepEqual(
  driftTunings.map((tuning) => tuning.driftSpeedMultiplier),
  [0.76, 0.8, 0.84, 0.88, 0.92],
  'DRIFT ratings must retain the agreed 24% to 8% speed-penalty curve'
);
assert.deepEqual(
  driftTunings.map((tuning) => tuning.driftStabilityMultiplier),
  [0.82, 0.91, 1, 1.09, 1.18],
  'Higher DRIFT ratings must settle lateral motion more cleanly'
);

const monsterTruck = CAR_CATALOG.find((car) => car.id === 'monster-truck');
assert.ok(monsterTruck, 'Monster Truck must remain in the vehicle catalog');
assert.equal(
  vehicleIgnoresOffRoadPenalty(monsterTruck.id),
  true,
  'Monster Truck must treat off-road terrain as track for vehicle physics'
);
for (const car of CAR_CATALOG.filter((candidate) => candidate.id !== 'monster-truck')) {
  assert.equal(
    vehicleIgnoresOffRoadPenalty(car.id),
    false,
    `${car.name} must keep the normal off-road physics penalty`
  );
}

const monsterMaxSpeed = 88 * monsterTruck.tuning.topSpeedMultiplier;
const monsterRoadLimit = getVehicleSpeedLimit({
  offRoad: false,
  boostActive: false,
  maxSpeed: monsterMaxSpeed,
  boostSpeedMultiplier: monsterTruck.tuning.boostSpeedMultiplier,
  driftHeld: false,
  driftSpeedMultiplier: monsterTruck.tuning.driftSpeedMultiplier
});
const monsterEffectiveOffRoadLimit = getVehicleSpeedLimit({
  offRoad: !vehicleIgnoresOffRoadPenalty(monsterTruck.id),
  boostActive: false,
  maxSpeed: monsterMaxSpeed,
  boostSpeedMultiplier: monsterTruck.tuning.boostSpeedMultiplier,
  driftHeld: false,
  driftSpeedMultiplier: monsterTruck.tuning.driftSpeedMultiplier
});
assert.equal(
  monsterEffectiveOffRoadLimit,
  monsterRoadLimit,
  'Monster Truck must retain its road speed limit while physically off-road'
);

const futureRacer = CAR_CATALOG.find((car) => car.id === 'race-future');
assert.ok(futureRacer, 'Future Racer must remain in the vehicle catalog');
assert.equal(OVERDRIVE_BUILD_SECONDS, 5, 'OVERDRIVE must take five clean seconds to fully build');
assert.equal(OVERDRIVE_MAX_SPEED_MULTIPLIER, 1.06, 'OVERDRIVE must top out at a small 6% speed-ceiling bonus');
assert.equal(vehicleHasOverdrive(futureRacer.id), true, 'Future Racer must own OVERDRIVE');
for (const car of CAR_CATALOG.filter((candidate) => candidate.id !== 'race-future')) {
  assert.equal(vehicleHasOverdrive(car.id), false, `${car.name} must not receive OVERDRIVE`);
}
assert.equal(getOverdriveSpeedMultiplier(0), 1);
assert.ok(Math.abs(getOverdriveSpeedMultiplier(2.5) - 1.03) < 1e-12);
assert.equal(getOverdriveSpeedMultiplier(5), 1.06);
assert.equal(getOverdriveSpeedMultiplier(20), 1.06, 'OVERDRIVE must clamp at its designed ceiling');

const overdriveState = { vehicleId: 'race-future', speed: 40, overdriveCleanSeconds: 0 };
updateVehicleOverdriveState({ state: overdriveState, dt: 2.5, speed: 40 });
assert.equal(overdriveState.overdriveCleanSeconds, 2.5);
assert.ok(Math.abs(getOverdriveSpeedMultiplier(overdriveState.overdriveCleanSeconds) - 1.03) < 1e-12);
updateVehicleOverdriveState({ state: overdriveState, dt: 2.5, speed: 40 });
assert.equal(overdriveState.overdriveCleanSeconds, 5);
assert.equal(getOverdriveSpeedMultiplier(overdriveState.overdriveCleanSeconds), 1.06);
updateVehicleOverdriveState({ state: overdriveState, offRoad: true });
assert.equal(overdriveState.overdriveCleanSeconds, 0, 'Leaving the road must reset OVERDRIVE immediately');
overdriveState.overdriveCleanSeconds = 5;
updateVehicleOverdriveState({ state: overdriveState, collided: true });
assert.equal(overdriveState.overdriveCleanSeconds, 0, 'A collision must reset OVERDRIVE immediately');
updateVehicleOverdriveState({ state: overdriveState, dt: 5, speed: 0 });
assert.equal(overdriveState.overdriveCleanSeconds, 0, 'Standing still must not preload OVERDRIVE');

const ordinaryState = { vehicleId: 'sedan', speed: 40, overdriveCleanSeconds: 4 };
assert.equal(updateVehicleOverdriveState({ state: ordinaryState, dt: 1, speed: 40 }), 1);
assert.equal(ordinaryState.overdriveCleanSeconds, 0, 'Non-perk cars must not retain OVERDRIVE state');

const drivingModes = [
  { name: 'road', offRoad: false, boostActive: false },
  { name: 'road with boost', offRoad: false, boostActive: true },
  { name: 'off-road', offRoad: true, boostActive: false },
  { name: 'off-road with boost', offRoad: true, boostActive: true }
];

for (const car of CAR_CATALOG) {
  assert.ok(car.tuning.driftEngineMultiplier < 1, `${car.name} must lose engine power in DRIFT`);
  assert.ok(car.tuning.driftDragAdd > 0, `${car.name} must gain drag in DRIFT`);
  assert.ok(car.tuning.driftSpeedMultiplier < 1, `${car.name} must have a DRIFT ceiling below GAS`);
  assert.ok(car.tuning.driftStabilityMultiplier > 0, `${car.name} must have a valid DRIFT stability profile`);

  const maxSpeed = 88 * car.tuning.topSpeedMultiplier;
  for (const mode of drivingModes) {
    const gasLimit = getVehicleSpeedLimit({
      ...mode,
      maxSpeed,
      boostSpeedMultiplier: car.tuning.boostSpeedMultiplier,
      driftHeld: false,
      driftSpeedMultiplier: car.tuning.driftSpeedMultiplier
    });
    const driftLimit = getVehicleSpeedLimit({
      ...mode,
      maxSpeed,
      boostSpeedMultiplier: car.tuning.boostSpeedMultiplier,
      driftHeld: true,
      driftSpeedMultiplier: car.tuning.driftSpeedMultiplier
    });

    assert.ok(
      driftLimit < gasLimit,
      `${car.name} must be slower in DRIFT than GAS on ${mode.name}`
    );
    assert.ok(
      Math.abs(driftLimit / gasLimit - car.tuning.driftSpeedMultiplier) < 1e-12,
      `${car.name} must apply its DRIFT rating consistently on ${mode.name}`
    );
  }
}

console.log('TURN DRIFT, Monster Truck all-terrain and Future Racer OVERDRIVE contracts passed for all 15 cars.');
