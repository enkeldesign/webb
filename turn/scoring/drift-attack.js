import { SCORE_FEEDBACK_EVENT } from './score-feedback.js';

export const DRIFT_ATTACK_SAMPLE_HZ = 12;
export const DRIFT_ATTACK_SAMPLE_INTERVAL_SECONDS = 1 / DRIFT_ATTACK_SAMPLE_HZ;
export const DRIFT_ATTACK_MIN_SPEED = 11;
export const DRIFT_ATTACK_FAIL_SPEED = 4;
export const DRIFT_ATTACK_MIN_SLIP = Math.PI * 18 / 180;
export const DRIFT_ATTACK_EXIT_SLIP = Math.PI * 10 / 180;
export const DRIFT_ATTACK_IDEAL_SLIP_START = Math.PI * 45 / 180;
export const DRIFT_ATTACK_IDEAL_SLIP_END = Math.PI * 80 / 180;
export const DRIFT_ATTACK_STRONG_SLIP_END = Math.PI * 95 / 180;
export const DRIFT_ATTACK_MAX_SLIP = Math.PI * 125 / 180;
export const DRIFT_ATTACK_BANK_DELAY_SECONDS = 0.3;
export const DRIFT_ATTACK_CHAIN_WINDOW_MS = 1400;
export const DRIFT_ATTACK_MAX_MULTIPLIER = 8;

