import { resolveWorldCollisionState } from '../race/world-collision.js?build=20260723-r53';
import { recordLapCourseSafetyState } from '../race/course-safety.js?revision=r186-road-edge-latch';
import { trackPitch, trackSurfaceY } from '../tracks/elevation.js?build=20260725-r67';
import {
  advanceVehiclePerkRuntimeState,
  resolveVehicleLockDragAdd,
  resolveVehicleOffRoadPenalty,
  resolveVehiclePerkTuning
} from './perk-runtime.js?revision=r233-graduated';

const OFFROAD_CAPABLE_VEHICLE_IDS = new Set(['monster-truck']);
const OVERDRIVE_VEHICLE_ID = 'race-future';
const OVERDRIVE_MIN_SPEED = 8;
const DRIFT_FLOW_SLIP_ANGLE = Math.PI / 12;
const DRIFT_HIGH_SLIP_ANGLE = Math.PI * 70 / 180;
const DRIFT_FLOW_PENALTY_SCALE = 0.65;
const DRIFT_HIGH_SLIP_PENALTY_SCALE = 0.80;
export const OVERDRIVE_BUILD_SECONDS = 5;
export const OVERDRIVE_MAX_SPEED_MULTIPLIER = 1.06;

export function vehicleIgnoresOffRoadPenalty(vehicleId) {
  return OFFROAD_CAPABLE_VEHICLE_IDS.has(String(vehicleId || ''));
}

export function vehicleHasOverdrive(vehicleId) {
  return String(vehicleId || '') === OVERDRIVE_VEHICLE_ID;
}

export function getOverdriveSpeedMultiplier(cleanSeconds = 0) {
  const progress = clamp(nonNegativeNumber(cleanSeconds, 0) / OVERDRIVE_BUILD_SECONDS, 0, 1);
  return 1 + (OVERDRIVE_MAX_SPEED_MULTIPLIER - 1) * progress;
}

export function resolveOverchargedControlMultiplier({
  controlMultiplier = 1,
  overchargeControlMultiplier = controlMultiplier,
  overcharge = 0
} = {}) {
  const baseControlMultiplier = positiveNumber(controlMultiplier, 1);
  if (nonNegativeNumber(overcharge, 0) <= 0) return baseControlMultiplier;
  return Math.max(
    baseControlMultiplier,
    positiveNumber(overchargeControlMultiplier, baseControlMultiplier)
  );
}

export function resolveVehicleOverchargedAccelerationMultiplier({
  vehicleId = '',
  perkUnlocked = false,
  accelerationMultiplier = 1,
  overchargeAccelerationMultiplier = accelerationMultiplier,
  overcharge = 0
} = {}) {
  const baseAccelerationMultiplier = positiveNumber(accelerationMultiplier, 1);
  const normalizedVehicleId = String(vehicleId || '');
  const ownsOverchargeAcceleration = normalizedVehicleId === 'race'
    || (normalizedVehicleId === 'truck' && perkUnlocked === true);
  if (!ownsOverchargeAcceleration || nonNegativeNumber(overcharge, 0) <= 0) {
    return baseAccelerationMultiplier;
  }
  return Math.max(
    baseAccelerationMultiplier,
    positiveNumber(overchargeAccelerationMultiplier, baseAccelerationMultiplier)
  );
}

export function updateVehicleOverdriveState({
  state,
  dt = 0,
  offRoad = state?.offRoad === true,
  collided = false,
  speed = state?.speed || 0
} = {}) {
  if (!state) return 1;
  if (!vehicleHasOverdrive(state.vehicleId)) {
    state.overdriveCleanSeconds = 0;
    return 1;
  }

  if (offRoad || collided) {
    state.overdriveCleanSeconds = 0;
    return 1;
  }

  if (nonNegativeNumber(speed, 0) >= OVERDRIVE_MIN_SPEED) {
    state.overdriveCleanSeconds = clamp(
      nonNegativeNumber(state.overdriveCleanSeconds, 0) + nonNegativeNumber(dt, 0),
      0,
      OVERDRIVE_BUILD_SECONDS
    );
  }

  return getOverdriveSpeedMultiplier(state.overdriveCleanSeconds);
}

