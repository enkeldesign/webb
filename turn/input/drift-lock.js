export const DRIFT_LOCK_ENGAGE_SECONDS = 0.14;
export const DRIFT_LOCK_RELEASE_SECONDS = 0.1;
export const DRIFT_LOCK_TOP_ZONE_SHARE = 0.32;
export const DRIFT_LOCK_OUTER_SLOP_PX = 18;
export const DRIFT_LOCK_VERTICAL_SLOP_PX = 12;
export const DRIFT_LOCK_SEAM_OVERLAP_PX = 4;
export const REGULAR_DRIFT_RECHARGE_BLEND = 0.5;

export function pointerUsesDriftLock({
  driftActive = false,
  pointerX = 0,
  pointerY = 0,
  padLeft = 0,
  padTop = 0,
  padHeight = 0,
  bubbleWidth = 0
} = {}) {
  if (!driftActive) return false;

  const left = finiteNumber(padLeft);
  const top = finiteNumber(padTop);
  const height = Math.max(1, finiteNumber(padHeight));
  const width = Math.max(1, finiteNumber(bubbleWidth));
  const x = finiteNumber(pointerX);
  const y = finiteNumber(pointerY);
  const lockTop = top - DRIFT_LOCK_VERTICAL_SLOP_PX;
  const lockBottom = top + height * DRIFT_LOCK_TOP_ZONE_SHARE + DRIFT_LOCK_VERTICAL_SLOP_PX;
  const lockLeft = left - width - DRIFT_LOCK_OUTER_SLOP_PX;
  const lockRight = left + DRIFT_LOCK_SEAM_OVERLAP_PX;

  return x >= lockLeft && x <= lockRight && y >= lockTop && y <= lockBottom;
}

export function advanceDriftLockAmount(currentAmount, lockRequested, dt) {
  const current = clamp(finiteNumber(currentAmount), 0, 1);
  const target = lockRequested === true ? 1 : 0;
  if (current === target) return target;

  const seconds = target > current
    ? DRIFT_LOCK_ENGAGE_SECONDS
    : DRIFT_LOCK_RELEASE_SECONDS;
  const step = Math.max(0, finiteNumber(dt)) / seconds;
  return target > current
    ? Math.min(target, current + step)
    : Math.max(target, current - step);
}

export function driftThrottleForLock(lockAmount) {
  return 1 - clamp(finiteNumber(lockAmount), 0, 1);
}

export function resolveDriftBoostRechargeMultiplier({
  driftHeld = false,
  driftLockAmount = 0,
  lockedMultiplier = 1
} = {}) {
  if (!driftHeld) return 0;

  const locked = Math.max(1, finiteNumber(lockedMultiplier));
  const regular = 1 + (locked - 1) * REGULAR_DRIFT_RECHARGE_BLEND;
  const lockMix = clamp(finiteNumber(driftLockAmount), 0, 1);
  return regular + (locked - regular) * lockMix;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
