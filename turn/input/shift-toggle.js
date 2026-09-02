export const SHIFT_GAS_ZONE_START = 0.32;
export const SHIFT_GAS_ZONE_END = 0.76;
export const SHIFT_OUTER_SLOP_PX = 18;
export const SHIFT_VERTICAL_SLOP_PX = 12;
export const SHIFT_SEAM_OVERLAP_PX = 4;
export const SHIFT_TOP_SPEED_DROP_PER_SECOND = 0.08;

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function pointerUsesShiftToggle({
  available = false,
  gasActive = false,
  pointerX = 0,
  pointerY = 0,
  padLeft = 0,
  padRight = padLeft,
  padTop = 0,
  padHeight = 0,
  bubbleWidth = 0,
  shiftSide = 'left'
} = {}) {
  if (!available || !gasActive) return false;

  const top = finiteNumber(padTop);
  const height = Math.max(0, finiteNumber(padHeight));
  const y = finiteNumber(pointerY);
  const shiftTop = top + height * SHIFT_GAS_ZONE_START - SHIFT_VERTICAL_SLOP_PX;
  const shiftBottom = top + height * SHIFT_GAS_ZONE_END + SHIFT_VERTICAL_SLOP_PX;
  if (y < shiftTop || y > shiftBottom) return false;

  const left = finiteNumber(padLeft);
  const right = finiteNumber(padRight, left);
  const width = Math.max(0, finiteNumber(bubbleWidth));
  const x = finiteNumber(pointerX);
  const shiftLeft = shiftSide === 'right'
    ? right - SHIFT_SEAM_OVERLAP_PX
    : left - width - SHIFT_OUTER_SLOP_PX;
  const shiftRight = shiftSide === 'right'
    ? right + width + SHIFT_OUTER_SLOP_PX
    : left + SHIFT_SEAM_OVERLAP_PX;
  return x >= shiftLeft && x <= shiftRight;
}

export function advanceShiftTopSpeedMultiplier(current, target, dt) {
  const currentValue = Math.max(0.01, finiteNumber(current, 1));
  const targetValue = Math.max(0.01, finiteNumber(target, currentValue));
  if (targetValue >= currentValue) return targetValue;
  return Math.max(
    targetValue,
    currentValue - Math.max(0, finiteNumber(dt)) * SHIFT_TOP_SPEED_DROP_PER_SECOND
  );
}
