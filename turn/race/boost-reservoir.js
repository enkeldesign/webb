export const NITROUS_POWER_MULTIPLIER = 1.5;
export const NITROUS_SPEED_MULTIPLIER = 1.12;

const EPSILON = 0.001;

export function createBoostReservoir(charge = 1, nitrousCharge = 0) {
  return normalizeReservoir({ charge, nitrousCharge });
}

export function updateBoostReservoir(reservoir, {
  dt,
  requested = false,
  locked = false,
  inBoostZone = false,
  driftHeld = false,
  drainSeconds = 2,
  rechargeSeconds = 4.2,
  driftRechargeMultiplier = 2.4
} = {}) {
  let { charge, nitrousCharge } = normalizeReservoir(reservoir);
  const elapsed = clamp(Number(dt) || 0, 0, 0.1);
  const canBoost = Boolean(requested && !locked && charge > EPSILON);
  let boosting = canBoost;
  let exhausted = false;
  let convertedToNitrous = 0;
  let nitrousSpent = 0;
  let boostPowerMultiplier = 1;
  let boostSpeedMultiplier = 1;

  if (canBoost) {
    const spendRequest = elapsed / positiveNumber(drainSeconds, 2);

    if (inBoostZone) {
      // The slice that would normally become empty is retained and changes type.
      // Existing empty capacity remains empty, so arriving with charge matters.
      const normalCharge = Math.max(0, charge - nitrousCharge);
      convertedToNitrous = Math.min(normalCharge, spendRequest);
      nitrousCharge = Math.min(charge, nitrousCharge + convertedToNitrous);
      boostPowerMultiplier = NITROUS_POWER_MULTIPLIER;
      boostSpeedMultiplier = NITROUS_SPEED_MULTIPLIER;
    } else {
      const spent = Math.min(charge, spendRequest);
      nitrousSpent = Math.min(nitrousCharge, spent);
      const nitrousShare = spent > 0 ? nitrousSpent / spent : 0;
      charge = Math.max(0, charge - spent);
      nitrousCharge = Math.max(0, nitrousCharge - nitrousSpent);
      boostPowerMultiplier = mix(1, NITROUS_POWER_MULTIPLIER, nitrousShare);
      boostSpeedMultiplier = mix(1, NITROUS_SPEED_MULTIPLIER, nitrousShare);

      if (charge <= EPSILON) {
        charge = 0;
        nitrousCharge = 0;
        boosting = false;
        exhausted = true;
      }
    }
  } else {
    const multiplier = driftHeld ? positiveNumber(driftRechargeMultiplier, 2.4) : 1;
    const recharge = elapsed * multiplier / positiveNumber(rechargeSeconds, 4.2);
    // Passive recharge is always ordinary boost. A red zone only converts charge
    // that is actively used there; it never fills pre-existing empty capacity.
    charge = Math.min(1, charge + recharge);
  }

  nitrousCharge = Math.min(charge, nitrousCharge);
  const normalCharge = Math.max(0, charge - nitrousCharge);
  const nitrousActive = boosting && (inBoostZone || nitrousSpent > 0);

  return Object.freeze({
    charge,
    normalCharge,
    nitrousCharge,
    boosting,
    exhausted,
    nitrousActive,
    convertedToNitrous,
    nitrousSpent,
    boostPowerMultiplier,
    boostSpeedMultiplier
  });
}

function normalizeReservoir(reservoir) {
  const charge = clamp(Number(reservoir?.charge) || 0, 0, 1);
  const nitrousCharge = clamp(Number(reservoir?.nitrousCharge) || 0, 0, charge);
  return Object.freeze({ charge, nitrousCharge });
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mix(from, to, amount) {
  return from + (to - from) * clamp(amount, 0, 1);
}
