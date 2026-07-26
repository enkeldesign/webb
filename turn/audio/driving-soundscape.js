const SOUNDSCAPE_UPDATE_INTERVAL_MS = 1000 / 30;
let installed = false;
let lastComputedAt = -Infinity;
let cachedFrame = null;

export function installUniversalDrivingSoundscape() {
  if (installed) return globalThis.__turnAudio;
  const baseAudio = globalThis.__turnAudio;
  if (!baseAudio) return null;

  installed = true;
  cachedFrame = emptyDrivingSoundscapeFrame();

  const enhancedAudio = Object.freeze({
    unlock: (...args) => baseAudio.unlock(...args),
    update(frame = {}, now = performance.now()) {
      if (now - lastComputedAt >= SOUNDSCAPE_UPDATE_INTERVAL_MS) {
        cachedFrame = createDrivingSoundscapeFrame(globalThis.__turnRuntime);
        lastComputedAt = now;
      }
      baseAudio.update({ ...cachedFrame, ...frame }, now);
    },
    cue: (...args) => baseAudio.cue(...args),
    silence: (...args) => baseAudio.silence(...args),
    get available() {
      return baseAudio.available;
    },
    get state() {
      return baseAudio.state;
    }
  });

  globalThis.__turnAudio = enhancedAudio;
  return enhancedAudio;
}

const MIN_TURN_ANGLE = 0.11;
const MIN_LOOKAHEAD_METERS = 28;
const MAX_LOOKAHEAD_METERS = 72;

export function createDrivingSoundscapeFrame(runtime) {
  const state = runtime?.state;
  const samples = runtime?.samples;
  if (!state || !Array.isArray(samples) || samples.length < 2) {
    return emptyDrivingSoundscapeFrame();
  }

  const index = normalizeIndex(state.nearestTrackIndex, samples.length);
  const sample = samples[index];
  if (!sample?.point || !sample?.tangent || !sample?.normal || !state.position) {
    return emptyDrivingSoundscapeFrame();
  }

  const right = normalizedVector(runtime.getRight?.()) || rightFromHeading(state.heading);
  const forward = normalizedVector(runtime.getForward?.()) || forwardFromHeading(state.heading);
  const offset = subtract(state.position, sample.point);
  const signedTrackOffset = dot(offset, sample.normal);
  const trackDistance = finiteNumber(state.trackDistance, horizontalLength(offset));
  const roadHalfWidth = Math.max(1, finiteNumber(runtime.trackWidth, 27) * 0.5);
  const edgeProximity = smoothstep(roadHalfWidth * 0.45, roadHalfWidth * 1.02, trackDistance);
  const offsetSign = signedTrackOffset === 0 ? 1 : Math.sign(signedTrackOffset);
  const edgeDirection = scale(sample.normal, offsetSign);
  const edgePan = clamp(dot(edgeDirection, right), -1, 1);

  const recoveryDirection = normalizedVector(subtract(sample.point, state.position));
  const recoveryPan = recoveryDirection ? clamp(dot(recoveryDirection, right), -1, 1) : 0;
  const recoveryUrgency = clamp(
    (trackDistance - roadHalfWidth * 0.82) / Math.max(1, roadHalfWidth * 0.95),
    0,
    1
  );

  const speed = Math.max(0, finiteNumber(state.speed, horizontalLength(state.velocity)));
  const lateralSpeed = state.velocity ? dot(state.velocity, right) : 0;
  const driftPan = speed > 1 ? clamp(lateralSpeed / Math.max(8, speed * 0.72), -1, 1) : 0;

  const upcomingTurn = findUpcomingTurn(samples, index, speed);
  const headingAlignment = clamp(dot(forward, sample.tangent), -1, 1);
  const headingError = signedAngle(forward, sample.tangent);
  const headingCorrectionPan = clamp(headingError / (Math.PI * 0.5), -1, 1);
  const wrongWay = headingAlignment < -0.42 && speed > 7 && finiteNumber(state.brake, 0) < 0.1;
  const rival = nearestRivalFrame(runtime, right);

  return {
    signedTrackOffset,
    trackDistance,
    edgeProximity,
    edgePan,
    offRoad: Boolean(state.offRoad),
    recoveryPan,
    recoveryUrgency,
    driftPan,
    turnDirection: upcomingTurn.direction,
    turnSeverity: upcomingTurn.severity,
    turnDistance: upcomingTurn.distance,
    turnProximity: upcomingTurn.proximity,
    headingAlignment,
    headingCorrectionPan,
    wrongWay,
    braking: finiteNumber(state.brake, 0) > 0.05,
    nearestRivalDistance: rival.distance,
    nearestRivalPan: rival.pan
  };
}

export function emptyDrivingSoundscapeFrame() {
  return {
    signedTrackOffset: 0,
    trackDistance: 0,
    edgeProximity: 0,
    edgePan: 0,
    offRoad: false,
    recoveryPan: 0,
    recoveryUrgency: 0,
    driftPan: 0,
    turnDirection: 0,
    turnSeverity: 0,
    turnDistance: Infinity,
    turnProximity: 0,
    headingAlignment: 1,
    headingCorrectionPan: 0,
    wrongWay: false,
    braking: false,
    nearestRivalDistance: Infinity,
    nearestRivalPan: 0
  };
}

