export const FLIGHT_LIMITS = Object.freeze({
  minimumSpeed: 44,
  stallSpeed: 57,
  cruiseSpeed: 92,
  maximumSpeed: 138,
  maximumPitch: degreesToRadians(22),
  maximumBank: degreesToRadians(42),
  maximumTurnRate: degreesToRadians(31),
  pitchResponseRate: 2.8,
  bankResponseRate: 4.4,
  throttleIncreaseRate: 0.34,
  throttleDecreaseRate: 0.46
});

export const START_POSE = Object.freeze({
  x: 0,
  y: 72,
  z: 185,
  heading: 0,
  pitch: degreesToRadians(2),
  bank: 0,
  speed: 91,
  throttle: 0.7
});

export function createFlightState(overrides = {}) {
  return {
    position: {
      x: finiteOr(overrides.x, START_POSE.x),
      y: finiteOr(overrides.y, START_POSE.y),
      z: finiteOr(overrides.z, START_POSE.z)
    },
    heading: finiteOr(overrides.heading, START_POSE.heading),
    pitch: finiteOr(overrides.pitch, START_POSE.pitch),
    bank: finiteOr(overrides.bank, START_POSE.bank),
    speed: finiteOr(overrides.speed, START_POSE.speed),
    throttle: clamp(finiteOr(overrides.throttle, START_POSE.throttle), 0, 1),
    verticalSpeed: 0,
    stalled: false,
    elapsed: 0
  };
}

export function updateFlightState(state, controls = {}, elapsedSeconds = 0) {
  const dt = clamp(finiteOr(elapsedSeconds, 0), 0, 0.05);
  if (!dt) return state;

  const turn = clamp(finiteOr(controls.turn, 0), -1, 1);
  const pitchControl = clamp(finiteOr(controls.pitch, 0), -1, 1);
  const thrust = Boolean(controls.thrust);
  const brake = Boolean(controls.brake);

  if (thrust !== brake) {
    const throttleRate = thrust
      ? FLIGHT_LIMITS.throttleIncreaseRate
      : -FLIGHT_LIMITS.throttleDecreaseRate;
    state.throttle = clamp(state.throttle + throttleRate * dt, 0, 1);
  }

  const targetPitch = pitchControl * FLIGHT_LIMITS.maximumPitch;
  const targetBank = turn * FLIGHT_LIMITS.maximumBank;
  state.pitch = damp(state.pitch, targetPitch, FLIGHT_LIMITS.pitchResponseRate, dt);
  state.bank = damp(state.bank, targetBank, FLIGHT_LIMITS.bankResponseRate, dt);

  const targetSpeed = lerp(
    FLIGHT_LIMITS.minimumSpeed,
    FLIGHT_LIMITS.maximumSpeed,
    state.throttle
  );
  state.speed = damp(state.speed, targetSpeed, 0.62, dt);

  // Climbing trades speed for height while a dive recovers some of that energy.
  const climbDemand = Math.max(0, Math.sin(state.pitch));
  const diveRecovery = Math.max(0, -Math.sin(state.pitch));
  state.speed += (diveRecovery * 8.2 - climbDemand * 6.4) * dt;
  state.speed = clamp(state.speed, FLIGHT_LIMITS.minimumSpeed * 0.72, FLIGHT_LIMITS.maximumSpeed);

  state.stalled = state.speed < FLIGHT_LIMITS.stallSpeed;
  const speedRange = Math.max(1, FLIGHT_LIMITS.maximumSpeed - FLIGHT_LIMITS.stallSpeed);
  const turnAuthority = clamp((state.speed - FLIGHT_LIMITS.minimumSpeed) / speedRange, 0.2, 1);
  state.heading = wrapAngle(
    state.heading - turn * FLIGHT_LIMITS.maximumTurnRate * turnAuthority * dt
  );

  const horizontalSpeed = Math.cos(state.pitch) * state.speed;
  const aerodynamicClimb = Math.sin(state.pitch) * state.speed;
  const stallSink = state.stalled
    ? lerp(0, 23, clamp(
      (FLIGHT_LIMITS.stallSpeed - state.speed)
        / (FLIGHT_LIMITS.stallSpeed - FLIGHT_LIMITS.minimumSpeed * 0.72),
      0,
      1
    ))
    : 0;

  state.verticalSpeed = aerodynamicClimb - stallSink;
  state.position.x += Math.sin(state.heading) * horizontalSpeed * dt;
  state.position.y += state.verticalSpeed * dt;
  state.position.z -= Math.cos(state.heading) * horizontalSpeed * dt;
  state.elapsed += dt;
  return state;
}

export function controlFromAngle(deltaRadians, {
  limitRadians = degreesToRadians(18),
  deadZoneRadians = degreesToRadians(1.8),
  invert = false,
  curvePower = 1.12
} = {}) {
  const magnitude = Math.abs(finiteOr(deltaRadians, 0));
  if (magnitude <= deadZoneRadians) return 0;

  const available = Math.max(0.001, limitRadians - deadZoneRadians);
  const linear = clamp((magnitude - deadZoneRadians) / available, 0, 1);
  const curved = Math.pow(linear, curvePower);
  const eased = curved * curved * (3 - 2 * curved);
  const direction = Math.sign(deltaRadians) * (invert ? -1 : 1);
  return direction * eased;
}

export function checkpointReached(position, checkpoint, radius = 34) {
  if (!position || !checkpoint) return false;
  const dx = finiteOr(position.x, 0) - finiteOr(checkpoint.x, 0);
  const dy = finiteOr(position.y, 0) - finiteOr(checkpoint.y, 0);
  const dz = finiteOr(position.z, 0) - finiteOr(checkpoint.z, 0);
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

export function distanceBetween(position, target) {
  if (!position || !target) return Infinity;
  return Math.hypot(
    finiteOr(position.x, 0) - finiteOr(target.x, 0),
    finiteOr(position.y, 0) - finiteOr(target.y, 0),
    finiteOr(position.z, 0) - finiteOr(target.z, 0)
  );
}

export function headingToTarget(position, target) {
  const dx = finiteOr(target?.x, 0) - finiteOr(position?.x, 0);
  const dz = finiteOr(target?.z, 0) - finiteOr(position?.z, 0);
  return Math.atan2(dx, -dz);
}

export function shortestAngle(from, to) {
  return wrapAngle(finiteOr(to, 0) - finiteOr(from, 0));
}

export function formatCourseTime(seconds) {
  const safe = Math.max(0, finiteOr(seconds, 0));
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${minutes}:${remainder.toFixed(2).padStart(5, '0')}`;
}

export function metresPerSecondToKnots(value) {
  return Math.max(0, finiteOr(value, 0)) * 1.943844;
}

export function radiansToDegrees(value) {
  return finiteOr(value, 0) * 180 / Math.PI;
}

export function degreesToRadians(value) {
  return finiteOr(value, 0) * Math.PI / 180;
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function damp(current, target, responseRate, dt) {
  return lerp(current, target, 1 - Math.exp(-responseRate * dt));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function wrapAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
