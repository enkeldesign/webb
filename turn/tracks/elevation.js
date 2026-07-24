export const VEHICLE_SURFACE_OFFSET = 0.18;

export function trackSurfaceY(sample, offset = VEHICLE_SURFACE_OFFSET) {
  const roadY = Number(sample?.point?.y);
  return (Number.isFinite(roadY) ? roadY : 0) + finiteNumber(offset, VEHICLE_SURFACE_OFFSET);
}

export function trackPitch(sample) {
  const tangent = sample?.tangent;
  const x = Number(tangent?.x);
  const y = Number(tangent?.y);
  const z = Number(tangent?.z);
  if (![x, y, z].every(Number.isFinite)) return 0;

  const horizontalLength = Math.hypot(x, z);
  if (horizontalLength <= 1e-6) return 0;
  return Math.atan2(y, horizontalLength);
}

export function trackSampleAtProgress(samples, progress) {
  if (!Array.isArray(samples) || !samples.length || !Number.isFinite(Number(progress))) return null;
  const wrappedProgress = ((Number(progress) % 1) + 1) % 1;
  const index = Math.round(wrappedProgress * samples.length) % samples.length;
  return samples[index] || null;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
