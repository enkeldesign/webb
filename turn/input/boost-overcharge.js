export const BOOST_OVERCHARGE_MAX_SECONDS = 0.6;
export const BOOST_OVERCHARGE_BUILD_SECONDS = 1.8;
export const BOOST_OVERCHARGE_DECAY_SECONDS = 8;
export const BOOST_OVERCHARGE_MAX_WIDTH = 0.2;
export const BOOST_OVERCHARGE_MIN_SPEED = 14;
export const BOOST_OVERCHARGE_MIN_SLIP_RADIANS = 10 * Math.PI / 180;
export const BOOST_OVERCHARGE_REGULAR_RECHARGE_MULTIPLIER = 2.4;

export const BOOST_OVERCHARGE_PHASE = Object.freeze({
  READY: 'ready',
  BUILDING: 'building',
  DECAYING: 'decaying'
});

export function resolveBoostSlipAngle({ heading = 0, velocity = null } = {}) {
  const angle = finiteNumber(heading);
  const velocityX = finiteNumber(velocity?.x);
  const velocityZ = finiteNumber(velocity?.z);
  const speed = Math.hypot(velocityX, velocityZ);
  if (speed <= 0.0001) return 0;

  const forwardX = Math.sin(angle);
  const forwardZ = Math.cos(angle);
  const rightX = Math.cos(angle);
  const rightZ = -Math.sin(angle);
  const longitudinal = velocityX * forwardX + velocityZ * forwardZ;
  const lateral = velocityX * rightX + velocityZ * rightZ;
  return Math.abs(Math.atan2(lateral, longitudinal));
}

export function qualifiesForBoostOvercharge({
  driftHeld = false,
  speed = 0,
  slipAngle = 0
} = {}) {
  return driftHeld === true
    && finiteNumber(speed) >= BOOST_OVERCHARGE_MIN_SPEED
    && Math.abs(finiteNumber(slipAngle)) >= BOOST_OVERCHARGE_MIN_SLIP_RADIANS;
}

export function boostOverchargeBuildRate(rechargeMultiplier = BOOST_OVERCHARGE_REGULAR_RECHARGE_MULTIPLIER) {
  const multiplier = Math.max(0, finiteNumber(rechargeMultiplier));
  return multiplier
    / BOOST_OVERCHARGE_REGULAR_RECHARGE_MULTIPLIER
    / BOOST_OVERCHARGE_BUILD_SECONDS;
}

export function advanceBoostOvercharge({
  amount = 0,
  phase = BOOST_OVERCHARGE_PHASE.READY,
  dt = 0,
  zone = '',
  qualifyingDrift = false,
  rechargeMultiplier = BOOST_OVERCHARGE_REGULAR_RECHARGE_MULTIPLIER,
  consuming = false
} = {}) {
  let nextAmount = clamp(finiteNumber(amount), 0, 1);
  let nextPhase = validPhase(phase);
  const elapsed = Math.max(0, finiteNumber(dt));
  let peaked = false;

  if (consuming && nextAmount > 0) {
    nextPhase = BOOST_OVERCHARGE_PHASE.DECAYING;
    nextAmount = Math.max(0, nextAmount - elapsed / BOOST_OVERCHARGE_MAX_SECONDS);
  } else if (zone === 'gas' && nextAmount > 0) {
    // GAS catches the current pressure exactly where it is. The phase is kept so
    // a pre-peak catch may resume building, while a post-peak catch resumes decay.
  } else if (nextPhase === BOOST_OVERCHARGE_PHASE.DECAYING && nextAmount > 0) {
    nextAmount = Math.max(0, nextAmount - elapsed / BOOST_OVERCHARGE_DECAY_SECONDS);
  } else if (zone === 'drift' && qualifyingDrift) {
    nextPhase = BOOST_OVERCHARGE_PHASE.BUILDING;
    nextAmount = Math.min(1, nextAmount + elapsed * boostOverchargeBuildRate(rechargeMultiplier));
    if (nextAmount >= 1) {
      nextAmount = 1;
      nextPhase = BOOST_OVERCHARGE_PHASE.DECAYING;
      peaked = true;
    }
  } else if (zone === 'drift' && nextPhase === BOOST_OVERCHARGE_PHASE.BUILDING && nextAmount > 0) {
    // Briefly losing the slip angle while still holding DRIFT should not destroy
    // the mini-game. Pressure leaks, but the player may resume building before peak.
    nextAmount = Math.max(0, nextAmount - elapsed / BOOST_OVERCHARGE_DECAY_SECONDS);
  } else if (nextAmount > 0) {
    // Releasing DRIFT without catching on GAS commits the bonus to its decay phase.
    nextPhase = BOOST_OVERCHARGE_PHASE.DECAYING;
    nextAmount = Math.max(0, nextAmount - elapsed / BOOST_OVERCHARGE_DECAY_SECONDS);
  }

  if (nextAmount <= 0.000001) {
    nextAmount = 0;
    nextPhase = BOOST_OVERCHARGE_PHASE.READY;
  }

  return Object.freeze({ amount: nextAmount, phase: nextPhase, peaked });
}

export function boostOverchargeVisualWidth(amount = 0) {
  return clamp(finiteNumber(amount), 0, 1) * BOOST_OVERCHARGE_MAX_WIDTH;
}

function validPhase(value) {
  return Object.values(BOOST_OVERCHARGE_PHASE).includes(value)
    ? value
    : BOOST_OVERCHARGE_PHASE.READY;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
