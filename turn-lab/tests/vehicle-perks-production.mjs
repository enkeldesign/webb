import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  CAR_CATALOG,
  deriveVehicleTuning
} from '../../turn/vehicle/catalog.js';
import { getVehicleSpeedLimit } from '../../turn/vehicle/physics.js';
import {
  CARRY_ON_LOCK_DRAG_ADD,
  DRIFT_DEMON_BUILD_SECONDS,
  DRIFT_DEMON_DECAY_SECONDS,
  FULL_TANK_BUILD_SECONDS,
  GRADUATED_MAX_ACCELERATION_MULTIPLIER,
  GRADUATED_MAX_CONTROL_MULTIPLIER,
  GRADUATED_MAX_TOP_SPEED_MULTIPLIER,
  GRADUATED_STAGE_SECONDS,
  GRADUATED_TOTAL_SECONDS,
  STANDARD_LOCK_DRAG_ADD,
  TORQUE_BUILD_SECONDS,
  TORQUE_DECAY_SECONDS,
  TRACTION_MIN_OFFROAD_PENALTY,
  advanceVehiclePerkRuntimeState,
  resetVehiclePerkRuntimeState,
  resolveGraduatedStageFeedback,
  resolveVehicleLockDragAdd,
  resolveVehicleOffRoadPenalty,
  resolveVehiclePerkTuning
} from '../../turn/vehicle/perk-runtime.js';

const [indexSource, mainSource, physicsSource, controlsSource, gameStateSource, achievementsRuntimeSource] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/game-state.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8')
]);

function perkState(vehicleId, perkUnlocked, tuning) {
  const state = {
    vehicleId,
    vehiclePerkUnlocked: perkUnlocked,
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

// TORQUE is runtime-only, builds under ordinary GAS, decays on release and always
// recomposes from the currently active STANDARD/SHIFT tuning.
const lockedTruck = perkState(truck.id, false, truck.tuning);
lockedTruck.vehiclePerkProgress = 1;
advanceVehiclePerkRuntimeState({ state: lockedTruck, dt: 0.1, gasHeld: true });
assert.equal(lockedTruck.vehiclePerkProgress, 0);
assert.equal(resolveVehiclePerkTuning({ state: lockedTruck, tuning: truck.tuning }), truck.tuning,
  'Locked TORQUE must return the exact ordinary tuning object');

const torqueTruck = perkState(truck.id, true, truck.tuning);
advanceForSeconds(torqueTruck, TORQUE_BUILD_SECONDS, { gasHeld: true });
assert.equal(torqueTruck.vehiclePerkProgress, 1);
assert.equal(
  resolveVehiclePerkTuning({ state: torqueTruck, tuning: truck.tuning }).accelerationMultiplier,
  deriveVehicleTuning({ ...truck.stats, acceleration: 5 }).accelerationMultiplier,
  'Sustained GAS must build Truck acceleration to the canonical 5/5 effect'
);
advanceForSeconds(torqueTruck, TORQUE_DECAY_SECONDS, { gasHeld: false });
assert.ok(torqueTruck.vehiclePerkProgress <= 1e-12, 'Releasing GAS must smoothly remove TORQUE');

const shiftOneTuning = deriveVehicleTuning({ ...truck.stats, acceleration: 1 });
const shiftFourTuning = deriveVehicleTuning({ ...truck.stats, acceleration: 4 });
const shiftingTruck = perkState(truck.id, true, shiftOneTuning);
advanceForSeconds(shiftingTruck, TORQUE_BUILD_SECONDS / 2, { gasHeld: true });
const retainedProgress = shiftingTruck.vehiclePerkProgress;
const fromOne = resolveVehiclePerkTuning({ state: shiftingTruck, tuning: shiftOneTuning }).accelerationMultiplier;
const fromFour = resolveVehiclePerkTuning({ state: shiftingTruck, tuning: shiftFourTuning }).accelerationMultiplier;
assert.equal(shiftingTruck.vehiclePerkProgress, retainedProgress,
  'Changing SHIFT baseline must preserve the live TORQUE progress fraction');
assert.ok(fromFour > fromOne && fromFour < 1.16,
  'TORQUE must immediately recompose from the new active base without a stale multiplier');

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
advanceVehiclePerkRuntimeState({ state: fullTankSuv, dt: 0.1, speed: 40, collided: true });
assert.equal(fullTankSuv.vehiclePerkProgress, 0, 'A collision must reset FULL TANK immediately');
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

// Ownership and lifecycle are canonical race state, not a cached UI guess.
assert.match(mainSource, /vehiclePerkUnlocked: isVehiclePerkUnlocked\(initialVehicleSelection\.carId\)/);
assert.match(mainSource, /state\.vehiclePerkUnlocked = isVehiclePerkUnlocked\(saved\.carId\)/);
assert.match(mainSource, /turn:trophy-road-updated/);
assert.match(mainSource, /turn:achievements-ready/);
assert.match(achievementsRuntimeSource, /new CustomEvent\('turn:achievements-ready'/);
assert.match(mainSource, /visibilitychange[\s\S]*resetVehiclePerkRuntimeState\(state\)/);
assert.match(mainSource, /pagehide[\s\S]*resetVehiclePerkRuntimeState\(state\)/);
assert.match(gameStateSource, /state\.vehiclePerkProgress = 0/);

console.log('TURN seven gated 1200–2000 Trophy Road vehicle perk behaviors passed.');
