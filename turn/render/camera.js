const DEFAULT_MAX_SENSOR_CAMERA_ROLL = 18 * Math.PI / 180;
const MAX_CONFIGURED_SAFE_ZONE_DEGREES = 45;
const LOW_SPEED_HORIZON_DEAD_ZONE = 1.25 * Math.PI / 180;
const LOW_SPEED_HORIZON_FULL_STABILIZATION_SPEED = 5 / 3.6;
const LOW_SPEED_HORIZON_RELEASE_SPEED = 25 / 3.6;

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

export function resolveLowSpeedHorizonDeadZone(speed) {
  const speedMagnitude = Math.abs(Number(speed) || 0);
  if (speedMagnitude <= LOW_SPEED_HORIZON_FULL_STABILIZATION_SPEED) {
    return LOW_SPEED_HORIZON_DEAD_ZONE;
  }
  if (speedMagnitude >= LOW_SPEED_HORIZON_RELEASE_SPEED) return 0;

  const releaseProgress = (
    speedMagnitude - LOW_SPEED_HORIZON_FULL_STABILIZATION_SPEED
  ) / (
    LOW_SPEED_HORIZON_RELEASE_SPEED - LOW_SPEED_HORIZON_FULL_STABILIZATION_SPEED
  );
  return LOW_SPEED_HORIZON_DEAD_ZONE * (1 - releaseProgress);
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
  const forward = getForward();
  const right = getRight();
  const speedRatio = clamp(state.speed / maxSpeed, 0, 1);
  const lateralVelocity = state.velocity.dot(right);
  const roadY = finiteNumber(state.position?.y, 0);
  const lookAheadCount = 18 + Math.round(speedRatio * 12);
  const lookAheadIndex = Array.isArray(samples) && samples.length && Number.isFinite(state.nearestTrackIndex)
    ? (state.nearestTrackIndex + lookAheadCount) % samples.length
    : -1;
  const lookAheadRoadY = lookAheadIndex >= 0
    ? finiteNumber(samples[lookAheadIndex]?.point?.y, roadY)
    : roadY;

  const followDistance = 14 + speedRatio * 7;
  const lateralOffset = lateralVelocity * 0.11;
  const cameraResponse = 1 - Math.exp(-dt * 6.2);
  cameraPosition.x = lerp(
    cameraPosition.x,
    state.position.x - forward.x * followDistance - right.x * lateralOffset,
    cameraResponse
  );
  cameraPosition.y = lerp(cameraPosition.y, roadY + 7.7 + speedRatio * 2.5, cameraResponse);
  cameraPosition.z = lerp(
    cameraPosition.z,
    state.position.z - forward.z * followDistance - right.z * lateralOffset,
    cameraResponse
  );
  camera.position.copy(cameraPosition);

  const targetDistance = 15 + speedRatio * 12;
  const targetResponse = 1 - Math.exp(-dt * 8.5);
  cameraTarget.x = lerp(
    cameraTarget.x,
    state.position.x + forward.x * targetDistance,
    targetResponse
  );
  const anticipatedRoadY = roadY + (lookAheadRoadY - roadY) * 0.35;
  cameraTarget.y = lerp(cameraTarget.y, anticipatedRoadY + 2, targetResponse);
  cameraTarget.z = lerp(
    cameraTarget.z,
    state.position.z + forward.z * targetDistance,
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
    camera.rotateZ(-stabilizedRoll);
  }

  camera.fov = lerp(camera.fov, 68 + speedRatio * 14, Math.min(1, dt * 4.5));
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
