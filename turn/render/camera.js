const DEFAULT_MAX_SENSOR_CAMERA_ROLL = 18 * Math.PI / 180;
const MAX_CONFIGURED_SAFE_ZONE_DEGREES = 45;

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
    camera.rotateZ(-guardedRoll);
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
