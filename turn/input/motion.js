import { getTurnPlatform } from '../platform/platform-context.js';

const STEERING_ENTER_THRESHOLD = degToRad(2.2);
const STEERING_EXIT_THRESHOLD = degToRad(0.9);
const MAX_CONFIGURED_SAFE_ZONE_DEGREES = 45;

export function motionPoseFromGravity(event) {
  const gravity = event?.accelerationIncludingGravity;
  if (!gravity || gravity.x == null || gravity.y == null || gravity.z == null) return null;

  const planarGravity = Math.hypot(gravity.x, gravity.y);
  if (Math.hypot(planarGravity, gravity.z) < 1.4 || planarGravity < 0.8) return null;

  return {
    roll: getScreenSpaceRoll(gravity),
    pitch: Math.atan2(gravity.z, planarGravity)
  };
}

export function resolveSteeringRollLimit(
  fallbackRadians,
  configuration = globalThis.__TURN_MOTION_SAFE_ZONE__
) {
  const configuredDegrees = Number(configuration?.steeringDegrees ?? configuration?.degrees);
  if (
    Number.isFinite(configuredDegrees)
    && configuredDegrees > 0
    && configuredDegrees <= MAX_CONFIGURED_SAFE_ZONE_DEGREES
  ) {
    return degToRad(configuredDegrees);
  }

  const fallback = Number(fallbackRadians);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : degToRad(14);
}

export function updateMotionInputState({ state, dt, maxSteerRoll }) {
  if (!state.sensorMode) {
    // Manual input is expressed in screen space (left = -1, right = +1), while
    // TURN's vehicle yaw convention uses the opposite sign.
    state.steering = lerp(state.steering, -state.manualSteering, Math.min(1, dt * 10));
    state.tiltDrive = 0;
    return;
  }

  state.roll += shortestAngle(state.roll, state.targetRoll) * Math.min(1, dt * 16);
  state.pitch = lerp(state.pitch, state.targetPitch, Math.min(1, dt * 12));

  const steeringRoll = normalizeAngle(state.roll - state.neutralRoll);
  const steeringMagnitude = Math.abs(steeringRoll);
  const steeringRollLimit = resolveSteeringRollLimit(maxSteerRoll);

  state.steeringEngaged ??= false;

  if (state.steeringEngaged) {
    if (steeringMagnitude < STEERING_EXIT_THRESHOLD) state.steeringEngaged = false;
  } else if (steeringMagnitude > STEERING_ENTER_THRESHOLD) {
    state.steeringEngaged = true;
  }

  let desiredSteering = 0;
  if (state.steeringEngaged) {
    const availableRoll = Math.max(0.001, steeringRollLimit - STEERING_EXIT_THRESHOLD);
    const linearSteer = clamp(
      (steeringMagnitude - STEERING_EXIT_THRESHOLD) / availableRoll,
      0,
      1
    );
    const easedSteer = linearSteer * linearSteer * (3 - 2 * linearSteer);
    desiredSteering = -Math.sign(steeringRoll) * easedSteer;
  }

  const steeringResponseRate = state.steeringEngaged ? 8.5 : 12;
  const steeringResponse = 1 - Math.exp(-dt * steeringResponseRate);
  state.steering = lerp(state.steering, desiredSteering, steeringResponse);

  // Acceleration and braking are direct controls. Pitch is intentionally not used for driving.
  state.tiltDrive = 0;
}

function getScreenSpaceRoll(gravity) {
  const angle = getScreenOrientationAngle();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const screenX = gravity.x * cos + gravity.y * sin;
  const screenY = -gravity.x * sin + gravity.y * cos;
  let roll = normalizeAngle(Math.atan2(screenX, -screenY));

  // A horizon is 180-degree symmetric. Fold into the nearest upright half-turn.
  if (roll > Math.PI / 2) roll -= Math.PI;
  if (roll < -Math.PI / 2) roll += Math.PI;

  return roll;
}

function getScreenOrientationAngle() {
  const platformAngle = getTurnPlatform()?.motion?.getScreenOrientationAngle?.();
  if (Number.isFinite(platformAngle)) return platformAngle;

  const degrees = Number.isFinite(globalThis.screen?.orientation?.angle)
    ? globalThis.screen.orientation.angle
    : Number(globalThis.window?.orientation || 0);
  return degToRad(Number.isFinite(degrees) ? degrees : 0);
}

function shortestAngle(from, to) {
  return normalizeAngle(to - from);
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

function degToRad(degrees) {
  return degrees * Math.PI / 180;
}
