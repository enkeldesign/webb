const SOUNDSCAPE_UPDATE_INTERVAL_MS = 1000 / 30;
const AIRPORT_TRACK_ID = 'airport';
const MIN_TURN_ANGLE = 0.11;
const MIN_LOOKAHEAD_METERS = 28;
const MAX_LOOKAHEAD_METERS = 72;
const CURRENT_TURN_SAMPLE_SPAN = 6;
const MIN_TRAJECTORY_HORIZON_SECONDS = 0.48;
const MAX_TRAJECTORY_HORIZON_SECONDS = 1.18;

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
      baseAudio.update(applyCornerFlowToAudioFrame({ ...cachedFrame, ...frame }), now);
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

  const trackId = activeTrackId(runtime, state);
  const airportHybrid = trackId === AIRPORT_TRACK_ID;
  const right = normalizedVector(runtime.getRight?.()) || rightFromHeading(state.heading);
  const forward = normalizedVector(runtime.getForward?.()) || forwardFromHeading(state.heading);
  const offset = subtract(state.position, sample.point);
  const signedTrackOffset = dot(offset, sample.normal);
  const trackDistance = finiteNumber(state.trackDistance, horizontalLength(offset));
  const roadHalfWidth = Math.max(1, finiteNumber(runtime.trackWidth, 27) * 0.5);
  const roadEdgeProximity = smoothstep(roadHalfWidth * 0.45, roadHalfWidth * 1.02, trackDistance);
  const offsetSign = signedTrackOffset === 0 ? 1 : Math.sign(signedTrackOffset);
  const edgeDirection = scale(sample.normal, offsetSign);
  const roadEdgePan = clamp(dot(edgeDirection, right), -1, 1);

  const recoveryDirection = normalizedVector(subtract(sample.point, state.position));
  const recoveryPan = recoveryDirection ? clamp(dot(recoveryDirection, right), -1, 1) : 0;
  const recoveryUrgency = clamp(
    (trackDistance - roadHalfWidth * 0.82) / Math.max(1, roadHalfWidth * 0.95),
    0,
    1
  );

  const speed = Math.max(0, finiteNumber(state.speed, horizontalLength(state.velocity)));
  const velocity = horizontalLength(state.velocity) > 0.25
    ? state.velocity
    : scale(forward, speed);
  const lateralSpeed = dot(velocity, right);
  const driftPan = speed > 1 ? clamp(lateralSpeed / Math.max(8, speed * 0.72), -1, 1) : 0;

  const upcomingTurn = findUpcomingTurn(samples, index, speed);
  const currentTurn = findCurrentTurn(samples, index);
  const headingAlignment = clamp(dot(forward, sample.tangent), -1, 1);
  const headingError = signedAngle(forward, sample.tangent);
  const headingCorrectionPan = clamp(headingError / (Math.PI * 0.5), -1, 1);
  const wrongWay = headingAlignment < -0.42 && speed > 7 && finiteNumber(state.brake, 0) < 0.1;
  const offRoad = Boolean(state.offRoad);
  const rival = nearestRivalFrame(runtime, right);

  const cornerFlow = airportHybrid
    ? 0
    : scoreCornerFlow({
      turnSeverity: currentTurn.severity,
      speed,
      headingAlignment,
      trackDistance,
      roadHalfWidth,
      lateralSpeed,
      offRoad
    });

  const trajectory = airportHybrid
    ? createTrajectoryCue({
      samples,
      startIndex: index,
      position: state.position,
      velocity,
      right,
      roadHalfWidth,
      trackDistance,
      speed,
      offRoad,
      wrongWay
    })
    : emptyTrajectoryCue();

  const airportGuidance = airportHybrid
    ? createAirportHybridGuidance({
      trajectoryRisk: trajectory.risk,
      trajectoryPan: trajectory.pan,
      turnDirection: currentTurn.direction,
      turnSeverity: currentTurn.severity,
      speed,
      offRoad,
      wrongWay
    })
    : emptyAirportHybridGuidance();

  return {
    trackId,
    airportHybrid,
    roadEdgeEnabled: !airportHybrid,
    turnPulseEnabled: !airportHybrid,
    signedTrackOffset,
    trackDistance,
    edgeProximity: airportHybrid ? airportGuidance.level : roadEdgeProximity,
    edgePan: airportHybrid ? airportGuidance.pan : roadEdgePan,
    offRoad,
    recoveryPan,
    recoveryUrgency,
    driftPan,
    turnDirection: airportHybrid ? 0 : upcomingTurn.direction,
    turnSeverity: airportHybrid ? 0 : upcomingTurn.severity,
    turnDistance: airportHybrid ? Infinity : upcomingTurn.distance,
    turnProximity: airportHybrid ? 0 : upcomingTurn.proximity,
    cornerDirection: currentTurn.direction,
    cornerSeverity: currentTurn.severity,
    cornerFlow,
    trajectoryRisk: trajectory.risk,
    trajectoryPan: trajectory.pan,
    predictedTrackDistance: trajectory.predictedTrackDistance,
    turnRibbonDirection: airportGuidance.ribbonDirection,
    turnRibbonStrength: airportGuidance.ribbonStrength,
    guidanceSource: airportGuidance.source,
    headingAlignment,
    headingCorrectionPan,
    wrongWay,
    braking: finiteNumber(state.brake, 0) > 0.05,
    nearestRivalDistance: rival.distance,
    nearestRivalPan: rival.pan
  };
}

