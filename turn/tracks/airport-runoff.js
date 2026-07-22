export const AIRPORT_HAIRPIN_RUNOFF_ZONES = Object.freeze([
  Object.freeze({
    id: 'hairpin-east',
    from: Object.freeze({ x: 8, z: 31 }),
    to: Object.freeze({ x: 31, z: 77 }),
    radius: 14
  }),
  Object.freeze({
    id: 'hairpin-west',
    from: Object.freeze({ x: -8, z: 31 }),
    to: Object.freeze({ x: -31, z: 77 }),
    radius: 14
  })
]);

export function isForgivingTrackSurface(trackId, position) {
  if (trackId !== 'airport' || !position) return false;
  return AIRPORT_HAIRPIN_RUNOFF_ZONES.some((zone) => pointInsideCapsule(position, zone));
}

export function pointInsideCapsule(position, zone) {
  const px = Number(position?.x);
  const pz = Number(position?.z);
  if (!Number.isFinite(px) || !Number.isFinite(pz)) return false;

  const ax = zone.from.x;
  const az = zone.from.z;
  const bx = zone.to.x;
  const bz = zone.to.z;
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared > 0
    ? clamp(((px - ax) * dx + (pz - az) * dz) / lengthSquared, 0, 1)
    : 0;
  const nearestX = ax + dx * t;
  const nearestZ = az + dz * t;
  const offsetX = px - nearestX;
  const offsetZ = pz - nearestZ;
  return offsetX * offsetX + offsetZ * offsetZ <= zone.radius * zone.radius;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
