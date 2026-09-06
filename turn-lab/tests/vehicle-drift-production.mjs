import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { CAR_CATALOG, deriveVehicleTuning, getVehicleStatTotal } from '../../turn/vehicle/catalog.js';
import {
  OVERDRIVE_BUILD_SECONDS,
  OVERDRIVE_MAX_SPEED_MULTIPLIER,
  getOverdriveSpeedMultiplier,
  getVehicleSpeedLimit,
  resolveDriftSpeedMultiplier,
  resolveOverchargedControlMultiplier,
  resolveVehicleOverchargedAccelerationMultiplier,
  updateVehicleOverdriveState,
  vehicleHasOverdrive,
  vehicleIgnoresOffRoadPenalty
} from '../../turn/vehicle/physics.js';

const [physicsSource, controlsSource, mainSource, showcaseSource, trophyRoadSource] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/trophy-road-showcase.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/progression/trophy-road.js', import.meta.url), 'utf8')
]);

const STAT_KEYS = Object.freeze([
  'speed',
  'acceleration',
  'control',
  'drift',
  'boostPower',
  'boostDuration'
]);
const CORE_TUNING_KEYS = Object.freeze([
  'topSpeedMultiplier',
  'accelerationMultiplier',
  'controlMultiplier',
  'driftEngineMultiplier',
  'driftDragAdd',
  'driftSpeedMultiplier',
  'driftStabilityMultiplier',
  'boostPowerMultiplier',
  'boostSpeedMultiplier',
  'boostDurationSeconds'
]);
const CORE_TUNING_OVERRIDES = Object.freeze({
  'vintage-racer': new Set(['driftDragAdd', 'driftSpeedMultiplier'])
});

// Attribute integrity: every ordinary 1–5 number is canonical game data, every car
// keeps the shared 18-point budget, and the runtime tuning is derived from those
// numbers unless an explicitly named perk owns that exact tuning field.
for (const car of CAR_CATALOG) {
  assert.equal(getVehicleStatTotal(car.stats), 18, `${car.name} must retain the shared 18-point attribute budget`);
  for (const statKey of STAT_KEYS) {
    assert.ok(Number.isInteger(car.stats[statKey]), `${car.name} ${statKey} must be an integer attribute`);
    assert.ok(car.stats[statKey] >= 1 && car.stats[statKey] <= 5, `${car.name} ${statKey} must stay on the 1–5 scale`);
  }

  const derived = deriveVehicleTuning(car.stats);
  const overrides = CORE_TUNING_OVERRIDES[car.id] || new Set();
  for (const tuningKey of CORE_TUNING_KEYS) {
    if (overrides.has(tuningKey)) continue;
    assert.equal(
      car.tuning[tuningKey],
      derived[tuningKey],
      `${car.name} ${tuningKey} must be derived from its displayed canonical attributes`
    );
  }
}

const neutralStats = Object.freeze({
  speed: 3,
  acceleration: 3,
  control: 3,
  drift: 3,
  boostPower: 3,
  boostDuration: 3
});
const tuningCurve = (statKey, tuningKey) => [1, 2, 3, 4, 5].map((value) => deriveVehicleTuning({
  ...neutralStats,
  [statKey]: value
})[tuningKey]);
assert.deepEqual(tuningCurve('speed', 'topSpeedMultiplier'), [0.84, 0.92, 1, 1.06, 1.12]);
assert.deepEqual(tuningCurve('acceleration', 'accelerationMultiplier'), [0.82, 0.91, 1, 1.08, 1.16]);
assert.deepEqual(tuningCurve('control', 'controlMultiplier'), [0.88, 0.94, 1, 1.07, 1.14]);
assert.deepEqual(tuningCurve('drift', 'driftSpeedMultiplier'), [0.76, 0.8, 0.84, 0.88, 0.92]);
assert.deepEqual(tuningCurve('drift', 'driftStabilityMultiplier'), [0.82, 0.91, 1, 1.09, 1.18]);
assert.deepEqual(tuningCurve('drift', 'driftDragAdd'), [0.16, 0.13, 0.1, 0.075, 0.055]);
assert.deepEqual(tuningCurve('boostPower', 'boostPowerMultiplier'), [0.78, 0.89, 1, 1.13, 1.26]);
assert.deepEqual(tuningCurve('boostPower', 'boostSpeedMultiplier'), [1.23, 1.275, 1.32, 1.35, 1.38]);
assert.deepEqual(tuningCurve('boostDuration', 'boostDurationSeconds'), [1.56, 1.96, 2.3, 2.92, 3.74]);

