export const FRONT_WHEEL_STEER_ANGLE = 0.58;
export const EXTREME_DRIFT_SLIP_THRESHOLD = Math.PI / 4;
export const MIN_TRAJECTORY_ALIGNMENT_SPEED = 1;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeWheelAngle(angle) {
  const finiteAngle = finiteNumber(angle);
  return Math.atan2(Math.sin(finiteAngle), Math.cos(finiteAngle));
}

export function resolveFrontWheelSteeringAngle({
  steering = 0,
  heading = 0,
  velocityX = 0,
  velocityZ = 0,
  driftHeld = false,
  driftLockAmount = 0
} = {}) {
  const inputAngle = clamp(finiteNumber(steering), -1, 1) * FRONT_WHEEL_STEER_ANGLE;
  const x = finiteNumber(velocityX);
  const z = finiteNumber(velocityZ);
  const speedSquared = x * x + z * z;
  const driftActive = Boolean(driftHeld) || finiteNumber(driftLockAmount) > 0;

  if (!driftActive || speedSquared < MIN_TRAJECTORY_ALIGNMENT_SPEED ** 2) {
    return inputAngle;
  }

  const trajectoryHeading = Math.atan2(x, z);
  const slipAngle = normalizeWheelAngle(trajectoryHeading - finiteNumber(heading));

  if (Math.abs(slipAngle) < EXTREME_DRIFT_SLIP_THRESHOLD - Number.EPSILON * 4) {
    return inputAngle;
  }

  return slipAngle;
}
