const SOUNDSCAPE_UPDATE_INTERVAL_MS = 1000 / 30;
const MIN_TRAJECTORY_HORIZON_SECONDS = 0.55;
const MAX_TRAJECTORY_HORIZON_SECONDS = 1.45;

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
  const speed = Math.max(0, finiteNumber(state.speed, horizontalLength(state.velocity)));
  const velocity = horizontalLength(state.velocity) > 0.25
    ? state.velocity
    : scale(forward, speed);

  const headingAlignment = clamp(dot(forward, sample.tangent), -1, 1);
  const headingError = signedAngle(forward, sample.tangent);
  const headingCorrectionPan = clamp(headingError / (Math.PI * 0.5), -1, 1);
  const offRoad = Boolean(state.offRoad);
  // Off-road recovery owns both road-finding and race-direction alignment.
  // The generic Wrong Way alarm is reserved for a car that is still on the road.
  const wrongWay = !offRoad
    && headingAlignment < -0.42
    && speed > 7
    && finiteNumber(state.brake, 0) < 0.1;

  const slider = createTrajectorySlider({
    samples,
    startIndex: index,
    position: state.position,
    velocity,
    right,
    forward,
    currentSample: sample,
    signedTrackOffset,
    trackDistance,
    roadHalfWidth,
    speed,
    offRoad,
    wrongWay
  });
  const rival = nearestRivalFrame(runtime, right);

  return {
    trackId: activeTrackId(runtime, state),
    signedTrackOffset,
    trackDistance,
    predictedTrackOffset: slider.predictedTrackOffset,
    predictedTrackDistance: slider.predictedTrackDistance,
    sliderPresence: slider.presence,
    sliderRisk: slider.risk,
    sliderPan: slider.pan,
    sliderValue: slider.value,
    sliderMode: slider.mode,
    surfaceAmount: slider.surfaceAmount,
    recoveryHeadingError: slider.recoveryHeadingError,
    recoveryTargetDistance: slider.recoveryTargetDistance,
    offRoad,
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
    trackId: '',
    signedTrackOffset: 0,
    trackDistance: 0,
    predictedTrackOffset: 0,
    predictedTrackDistance: 0,
    sliderPresence: 0,
    sliderRisk: 0,
    sliderPan: 0,
    sliderValue: 0,
    sliderMode: 'road',
    surfaceAmount: 0,
    recoveryHeadingError: 0,
    recoveryTargetDistance: 0,
    offRoad: false,
    headingAlignment: 1,
    headingCorrectionPan: 0,
    wrongWay: false,
    braking: false,
    nearestRivalDistance: Infinity,
    nearestRivalPan: 0
  };
}

function createTrajectorySlider({
  samples,
  startIndex,
  position,
  velocity,
  right,
  forward,
  currentSample,
  signedTrackOffset,
  trackDistance,
  roadHalfWidth,
  speed,
  offRoad,
  wrongWay
}) {
  if (wrongWay || (!offRoad && speed < 1.5)) return emptyTrajectorySlider();

  if (offRoad) {
    return createRecoverySlider({
      samples,
      startIndex,
      position,
      right,
      forward,
      currentSample,
      trackDistance,
      roadHalfWidth,
      speed
    });
  }

  const horizon = clamp(
    MIN_TRAJECTORY_HORIZON_SECONDS + speed * 0.014,
    MIN_TRAJECTORY_HORIZON_SECONDS,
    MAX_TRAJECTORY_HORIZON_SECONDS
  );
  const predictedPosition = add(position, scale(velocity, horizon));
  const searchRadius = Math.min(
    Math.max(24, Math.round(samples.length * 0.18)),
    Math.max(40, Math.round(36 + speed * 1.55))
  );
  const predictedSample = nearestSampleInWindow(samples, startIndex, predictedPosition, searchRadius)
    || currentSample;
  if (!predictedSample?.point || !predictedSample?.normal) return emptyTrajectorySlider();

  const predictedOffsetVector = subtract(predictedPosition, predictedSample.point);
  const predictedTrackOffset = dot(predictedOffsetVector, predictedSample.normal);
  const predictedTrackDistance = Math.abs(predictedTrackOffset);
  const currentNormalized = clamp(signedTrackOffset / roadHalfWidth, -1.5, 1.5);
  const predictedNormalized = clamp(predictedTrackOffset / roadHalfWidth, -1.5, 1.5);

  // The road Slider combines where the car is with where its present motion will put it.
  // Prediction carries more weight, while current position keeps the cue stable at low speed.
  const value = clamp(currentNormalized * 0.36 + predictedNormalized * 0.64, -1.35, 1.35);
  const magnitude = Math.abs(value);
  const speedPresence = smoothstep(1.5, 8, speed);
  const risk = smoothstep(0.18, 0.86, magnitude) * speedPresence;
  const presence = speedPresence;

  if (magnitude < 0.015) {
    return {
      mode: 'road',
      presence,
      risk,
      pan: 0,
      value,
      surfaceAmount: 0,
      recoveryHeadingError: 0,
      recoveryTargetDistance: 0,
      predictedTrackOffset,
      predictedTrackDistance
    };
  }

  const guidanceNormal = scale(predictedSample.normal, Math.sign(value));
  const earSide = clamp(dot(guidanceNormal, right), -1, 1);
  const panMagnitude = smoothstep(0.04, 0.78, magnitude);
  const pan = clamp(earSide * panMagnitude, -1, 1);

  return {
    mode: 'road',
    presence,
    risk,
    pan,
    value,
    surfaceAmount: 0,
    recoveryHeadingError: 0,
    recoveryTargetDistance: 0,
    predictedTrackOffset,
    predictedTrackDistance
  };
}