export function resolveDriftSpeedMultiplier({
  driftSpeedMultiplier = 0.84,
  slipAngle = 0,
  driftLockAmount = 0
} = {}) {
  const baseMultiplier = clamp(
    positiveNumber(driftSpeedMultiplier, 0.84),
    0.5,
    0.99
  );
  const slip = Math.abs(Number(slipAngle) || 0);
  const slipMix = smoothstep(DRIFT_FLOW_SLIP_ANGLE, DRIFT_HIGH_SLIP_ANGLE, slip);
  const ordinaryPenaltyScale = lerp(
    DRIFT_FLOW_PENALTY_SCALE,
    DRIFT_HIGH_SLIP_PENALTY_SCALE,
    slipMix
  );
  // Ordinary flowing DRIFT keeps more momentum, especially at modest slip angles.
  // LOCK remains the committed handbrake state and restores the full legacy speed cost.
  const penaltyScale = lerp(
    ordinaryPenaltyScale,
    1,
    clamp(nonNegativeNumber(driftLockAmount, 0), 0, 1)
  );
  return 1 - (1 - baseMultiplier) * penaltyScale;
}

export function getVehicleSpeedLimit({
  offRoad = false,
  offRoadPenalty = offRoad ? 1 : 0,
  boostActive = false,
  maxSpeed,
  boostSpeedMultiplier = 1.32,
  driftHeld = false,
  driftSpeedMultiplier = 0.84,
  driftSlipAngle = 0,
  driftLockAmount = 0
}) {
  const effectiveMaxSpeed = positiveNumber(maxSpeed, 1);
  const effectiveBoostSpeedMultiplier = positiveNumber(boostSpeedMultiplier, 1.32);
  const effectiveDriftSpeedMultiplier = resolveDriftSpeedMultiplier({
    driftSpeedMultiplier,
    slipAngle: driftSlipAngle,
    driftLockAmount
  });
  const roadSpeedLimit = boostActive
    ? effectiveMaxSpeed * effectiveBoostSpeedMultiplier
    : effectiveMaxSpeed;
  const offRoadSpeedLimit = boostActive
    ? effectiveMaxSpeed * 0.82
    : effectiveMaxSpeed * 0.73;
  const baseSpeedLimit = lerp(
    roadSpeedLimit,
    offRoadSpeedLimit,
    clamp(nonNegativeNumber(offRoadPenalty, offRoad ? 1 : 0), 0, 1)
  );

  return driftHeld
    ? baseSpeedLimit * effectiveDriftSpeedMultiplier
    : baseSpeedLimit;
}

