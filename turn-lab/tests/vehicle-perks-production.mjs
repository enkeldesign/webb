import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  CAR_CATALOG,
  deriveVehicleTuning
} from '../../turn/vehicle/catalog.js';
import { resolveVehiclePerkStatusFeedback } from '../../turn/vehicle/perk-presentation.js';
import {
  getVehicleSpeedLimit,
  resolveOverchargedControlMultiplier,
  resolveVehicleOverchargedAccelerationMultiplier
} from '../../turn/vehicle/physics.js';
import { PERK_RARITY, VEHICLE_PERKS, getVehiclePerk, originalVehiclePerk } from '../../turn/vehicle/perks.js';
import { consumeBoostTank, convertBoostTank, decayConvertedBoost, ROAD_RAGE_CONVERSION_SECONDS } from '../../turn/input/boost-tank.js';
import {
  CARRY_ON_LOCK_DRAG_ADD,
  CLEAN_EXIT_CONTROL_BONUS,
  CLEAN_EXIT_SECONDS,
  DRIFT_DEMON_BUILD_SECONDS,
  DRIFT_DEMON_DECAY_SECONDS,
  FULL_TANK_BUILD_SECONDS,
  FULL_TANK_MIN_SPEED,
  GRADUATED_MAX_ACCELERATION_MULTIPLIER,
  GRADUATED_MAX_CONTROL_MULTIPLIER,
  GRADUATED_MAX_TOP_SPEED_MULTIPLIER,
  GRADUATED_STAGE_SECONDS,
  GRADUATED_TOTAL_SECONDS,
  STANDARD_LOCK_DRAG_ADD,
  TORQUE_BUILD_SECONDS,
  TRACTION_MIN_OFFROAD_PENALTY,
  activeVehiclePerkIds,
  advanceVehiclePerkRuntimeState,
  resetVehiclePerkRuntimeState,
  resolveGraduatedStageFeedback,
  resolveVehicleLockDragAdd,
  resolveVehicleOffRoadPenalty,
  resolveVehiclePerkTuning
} from '../../turn/vehicle/perk-runtime.js';

const [indexSource, mainSource, physicsSource, controlsSource, gameStateSource, achievementsRuntimeSource, perkRuntimeSource] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/game-state.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/perk-runtime.js', import.meta.url), 'utf8')
]);

function perkState(vehicleId, perkUnlocked, tuning, installedPerkId = '') {
  const state = {
    vehicleId,
    vehiclePerkUnlocked: perkUnlocked,
    vehicleInstalledPerkId: installedPerkId,
    vehicleTuning: tuning,
    vehicleEffectiveTuning: tuning
  };
  resetVehiclePerkRuntimeState(state);
  return state;
}

function advanceForSeconds(state, seconds, inputs = {}) {
  const steps = Math.ceil(seconds / 0.1);
  for (let index = 0; index < steps; index += 1) {
    advanceVehiclePerkRuntimeState({ state, dt: Math.min(0.1, seconds - index * 0.1), ...inputs });
  }
}

const awd = CAR_CATALOG.find(({ id }) => id === 'convertible');
const truck = CAR_CATALOG.find(({ id }) => id === 'truck');
const van = CAR_CATALOG.find(({ id }) => id === 'van');
const suv = CAR_CATALOG.find(({ id }) => id === 'suv');
const sportsCar = CAR_CATALOG.find(({ id }) => id === 'sedan-sports');
const learner = CAR_CATALOG.find(({ id }) => id === 'classic');
assert.ok(awd && truck && van && suv && sportsCar && learner,
  'Every dynamic-perk car must remain in the canonical catalog');
assert.equal(awd.perk?.title, 'TRACTION');
assert.equal(truck.perk?.title, 'TORQUE');
assert.equal(truck.perk?.description,
  'OVERCHARGE builds BOOST TANK to 5/5 and has a stronger KICK.');
assert.equal(van.perk?.title, 'CARRY ON');

// TRACTION is a partial shoulder-depth curve, never an OVERSIZED-style exemption.
const trackWidth = 100;
assert.equal(resolveVehicleOffRoadPenalty({
  vehicleId: awd.id,
  perkUnlocked: false,
  offRoad: true,
  trackDistance: 58.01,
  trackWidth
}), 1, 'Locked TRACTION must have no effect');
assert.equal(resolveVehicleOffRoadPenalty({
  vehicleId: awd.id,
  perkUnlocked: true,
  offRoad: false,
  trackDistance: 58,
  trackWidth
}), 0, 'On-road driving must have no terrain penalty');
const shallowPenalty = resolveVehicleOffRoadPenalty({
  vehicleId: awd.id,
  perkUnlocked: true,
  offRoad: true,
  trackDistance: 58.01,
  trackWidth
});
const shoulderPenalty = resolveVehicleOffRoadPenalty({
  vehicleId: awd.id,
  perkUnlocked: true,
  offRoad: true,
  trackDistance: 83,
  trackWidth
});
const deepPenalty = resolveVehicleOffRoadPenalty({
  vehicleId: awd.id,
  perkUnlocked: true,
  offRoad: true,
  trackDistance: 100,
  trackWidth
});
assert.equal(shallowPenalty, TRACTION_MIN_OFFROAD_PENALTY);
assert.ok(shoulderPenalty > shallowPenalty && shoulderPenalty < 1,
  'TRACTION must progressively give back its forgiveness across the shoulder');
assert.equal(deepPenalty, 1, 'Deep off-road AWD driving must receive the complete ordinary penalty');
assert.equal(resolveVehicleOffRoadPenalty({
  vehicleId: 'monster-truck',
  perkUnlocked: true,
  offRoad: true,
  trackDistance: 58.01,
  trackWidth
}), 1, 'TRACTION must not become a generic off-road exemption');

const partialLimit = getVehicleSpeedLimit({
  maxSpeed: 100,
  offRoad: true,
  offRoadPenalty: shallowPenalty
});
assert.ok(Math.abs(partialLimit - (100 + (73 - 100) * shallowPenalty)) < 1e-12,
  'The AWD shoulder factor must blend the real speed ceiling rather than toggle a cosmetic state');

