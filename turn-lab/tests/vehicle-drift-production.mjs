import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

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

const [physicsSource, controlsSource] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8')
]);

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
  'Ordinary DRIFT ratings must retain the agreed 24% to 8% speed-penalty curve'
);
assert.deepEqual(
  driftTunings.map((tuning) => tuning.driftStabilityMultiplier),
  [0.82, 0.91, 1, 1.09, 1.18],
  'Higher ordinary DRIFT ratings must settle lateral motion more cleanly'
);

const vintageRacer = CAR_CATALOG.find((car) => car.id === 'vintage-racer');
assert.ok(vintageRacer, 'Vintage Racer must remain in the vehicle catalog');
assert.equal(vintageRacer.perk?.title, 'DRIFTAGE');
assert.match(vintageRacer.perk?.description || '', /larger slip angles/i);
assert.equal(vintageRacer.tuning.driftSpeedMultiplier, 0.9,
  'DRIFTAGE must retain substantially more speed than the Vintage Racer ordinary DRIFT-2 baseline');
assert.equal(vintageRacer.tuning.driftDragAdd, 0.07,
  'DRIFTAGE must add less drag while DRIFT is held');
assert.equal(vintageRacer.tuning.driftYawMultiplier, 1.28,
  'DRIFTAGE steering must become more aggressive while drifting');
assert.equal(vintageRacer.tuning.driftGripMultiplier, 0.72,
  'DRIFTAGE must reduce lateral correction so larger slip angles can be held');
assert.equal(vintageRacer.tuning.driftSlideMultiplier, 1.18,
  'DRIFTAGE must support a larger sustained slide');
const ordinaryDriftTwo = deriveVehicleTuning({
  speed: 4,
  acceleration: 4,
  control: 3,
  drift: 2,
  boostPower: 3,
  boostDuration: 2
});
assert.ok(vintageRacer.tuning.driftSpeedMultiplier > ordinaryDriftTwo.driftSpeedMultiplier);
assert.ok(vintageRacer.tuning.driftDragAdd < ordinaryDriftTwo.driftDragAdd);
assert.match(physicsSource, /steeringStatMultiplier \*[\s\S]*driftYawMultiplier/,
  'Vehicle physics must apply the car-owned DRIFT yaw multiplier');
assert.match(physicsSource, /0\.42 \* driftStabilityMultiplier \* driftGripTuningMultiplier/,
  'Vehicle physics must apply the car-owned slip/grip multiplier');
assert.match(physicsSource, /slideStrength = \(driftHeld \? 0\.235 : 0\.12\) \* driftSlideMultiplier/,
  'Vehicle physics must apply the car-owned sustained-slide multiplier');

const rallyRacer = CAR_CATALOG.find((car) => car.id === 'toy-racer');
assert.ok(rallyRacer, 'The former Toy Racer asset/id must remain available for saved selections and ghosts');
assert.equal(rallyRacer.name, 'Rally Racer', 'Toy Racer must be presented as Rally Racer without changing its stable id');
assert.equal(rallyRacer.perk?.title, 'TWITCHY TURNY');
assert.match(rallyRacer.perk?.description || '', /fills BOOST even faster/i);
assert.equal(rallyRacer.tuning.boostDurationSeconds, 1.2,
  'Rally Racer must retain the smallest Boost tank');
assert.equal(rallyRacer.tuning.driftBoostRechargeMultiplier, 3.6,
  'TWITCHY TURNY must recharge Boost 50% faster than the ordinary 2.4x DRIFT recharge');
assert.match(controlsSource, /function getDriftRechargeMultiplier\(\)/);
assert.match(controlsSource, /driftBoostRechargeMultiplier/);
assert.match(
  controlsSource,
  /globalThis\.__turnDriftHeld \? getDriftRechargeMultiplier\(\) : 1/,
  'Boost recharge must read the selected car tuning only while DRIFT is held'
);

const monsterTruck = CAR_CATALOG.find((car) => car.id === 'monster-truck');
assert.ok(monsterTruck, 'Monster Truck must remain in the vehicle catalog');
assert.equal(monsterTruck.perk?.title, 'OVERSIZED');
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
assert.equal(futureRacer.perk?.title, 'OVERDRIVE');
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
      `${car.name} must apply its DRIFT ceiling consistently on ${mode.name}`
    );
  }
}

console.log('TURN DRIFT, DRIFTAGE, TWITCHY TURNY, OVERSIZED and OVERDRIVE contracts passed for all 15 cars.');