function updateVehiclePhysicsStateCore({
  state,
  dt,
  updateMotionInput,
  findNearestTrack,
  getForward,
  getRight,
  trackWidth,
  trackSampleCount,
  maxSpeed,
  analogGas = 0,
  boostActive = false,
  boostOvercharge = 0,
  driftHeld = false,
  driftLock = 0,
  vehicleTuning = null
}) {
  updateMotionInput(dt);

  const baseTuning = vehicleTuning || globalThis.__turnVehicleTuning;
  const tuning = resolveVehiclePerkTuning({ state, tuning: baseTuning });
  const baseAccelerationMultiplier = positiveNumber(tuning?.accelerationMultiplier, 1);
  const accelerationMultiplier = resolveVehicleOverchargedAccelerationMultiplier({
    vehicleId: state.vehicleId,
    perkUnlocked: state.vehiclePerkUnlocked,
    accelerationMultiplier: baseAccelerationMultiplier,
    overchargeAccelerationMultiplier: tuning?.overchargeAccelerationMultiplier,
    overcharge: boostOvercharge
  });
  const baseControlMultiplier = positiveNumber(tuning?.controlMultiplier, 1);
  const controlMultiplier = resolveOverchargedControlMultiplier({
    controlMultiplier: baseControlMultiplier,
    overchargeControlMultiplier: tuning?.overchargeControlMultiplier,
    overcharge: boostOvercharge
  });
  state.apexGripActive = String(state.vehicleId || '') === 'race'
    && (controlMultiplier > baseControlMultiplier
      || accelerationMultiplier > baseAccelerationMultiplier);
  state.torqueActive = String(state.vehicleId || '') === 'truck'
    && state.vehiclePerkUnlocked === true
    && accelerationMultiplier > baseAccelerationMultiplier;
  const driftEngineMultiplier = positiveNumber(tuning?.driftEngineMultiplier, 0.86);
  const driftDragAdd = nonNegativeNumber(tuning?.driftDragAdd, 0.1);
  const driftSpeedMultiplier = clamp(positiveNumber(tuning?.driftSpeedMultiplier, 0.84), 0.5, 0.99);
  const driftStabilityMultiplier = clamp(positiveNumber(tuning?.driftStabilityMultiplier, 1), 0.75, 1.25);
  const driftYawMultiplier = driftHeld
    ? clamp(positiveNumber(tuning?.driftYawMultiplier, 1), 0.75, 1.5)
    : 1;
  const driftGripTuningMultiplier = driftHeld
    ? clamp(positiveNumber(tuning?.driftGripMultiplier, 1), 0.55, 1.25)
    : 1;
  const driftSlideMultiplier = driftHeld
    ? clamp(positiveNumber(tuning?.driftSlideMultiplier, 1), 0.75, 1.5)
    : 1;
  const driftLockAmount = driftHeld
    ? clamp(nonNegativeNumber(driftLock, 0), 0, 1)
    : 0;
  const lockYawMultiplier = lerp(1, 1.55, driftLockAmount);
  const lockGripMultiplier = lerp(1, 0.22, driftLockAmount);
  const lockSlideMultiplier = lerp(1, 1.25, driftLockAmount);
  const lockDragAdd = resolveVehicleLockDragAdd({
    vehicleId: state.vehicleId,
    perkUnlocked: state.vehiclePerkUnlocked,
    perkLockDragAdd: tuning?.lockDragAdd
  });
  state.driftLockAmount = driftLockAmount;
  const tuningBoostPowerMultiplier = positiveNumber(tuning?.boostPowerMultiplier, 1);
  const tuningBoostSpeedMultiplier = positiveNumber(tuning?.boostSpeedMultiplier, 1.32);
  const baseTopSpeedMultiplier = positiveNumber(baseTuning?.topSpeedMultiplier, 1);
  const effectiveTopSpeedMultiplier = positiveNumber(tuning?.topSpeedMultiplier, baseTopSpeedMultiplier);
  const effectiveMaxSpeed = maxSpeed * effectiveTopSpeedMultiplier / baseTopSpeedMultiplier;
  state.vehicleEffectiveMaxSpeed = effectiveMaxSpeed;
  const activeTrackSampleCount = positiveNumber(state.trackSampleCount, trackSampleCount);
  const directGas = Math.max(0, Number(analogGas) || 0);
  const directBrake = 0;
  state.throttle = Math.max(directGas, state.touchGas ? 1 : 0);
  state.brake = Math.max(directBrake, state.touchBrake ? 1 : 0);

  const nearestBefore = findNearestTrack(state.position);
  state.nearestTrackIndex = nearestBefore.index;
  state.trackDistance = nearestBefore.distance;
  state.offRoad = nearestBefore.distance > trackWidth * 0.58 && !isForgivingSurface(state.position);
  const physicsOffRoad = state.offRoad && !vehicleIgnoresOffRoadPenalty(state.vehicleId);
  const offRoadPenalty = resolveVehicleOffRoadPenalty({
    vehicleId: state.vehicleId,
    perkUnlocked: state.vehiclePerkUnlocked,
    offRoad: physicsOffRoad,
    trackDistance: state.trackDistance,
    trackWidth
  });

  const forward = getForward();
  const right = getRight();
  let forwardSpeed = state.velocity.dot(forward);
  let lateralSpeed = state.velocity.dot(right);
  let speed = state.velocity.length();

  const brakingOrReversing = state.brake > 0;
  const driveThrottle = brakingOrReversing ? 0 : state.throttle;
  const effectiveBoostActive = boostActive && !brakingOrReversing;

  const enginePower =
    lerp(43, 36, offRoadPenalty) *
    accelerationMultiplier *
    (driftHeld ? driftEngineMultiplier : 1);
  const boostPower = effectiveBoostActive
    ? lerp(36, 16, offRoadPenalty) * tuningBoostPowerMultiplier
    : 0;
  state.velocity.addScaledVector(
    forward,
    (driveThrottle * enginePower + boostPower) * dt
  );

  if (state.brake > 0) {
    const brakeStep = 62 * state.brake * dt;
    forwardSpeed = state.velocity.dot(forward);

    if (forwardSpeed > 0.35) {
      // First use of the control is always braking while the car still moves forward.
      state.velocity.addScaledVector(
        forward,
        -Math.min(forwardSpeed, brakeStep)
      );
    } else {
      // Once forward motion is essentially gone, the same held control becomes reverse.
      const reversePower = lerp(27, 20, offRoadPenalty) * accelerationMultiplier;
      state.velocity.addScaledVector(forward, -reversePower * state.brake * dt);

      const reverseSpeed = state.velocity.dot(forward);
      const reverseSpeedLimit = effectiveMaxSpeed * 0.32;
      if (reverseSpeed < -reverseSpeedLimit) {
        state.velocity.addScaledVector(forward, -reverseSpeedLimit - reverseSpeed);
      }
    }

    forwardSpeed = state.velocity.dot(forward);
  }

  speed = state.velocity.length();
  const speedRatio = clamp(speed / effectiveMaxSpeed, 0, 1);
  const brakeDriftInput = state.brake > 0 && forwardSpeed > 0 ? state.brake : 0;
  const driftIntent = clamp(
    Math.abs(state.steering) * speedRatio * 0.9 +
      brakeDriftInput * Math.abs(state.steering) * 1.35 +
      Math.abs(lateralSpeed) / 22 +
      (driftHeld ? 0.48 + Math.abs(state.steering) * 0.5 : 0) +
      driftLockAmount * (0.25 + Math.abs(state.steering) * 0.35),
    0,
    1
  );
  const driftResponseRate = driftIntent > state.driftAmount
    ? 7
    : 3.2 * driftStabilityMultiplier;

  state.driftAmount = lerp(
    state.driftAmount,
    driftIntent,
    Math.min(1, dt * driftResponseRate)
  );

  const steeringAuthority = clamp(Math.abs(forwardSpeed) / 7, 0, 1);
  const steeringStatMultiplier = driftHeld
    ? lerp(1, controlMultiplier, 0.25)
    : controlMultiplier;
  const yawRate =
    state.steering *
    Math.sign(forwardSpeed || 1) *
    (0.18 + Math.abs(forwardSpeed) * 0.012) *
    steeringAuthority *
    steeringStatMultiplier *
    driftYawMultiplier *
    lockYawMultiplier *
    (1 + state.driftAmount * 0.65 + (driftHeld ? 0.58 : 0));

  state.heading = normalizeAngle(state.heading + yawRate * dt);

  const newRight = getRight();
  lateralSpeed = state.velocity.dot(newRight);

  const controlGripMultiplier = driftHeld
    ? 1
    : 0.92 + controlMultiplier * 0.08;
  const driftGripMultiplier = driftHeld
    ? 0.42 * driftStabilityMultiplier * driftGripTuningMultiplier * lockGripMultiplier
    : 1;
  const roadGrip = lerp(11.5, 1.45, state.driftAmount);
  const offRoadGrip = lerp(3.4, 1.35, state.driftAmount);
  const grip = lerp(roadGrip, offRoadGrip, offRoadPenalty) *
    controlGripMultiplier * driftGripMultiplier;

  const lateralCorrection = 1 - Math.exp(-grip * dt);
  state.velocity.addScaledVector(newRight, -lateralSpeed * lateralCorrection);

  if ((state.driftAmount > 0.18 || driftHeld) && speed > 14) {
    const slideStrength = (driftHeld ? 0.235 : 0.12) *
      driftSlideMultiplier * lockSlideMultiplier;
    state.velocity.addScaledVector(
      newRight,
      state.steering * speed * Math.max(state.driftAmount, 0.48) * slideStrength * dt
    );
  }

  const roadDrag = 0.11 + speed * 0.0009 +
    (driftHeld ? driftDragAdd : 0) + driftLockAmount * lockDragAdd;
  const drag = lerp(roadDrag, 0.34, offRoadPenalty);
  state.velocity.multiplyScalar(Math.exp(-drag * dt));

  speed = state.velocity.length();
  const overdriveSpeedMultiplier = updateVehicleOverdriveState({
    state,
    dt,
    offRoad: state.offRoad,
    speed
  });
  const currentForward = getForward();
  const currentRight = getRight();
  // Keep the full 0..PI relationship between the car and its velocity. Folding
  // the longitudinal component with Math.abs made a car spinning past 90 degrees
  // look like a mild forward slide and incorrectly restored most of its momentum.
  const signedDriftSlipAngle = Math.atan2(
    state.velocity.dot(currentRight),
    state.velocity.dot(currentForward)
  );
  state.driftSlipAngle = signedDriftSlipAngle;
  const driftSlipAngle = Math.abs(signedDriftSlipAngle);
  const speedLimit = getVehicleSpeedLimit({
    offRoad: physicsOffRoad,
    offRoadPenalty,
    boostActive: effectiveBoostActive,
    maxSpeed: effectiveMaxSpeed,
    boostSpeedMultiplier: tuningBoostSpeedMultiplier,
    driftHeld,
    driftSpeedMultiplier,
    driftSlipAngle,
    driftLockAmount
  }) * overdriveSpeedMultiplier;

  if (speed > speedLimit) state.velocity.multiplyScalar(speedLimit / speed);

  state.position.addScaledVector(state.velocity, dt);
  state.speed = state.velocity.length();

  let nearestAfter = findNearestTrack(state.position);
  recordLapCourseSafetyState({
    state,
    nearestTrack: nearestAfter,
    trackWidth,
    forgivingSurface: isForgivingSurface(state.position)
  });
  const collision = resolveWorldCollisionState({
    state,
    trackId: state.trackId,
    nearestTrack: nearestAfter,
    collisionProfile: currentCollisionProfile(),
    dt
  });
  state.collided = collision.collided === true;
  if (collision.collided) updateVehicleOverdriveState({ state, collided: true });
  if (collision.collided) nearestAfter = findNearestTrack(state.position);

  state.position.y = trackSurfaceY(nearestAfter.sample);
  state.surfacePitch = trackPitch(nearestAfter.sample);
  state.trackDistance = nearestAfter.distance;
  state.offRoad = nearestAfter.distance > trackWidth * 0.58 && !isForgivingSurface(state.position);
  if (state.offRoad) updateVehicleOverdriveState({ state, offRoad: true });
  state.lastProgress = state.progress;
  state.progress = nearestAfter.index / activeTrackSampleCount;
  state.nearestTrackIndex = nearestAfter.index;
  state.speed = state.velocity.length();

  advanceVehiclePerkRuntimeState({
    state,
    dt,
    overcharge: boostOvercharge,
    boostActive: effectiveBoostActive,
    driftHeld,
    offRoad: state.offRoad,
    collided: collision.collided,
    speed: state.speed
  });

  return nearestAfter;
}

export function updateVehiclePhysicsState(options) {
  const recordPhase = globalThis.__turnPerfRecordPhase;
  if (typeof recordPhase !== 'function') return updateVehiclePhysicsStateCore(options);

  const startedAt = performanceNow();
  try {
    return updateVehiclePhysicsStateCore(options);
  } finally {
    recordPhase('physics', Math.max(0, performanceNow() - startedAt));
  }
}

function isForgivingSurface(position) {
  try {
    return globalThis.__turnIsForgivingSurface?.(position) === true;
  } catch (_) {
    return false;
  }
}

function currentCollisionProfile() {
  try {
    return globalThis.__turnGetCollisionProfile?.() || null;
  } catch (_) {
    return null;
  }
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