// TORQUE is activated by OVERCHARGE, not sustained GAS. OVERCHARGE builds the
// normalized BOOST TANK capacity toward 5/5 from the active STANDARD/SHIFT base, and
// its KICK is stronger in physics (vehicle-drift-production.mjs, #1232).
const lockedTruck = perkState(truck.id, false, truck.tuning);
lockedTruck.vehiclePerkProgress = 1;
advanceVehiclePerkRuntimeState({ state: lockedTruck, dt: 0.1, overcharge: 0.4 });
assert.equal(lockedTruck.vehiclePerkProgress, 0);
assert.equal(resolveVehiclePerkTuning({ state: lockedTruck, tuning: truck.tuning }), truck.tuning,
  'Locked TORQUE must return the exact ordinary tuning object');

const torqueTruck = perkState(truck.id, true, truck.tuning);
advanceForSeconds(torqueTruck, TORQUE_BUILD_SECONDS, { gasHeld: true });
assert.equal(torqueTruck.vehiclePerkProgress, 0,
  'Holding GAS by itself must no longer build TORQUE');
advanceForSeconds(torqueTruck, TORQUE_BUILD_SECONDS, { overcharge: 0.4 });
assert.equal(torqueTruck.vehiclePerkProgress, 1);
const maxTorqueTank = resolveVehiclePerkTuning({ state: torqueTruck, tuning: truck.tuning });
assert.equal(maxTorqueTank.accelerationMultiplier, truck.tuning.accelerationMultiplier,
  'TORQUE tank progress must not recreate the old gradual ACCELERATION ramp');
assert.equal(maxTorqueTank.boostDurationSeconds, 3.74,
  'TORQUE must progressively grow BOOST TANK capacity to the canonical 5/5 ceiling');

advanceVehiclePerkRuntimeState({
  state: torqueTruck,
  dt: 0.1,
  overcharge: 0,
  boostActive: true
});
assert.equal(torqueTruck.vehiclePerkProgress, 1,
  'Spending OVERCHARGE through one continuous BOOST must retain the built tank reserve');
advanceVehiclePerkRuntimeState({
  state: torqueTruck,
  dt: 0.1,
  overcharge: 0,
  boostActive: false
});
assert.equal(torqueTruck.vehiclePerkProgress, 0,
  'Once OVERCHARGE and its continuous BOOST spend are over, TORQUE must return to baseline');
assert.equal(resolveVehiclePerkTuning({ state: torqueTruck, tuning: truck.tuning }), truck.tuning);

const shiftOneTankTuning = deriveVehicleTuning({ ...truck.stats, boostDuration: 1 });
const shiftFourTankTuning = deriveVehicleTuning({ ...truck.stats, boostDuration: 4 });
const shiftingTruck = perkState(truck.id, true, shiftOneTankTuning);
advanceForSeconds(shiftingTruck, TORQUE_BUILD_SECONDS / 2, { overcharge: 0.3 });
const retainedProgress = shiftingTruck.vehiclePerkProgress;
const fromOneTank = resolveVehiclePerkTuning({
  state: shiftingTruck,
  tuning: shiftOneTankTuning
}).boostDurationSeconds;
const fromFourTank = resolveVehiclePerkTuning({
  state: shiftingTruck,
  tuning: shiftFourTankTuning
}).boostDurationSeconds;
assert.equal(shiftingTruck.vehiclePerkProgress, retainedProgress,
  'Changing SHIFT baseline must preserve the live TORQUE tank-build fraction');
assert.ok(fromFourTank > fromOneTank && fromFourTank < 3.74,
  'TORQUE must immediately recompose tank growth from the new active STANDARD/SHIFT base');