export function createAirportHybridGuidance({
  trajectoryRisk = 0,
  trajectoryPan = 0,
  turnDirection = 0,
  turnSeverity = 0,
  speed = 0,
  offRoad = false,
  wrongWay = false
} = {}) {
  if (offRoad || wrongWay) return emptyAirportHybridGuidance();

  const risk = clamp(finiteNumber(trajectoryRisk, 0), 0, 1);
  const ribbonDirection = Math.sign(finiteNumber(turnDirection, 0));
  const ribbonStrength = ribbonDirection
    ? smoothstep(0.045, 0.2, finiteNumber(turnSeverity, 0))
      * smoothstep(5, 18, finiteNumber(speed, 0))
    : 0;
  const ribbonLevel = ribbonStrength * 0.46;
  const trajectoryWeight = ribbonStrength > 0
    ? smoothstep(0.12, 0.62, risk)
    : (risk > 0 ? 1 : 0);
  const level = Math.max(risk, ribbonLevel * (1 - trajectoryWeight * 0.35));
  const ribbonPan = ribbonDirection * 0.76;
  const pan = level > 0
    ? clamp(lerp(ribbonPan, clamp(finiteNumber(trajectoryPan, 0), -1, 1), trajectoryWeight), -1, 1)
    : 0;

  return {
    level,
    pan,
    ribbonDirection,
    ribbonStrength,
    source: risk >= ribbonLevel && risk > 0 ? 'trajectory' : (ribbonStrength > 0 ? 'ribbon' : 'none')
  };
}

export function applyCornerFlowToAudioFrame(frame = {}) {
  const cornerFlow = clamp(Number(frame.cornerFlow) || 0, 0, 1);
  if (cornerFlow <= 0) return frame;

  const driftAmount = clamp(Number(frame.driftAmount) || 0, 0, 1);
  const enginePitch = clamp(Number(frame.enginePitch) || 1, 0.55, 1.7);

  return {
    ...frame,
    // A settled corner sounds cleaner rather than triggering a separate reward effect.
    // Physics stays untouched: only the audible grit softens and the engine note tightens slightly.
    driftAmount: driftAmount * (1 - cornerFlow * 0.24),
    enginePitch: enginePitch * (1 + cornerFlow * 0.018)
  };
}

export function emptyDrivingSoundscapeFrame() {
  return {
    trackId: '',
    airportHybrid: false,
    roadEdgeEnabled: true,
    turnPulseEnabled: true,
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
    cornerDirection: 0,
    cornerSeverity: 0,
    cornerFlow: 0,
    trajectoryRisk: 0,
    trajectoryPan: 0,
    predictedTrackDistance: 0,
    turnRibbonDirection: 0,
    turnRibbonStrength: 0,
    guidanceSource: 'none',
    headingAlignment: 1,
    headingCorrectionPan: 0,
    wrongWay: false,
    braking: false,
    nearestRivalDistance: Infinity,
    nearestRivalPan: 0
  };
}