const POINTS_PER_METER = 5;
const MIN_BANK_SCORE = 10;
const DIRECTION_DEADZONE = Math.PI / 180;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(start, end, value) {
  const amount = clamp((value - start) / Math.max(0.000001, end - start), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function directionForSlip(slipAngle, fallback = 1) {
  if (slipAngle > DIRECTION_DEADZONE) return 1;
  if (slipAngle < -DIRECTION_DEADZONE) return -1;
  return fallback || 1;
}

export function driftAngleQuality(slipAngle) {
  const slip = Math.abs(finiteNumber(slipAngle));
  if (slip < DRIFT_ATTACK_MIN_SLIP || slip >= DRIFT_ATTACK_MAX_SLIP) return 0;
  if (slip < DRIFT_ATTACK_IDEAL_SLIP_START) {
    return lerp(0.22, 1, smoothstep(DRIFT_ATTACK_MIN_SLIP, DRIFT_ATTACK_IDEAL_SLIP_START, slip));
  }
  if (slip <= DRIFT_ATTACK_IDEAL_SLIP_END) return 1;
  if (slip <= DRIFT_ATTACK_STRONG_SLIP_END) {
    return lerp(1, 0.82, smoothstep(DRIFT_ATTACK_IDEAL_SLIP_END, DRIFT_ATTACK_STRONG_SLIP_END, slip));
  }
  return lerp(0.82, 0, smoothstep(DRIFT_ATTACK_STRONG_SLIP_END, DRIFT_ATTACK_MAX_SLIP, slip));
}

export function driftSpeedQuality(speed) {
  const metresPerSecond = Math.max(0, finiteNumber(speed));
  if (metresPerSecond < DRIFT_ATTACK_MIN_SPEED) return 0;
  const roadSpeed = smoothstep(DRIFT_ATTACK_MIN_SPEED, 28, metresPerSecond);
  const highSpeed = smoothstep(28, 42, metresPerSecond);
  return 0.45 + roadSpeed * 0.55 + highSpeed * 0.28;
}

export function createDriftAttackScorer({ onState = null, onEvent = null } = {}) {
  const feedbackState = {
    active: false,
    score: 0,
    unbanked: 0,
    multiplier: 1,
    intensity: 0,
    phase: 'quiet',
    label: 'DRIFT'
  };

  let attemptActive = false;
  let drifting = false;
  let accumulator = 0;
  let collisionPending = false;
  let currentExact = 0;
  let lapExact = 0;
  let driftSeconds = 0;
  let exitSeconds = 0;
  let direction = 0;
  let lastBankDirection = 0;
  let chainExpiresAt = 0;
  let multiplier = 1;
  let bankCount = 0;
  let bestBank = 0;
  let maxMultiplier = 1;
  let sampleCount = 0;

  function emitState(now) {
    if (typeof onState === 'function') onState(feedbackState, now);
  }

  function emitEvent(type, detail, now) {
    if (typeof onEvent === 'function') onEvent(type, detail, now);
  }

  function syncFeedback(
    now,
    active = drifting,
    phase = active ? 'build' : 'quiet',
    intensity = 0
  ) {
    feedbackState.active = active;
    feedbackState.score = Math.max(0, Math.round(lapExact));
    feedbackState.unbanked = Math.max(0, Math.round(currentExact));
    feedbackState.multiplier = multiplier;
    feedbackState.intensity = clamp(intensity, 0, 1);
    feedbackState.phase = phase;
    emitState(now);
  }

  function resetLapValues() {
    drifting = false;
    accumulator = 0;
    collisionPending = false;
    currentExact = 0;
    lapExact = 0;
    driftSeconds = 0;
    exitSeconds = 0;
    direction = 0;
    lastBankDirection = 0;
    chainExpiresAt = 0;
    multiplier = 1;
    bankCount = 0;
    bestBank = 0;
    maxMultiplier = 1;
  }

  function beginLap(now = 0) {
    attemptActive = true;
    resetLapValues();
    syncFeedback(now);
  }

  function reset(now = 0) {
    attemptActive = false;
    resetLapValues();
    syncFeedback(now);
  }

  function startDrift(now, nextDirection) {
    const linked = chainExpiresAt > 0 && now <= chainExpiresAt;
    const oppositeDirection = linked && lastBankDirection !== 0 && nextDirection !== lastBankDirection;
    if (!linked) multiplier = 1;
    else if (oppositeDirection) {
      multiplier = Math.min(DRIFT_ATTACK_MAX_MULTIPLIER, multiplier + 1);
      maxMultiplier = Math.max(maxMultiplier, multiplier);
      emitEvent(SCORE_FEEDBACK_EVENT.MILESTONE, {
        multiplier,
        label: `DRIFT ×${multiplier}`,
        direction: nextDirection
      }, now);
    }

    drifting = true;
    currentExact = 0;
    driftSeconds = 0;
    exitSeconds = 0;
    direction = nextDirection;
    chainExpiresAt = 0;
    emitEvent(SCORE_FEEDBACK_EVENT.BUILD, {
      multiplier,
      direction,
      announce: false
    }, now);
  }

  function bank(now, reason = 'exit') {
    const bankedExact = currentExact;
    const bankedScore = Math.max(0, Math.round(bankedExact));
    const bankedDirection = direction;
    const duration = driftSeconds;

    drifting = false;
    currentExact = 0;
    driftSeconds = 0;
    exitSeconds = 0;
    direction = 0;

    if (bankedScore < MIN_BANK_SCORE) {
      if (!bankCount) multiplier = 1;
      syncFeedback(now);
      return 0;
    }

    lapExact += bankedExact;
    bankCount += 1;
    bestBank = Math.max(bestBank, bankedScore);
    lastBankDirection = bankedDirection;
    chainExpiresAt = now + DRIFT_ATTACK_CHAIN_WINDOW_MS;
    maxMultiplier = Math.max(maxMultiplier, multiplier);
    syncFeedback(now);
    emitEvent(SCORE_FEEDBACK_EVENT.BANK, {
      score: bankedScore,
      lapScore: Math.max(0, Math.round(lapExact)),
      multiplier,
      direction: bankedDirection,
      duration,
      reason,
      announce: reason !== 'lap'
    }, now);
    return bankedScore;
  }

  function lose(now, reason) {
    const lostScore = Math.max(0, Math.round(currentExact));
    const lostDirection = direction;
    const duration = driftSeconds;
    drifting = false;
    currentExact = 0;
    driftSeconds = 0;
    exitSeconds = 0;
    direction = 0;
    lastBankDirection = 0;
    chainExpiresAt = 0;
    multiplier = 1;
    syncFeedback(now);
    if (lostScore > 0) {
      emitEvent(SCORE_FEEDBACK_EVENT.LOSS, {
        score: lostScore,
        lapScore: Math.max(0, Math.round(lapExact)),
        multiplier: 1,
        direction: lostDirection,
        duration,
        reason
      }, now);
    }
    return lostScore;
  }

  function expireChain(now) {
    if (drifting || !chainExpiresAt || now <= chainExpiresAt) return;
    chainExpiresAt = 0;
    lastBankDirection = 0;
    multiplier = 1;
  }

  function sample(sampleDt, now, speed, slipAngle, offRoad, collided) {
    sampleCount += 1;
    expireChain(now);
    const slip = finiteNumber(slipAngle);
    const absoluteSlip = Math.abs(slip);
    const angleQuality = driftAngleQuality(slip);
    const speedQuality = driftSpeedQuality(speed);
    const qualifying = angleQuality > 0 && speedQuality > 0;
    const failed = collisionPending || collided || offRoad || absoluteSlip >= DRIFT_ATTACK_MAX_SLIP;

    if (drifting && failed) {
      lose(now, collisionPending || collided ? 'collision' : offRoad ? 'off-road' : 'spin');
      return;
    }
    if (!drifting && failed) return;

    const sampleDirection = directionForSlip(slip, direction || lastBankDirection || 1);
    if (!drifting) {
      if (!qualifying) return;
      startDrift(now, sampleDirection);
    } else if (qualifying && sampleDirection !== direction) {
      bank(now, 'linked-transition');
      startDrift(now, sampleDirection);
    }

    if (!drifting) return;

    if (!qualifying) {
      const exiting = absoluteSlip <= DRIFT_ATTACK_EXIT_SLIP
        || speed < DRIFT_ATTACK_MIN_SPEED;
      exitSeconds = exiting ? exitSeconds + sampleDt : 0;
      const settledIntensity = Math.max(0, feedbackState.intensity - sampleDt / DRIFT_ATTACK_BANK_DELAY_SECONDS);
      syncFeedback(now, true, 'settle', settledIntensity);
      if (speed < DRIFT_ATTACK_FAIL_SPEED) lose(now, 'stopped');
      else if (exiting && exitSeconds >= DRIFT_ATTACK_BANK_DELAY_SECONDS) bank(now);
      return;
    }

    exitSeconds = 0;
    driftSeconds += sampleDt;
    const durationQuality = 0.72 + smoothstep(0, 2.6, driftSeconds) * 0.28;
    const distance = Math.max(0, speed) * sampleDt;
    currentExact += distance * POINTS_PER_METER * angleQuality * speedQuality * durationQuality * multiplier;
    const intensity = clamp(
      angleQuality * 0.58 + Math.min(1, speedQuality) * 0.2 + Math.min(1, driftSeconds / 2.6) * 0.22,
      0,
      1
    );
    syncFeedback(now, true, intensity >= 0.82 ? 'intensify' : 'build', intensity);
  }

  function advance(
    dt,
    now,
    speed,
    slipAngle,
    offRoad = false,
    collided = false,
    lapActive = true
  ) {
    const elapsed = clamp(finiteNumber(dt), 0, 0.25);
    const timestamp = finiteNumber(now);
    if (!lapActive) {
      accumulator = 0;
      collisionPending = false;
      return false;
    }
    if (!attemptActive) beginLap(timestamp);

    collisionPending = collisionPending || collided === true;
    if (!drifting && finiteNumber(speed) < DRIFT_ATTACK_MIN_SPEED) {
      expireChain(timestamp);
      collisionPending = false;
      accumulator = 0;
      return false;
    }

    accumulator += elapsed;
    if (accumulator + Number.EPSILON < DRIFT_ATTACK_SAMPLE_INTERVAL_SECONDS) return false;
    const sampleDt = accumulator;
    accumulator = 0;
    sample(
      sampleDt,
      timestamp,
      Math.max(0, finiteNumber(speed)),
      finiteNumber(slipAngle),
      offRoad === true,
      collided === true
    );
    collisionPending = false;
    return true;
  }

  function completeLap(now = 0) {
    const timestamp = finiteNumber(now);
    if (drifting) bank(timestamp, 'lap');
    const result = Object.freeze({
      score: Math.max(0, Math.round(lapExact)),
      bankCount,
      bestBank,
      maxMultiplier
    });
    attemptActive = true;
    resetLapValues();
    syncFeedback(timestamp);
    return result;
  }

  function inspect() {
    return {
      attemptActive,
      drifting,
      lapScore: Math.max(0, Math.round(lapExact)),
      unbanked: Math.max(0, Math.round(currentExact)),
      driftSeconds,
      multiplier,
      bankCount,
      bestBank,
      maxMultiplier,
      sampleCount,
      chainExpiresAt,
      feedback: { ...feedbackState }
    };
  }

  return Object.freeze({
    feedbackState,
    beginLap,
    advance,
    completeLap,
    reset,
    inspect
  });
}