assert.match(physicsSource,
  /advanceVehiclePerkRuntimeState\(\{[\s\S]*overcharge: boostOvercharge,[\s\S]*boostActive: effectiveBoostActive/,
  'Vehicle physics must feed live OVERCHARGE and BOOST-spend state into TORQUE');
assert.match(controlsSource,
  /vehicleEffectiveTuning\?\.boostDurationSeconds[\s\S]*__turnVehicleTuning\?\.boostDurationSeconds/,
  'Boost consumption must read TORQUE’s effective tank capacity before the ordinary base capacity');
assert.match(controlsSource, /globalThis\.__turnBoostCharge = boostCharge/,
  'Growing TORQUE capacity must preserve normalized charge instead of manufacturing Boost');

// CARRY ON changes only the explicit LOCK drag term. Rotation, grip, slide and
// ordinary DRIFT stay in the shared physics path.
assert.equal(resolveVehicleLockDragAdd({
  vehicleId: van.id,
  perkUnlocked: false,
  perkLockDragAdd: van.tuning.lockDragAdd
}), STANDARD_LOCK_DRAG_ADD, 'Locked CARRY ON must retain ordinary LOCK drag');
assert.equal(resolveVehicleLockDragAdd({
  vehicleId: van.id,
  perkUnlocked: true,
  perkLockDragAdd: van.tuning.lockDragAdd
}), CARRY_ON_LOCK_DRAG_ADD, 'Unlocked CARRY ON must materially reduce only LOCK drag');
assert.equal(resolveVehicleLockDragAdd({
  vehicleId: 'sedan',
  perkUnlocked: true,
  perkLockDragAdd: van.tuning.lockDragAdd
}), STANDARD_LOCK_DRAG_ADD, 'Other cars must retain ordinary LOCK drag');
assert.match(physicsSource, /lockYawMultiplier = lerp\(1, 1\.55, driftLockAmount\)/);
assert.match(physicsSource, /lockGripMultiplier = lerp\(1, 0\.22, driftLockAmount\)/);
assert.match(physicsSource, /lockSlideMultiplier = lerp\(1, 1\.25, driftLockAmount\)/);
assert.match(physicsSource, /driftLockAmount \* lockDragAdd/);

// FULL TANK grows capacity from the current tuning without ever touching the
// normalized 0–1 charge value. On-road DRIFT is clean; off-road/collision reset it.
const lockedSuv = perkState(suv.id, false, suv.tuning);
lockedSuv.vehiclePerkProgress = 1;
advanceVehiclePerkRuntimeState({ state: lockedSuv, dt: 0.1, speed: 40 });
assert.equal(lockedSuv.vehiclePerkProgress, 0, 'Locked FULL TANK must have zero runtime effect');
const fullTankSuv = perkState(suv.id, true, suv.tuning);
advanceForSeconds(fullTankSuv, FULL_TANK_BUILD_SECONDS / 2, { speed: 40, driftHeld: true });
assert.ok(fullTankSuv.vehiclePerkProgress > 0.49 && fullTankSuv.vehiclePerkProgress < 0.51,
  'Legitimate on-road DRIFT must continue building FULL TANK');
const halfTankDuration = resolveVehiclePerkTuning({
  state: fullTankSuv,
  tuning: suv.tuning
}).boostDurationSeconds;
assert.ok(halfTankDuration > suv.tuning.boostDurationSeconds && halfTankDuration < 3.74);
advanceForSeconds(fullTankSuv, FULL_TANK_BUILD_SECONDS / 2, { speed: 40 });
assert.equal(fullTankSuv.vehiclePerkProgress, 1);
assert.equal(resolveVehiclePerkTuning({ state: fullTankSuv, tuning: suv.tuning }).boostDurationSeconds, 3.74);
// Clean driving also fills the charge at the build rate, in race time: the fill accrues
// with every physics step (so a slow frame rate fills as fast as capacity grows), even
// once the tank is 5/5, and the BOOST loop takes it each frame.
fullTankSuv.vehiclePerkBoostRefill = 0;
for (let step = 0; step < 20; step += 1) advanceVehiclePerkRuntimeState({ state: fullTankSuv, dt: 0.1, speed: 40 });
assert.ok(Math.abs(fullTankSuv.vehiclePerkBoostRefill - 2 / FULL_TANK_BUILD_SECONDS) < 1e-9, 'Two seconds of clean driving earn a quarter tank');
fullTankSuv.vehiclePerkBoostRefill = 0;
advanceVehiclePerkRuntimeState({ state: fullTankSuv, dt: 0.1, speed: FULL_TANK_MIN_SPEED / 2 });
assert.equal(fullTankSuv.vehiclePerkBoostRefill, 0, 'Crawling does not fill the tank');
advanceVehiclePerkRuntimeState({ state: lockedSuv, dt: 0.1, speed: 40 });
assert.equal(lockedSuv.vehiclePerkBoostRefill, 0, 'Locked FULL TANK fills nothing');
advanceVehiclePerkRuntimeState({ state: fullTankSuv, dt: 0.1, speed: 40, collided: true });
assert.equal(fullTankSuv.vehiclePerkProgress, 0, 'A collision must reset FULL TANK immediately');
assert.equal(fullTankSuv.vehiclePerkBoostRefill, 0, 'A collision earns no fill');
fullTankSuv.vehiclePerkProgress = 1;
advanceVehiclePerkRuntimeState({ state: fullTankSuv, dt: 0.1, speed: 40, offRoad: true });
assert.equal(fullTankSuv.vehiclePerkProgress, 0, 'Meaningful off-road travel must reset FULL TANK immediately');

const lowTankTuning = deriveVehicleTuning({ ...suv.stats, boostDuration: 1 });
const highTankTuning = deriveVehicleTuning({ ...suv.stats, boostDuration: 4 });
const shiftingSuv = perkState(suv.id, true, lowTankTuning);
advanceForSeconds(shiftingSuv, FULL_TANK_BUILD_SECONDS / 2, { speed: 40 });
const fullTankProgress = shiftingSuv.vehiclePerkProgress;
const lowTankEffect = resolveVehiclePerkTuning({ state: shiftingSuv, tuning: lowTankTuning }).boostDurationSeconds;
const highTankEffect = resolveVehiclePerkTuning({ state: shiftingSuv, tuning: highTankTuning }).boostDurationSeconds;
assert.equal(shiftingSuv.vehiclePerkProgress, fullTankProgress);
assert.ok(highTankEffect > lowTankEffect && highTankEffect < 3.74,
  'FULL TANK must recompose from a new SHIFT base without resetting or duplicating progress');
assert.match(controlsSource,
  /vehicleEffectiveTuning\?\.boostDurationSeconds[\s\S]*__turnVehicleTuning\?\.boostDurationSeconds/,
  'Boost consumption must read FULL TANK’s effective capacity before the ordinary base capacity');
assert.match(controlsSource,
  /const perkRefill = [^\n]*vehiclePerkBoostRefill[\s\S]*perkState\.vehiclePerkBoostRefill = 0;[\s\S]*if \(boostCharge < 0\.999999\) \{\s*boostCharge = Math\.min\(1, boostCharge \+ dt \* rechargeMultiplier \/ BOOST_RECHARGE_SECONDS \+ perkRefill\)/,
  'FULL TANK fill is taken every frame and fills the charge only between boosts');
assert.match(physicsSource, /advanceVehiclePerkRuntimeState\(/, 'The fill accrues in the physics step, which only runs while the race runs');
assert.match(controlsSource, /globalThis\.__turnBoostCharge = boostCharge/,
  'Capacity changes must retain normalized charge instead of manufacturing Boost');

// DRIFT DEMON interpolates the complete canonical DRIFT tuning family. LOCK is
// represented by the same held DRIFT input and therefore cannot build it faster.
const lockedSportsCar = perkState(sportsCar.id, false, sportsCar.tuning);
lockedSportsCar.vehiclePerkProgress = 1;
advanceVehiclePerkRuntimeState({ state: lockedSportsCar, dt: 0.1, driftHeld: true });
assert.equal(lockedSportsCar.vehiclePerkProgress, 0, 'Locked DRIFT DEMON must have zero runtime effect');
const driftDemon = perkState(sportsCar.id, true, sportsCar.tuning);
advanceForSeconds(driftDemon, DRIFT_DEMON_BUILD_SECONDS / 2, { driftHeld: true });
const driftProgress = driftDemon.vehiclePerkProgress;
const demonTuning = resolveVehiclePerkTuning({ state: driftDemon, tuning: sportsCar.tuning });
assert.ok(driftProgress > 0.49 && driftProgress < 0.51);
assert.ok(demonTuning.driftSpeedMultiplier > sportsCar.tuning.driftSpeedMultiplier);
assert.ok(demonTuning.driftDragAdd < sportsCar.tuning.driftDragAdd);
assert.ok(demonTuning.driftStabilityMultiplier > sportsCar.tuning.driftStabilityMultiplier);
advanceForSeconds(driftDemon, DRIFT_DEMON_BUILD_SECONDS / 2, { driftHeld: true });
assert.equal(driftDemon.vehiclePerkProgress, 1);
assert.equal(resolveVehiclePerkTuning({ state: driftDemon, tuning: sportsCar.tuning }).driftSpeedMultiplier, 0.92);
advanceForSeconds(driftDemon, DRIFT_DEMON_DECAY_SECONDS, { driftHeld: false });
assert.ok(driftDemon.vehiclePerkProgress <= 1e-12,
  'Releasing DRIFT must smoothly return DRIFT DEMON to the active base');

const driftOneTuning = deriveVehicleTuning({ ...sportsCar.stats, drift: 1 });
const driftFourTuning = deriveVehicleTuning({ ...sportsCar.stats, drift: 4 });
const shiftingDemon = perkState(sportsCar.id, true, driftOneTuning);
advanceForSeconds(shiftingDemon, DRIFT_DEMON_BUILD_SECONDS / 2, { driftHeld: true });
const demonProgress = shiftingDemon.vehiclePerkProgress;
const fromDriftOne = resolveVehiclePerkTuning({ state: shiftingDemon, tuning: driftOneTuning }).driftSpeedMultiplier;
const fromDriftFour = resolveVehiclePerkTuning({ state: shiftingDemon, tuning: driftFourTuning }).driftSpeedMultiplier;
assert.equal(shiftingDemon.vehiclePerkProgress, demonProgress);
assert.ok(fromDriftFour > fromDriftOne && fromDriftFour < 0.92,
  'DRIFT DEMON must immediately recompose from the active STANDARD/SHIFT base');

assert.equal(resolveVehiclePerkStatusFeedback({
  perkId: 'full-tank', previousProgress: 0.99, nextProgress: 1
}), 'FULL TANK');
assert.equal(resolveVehiclePerkStatusFeedback({
  perkId: 'full-tank', previousProgress: 1, nextProgress: 0
}), 'FULL TANK LOST');
assert.equal(resolveVehiclePerkStatusFeedback({
  perkId: 'torque', previousProgress: 0.99, nextProgress: 1
}), 'BOOST TANK 5/5');
assert.equal(resolveVehiclePerkStatusFeedback({
  perkId: 'torque', previousProgress: 1, nextProgress: 0
}), null, 'Truck must not announce LOST when temporary OVERCHARGE capacity returns to baseline');
assert.equal(resolveVehiclePerkStatusFeedback({
  perkId: 'drift-demon', previousProgress: 0.99, nextProgress: 1
}), 'DRIFT 5/5');
assert.equal(resolveVehiclePerkStatusFeedback({
  perkId: 'drift-demon', previousProgress: 1, nextProgress: 0.5
}), null, 'Sports Car DRIFT decay must not announce LOST');
assert.equal(resolveVehiclePerkStatusFeedback({
  perkId: '', previousProgress: 0.99, nextProgress: 1
}), null, 'A locked perk runs in no slot, so it has no cue');
assert.equal(resolveVehiclePerkStatusFeedback({
  perkId: 'full-tank', previousProgress: 1, nextProgress: 1
}), null, 'Status feedback must fire only on threshold crossings');
assert.match(mainSource,
  /resolveVehiclePerkStatusFeedback\([\s\S]*previousVehiclePerkProgress[\s\S]*state\.vehiclePerkProgress[\s\S]*showCompactRacePill\(perkStatusFeedback, \{\s*tone: 'blue'/,
  'Dynamic perk milestones must use the shared compact blue race cue lane');

// GRADUATED builds one readable stage at a time from the current base and earns
// genuinely endgame conditional ceilings without mutating Learner Car’s 18 points.
assert.equal(learner.perk?.title, 'GRADUATED');
assert.equal(GRADUATED_TOTAL_SECONDS, GRADUATED_STAGE_SECONDS * 3);
const lockedLearner = perkState(learner.id, false, learner.tuning);
lockedLearner.vehiclePerkProgress = 1;
lockedLearner.vehiclePerkStage = 3;
advanceVehiclePerkRuntimeState({ state: lockedLearner, dt: 0.1, speed: 40, driftHeld: true });
assert.equal(lockedLearner.vehiclePerkProgress, 0);
assert.equal(lockedLearner.vehiclePerkStage, 0, 'Locked GRADUATED must have zero runtime effect');

const graduated = perkState(learner.id, true, learner.tuning);
advanceForSeconds(graduated, GRADUATED_STAGE_SECONDS, { speed: 40, driftHeld: true });
assert.equal(graduated.vehiclePerkStage, 1,
  'On-road DRIFT/LOCK must count as clean time and complete CONTROL first');
let graduatedTuning = resolveVehiclePerkTuning({ state: graduated, tuning: learner.tuning });
assert.equal(graduatedTuning.controlMultiplier, GRADUATED_MAX_CONTROL_MULTIPLIER);
assert.equal(graduatedTuning.accelerationMultiplier, learner.tuning.accelerationMultiplier);
assert.equal(graduatedTuning.topSpeedMultiplier, learner.tuning.topSpeedMultiplier);

advanceForSeconds(graduated, GRADUATED_STAGE_SECONDS, { speed: 40 });
assert.equal(graduated.vehiclePerkStage, 2);
graduatedTuning = resolveVehiclePerkTuning({ state: graduated, tuning: learner.tuning });
assert.equal(graduatedTuning.controlMultiplier, GRADUATED_MAX_CONTROL_MULTIPLIER);
assert.equal(graduatedTuning.accelerationMultiplier, GRADUATED_MAX_ACCELERATION_MULTIPLIER);
assert.equal(graduatedTuning.topSpeedMultiplier, learner.tuning.topSpeedMultiplier,
  'TOP SPEED must remain at baseline until CONTROL and ACCELERATION are complete');

advanceForSeconds(graduated, GRADUATED_STAGE_SECONDS, { speed: 40 });
assert.equal(graduated.vehiclePerkStage, 3);
graduatedTuning = resolveVehiclePerkTuning({ state: graduated, tuning: learner.tuning });
assert.equal(graduatedTuning.topSpeedMultiplier, GRADUATED_MAX_TOP_SPEED_MULTIPLIER);
const ordinaryMaximum = deriveVehicleTuning({
  speed: 5,
  acceleration: 5,
  control: 5,
  drift: 5,
  boostPower: 5,
  boostDuration: 5
});
assert.ok(graduatedTuning.controlMultiplier > ordinaryMaximum.controlMultiplier);
assert.ok(graduatedTuning.accelerationMultiplier > ordinaryMaximum.accelerationMultiplier);
assert.ok(graduatedTuning.topSpeedMultiplier > ordinaryMaximum.topSpeedMultiplier,
  'A complete clean streak must make the Learner Car genuinely competitive beyond nominal 5/5');

const learnerShiftTuning = deriveVehicleTuning({
  speed: 2,
  acceleration: 2,
  control: 4,
  drift: 4,
  boostPower: 2,
  boostDuration: 4
});
const shiftingGraduate = perkState(learner.id, true, learner.tuning);
advanceForSeconds(shiftingGraduate, GRADUATED_STAGE_SECONDS * 1.5, { speed: 40 });
const graduateProgress = shiftingGraduate.vehiclePerkProgress;
const standardAcceleration = resolveVehiclePerkTuning({
  state: shiftingGraduate,
  tuning: learner.tuning
}).accelerationMultiplier;
const shiftedAcceleration = resolveVehiclePerkTuning({
  state: shiftingGraduate,
  tuning: learnerShiftTuning
}).accelerationMultiplier;
assert.equal(shiftingGraduate.vehiclePerkProgress, graduateProgress,
  'SHIFT must preserve a valid GRADUATED streak');
assert.ok(shiftedAcceleration > standardAcceleration && shiftedAcceleration < GRADUATED_MAX_ACCELERATION_MULTIPLIER,
  'GRADUATED must recompose from the new SHIFT baseline without duplicating its bonus');

const stageBeforeCollision = shiftingGraduate.vehiclePerkStage;
advanceVehiclePerkRuntimeState({ state: shiftingGraduate, dt: 0.1, speed: 40, collided: true });
assert.equal(shiftingGraduate.vehiclePerkProgress, 0);
assert.equal(shiftingGraduate.vehiclePerkStage, 0,
  'A collision must reset every GRADUATED stage and temporary bonus');
assert.equal(resolveGraduatedStageFeedback(0, 1), 'GRADUATED · CONTROL');
assert.equal(resolveGraduatedStageFeedback(1, 2), 'GRADUATED · ACCELERATION');
assert.equal(resolveGraduatedStageFeedback(2, 3), 'GRADUATED · TOP SPEED');
assert.equal(resolveGraduatedStageFeedback(stageBeforeCollision, 0), 'GRADUATED · STREAK LOST');
assert.equal(resolveGraduatedStageFeedback(0, 0), null,
  'GRADUATED feedback must occur only at stage boundaries, never every physics frame');
shiftingGraduate.vehiclePerkProgress = 1;
shiftingGraduate.vehiclePerkStage = 3;
advanceVehiclePerkRuntimeState({ state: shiftingGraduate, dt: 0.1, speed: 40, offRoad: true });
assert.equal(shiftingGraduate.vehiclePerkProgress, 0,
  'Meaningful off-road travel must reset every GRADUATED bonus');
assert.match(indexSource, /<div class="message" id="message" role="status"><\/div>/,
  'Stage feedback must use TURN’s existing textual live status instead of color alone');
assert.match(mainSource,
  /resolveGraduatedStageFeedback\([\s\S]*previousVehiclePerkStage[\s\S]*state\.vehiclePerkStage[\s\S]*showMessage\(graduatedFeedback, 1800\)/,
  'The race loop must announce only reached or lost GRADUATED stages');

// CLEAN EXIT (Compact): a clean drift, one DRIFT ATTACK would bank, adds 1 CONTROL up to
// 5/5 for CLEAN_EXIT_SECONDS. A wall hit, a spin or a tap earns nothing; a new clean drift
// restarts the time and never stacks.
const compact = CAR_CATALOG.find(({ id }) => id === 'compact');
assert.equal(compact.perk.title, 'CLEAN EXIT');
assert.deepEqual([CLEAN_EXIT_CONTROL_BONUS, CLEAN_EXIT_SECONDS], [1, 3]);
const compactControlFive = deriveVehicleTuning({ ...compact.stats, control: 5 });
const straight = () => ({ speed: 25, slipAngle: 0 });
const drifting = () => ({ speed: 25, slipAngle: 0.9 });
function cleanExitRun(steps, tuning = compact.tuning) {
  const state = perkState(compact.id, true, tuning);
  const controls = [];
  for (const [seconds, input] of steps) {
    for (let frame = 0; frame < Math.round(seconds * 60); frame += 1) {
      advanceVehiclePerkRuntimeState({ state, dt: 1 / 60, ...input() });
      controls.push(resolveVehiclePerkTuning({ state, tuning }).controlMultiplier);
    }
  }
  const bonusSeconds = controls.filter((control) => control > tuning.controlMultiplier).length / 60;
  return { state, controls, bonusSeconds, peak: Math.max(...controls) };
}
const cleanDrift = cleanExitRun([[1, straight], [1.5, drifting], [5, straight]]);
assert.ok(Math.abs(cleanDrift.bonusSeconds - CLEAN_EXIT_SECONDS) < 0.05,
  `A clean drift adds CONTROL for ${CLEAN_EXIT_SECONDS} s (${cleanDrift.bonusSeconds} s)`);
assert.equal(cleanDrift.peak, compactControlFive.controlMultiplier, 'CLEAN EXIT adds one CONTROL point: 4/5 becomes 5/5');
assert.equal(cleanDrift.controls.at(-1), compact.tuning.controlMultiplier, 'CONTROL returns to 4/5 when the time runs out');
for (const [label, steps] of [
  ['a tap', [[1, straight], [0.12, drifting], [5, straight]]],
  ['a wall hit', [[1, straight], [1.2, drifting], [0.1, () => ({ speed: 20, slipAngle: 0.9, collided: true })], [5, straight]]],
  ['a spin', [[1, straight], [1.2, drifting], [0.3, () => ({ speed: 20, slipAngle: 2.4 })], [5, straight]]],
  ['leaving the road', [[1, straight], [1.2, drifting], [0.2, () => ({ speed: 22, slipAngle: 0.9, offRoad: true })], [5, straight]]]
]) {
  assert.equal(cleanExitRun(steps).bonusSeconds, 0, `CLEAN EXIT needs a clean drift, not ${label}`);
}
const twoDrifts = cleanExitRun([[1, straight], [1.5, drifting], [2, straight], [1.5, drifting], [5, straight]]);
assert.equal(twoDrifts.peak, compactControlFive.controlMultiplier, 'A second clean drift never stacks CONTROL');
assert.ok(twoDrifts.bonusSeconds > CLEAN_EXIT_SECONDS * 1.4 && twoDrifts.bonusSeconds <= CLEAN_EXIT_SECONDS * 2 + 0.05,
  `A second clean drift restarts the time (${twoDrifts.bonusSeconds} s)`);
const shiftedToFive = cleanExitRun([[1, straight], [1.5, drifting], [1, straight]], compactControlFive);
assert.equal(shiftedToFive.peak, compactControlFive.controlMultiplier, 'CLEAN EXIT never lifts CONTROL past 5/5');
assert.equal(resolveVehiclePerkStatusFeedback({
  perkId: 'clean-exit', previousProgress: 0.4, nextProgress: 1
}), null, 'CLEAN EXIT triggers too often for a race pill: it has no cue');

// Ownership and lifecycle are canonical race state, not a cached UI guess.
assert.match(mainSource, /vehiclePerkUnlocked: isVehiclePerkUnlocked\(initialVehicleSelection\.carId\)/);
assert.match(mainSource, /state\.vehiclePerkUnlocked = isVehiclePerkUnlocked\(saved\.carId\)/);
assert.match(mainSource, /turn:trophy-road-updated/);
assert.match(mainSource, /turn:achievements-ready/);
assert.match(achievementsRuntimeSource, /new CustomEvent\('turn:achievements-ready'/);
// Leaving TURN pauses an active lap (the perk waits with it); otherwise the perk resets.
assert.match(mainSource, /function pauseOrResetPerk\(\) \{\s*if \(globalThis\.__turnRacePause\?\.pause\('background'\) !== true\) resetVehiclePerkRuntimeState\(state\);/);
assert.match(mainSource, /visibilitychange[\s\S]*pauseOrResetPerk\(\)/);
assert.match(mainSource, /pagehide[\s\S]*pauseOrResetPerk\(\)/);
assert.match(gameStateSource, /state\.vehiclePerkProgress = 0/);

// #1219: every perk has an identity of its own, apart from its cars: a stable id, a
// rarity, and whether it may be installed on another car. Rarity is presentation only.
const PERK_TABLE = {
  'clean-exit': ['CLEAN EXIT', ['compact'], 'common', true],
  traction: ['TRACTION', ['convertible'], 'rare', true],
  'drift-demon': ['DRIFT DEMON', ['sedan-sports'], 'rare', true],
  'carry-on': ['CARRY ON', ['van'], 'rare', true],
  driftage: ['DRIFTAGE', ['vintage-racer'], 'epic', true],
  'apex-grip': ['APEX GRIP', ['race'], 'epic', true],
  'full-tank': ['FULL TANK', ['suv'], 'epic', true],
  torque: ['TORQUE', ['truck'], 'epic', true],
  graduated: ['GRADUATED', ['classic'], 'legendary', false],
  oversized: ['OVERSIZED', ['monster-truck'], 'legendary', false],
  'double-shift': ['DOUBLE SHIFT', ['sedan'], 'legendary', false],
  overdrive: ['OVERDRIVE', ['race-future'], 'legendary', false],
  'flow-shift': ['FLOW SHIFT', ['supercar'], 'legendary', false],
  sirens: ['SIRENS', ['firetruck', 'police', 'ambulance'], 'legendary', false],
  smv: ['SMV', ['tractor'], 'legendary', false],
  'twitchy-turny': ['TWITCHY TURNY', ['toy-racer'], 'legendary', false]
};
assert.deepEqual(VEHICLE_PERKS.map(({ id }) => id).sort(), Object.keys(PERK_TABLE).sort(), 'Sixteen perks, each id once');
assert.deepEqual(Object.values(PERK_RARITY).sort(), ['common', 'epic', 'legendary', 'mythic', 'rare']);
for (const [id, [title, vehicleIds, rarity, installable]] of Object.entries(PERK_TABLE)) {
  const perk = getVehiclePerk(id);
  assert.deepEqual([perk.title, [...perk.vehicleIds], perk.rarity, perk.installable],
    [title, vehicleIds, rarity, installable], `${title}: its cars, rarity and whether it may be installed on another car`);
  assert.equal('cloneable' in perk, false, `${title}: no clone step (#1228)`);
  assert.ok(Object.isFrozen(perk) && Object.isFrozen(perk.vehicleIds));
  for (const vehicleId of vehicleIds) assert.equal(originalVehiclePerk(vehicleId), perk, `${vehicleId} comes with ${title}`);
}
assert.equal(VEHICLE_PERKS.filter(({ installable }) => installable).length, 8, 'Eight perks may be installed on another car');
for (const car of CAR_CATALOG) {
  assert.equal(car.perk, originalVehiclePerk(car.id), `${car.name}'s perk is its entry in the perk table`);
  // A perk's fixed values are part of its car's tuning, under STANDARD and SHIFT alike.
  for (const [key, value] of Object.entries(car.perk.tuning || {})) assert.equal(car.tuning[key], value, `${car.name} ${key}`);
}

// A car runs its ORIGINAL perk once unlocked and at most one INSTALLED perk, each in a
// slot of its own. Nothing installs one yet (PERKULATOR comes later); the runtime is
// ready, and with nothing installed every car behaves exactly as before.
const truckWith = (installed, tuning = truck.tuning) => perkState(truck.id, true, tuning, installed);
// Achievement perks use the existing installed slot and have no original car.
for (const id of ['turbo', 'road-rage']) {
  const perk = getVehiclePerk(id);
  assert.equal(perk.rarity, 'mythic');
  assert.deepEqual(perk.vehicleIds, []);
  assert.equal(perk.installable, true);
  assert.deepEqual(activeVehiclePerkIds(truckWith(id)), ['torque', id]);
}
const turboTruck = truckWith('turbo');
const turboTuning = resolveVehiclePerkTuning({ state: turboTruck, tuning: truck.tuning });
assert.equal(turboTuning.boostEffectMultiplier, 2.5);
assert.equal(turboTuning.boostConsumptionMultiplier, 2);
assert.equal(truck.tuning.boostEffectMultiplier, undefined, 'Installing TURBO never changes the original tuning');
turboTruck.vehicleInstalledPerkId = '';
assert.equal(resolveVehiclePerkTuning({ state: turboTruck, tuning: truck.tuning }).boostEffectMultiplier, undefined);

// ROAD RAGE conserves fuel and capacity. Dirty driving/BOOST only stops conversion.
const cleanConversion = { enabled: true, requested: false, offRoad: false, collided: false, speed: 40 };
const seedTank = { charge: 1, overcharge: 0.5, converted: 0 };
convertBoostTank(seedTank, ROAD_RAGE_CONVERSION_SECONDS / 2, cleanConversion);
assert.deepEqual(seedTank, { charge: 1, overcharge: 0.5, converted: 0.5 });
convertBoostTank(seedTank, ROAD_RAGE_CONVERSION_SECONDS, cleanConversion);
assert.deepEqual(seedTank, { charge: 1, overcharge: 0.5, converted: 1 }, 'Conversion never adds capacity');
for (const blocked of [{ enabled: false }, { requested: true }, { offRoad: true }, { collided: true }, { speed: 0 }]) {
  const tank = { charge: 1, overcharge: 0.5, converted: 0.25 };
  convertBoostTank(tank, 2, { ...cleanConversion, ...blocked });
  assert.equal(tank.converted, 0.25, 'Losing the condition preserves stored converted fuel');
}
for (const tank of [{ charge: 0.9, overcharge: 0.5, converted: 0 }, { charge: 1, overcharge: 0, converted: 0 }]) {
  convertBoostTank(tank, 2, cleanConversion);
  assert.equal(tank.converted, 0, 'A partial tank or missing seed cannot convert');
}
// Consume bonus OC, then converted base fuel, then ordinary fuel, without a lost step
// at resource boundaries. TURBO accelerates every part of the same tank's burn.
const mixedTank = { charge: 1, overcharge: 1, converted: 0.5 };
consumeBoostTank(mixedTank, 0.3, 2, 2);
assert.equal(mixedTank.charge, 1);
assert.equal(mixedTank.overcharge, 0);
assert.equal(mixedTank.burningOvercharge, true);
consumeBoostTank(mixedTank, 0.5, 2, 2);
assert.equal(mixedTank.converted, 0);
assert.equal(mixedTank.charge, 0.5);
assert.equal(mixedTank.burningOvercharge, true, 'The final OC frame still burns purple');
consumeBoostTank(mixedTank, 0.25, 2, 2);
assert.equal(mixedTank.charge, 0.25);
assert.equal(mixedTank.burningOvercharge, false, 'Ordinary fuel follows OC');
for (const fps of [25, 60, 120]) {
  const tank = { charge: 1, overcharge: 0.5, converted: 0.5 };
  for (let step = 0; step < fps; step += 1) consumeBoostTank(tank, 1 / fps, 2, 2);
  assert.ok(Math.abs(tank.charge - 0.15) < 1e-9, 'A mixed tank drains identically at different frame rates');
}
const heldTank = { charge: 1, overcharge: 0, converted: 0.5 };
decayConvertedBoost(heldTank, 4, true);
assert.equal(heldTank.converted, 0.5, 'GAS holds converted OC');
decayConvertedBoost(heldTank, 2, false);
assert.deepEqual(heldTank, { charge: 0.75, overcharge: 0, converted: 0.25 }, 'Loose converted OC leaks from total fuel');
assert.deepEqual(activeVehiclePerkIds(perkState(truck.id, true, truck.tuning)), ['torque']);
assert.deepEqual(activeVehiclePerkIds(truckWith('full-tank')), ['torque', 'full-tank']);
assert.deepEqual(activeVehiclePerkIds(truckWith('torque')), ['torque'], 'A car never runs its own perk twice');
assert.deepEqual(activeVehiclePerkIds(truckWith('overdrive')), ['torque'], 'A LEGENDARY perk cannot be installed');
assert.deepEqual(activeVehiclePerkIds(truckWith('no-such-perk')), ['torque']);
const lockedTankSuv = perkState(suv.id, false, suv.tuning, 'torque');
assert.deepEqual(activeVehiclePerkIds(lockedTankSuv), ['torque'], 'An installed perk runs while the car\'s own is still locked');
const reinstalled = truckWith('full-tank');
advanceForSeconds(reinstalled, 1, { speed: 40, overcharge: 0.5 });
assert.ok(reinstalled.vehiclePerkProgress > 0 && reinstalled.vehicleInstalledPerkProgress > 0, 'Both slots build');
reinstalled.vehicleInstalledPerkId = 'apex-grip';
assert.deepEqual(activeVehiclePerkIds(reinstalled), ['torque', 'apex-grip']);
assert.deepEqual([reinstalled.vehiclePerkProgress, reinstalled.vehicleInstalledPerkProgress], [0, 0],
  'Changing the installed perk starts both slots afresh');

// FULL TANK + TORQUE: each builds BOOST TANK on its own terms; the stronger applies.
const tankTruck = truckWith('full-tank');
advanceForSeconds(tankTruck, TORQUE_BUILD_SECONDS / 2, { speed: 40, overcharge: 0.4 });
const bothBuilding = resolveVehiclePerkTuning({ state: tankTruck, tuning: truck.tuning }).boostDurationSeconds;
assert.ok(tankTruck.vehiclePerkProgress > tankTruck.vehicleInstalledPerkProgress, 'TORQUE builds faster than FULL TANK');
assert.equal(bothBuilding, resolveVehiclePerkTuning({
  state: Object.assign(perkState(truck.id, true, truck.tuning), { vehiclePerkProgress: tankTruck.vehiclePerkProgress }),
  tuning: truck.tuning
}).boostDurationSeconds, 'The stronger build applies; the two never add up');
assert.ok(tankTruck.vehiclePerkBoostRefill > 0, 'An installed FULL TANK fills the tank too');
advanceVehiclePerkRuntimeState({ state: tankTruck, dt: 0.1, speed: 40, overcharge: 0, boostActive: false });
assert.equal(tankTruck.vehiclePerkProgress, 0, 'TORQUE returns to baseline when OVERCHARGE ends');
assert.ok(tankTruck.vehicleInstalledPerkProgress > 0, 'while FULL TANK keeps what clean driving built');
const fullTankOnly = resolveVehiclePerkTuning({ state: tankTruck, tuning: truck.tuning }).boostDurationSeconds;
assert.ok(fullTankOnly > truck.tuning.boostDurationSeconds && fullTankOnly < 3.74);

// APEX GRIP on another CONTROL/ACCELERATION modifier: its fixed OVERCHARGE values join
// the car's, the stronger of each applying.
const apexTruck = truckWith('apex-grip');
const apexTuning = resolveVehiclePerkTuning({ state: apexTruck, tuning: truck.tuning });
assert.notEqual(apexTuning, truck.tuning);
assert.deepEqual([apexTuning.overchargeControlMultiplier, apexTuning.overchargeAccelerationMultiplier], [1.21, 1.24]);
assert.equal(resolveOverchargedControlMultiplier({
  controlMultiplier: apexTuning.controlMultiplier,
  overchargeControlMultiplier: apexTuning.overchargeControlMultiplier,
  overcharge: 0.5
}), 1.21, 'An installed APEX GRIP lifts CONTROL in OVERCHARGE');
assert.equal(resolveVehicleOverchargedAccelerationMultiplier({
  perkIds: activeVehiclePerkIds(apexTruck),
  accelerationMultiplier: apexTuning.accelerationMultiplier,
  overchargeAccelerationMultiplier: apexTuning.overchargeAccelerationMultiplier,
  overcharge: 0.5
}), 1.24, 'TORQUE and APEX GRIP lift ACCELERATION once, not twice');

// CLEAN EXIT + another CONTROL modification: GRADUATED's CONTROL and CLEAN EXIT's +1
// never add up; the higher applies.
const learnerTuning = learner.tuning;
const cleanLearner = perkState(learner.id, true, learnerTuning, 'clean-exit');
cleanLearner.vehiclePerkProgress = 1 / 6;
cleanLearner.vehicleInstalledPerkProgress = 1;
const halfControl = resolveVehiclePerkTuning({ state: cleanLearner, tuning: learnerTuning }).controlMultiplier;
assert.equal(halfControl, Math.max(
  learnerTuning.controlMultiplier + (GRADUATED_MAX_CONTROL_MULTIPLIER - learnerTuning.controlMultiplier) * 0.5,
  learnerTuning.controlMultiplier
));
assert.ok(halfControl < GRADUATED_MAX_CONTROL_MULTIPLIER);
cleanLearner.vehiclePerkProgress = 0;
assert.equal(resolveVehiclePerkTuning({ state: cleanLearner, tuning: learnerTuning }).controlMultiplier,
  learnerTuning.controlMultiplier, 'CLEAN EXIT never lifts CONTROL past 5/5, where the Learner Car already is');

// DRIFT DEMON with DRIFTAGE, and with SHIFT: DRIFT DEMON builds DRIFT up to 5/5 from the
// configured car and never weakens what DRIFTAGE sets beyond 5/5.
const vintage = CAR_CATALOG.find(({ id }) => id === 'vintage-racer');
const demonVintage = perkState(vintage.id, true, vintage.tuning, 'drift-demon');
demonVintage.vehicleInstalledPerkProgress = 1;
const demonDriftage = resolveVehiclePerkTuning({ state: demonVintage, tuning: vintage.tuning });
assert.deepEqual([demonDriftage.driftDragAdd, demonDriftage.driftSpeedMultiplier], [0.045, 0.95],
  'DRIFTAGE stays where it is stronger than 5/5');
const vintageDriftTwo = deriveVehicleTuning({ ...vintage.stats, drift: 2 });
const shiftedVintage = resolveVehiclePerkTuning({ state: demonVintage, tuning: { ...vintageDriftTwo, ...vintage.perk.tuning } });
assert.equal(shiftedVintage.driftEngineMultiplier, 0.94, 'DRIFT DEMON builds DRIFT from a SHIFTed base up to 5/5');
const driftageSports = perkState(sportsCar.id, true, sportsCar.tuning, 'driftage');
const sportsDriftage = resolveVehiclePerkTuning({ state: driftageSports, tuning: sportsCar.tuning });
assert.deepEqual([sportsDriftage.driftDragAdd, sportsDriftage.driftYawMultiplier, sportsDriftage.driftGripMultiplier],
  [0.045, 1.28, 0.72], 'An installed DRIFTAGE sets its values on any car');
driftageSports.vehiclePerkProgress = 1;
const sportsBoth = resolveVehiclePerkTuning({ state: driftageSports, tuning: sportsCar.tuning });
assert.deepEqual([sportsBoth.driftDragAdd, sportsBoth.driftSpeedMultiplier, sportsBoth.driftEngineMultiplier], [0.045, 0.95, 0.94]);

// The other fixed and stateless perks follow the perk, not the car.
const twitchyVan = perkState(van.id, true, van.tuning, 'twitchy-turny');
assert.deepEqual(activeVehiclePerkIds(twitchyVan), ['carry-on'], 'TWITCHY TURNY is LEGENDARY: it stays with the Rally Racer');
assert.equal(resolveVehiclePerkTuning({ state: twitchyVan, tuning: van.tuning }).driftBoostRechargeMultiplier,
  van.tuning.driftBoostRechargeMultiplier);
const carryOnTruck = truckWith('carry-on');
assert.equal(resolveVehicleLockDragAdd({
  perkIds: activeVehiclePerkIds(carryOnTruck),
  perkLockDragAdd: resolveVehiclePerkTuning({ state: carryOnTruck, tuning: truck.tuning }).lockDragAdd
}), CARRY_ON_LOCK_DRAG_ADD, 'An installed CARRY ON eases LOCK on any car');
assert.equal(resolveVehicleOffRoadPenalty({
  perkIds: activeVehiclePerkIds(truckWith('traction')), offRoad: true, trackDistance: 58.01, trackWidth
}), TRACTION_MIN_OFFROAD_PENALTY, 'An installed TRACTION eases shallow off-road on any car');
assert.match(controlsSource, /vehicleEffectiveTuning\?\.driftBoostRechargeMultiplier[\s\S]*__turnVehicleTuning\?\.driftBoostRechargeMultiplier/,
  'DRIFT recharge reads the tuning the race runs with');
assert.match(gameStateSource, /state\.vehicleInstalledPerkProgress = 0/);
assert.doesNotMatch(perkRuntimeSource, /activePerk\(state, '|vehicleId === '(truck|suv|sedan-sports|classic|compact|van|convertible)'/,
  'Perks are known by their ids, never by the car they come from');

console.log('TURN seven gated 1200–2000 Trophy Road vehicle perk behaviors, the perk table and installed-perk composition passed.');