function createTrajectoryCue({
  samples,
  startIndex,
  position,
  velocity,
  right,
  roadHalfWidth,
  trackDistance,
  speed,
  offRoad,
  wrongWay
}) {
  if (offRoad || wrongWay || speed < 2) return emptyTrajectoryCue();

  const horizon = clamp(
    MIN_TRAJECTORY_HORIZON_SECONDS + speed * 0.012,
    MIN_TRAJECTORY_HORIZON_SECONDS,
    MAX_TRAJECTORY_HORIZON_SECONDS
  );
  const predictedPosition = add(position, scale(velocity, horizon));
  const searchRadius = Math.min(
    Math.max(24, Math.round(samples.length * 0.18)),
    Math.max(36, Math.round(34 + speed * 1.45))
  );
  const predictedSample = nearestSampleInWindow(samples, startIndex, predictedPosition, searchRadius);
  if (!predictedSample?.point || !predictedSample?.normal) return emptyTrajectoryCue();

  const predictedOffset = subtract(predictedPosition, predictedSample.point);
  const signedPredictedOffset = dot(predictedOffset, predictedSample.normal);
  const predictedTrackDistance = Math.abs(signedPredictedOffset);
  const riskDistance = Math.max(predictedTrackDistance, trackDistance * 0.86);
  const risk = smoothstep(roadHalfWidth * 0.42, roadHalfWidth * 1.02, riskDistance)
    * smoothstep(2, 14, speed);
  const threatSign = signedPredictedOffset === 0 ? 1 : Math.sign(signedPredictedOffset);
  const threatDirection = scale(predictedSample.normal, threatSign);
  const pan = clamp(dot(threatDirection, right), -1, 1);

  return { risk, pan, predictedTrackDistance };
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

function emptyTrajectoryCue() {
  return { risk: 0, pan: 0, predictedTrackDistance: 0 };
}

function emptyAirportHybridGuidance() {
  return {
    level: 0,
    pan: 0,
    ribbonDirection: 0,
    ribbonStrength: 0,
    source: 'none'
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
    // In TURN's X/Z world, signedAngle increases opposite to the listener's left/right convention.
    // Negating it maps a road curving left to the left ear and a road curving right to the right ear.
    direction: -Math.sign(strongestAngle),
    severity: clamp(Math.abs(strongestAngle) / (Math.PI * 0.55), 0, 1),
    distance: firstTurnDistance,
    proximity: clamp(1 - firstTurnDistance / lookahead, 0, 1)
  };
}

function findCurrentTurn(samples, index) {
  const before = samples[normalizeIndex(index - CURRENT_TURN_SAMPLE_SPAN, samples.length)];
  const after = samples[normalizeIndex(index + CURRENT_TURN_SAMPLE_SPAN, samples.length)];
  if (!before?.tangent || !after?.tangent) return { direction: 0, severity: 0 };

  const angle = signedAngle(before.tangent, after.tangent);
  const severity = clamp(Math.abs(angle) / (Math.PI * 0.38), 0, 1);
  return {
    direction: severity > 0.035 ? -Math.sign(angle) : 0,
    severity
  };
}

function scoreCornerFlow({
  turnSeverity,
  speed,
  headingAlignment,
  trackDistance,
  roadHalfWidth,
  lateralSpeed,
  offRoad
}) {
  if (offRoad || turnSeverity < 0.045 || speed < 7 || headingAlignment < 0.45) return 0;

  const curvePresence = smoothstep(0.045, 0.2, turnSeverity);
  const headingQuality = smoothstep(0.68, 0.985, headingAlignment);
  const roadQuality = 1 - smoothstep(roadHalfWidth * 0.72, roadHalfWidth * 0.98, trackDistance);
  const slipRatio = Math.abs(lateralSpeed) / Math.max(1, speed);
  const targetSlip = 0.025 + turnSeverity * 0.16;
  const slipTolerance = 0.16 + turnSeverity * 0.12;
  const slipQuality = clamp(1 - Math.abs(slipRatio - targetSlip) / slipTolerance, 0, 1);
  const speedQuality = smoothstep(7, 25, speed);
  const balance = headingQuality * 0.45
    + roadQuality * 0.25
    + slipQuality * 0.2
    + speedQuality * 0.1;

  return curvePresence * smoothstep(0.58, 0.9, balance);
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

function lerp(from, to, amount) {
  return from + (to - from) * clamp(amount, 0, 1);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
