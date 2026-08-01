import { resolveWorldCollisionState } from '../race/world-collision.js?build=20260723-r53';
import { trackPitch, trackSurfaceY } from '../tracks/elevation.js?build=20260725-r67';

export function getVehicleSpeedLimit({
  offRoad = false,
  boostActive = false,
  maxSpeed,
  boostSpeedMultiplier = 1.32,
  driftHeld = false,
  driftSpeedMultiplier = 0.84
}) {
  const effectiveMaxSpeed = positiveNumber(maxSpeed, 1);
  const effectiveBoostSpeedMultiplier = positiveNumber(boostSpeedMultiplier, 1.32);
  const effectiveDriftSpeedMultiplier = clamp(
    positiveNumber(driftSpeedMultiplier, 0.84),
    0.5,
    0.99
  );
  const baseSpeedLimit = offRoad
    ? (boostActive ? effectiveMaxSpeed * 0.82 : effectiveMaxSpeed * 0.73)
    : (boostActive ? effectiveMaxSpeed * effectiveBoostSpeedMultiplier : effectiveMaxSpeed);

  return driftHeld
    ? baseSpeedLimit * effectiveDriftSpeedMultiplier
    : baseSpeedLimit;
}

export function updateVehiclePhysicsState({
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
  driftHeld = false,
  vehicleTuning = null
}) {
  updateMotionInput(dt);

  const tuning = vehicleTuning || globalThis.__turnVehicleTuning;
  const accelerationMultiplier = positiveNumber(tuning?.accelerationMultiplier, 1);
  const controlMultiplier = positiveNumber(tuning?.controlMultiplier, 1);
  const driftEngineMultiplier = positiveNumber(tuning?.driftEngineMultiplier, 0.86);
  const driftDragAdd = nonNegativeNumber(tuning?.driftDragAdd, 0.1);
  const driftSpeedMultiplier = clamp(positiveNumber(tuning?.driftSpeedMultiplier, 0.84), 0.5, 0.99);
  const driftStabilityMultiplier = clamp(positiveNumber(tuning?.driftStabilityMultiplier, 1), 0.75, 1.25);
  const tuningBoostPowerMultiplier = positiveNumber(tuning?.boostPowerMultiplier, 1);
  const tuningBoostSpeedMultiplier = positiveNumber(tuning?.boostSpeedMultiplier, 1.32);
  const effectiveMaxSpeed = maxSpeed;
  const activeTrackSampleCount = positiveNumber(state.trackSampleCount, trackSampleCount);
  const directGas = Math.max(0, Number(analogGas) || 0);
  const directBrake = 0;
  state.throttle = Math.max(directGas, state.touchGas ? 1 : 0);
  state.brake = Math.max(directBrake, state.touchBrake ? 1 : 0);

  const nearestBefore = findNearestTrack(state.position);
  state.nearestTrackIndex = nearestBefore.index;
  state.trackDistance = nearestBefore.distance;
  state.offRoad = nearestBefore.distance > trackWidth * 0.58 && !isForgivingSurface(state.position);

  const forward = getForward();
  const right = getRight();
  let forwardSpeed = state.velocity.dot(forward);
  let lateralSpeed = state.velocity.dot(right);
  let speed = state.velocity.length();

  const brakingOrReversing = state.brake > 0;
  const driveThrottle = brakingOrReversing ? 0 : state.throttle;
  const effectiveBoostActive = boostActive && !brakingOrReversing;

  const enginePower =
    (state.offRoad ? 36 : 43) *
    accelerationMultiplier *
    (driftHeld ? driftEngineMultiplier : 1);
  const boostPower = effectiveBoostActive
    ? (state.offRoad ? 16 : 36) * tuningBoostPowerMultiplier
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
      const reversePower = (state.offRoad ? 20 : 27) * accelerationMultiplier;
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
      (driftHeld ? 0.48 + Math.abs(state.steering) * 0.5 : 0),
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
    (1 + state.driftAmount * 0.65 + (driftHeld ? 0.58 : 0));

  state.heading = normalizeAngle(state.heading + yawRate * dt);

  const newRight = getRight();
  lateralSpeed = state.velocity.dot(newRight);

  const controlGripMultiplier = driftHeld
    ? 1
    : 0.92 + controlMultiplier * 0.08;
  const driftGripMultiplier = driftHeld
    ? 0.42 * driftStabilityMultiplier
    : 1;
  const grip = (
    state.offRoad
      ? lerp(3.4, 1.35, state.driftAmount)
      : lerp(11.5, 1.45, state.driftAmount)
  ) * controlGripMultiplier * driftGripMultiplier;

  const lateralCorrection = 1 - Math.exp(-grip * dt);
  state.velocity.addScaledVector(newRight, -lateralSpeed * lateralCorrection);

  if ((state.driftAmount > 0.18 || driftHeld) && speed > 14) {
    const slideStrength = driftHeld ? 0.235 : 0.12;
    state.velocity.addScaledVector(
      newRight,
      state.steering * speed * Math.max(state.driftAmount, 0.48) * slideStrength * dt
    );
  }

  const drag = state.offRoad
    ? 0.34
    : 0.11 + speed * 0.0009 + (driftHeld ? driftDragAdd : 0);
  state.velocity.multiplyScalar(Math.exp(-drag * dt));

  const speedLimit = getVehicleSpeedLimit({
    offRoad: state.offRoad,
    boostActive: effectiveBoostActive,
    maxSpeed: effectiveMaxSpeed,
    boostSpeedMultiplier: tuningBoostSpeedMultiplier,
    driftHeld,
    driftSpeedMultiplier
  });

  speed = state.velocity.length();
  if (speed > speedLimit) state.velocity.multiplyScalar(speedLimit / speed);

  state.position.addScaledVector(state.velocity, dt);
  state.speed = state.velocity.length();

  let nearestAfter = findNearestTrack(state.position);
  const collision = resolveWorldCollisionState({
    state,
    trackId: state.trackId,
    nearestTrack: nearestAfter,
    collisionProfile: currentCollisionProfile(),
    dt
  });
  if (collision.collided) nearestAfter = findNearestTrack(state.position);

  state.position.y = trackSurfaceY(nearestAfter.sample);
  state.surfacePitch = trackPitch(nearestAfter.sample);
  state.trackDistance = nearestAfter.distance;
  state.offRoad = nearestAfter.distance > trackWidth * 0.58 && !isForgivingSurface(state.position);
  state.lastProgress = state.progress;
  state.progress = nearestAfter.index / activeTrackSampleCount;
  state.nearestTrackIndex = nearestAfter.index;
  state.speed = state.velocity.length();

  return nearestAfter;
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
