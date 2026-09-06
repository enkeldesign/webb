export const REVERSE_BRAKE_ZONE_START = 0.76;
export const REVERSE_OUTER_SLOP_PX = 18;
export const REVERSE_VERTICAL_SLOP_PX = 12;
export const REVERSE_SEAM_OVERLAP_PX = 4;

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function pointerUsesReverse({
  brakeActive = false,
  pointerX = 0,
  pointerY = 0,
  padLeft = 0,
  padRight = padLeft,
  padTop = 0,
  padHeight = 0,
  bubbleWidth = 0,
  reverseSide = 'left'
} = {}) {
  if (!brakeActive) return false;

  const top = finiteNumber(padTop);
  const height = Math.max(0, finiteNumber(padHeight));
  const y = finiteNumber(pointerY);
  const reverseTop = top + height * REVERSE_BRAKE_ZONE_START - REVERSE_VERTICAL_SLOP_PX;
  const reverseBottom = top + height + REVERSE_VERTICAL_SLOP_PX;
  if (y < reverseTop || y > reverseBottom) return false;

  const left = finiteNumber(padLeft);
  const right = finiteNumber(padRight, left);
  const width = Math.max(0, finiteNumber(bubbleWidth));
  const x = finiteNumber(pointerX);
  const reverseLeft = reverseSide === 'right'
    ? right - REVERSE_SEAM_OVERLAP_PX
    : left - width - REVERSE_OUTER_SLOP_PX;
  const reverseRight = reverseSide === 'right'
    ? right + width + REVERSE_OUTER_SLOP_PX
    : left + REVERSE_SEAM_OVERLAP_PX;

  return x >= reverseLeft && x <= reverseRight;
}
