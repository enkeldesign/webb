import { installDriftCameraSetting } from '../ui/drift-camera-setting.js?revision=r215-advanced-drift';

const DEFAULT_MAX_SENSOR_CAMERA_ROLL = 18 * Math.PI / 180;
const MAX_CONFIGURED_SAFE_ZONE_DEGREES = 45;
const LOW_SPEED_HORIZON_DEAD_ZONE = 1.25 * Math.PI / 180;
const LOW_SPEED_HORIZON_FULL_STABILIZATION_SPEED = 5 / 3.6;
const LOW_SPEED_HORIZON_RELEASE_SPEED = 25 / 3.6;
const LOW_SPEED_HORIZON_SMOOTHING_RATE = 10;
const DRIFT_CAMERA_BLEND_START_SPEED = 8 / 3.6;
const DRIFT_CAMERA_FULL_BLEND_SPEED = 28 / 3.6;
const DRIFT_CAMERA_TRAVEL_WEIGHT = 0.85;
const DRIFT_CAMERA_RESPONSE_RATE = 7.5;
const CAMERA_POSITION_RESPONSE_RATE = 6.2;
const CAMERA_TARGET_RESPONSE_RATE = 8.5;

installDriftCameraSetting();

export function resolveSensorCameraRollLimit(
  configuration = globalThis.__TURN_MOTION_SAFE_ZONE__
) {
  const configuredDegrees = Number(configuration?.horizonDegrees ?? configuration?.degrees);
  if (
    Number.isFinite(configuredDegrees)
    && configuredDegrees > 0
    && configuredDegrees <= MAX_CONFIGURED_SAFE_ZONE_DEGREES
  ) {
    return configuredDegrees * Math.PI / 180;
  }
  return DEFAULT_MAX_SENSOR_CAMERA_ROLL;
}

export function resolveLowSpeedHorizonStabilizationAmount(speed) {
  const speedMagnitude = Math.abs(Number(speed) || 0);
  if (speedMagnitude <= LOW_SPEED_HORIZON_FULL_STABILIZATION_SPEED) return 1;
  if (speedMagnitude >= LOW_SPEED_HORIZON_RELEASE_SPEED) return 0;

  return 1 - (
    speedMagnitude - LOW_SPEED_HORIZON_FULL_STABILIZATION_SPEED
  ) / (
    LOW_SPEED_HORIZON_RELEASE_SPEED - LOW_SPEED_HORIZON_FULL_STABILIZATION_SPEED
  );
}

export function resolveLowSpeedHorizonDeadZone(speed) {
  return LOW_SPEED_HORIZON_DEAD_ZONE * resolveLowSpeedHorizonStabilizationAmount(speed);
}

export function applyLowSpeedHorizonDeadZone(relativeRoll, maxRoll, speed) {
  const limit = Math.max(0, Number(maxRoll) || 0);
  if (!limit) return 0;

  const guardedRoll = clamp(Number(relativeRoll) || 0, -limit, limit);
  const deadZone = Math.min(limit, resolveLowSpeedHorizonDeadZone(speed));
  if (!deadZone) return guardedRoll;

  const magnitude = Math.abs(guardedRoll);
  if (magnitude <= deadZone) return 0;

  // Remove only the low-speed neutral jitter range, then stretch the remaining
  // response so intentional full tilt still reaches the existing camera limit.
  const activeRange = Math.max(0.000001, limit - deadZone);
  const remappedMagnitude = (magnitude - deadZone) / activeRange * limit;
  return Math.sign(guardedRoll) * remappedMagnitude;
}

export function smoothLowSpeedHorizonRoll(previousRoll, targetRoll, speed, dt) {
  const target = Number(targetRoll) || 0;
  const previous = Number(previousRoll);
  const current = Number.isFinite(previous) ? previous : target;
  const stabilizationAmount = resolveLowSpeedHorizonStabilizationAmount(speed);

  // Normal racing takes the direct path: no extra Math.exp() and no visual lag.
  if (stabilizationAmount <= 0) return target;

  const elapsed = Math.max(0, Number(dt) || 0);
  const smoothingResponse = 1 - Math.exp(-elapsed * LOW_SPEED_HORIZON_SMOOTHING_RATE);
  const smoothedRoll = lerp(current, target, smoothingResponse);

  // Fade the temporal smoothing out over the same 5–25 km/h interval as the
  // dead zone, reaching the untouched direct response at 25 km/h.
  return lerp(target, smoothedRoll, stabilizationAmount);
}