function findUpcomingTurn(samples, startIndex, speed) {
  const lookahead = clamp(24 + speed * 0.65, MIN_LOOKAHEAD_METERS, MAX_LOOKAHEAD_METERS);
  const start = samples[startIndex];
  let previous = start;
  let travelled = 0;
  let firstTurnDistance = Infinity;
  let strongestAngle = 0;

  for (let step = 1; step < samples.length; step += 1) {
    const sample = samples[(startIndex + step) % samples.length];
    travelled += horizontalDistance(previous.point, sample.point);
    previous = sample;
    if (travelled > lookahead) break;

    const angle = signedAngle(start.tangent, sample.tangent);
    if (Math.abs(angle) >= MIN_TURN_ANGLE && firstTurnDistance === Infinity) {
      firstTurnDistance = travelled;
    }
    if (Math.abs(angle) > Math.abs(strongestAngle)) strongestAngle = angle;
  }

  if (!Number.isFinite(firstTurnDistance) || Math.abs(strongestAngle) < MIN_TURN_ANGLE) {
    return { direction: 0, severity: 0, distance: Infinity, proximity: 0 };
  }

  return {
    direction: Math.sign(strongestAngle),
    severity: clamp(Math.abs(strongestAngle) / (Math.PI * 0.55), 0, 1),
    distance: firstTurnDistance,
    proximity: clamp(1 - firstTurnDistance / lookahead, 0, 1)
  };
}

function nearestRivalFrame(runtime, right) {
  const state = runtime?.state;
  const player = runtime?.playerCar?.position || state?.position;
  if (!state?.lapActive || !player) return { distance: Infinity, pan: 0 };

  let nearestDistance = Infinity;
  let nearestPan = 0;

  for (const car of runtime.competitorCars || []) {
    if (!car?.visible || !car.position) continue;
    const delta = subtract(car.position, player);
    const distance = horizontalLength(delta);
    if (distance >= nearestDistance) continue;
    const direction = normalizedVector(delta);
    nearestDistance = distance;
    nearestPan = direction ? clamp(dot(direction, right), -1, 1) : 0;
  }

  return { distance: nearestDistance, pan: nearestPan };
}

function signedAngle(from, to) {
  const cross = finiteNumber(from?.z, 0) * finiteNumber(to?.x, 0)
    - finiteNumber(from?.x, 0) * finiteNumber(to?.z, 0);
  const alignment = finiteNumber(from?.x, 0) * finiteNumber(to?.x, 0)
    + finiteNumber(from?.z, 0) * finiteNumber(to?.z, 0);
  return Math.atan2(cross, alignment);
}

function rightFromHeading(heading) {
  const angle = finiteNumber(heading, 0);
  return { x: Math.cos(angle), y: 0, z: -Math.sin(angle) };
}

function forwardFromHeading(heading) {
  const angle = finiteNumber(heading, 0);
  return { x: Math.sin(angle), y: 0, z: Math.cos(angle) };
}

function normalizedVector(vector) {
  if (!vector) return null;
  const length = Math.hypot(
    finiteNumber(vector.x, 0),
    finiteNumber(vector.y, 0),
    finiteNumber(vector.z, 0)
  );
  if (length < 0.0001) return null;
  return {
    x: finiteNumber(vector.x, 0) / length,
    y: finiteNumber(vector.y, 0) / length,
    z: finiteNumber(vector.z, 0) / length
  };
}

function subtract(a, b) {
  return {
    x: finiteNumber(a?.x, 0) - finiteNumber(b?.x, 0),
    y: finiteNumber(a?.y, 0) - finiteNumber(b?.y, 0),
    z: finiteNumber(a?.z, 0) - finiteNumber(b?.z, 0)
  };
}

function scale(vector, amount) {
  return {
    x: finiteNumber(vector?.x, 0) * amount,
    y: finiteNumber(vector?.y, 0) * amount,
    z: finiteNumber(vector?.z, 0) * amount
  };
}

function dot(a, b) {
  return finiteNumber(a?.x, 0) * finiteNumber(b?.x, 0)
    + finiteNumber(a?.y, 0) * finiteNumber(b?.y, 0)
    + finiteNumber(a?.z, 0) * finiteNumber(b?.z, 0);
}

function horizontalLength(vector) {
  return Math.hypot(finiteNumber(vector?.x, 0), finiteNumber(vector?.z, 0));
}

function horizontalDistance(a, b) {
  return Math.hypot(
    finiteNumber(a?.x, 0) - finiteNumber(b?.x, 0),
    finiteNumber(a?.z, 0) - finiteNumber(b?.z, 0)
  );
}

function normalizeIndex(value, length) {
  const index = Math.trunc(finiteNumber(value, 0));
  return ((index % length) + length) % length;
}

function smoothstep(min, max, value) {
  const t = clamp((value - min) / Math.max(0.0001, max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