// The new tank curve deliberately helps the weakest tanks most while retaining a
// meaningful duration spread between 1/5 and 5/5. Gameplay controls still apply the
// existing shared 1.5x duration multiplier on top of these stat-derived base seconds.
const previousTankCurve = [1.2, 1.6, 2, 2.65, 3.4];
const currentTankCurve = tuningCurve('boostDuration', 'boostDurationSeconds');
const tankGrowth = currentTankCurve.map((seconds, index) => seconds / previousTankCurve[index] - 1);
assert.ok(tankGrowth[0] >= 0.29 && tankGrowth[0] <= 0.31, '1/5 BOOST TANK should gain about 30 percent capacity');
assert.ok(tankGrowth[1] > tankGrowth[2], '2/5 BOOST TANK should receive more help than the middle rating');
assert.ok(tankGrowth[2] > tankGrowth[3], 'The BOOST TANK expansion should taper toward stronger tanks');
assert.ok(tankGrowth[4] >= 0.09 && tankGrowth[4] <= 0.11, '5/5 BOOST TANK should gain only about 10 percent capacity');

// Runtime wiring: the six player-facing attributes must reach actual driving code,
// not stop at the Lot card.
assert.match(mainSource, /maxSpeed: MAX_SPEED \* state\.vehicleTuning\.topSpeedMultiplier/,
  'TOP SPEED must scale the actual race speed ceiling');
assert.match(physicsSource, /enginePower =[\s\S]*accelerationMultiplier/,
  'ACCELERATION must scale forward engine power');
assert.match(physicsSource, /reversePower = lerp\(27, 20, offRoadPenalty\) \* accelerationMultiplier/,
  'ACCELERATION must also scale reverse power consistently');
assert.match(physicsSource, /steeringStatMultiplier =[\s\S]*controlMultiplier/,
  'CONTROL must scale actual steering authority');
assert.match(physicsSource, /controlGripMultiplier =[\s\S]*controlMultiplier/,
  'CONTROL must contribute to actual road grip');
assert.match(physicsSource, /driftHeld \? driftEngineMultiplier : 1/,
  'DRIFT must affect engine power while drifting');
assert.match(physicsSource, /driftHeld \? driftDragAdd : 0/,
  'DRIFT must affect drag while drifting');
assert.match(physicsSource, /baseSpeedLimit \* effectiveDriftSpeedMultiplier/,
  'DRIFT must affect the active speed ceiling');