export function resolveDriftCameraBlend(speed) {
  const magnitude = Math.abs(Number(speed) || 0);
  if (magnitude <= DRIFT_CAMERA_BLEND_START_SPEED) return 0;
  if (magnitude >= DRIFT_CAMERA_FULL_BLEND_SPEED) return 1;
  const progress = (
    magnitude - DRIFT_CAMERA_BLEND_START_SPEED
  ) / (
    DRIFT_CAMERA_FULL_BLEND_SPEED - DRIFT_CAMERA_BLEND_START_SPEED
  );
  return progress * progress * (3 - 2 * progress);
}

export function resolveDriftCameraYawOffset({
  velocity,
  forward,
  right,
  previousOffset = 0,
  dt = 0,
  enabled = globalThis.__turnDriftCameraEnabled === true
}) {
  if (!enabled) return 0;

  const velocityX = finiteNumber(velocity?.x, 0);
  const velocityZ = finiteNumber(velocity?.z, 0);
  const travelSpeed = Math.hypot(velocityX, velocityZ);
  const blend = resolveDriftCameraBlend(travelSpeed);
  const previous = normalizeAngle(previousOffset);
  const longitudinal = velocityX * finiteNumber(forward?.x, 0)
    + velocityZ * finiteNumber(forward?.z, 0);
  const lateral = velocityX * finiteNumber(right?.x, 0)
    + velocityZ * finiteNumber(right?.z, 0);
  const travelOffset = travelSpeed > 0.0001 ? Math.atan2(lateral, longitudinal) : 0;
  const targetOffset = travelOffset * DRIFT_CAMERA_TRAVEL_WEIGHT * blend;
  const targetDelta = normalizeAngle(targetOffset - previous);
  const response = 1 - Math.exp(-Math.max(0, Number(dt) || 0) * DRIFT_CAMERA_RESPONSE_RATE);
  return normalizeAngle(previous + targetDelta * response);
}

export function resolveCameraMotionLeadTime(responseRate, dt) {
  const rate = Math.max(0, Number(responseRate) || 0);
  if (!rate) return 0;

  const elapsed = Math.max(0, Number(dt) || 0);
  if (!elapsed) return 1 / rate;

  const denominator = Math.expm1(elapsed * rate);
  if (!Number.isFinite(denominator)) return 0;
  return denominator > 0 ? elapsed / denominator : 1 / rate;
}