function createRecoverySlider({
  samples,
  startIndex,
  position,
  right,
  forward,
  currentSample,
  trackDistance,
  roadHalfWidth,
  speed
}) {
  const lookAheadDistance = clamp(
    18 + trackDistance * 0.85 + speed * 0.55,
    22,
    90
  );
  const targetSample = sampleAheadByDistance(samples, startIndex, lookAheadDistance)
    || currentSample;
  const targetVector = subtract(targetSample.point, position);
  const targetDirection = normalizedVector(targetVector);
  if (!targetDirection) return emptyTrajectorySlider();

  const lateral = clamp(dot(targetDirection, right), -1, 1);
  const forwardness = clamp(dot(targetDirection, forward), -1, 1);
  const turnAngle = signedAngle(forward, targetDirection);
  const turnSign = Math.sign(turnAngle) || Math.sign(lateral) || 1;
  const behindAmount = smoothstep(0.05, 0.86, -forwardness);
  const lateralPan = clamp(lateral * 1.35, -1, 1);
  const panMagnitude = Math.max(
    Math.abs(lateralPan),
    behindAmount * 0.94
  );
  const pan = clamp(turnSign * panMagnitude, -1, 1);

  const offRoadDepth = clamp(
    (trackDistance - roadHalfWidth * 0.82) / Math.max(1, roadHalfWidth * 2.2),
    0,
    1
  );
  const risk = 0.8 + offRoadDepth * 0.2;
  const surfaceAmount = clamp(0.32 + offRoadDepth * 0.68, 0, 1);
  const targetDistance = horizontalLength(targetVector);

  return {
    mode: 'recovery',
    presence: 1,
    risk,
    pan,
    value: clamp(turnAngle / Math.PI, -1, 1),
    surfaceAmount,
    recoveryHeadingError: Math.abs(turnAngle) / Math.PI,
    recoveryTargetDistance: targetDistance,
    predictedTrackOffset: 0,
    predictedTrackDistance: trackDistance
  };
}

function emptyTrajectorySlider() {
  return {
    mode: 'road',
    presence: 0,
    risk: 0,
    pan: 0,
    value: 0,
    surfaceAmount: 0,
    recoveryHeadingError: 0,
    recoveryTargetDistance: 0,
    predictedTrackOffset: 0,
    predictedTrackDistance: 0
  };
}

function sampleAheadByDistance(samples, startIndex, targetDistance) {
  let travelled = 0;
  let previous = samples[normalizeIndex(startIndex, samples.length)];
  if (!previous?.point) return null;

  for (let step = 1; step < samples.length; step += 1) {
    const sample = samples[normalizeIndex(startIndex + step, samples.length)];
    if (!sample?.point) continue;
    travelled += horizontalDistance(previous.point, sample.point);
    if (travelled >= targetDistance) return sample;
    previous = sample;
  }

  return previous;
}

function nearestSampleInWindow(samples, startIndex, position, radius) {
  let nearest = null;
  let nearestDistance = Infinity;
  const boundedRadius = Math.min(samples.length - 1, Math.max(1, Math.round(radius)));

  for (let step = -boundedRadius; step <= boundedRadius; step += 1) {
    const sample = samples[normalizeIndex(startIndex + step, samples.length)];
    if (!sample?.point) continue;
    const distance = horizontalDistance(position, sample.point);
    if (distance >= nearestDistance) continue;
    nearest = sample;
    nearestDistance = distance;
  }

  return nearest;
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

function activeTrackId(runtime, state) {
  return String(
    runtime?.trackId
    || state?.trackId
    || globalThis.__turnGetTrackId?.()
    || ''
  ).toLowerCase();
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

function add(a, b) {
  return {
    x: finiteNumber(a?.x, 0) + finiteNumber(b?.x, 0),
    y: finiteNumber(a?.y, 0) + finiteNumber(b?.y, 0),
    z: finiteNumber(a?.z, 0) + finiteNumber(b?.z, 0)
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