assert.match(physicsSource, /signedDriftSlipAngle = Math\.atan2\(/,
  'The DRIFT ceiling must respond to real velocity slip instead of only button state');
assert.match(physicsSource, /state\.driftSlipAngle = signedDriftSlipAngle/,
  'Automatic drift scoring must receive the signed physical slip direction');
assert.match(physicsSource, /driftSlipAngle = Math\.abs\(signedDriftSlipAngle\)/,
  'The existing speed ceiling must continue using slip magnitude');
assert.doesNotMatch(physicsSource, /signedDriftSlipAngle = Math\.atan2\([\s\S]{0,140}Math\.abs\(state\.velocity\.dot\(currentForward\)\)/,
  'The DRIFT ceiling must not fold reverse-heading spins back into a mild forward slip');
assert.match(physicsSource, /driftSlipAngle,[\s\S]*driftLockAmount/,
  'The live speed-limit call must pass both slip angle and LOCK state');
assert.match(physicsSource, /3\.2 \* driftStabilityMultiplier/,
  'DRIFT must affect slide recovery');
assert.match(physicsSource, /0\.42 \* driftStabilityMultiplier/,
  'DRIFT must affect lateral stability');
assert.match(mainSource, /driftLock: globalThis\.__turnDriftLockAmount \|\| 0/,
  'The runtime must pass the smoothed binary DRIFT LOCK amount into vehicle physics');
assert.match(physicsSource, /lockYawMultiplier = lerp\(1, 1\.55, driftLockAmount\)/,
  'The short LOCK transition must scale rotation without adding wheel simulations');
assert.match(physicsSource, /lockGripMultiplier = lerp\(1, 0\.22, driftLockAmount\)/,
  'The short LOCK transition must release rear lateral grip');
assert.match(physicsSource, /driftLockAmount \* lockDragAdd/,
  'LOCK must apply the selected vehicle’s gated handbrake-like speed cost');
assert.match(physicsSource, /\* tuningBoostPowerMultiplier/,
  'BOOST POWER must scale actual boost acceleration');
assert.match(physicsSource, /boostSpeedMultiplier: tuningBoostSpeedMultiplier/,
  'BOOST POWER must scale the actual boosted speed ceiling');
assert.match(controlsSource, /getBoostDrainSeconds\(\)[\s\S]*__turnVehicleTuning\?\.boostDurationSeconds/,
  'BOOST TANK must determine actual boost drain duration');

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
  'Ordinary DRIFT ratings must retain the 24% to 8% committed-slide base penalty curve'
);
assert.deepEqual(
  driftTunings.map((tuning) => tuning.driftStabilityMultiplier),
  [0.82, 0.91, 1, 1.09, 1.18],
  'Higher ordinary DRIFT ratings must settle lateral motion more cleanly'
);

const neutralDriftBase = driftTunings[2].driftSpeedMultiplier;
const flowingDriftMultiplier = resolveDriftSpeedMultiplier({
  driftSpeedMultiplier: neutralDriftBase,
  slipAngle: 0
});
const highSlipDriftMultiplier = resolveDriftSpeedMultiplier({
  driftSpeedMultiplier: neutralDriftBase,
  slipAngle: Math.PI * 70 / 180
});
const reverseSpinDriftMultiplier = resolveDriftSpeedMultiplier({
  driftSpeedMultiplier: neutralDriftBase,
  slipAngle: Math.PI * 170 / 180
});
const lockedDriftMultiplier = resolveDriftSpeedMultiplier({
  driftSpeedMultiplier: neutralDriftBase,
  slipAngle: 0,
  driftLockAmount: 1
});
assert.ok(Math.abs(flowingDriftMultiplier - 0.896) < 1e-12,
  'Low-slip DRIFT should retain 35 percent more of the old speed penalty budget');
assert.ok(Math.abs(highSlipDriftMultiplier - 0.872) < 1e-12,
  'A 70-degree slide should still retain 20 percent more speed than the former ordinary DRIFT cap');
assert.equal(reverseSpinDriftMultiplier, highSlipDriftMultiplier,
  'A car spun beyond 90 degrees must retain the full high-slip speed cost');
assert.equal(lockedDriftMultiplier, neutralDriftBase,
  'Full DRIFT LOCK must retain the committed legacy speed cost');
assert.ok(flowingDriftMultiplier > highSlipDriftMultiplier && highSlipDriftMultiplier > lockedDriftMultiplier,
  'DRIFT speed cost must rise progressively from flowing slide to high slip to LOCK');

const vintageRacer = CAR_CATALOG.find((car) => car.id === 'vintage-racer');
assert.ok(vintageRacer, 'Vintage Racer must remain in the vehicle catalog');
assert.deepEqual(vintageRacer.stats, {
  speed: 4,
  acceleration: 3,
  control: 2,
  drift: 5,
  boostPower: 2,
  boostDuration: 2
}, 'Vintage Racer must spend three ordinary stat points to reach maximum DRIFT');
assert.equal(getVehicleStatTotal(vintageRacer.stats), 18,
  'Vintage Racer must retain the shared 18-point vehicle budget');
assert.equal(vintageRacer.defaultColor, '#004455',
  'Vintage Racer must retain its current deep teal factory colour');
assert.equal(vintageRacer.perk?.title, 'DRIFTAGE');
assert.match(vintageRacer.perk?.description || '', /larger slip angles/i);
assert.equal(vintageRacer.tuning.driftSpeedMultiplier, 0.95,
  'DRIFTAGE must retain more speed than an ordinary maximum-DRIFT car');
assert.equal(vintageRacer.tuning.driftDragAdd, 0.045,
  'DRIFTAGE must add less drag than an ordinary maximum-DRIFT car');
assert.equal(vintageRacer.tuning.driftYawMultiplier, 1.28,
  'DRIFTAGE steering must become more aggressive while drifting');
assert.equal(vintageRacer.tuning.driftGripMultiplier, 0.72,
  'DRIFTAGE must reduce lateral correction so larger slip angles can be held');
assert.equal(vintageRacer.tuning.driftSlideMultiplier, 1.18,
  'DRIFTAGE must support a larger sustained slide');
const ordinaryDriftFive = deriveVehicleTuning(vintageRacer.stats);
assert.ok(vintageRacer.tuning.driftSpeedMultiplier > ordinaryDriftFive.driftSpeedMultiplier);
assert.ok(vintageRacer.tuning.driftDragAdd < ordinaryDriftFive.driftDragAdd);
assert.match(physicsSource, /steeringStatMultiplier \*[\s\S]*driftYawMultiplier/,
  'Vehicle physics must apply the car-owned DRIFT yaw multiplier');
assert.match(physicsSource, /0\.42 \* driftStabilityMultiplier \* driftGripTuningMultiplier/,
  'Vehicle physics must apply the car-owned slip/grip multiplier');
assert.match(physicsSource,
  /slideStrength = \(driftHeld \? 0\.235 : 0\.12\) \*[\s\S]*driftSlideMultiplier \* lockSlideMultiplier/,
  'Vehicle physics must apply both the car-owned and smoothed binary LOCK slide multipliers');

const rallyRacer = CAR_CATALOG.find((car) => car.id === 'toy-racer');
assert.ok(rallyRacer, 'The former Toy Racer asset/id must remain available for saved selections and ghosts');
assert.equal(rallyRacer.name, 'Rally Racer', 'Toy Racer must be presented as Rally Racer without changing its stable id');
assert.deepEqual(rallyRacer.stats, {
  speed: 4,
  acceleration: 4,
  control: 1,
  drift: 4,
  boostPower: 4,
  boostDuration: 1
}, 'Rally Racer must keep the intentional high-skill 4/4/1/4/4/1 profile');
assert.equal(getVehicleStatTotal(rallyRacer.stats), 18,
  'Rally Racer must retain the shared 18-point vehicle budget');
const ordinaryRallyTuning = deriveVehicleTuning(rallyRacer.stats);
for (const tuningKey of CORE_TUNING_KEYS) {
  assert.equal(
    rallyRacer.tuning[tuningKey],
    ordinaryRallyTuning[tuningKey],
    `Rally Racer ${tuningKey} must come from its 4/4/1/4/4/1 attributes`
  );
}
assert.equal(rallyRacer.defaultColor, '#cccccc', 'Rally Racer factory paint must be #ccc');
assert.equal(rallyRacer.perk?.title, 'TWITCHY TURNY');
assert.match(rallyRacer.perk?.description || '', /fills BOOST even faster/i);
assert.doesNotMatch(rallyRacer.perk?.description || '', /tiny|small(?:er)? tank/i,
  'TWITCHY TURNY copy must not imply a special Boost-tank penalty');
assert.equal(rallyRacer.stats.boostDuration, 1,
  'Rally Racer must use the ordinary minimum 1/5 Boost Tank attribute');
assert.equal(rallyRacer.tuning.boostDurationSeconds, 1.56,
  'Rating 1 must use the new larger ordinary Boost tank with no Rally-specific downsizing');
assert.equal(rallyRacer.tuning.driftBoostRechargeMultiplier, 3.6,
  'TWITCHY TURNY must recharge Boost 50% faster than the ordinary 2.4x DRIFT recharge');
assert.match(controlsSource, /function getDriftRechargeMultiplier\(\)/);
assert.match(controlsSource, /driftBoostRechargeMultiplier/);
assert.match(
  controlsSource,
  /resolveDriftBoostRechargeMultiplier\(\{[\s\S]*lockedMultiplier: getDriftRechargeMultiplier\(\)/,
  'The selected car tuning must remain the LOCK recharge ceiling while regular DRIFT uses the midpoint'
);

const suv = CAR_CATALOG.find((car) => car.id === 'suv');
assert.ok(suv, 'SUV must remain in the vehicle catalog');
assert.equal(suv.defaultColor, '#0555aa', 'Luxury SUV factory paint must remain blue');
const awd = CAR_CATALOG.find((car) => car.id === 'convertible');
assert.ok(awd, 'AWD must remain in the stable Convertible catalog slot');
assert.equal(awd.defaultColor, '#776655', 'AWD factory paint must use the approved brown primary');
assert.equal(awd.defaultSecondaryColor, '#393329', 'AWD factory paint must use the approved dark brown secondary');

const raceCar = CAR_CATALOG.find((car) => car.id === 'race');
assert.ok(raceCar, 'Race Car must remain in the vehicle catalog');
assert.equal(raceCar.defaultColor, '#5d503f', 'Race Car factory paint must be the current brown');
assert.equal(raceCar.perk?.title, 'APEX GRIP');
assert.equal(raceCar.perk?.description,
  'OVERCHARGE increases CONTROL and ACCELERATION beyond their ordinary limits.');
assert.equal(raceCar.tuning.controlMultiplier, 1.07,
  'Race Car must retain its ordinary 4/5 CONTROL tuning when it is not OVERCHARGED');
assert.equal(raceCar.tuning.overchargeControlMultiplier, 1.21,
  'APEX GRIP must extend the established CONTROL curve one tier beyond its visible 5/5 ceiling');
assert.equal(raceCar.tuning.accelerationMultiplier, 1.08,
  'Race Car must retain its ordinary 4/5 ACCELERATION tuning outside OVERCHARGE');
assert.equal(raceCar.tuning.overchargeAccelerationMultiplier, 1.24,
  'APEX GRIP ACCELERATION must extend the established curve one tier beyond visible 5/5');
assert.equal(resolveOverchargedControlMultiplier({
  controlMultiplier: raceCar.tuning.controlMultiplier,
  overchargeControlMultiplier: raceCar.tuning.overchargeControlMultiplier,
  overcharge: 0
}), 1.07);
assert.equal(resolveOverchargedControlMultiplier({
  controlMultiplier: raceCar.tuning.controlMultiplier,
  overchargeControlMultiplier: raceCar.tuning.overchargeControlMultiplier,
  overcharge: 0.001
}), 1.21,
  'Any live OVERCHARGE must activate APEX GRIP CONTROL without requiring a separate catch flag');
assert.equal(resolveVehicleOverchargedAccelerationMultiplier({
  vehicleId: raceCar.id,
  accelerationMultiplier: raceCar.tuning.accelerationMultiplier,
  overchargeAccelerationMultiplier: raceCar.tuning.overchargeAccelerationMultiplier,
  overcharge: 0
}), 1.08);
assert.equal(resolveVehicleOverchargedAccelerationMultiplier({
  vehicleId: raceCar.id,
  accelerationMultiplier: raceCar.tuning.accelerationMultiplier,
  overchargeAccelerationMultiplier: raceCar.tuning.overchargeAccelerationMultiplier,
  overcharge: 0.001
}), 1.24,
  'Any live OVERCHARGE must immediately activate APEX GRIP ACCELERATION');
const visibleFiveAcceleration = deriveVehicleTuning({ ...raceCar.stats, acceleration: 5 }).accelerationMultiplier;
assert.equal(visibleFiveAcceleration, 1.16);
assert.equal(resolveVehicleOverchargedAccelerationMultiplier({
  vehicleId: raceCar.id,
  accelerationMultiplier: visibleFiveAcceleration,
  overchargeAccelerationMultiplier: raceCar.tuning.overchargeAccelerationMultiplier,
  overcharge: 1
}), 1.24,
  'APEX GRIP ACCELERATION must still exceed a visible 5/5 STANDARD or SHIFT baseline');
for (const car of CAR_CATALOG.filter((candidate) => candidate.id !== 'race')) {
  assert.equal(resolveOverchargedControlMultiplier({
    controlMultiplier: car.tuning.controlMultiplier,
    overchargeControlMultiplier: car.tuning.overchargeControlMultiplier,
    overcharge: 1
  }), car.tuning.controlMultiplier, `${car.name} must not inherit APEX GRIP CONTROL`);
}
assert.match(mainSource, /boostOvercharge: globalThis\.__turnBoostOvercharge \|\| 0/,
  'The current OVERCHARGE amount must reach vehicle physics every frame');
assert.match(physicsSource, /state\.apexGripActive = String\(state\.vehicleId \|\| ''\) === 'race'/,
  'Physics must expose whether Race Car is actively receiving APEX GRIP');

const truck = CAR_CATALOG.find((car) => car.id === 'truck');
assert.ok(truck, 'Truck must remain in the vehicle catalog');
assert.equal(truck.defaultColor, '#b93632', 'Truck factory paint must be the former Race Car red');
assert.equal(truck.perk?.description,
  'OVERCHARGE increases ACCELERATION and builds BOOST TANK up to 5/5.');
assert.equal(truck.tuning.overchargeAccelerationMultiplier, 1.24,
  'TORQUE must use the same beyond-5/5 ACCELERATION target as APEX GRIP');
assert.equal(resolveVehicleOverchargedAccelerationMultiplier({
  vehicleId: truck.id,
  perkUnlocked: false,
  accelerationMultiplier: truck.tuning.accelerationMultiplier,
  overchargeAccelerationMultiplier: truck.tuning.overchargeAccelerationMultiplier,
  overcharge: 1
}), truck.tuning.accelerationMultiplier,
  'Locked TORQUE must not change ACCELERATION');
assert.equal(resolveVehicleOverchargedAccelerationMultiplier({
  vehicleId: truck.id,
  perkUnlocked: true,
  accelerationMultiplier: truck.tuning.accelerationMultiplier,
  overchargeAccelerationMultiplier: truck.tuning.overchargeAccelerationMultiplier,
  overcharge: 0.001
}), 1.24,
  'Unlocked TORQUE must immediately apply the APEX-style ACCELERATION buff on any live OVERCHARGE');
for (const car of CAR_CATALOG.filter((candidate) => candidate.id !== 'race' && candidate.id !== 'truck')) {
  assert.equal(resolveVehicleOverchargedAccelerationMultiplier({
    vehicleId: car.id,
    perkUnlocked: true,
    accelerationMultiplier: car.tuning.accelerationMultiplier,
    overchargeAccelerationMultiplier: car.tuning.overchargeAccelerationMultiplier,
    overcharge: 1
  }), car.tuning.accelerationMultiplier, `${car.name} must not inherit the OVERCHARGE ACCELERATION perk`);
}
assert.match(physicsSource, /state\.torqueActive = String\(state\.vehicleId \|\| ''\) === 'truck'/,
  'Physics must expose whether unlocked TORQUE is actively receiving its OVERCHARGE ACCELERATION buff');

assert.match(
  showcaseSource,
  /'race-car': Object\.freeze\(\[[\s\S]*carId: 'race'/,
  'Race Car Trophy Road detail must use its 3D vehicle model'
);
assert.match(
  showcaseSource,
  /'vintage-racer': Object\.freeze\(\[[\s\S]*carId: 'vintage-racer'/,
  'Vintage Racer Trophy Road detail must use its 3D vehicle model'
);
assert.match(
  showcaseSource,
  /'rally-racer': Object\.freeze\(\[[\s\S]*carId: 'toy-racer'/,
  'Rally Racer Trophy Road detail must use the stable Toy Racer 3D asset'
);
assert.match(showcaseSource, /catalog\.js\?revision=r243-mountain-1300/,
  'Trophy Road models must use the refreshed factory colours');
assert.doesNotMatch(trophyRoadSource, /tank is tiny|tiny tank/i,
  'Trophy Road must not describe the ordinary 1\/5 Rally tank as an extra penalty');

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
    const flowLimit = getVehicleSpeedLimit({
      ...mode,
      maxSpeed,
      boostSpeedMultiplier: car.tuning.boostSpeedMultiplier,
      driftHeld: true,
      driftSpeedMultiplier: car.tuning.driftSpeedMultiplier,
      driftSlipAngle: Math.PI / 12
    });
    const highSlipLimit = getVehicleSpeedLimit({
      ...mode,
      maxSpeed,
      boostSpeedMultiplier: car.tuning.boostSpeedMultiplier,
      driftHeld: true,
      driftSpeedMultiplier: car.tuning.driftSpeedMultiplier,
      driftSlipAngle: Math.PI * 70 / 180
    });
    const lockLimit = getVehicleSpeedLimit({
      ...mode,
      maxSpeed,
      boostSpeedMultiplier: car.tuning.boostSpeedMultiplier,
      driftHeld: true,
      driftSpeedMultiplier: car.tuning.driftSpeedMultiplier,
      driftSlipAngle: Math.PI / 12,
      driftLockAmount: 1
    });

    assert.ok(flowLimit < gasLimit, `${car.name} must remain slower in flowing DRIFT than GAS on ${mode.name}`);
    assert.ok(highSlipLimit < flowLimit, `${car.name} must pay more speed for high slip than a flowing DRIFT on ${mode.name}`);
    assert.ok(lockLimit < highSlipLimit, `${car.name} must pay the strongest speed cost in full LOCK on ${mode.name}`);
    assert.ok(
      Math.abs(lockLimit / gasLimit - car.tuning.driftSpeedMultiplier) < 1e-12,
      `${car.name} full LOCK must retain its stat-derived committed DRIFT ceiling on ${mode.name}`
    );
  }
}

console.log('TURN all-car attribute-to-physics integrity, APEX GRIP, TORQUE, DRIFTAGE, TWITCHY TURNY, OVERSIZED and OVERDRIVE contracts passed for all 15 cars.');