export function updateRaceCameraState({
  state,
  camera,
  cameraPosition,
  cameraTarget,
  getForward,
  getRight,
  samples,
  maxSpeed,
  dt
}) {
  const carForward = getForward();
  const carRight = getRight();
  state.driftCameraYawOffset = resolveDriftCameraYawOffset({
    velocity: state.velocity,
    forward: carForward,
    right: carRight,
    previousOffset: state.driftCameraYawOffset,
    dt
  });
  const driftCosine = Math.cos(state.driftCameraYawOffset);
  const driftSine = Math.sin(state.driftCameraYawOffset);
  const forward = {
    x: carForward.x * driftCosine + carRight.x * driftSine,
    y: 0,
    z: carForward.z * driftCosine + carRight.z * driftSine
  };
  const right = {
    x: carRight.x * driftCosine - carForward.x * driftSine,
    y: 0,
    z: carRight.z * driftCosine - carForward.z * driftSine
  };
  const speedRatio = clamp(state.speed / maxSpeed, 0, 1);
  const speedResponsiveCamera = globalThis.__turnSpeedResponsiveCameraEnabled === true;
  const velocityX = finiteNumber(state.velocity?.x, 0);
  const velocityZ = finiteNumber(state.velocity?.z, 0);
  // Keep the established lateral-drift offset driven by the car's own axis.
  // Drift Camera changes only camera orientation, not handling or the amount of
  // existing lateral camera movement.
  const lateralVelocity = state.velocity.dot(carRight);
  const roadY = finiteNumber(state.position?.y, 0);
  const lookAheadCount = 18 + Math.round(speedRatio * 12);
  const lookAheadIndex = Array.isArray(samples) && samples.length && Number.isFinite(state.nearestTrackIndex)
    ? (state.nearestTrackIndex + lookAheadCount) % samples.length
    : -1;
  const lookAheadRoadY = lookAheadIndex >= 0
    ? finiteNumber(samples[lookAheadIndex]?.point?.y, roadY)
    : roadY;

  // Zoom reverses the established physical pull-back: it moves slightly closer
  // and lower as speed builds. Both profiles share the same widening FOV, while
  // OFF preserves the classic distance and height curves.
  const followDistance = speedResponsiveCamera
    ? 16 - speedRatio * 2
    : 14 + speedRatio * 4;
  const cameraHeight = speedResponsiveCamera
    ? 8.7 - speedRatio
    : 7.7 + speedRatio * 2.5;
  const lateralOffset = lateralVelocity * 0.11;
  const cameraResponse = 1 - Math.exp(-dt * CAMERA_POSITION_RESPONSE_RATE);
  // Exponential world-space following otherwise adds a second, much larger
  // speed-dependent pull-back: at racing speed the camera trails the moving car
  // by roughly velocity / responseRate. Lead the moving target by the exact
  // discrete-time amount so smoothing remains available for turns without
  // allowing straight-line translation to move the car away on screen.
  const cameraMotionLead = speedResponsiveCamera
    ? resolveCameraMotionLeadTime(CAMERA_POSITION_RESPONSE_RATE, dt)
    : 0;
  cameraPosition.x = lerp(
    cameraPosition.x,
    state.position.x + velocityX * cameraMotionLead
      - forward.x * followDistance - right.x * lateralOffset,
    cameraResponse
  );
  cameraPosition.y = lerp(cameraPosition.y, roadY + cameraHeight, cameraResponse);
  cameraPosition.z = lerp(
    cameraPosition.z,
    state.position.z + velocityZ * cameraMotionLead
      - forward.z * followDistance - right.z * lateralOffset,
    cameraResponse
  );
  camera.position.copy(cameraPosition);

  const targetDistance = 15 + speedRatio * 12;
  const targetResponse = 1 - Math.exp(-dt * CAMERA_TARGET_RESPONSE_RATE);
  const targetMotionLead = speedResponsiveCamera
    ? resolveCameraMotionLeadTime(CAMERA_TARGET_RESPONSE_RATE, dt)
    : 0;
  cameraTarget.x = lerp(
    cameraTarget.x,
    state.position.x + velocityX * targetMotionLead + forward.x * targetDistance,
    targetResponse
  );
  const anticipatedRoadY = roadY + (lookAheadRoadY - roadY) * 0.35;
  cameraTarget.y = lerp(cameraTarget.y, anticipatedRoadY + 2, targetResponse);
  cameraTarget.z = lerp(
    cameraTarget.z,
    state.position.z + velocityZ * targetMotionLead + forward.z * targetDistance,
    targetResponse
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(cameraTarget);

  if (state.sensorMode) {
    const neutralRoll = Number.isFinite(state.neutralRoll) ? state.neutralRoll : 0;
    const relativeRoll = normalizeAngle(state.roll - neutralRoll);
    const maxSensorCameraRoll = resolveSensorCameraRollLimit();
    const guardedRoll = clamp(relativeRoll, -maxSensorCameraRoll, maxSensorCameraRoll);
    const stabilizedRoll = applyLowSpeedHorizonDeadZone(
      guardedRoll,
      maxSensorCameraRoll,
      state.speed
    );
    state.horizonCameraRoll = smoothLowSpeedHorizonRoll(
      state.horizonCameraRoll,
      stabilizedRoll,
      state.speed,
      dt
    );
    camera.rotateZ(-state.horizonCameraRoll);
  } else {
    state.horizonCameraRoll = 0;
  }

  camera.fov = lerp(camera.fov, 68 + speedRatio * 20, Math.min(1, dt * 4.5));
  camera.updateProjectionMatrix();
}

function normalizeAngle(angle) {
  let value = Number(angle) || 0;
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

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
