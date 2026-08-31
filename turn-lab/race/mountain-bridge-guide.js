const EPSILON = 1e-6;
const DEFAULT_SECONDS = 1 / 60;
const MAX_SECONDS = 0.1;
const INACTIVE_GUIDE = Object.freeze({
  active: false,
  assisted: false,
  contained: false,
  influence: 0,
  limit: Infinity
});

export function resolveMountainBridgeGuideState({
  state,
  nearestTrack = null,
  guide = null,
  baselineLimit = Infinity,
  dt = DEFAULT_SECONDS
} = {}) {
  if (
    !guide
    || !state?.position
    || !state?.velocity
    || !nearestTrack?.sample?.point
    || !Number.isFinite(nearestTrack.distance)
    || !Number.isFinite(nearestTrack.index)
  ) {
    return INACTIVE_GUIDE;
  }

  // Route index identifies this one physical bridge. Coordinate-only activation
  // would also catch the summit and lower run where their x values happen to match.
  const routeIndex = Number(nearestTrack.index);
  const sample = nearestTrack.sample;
  let normalX = Number(sample?.normal?.x);
  let normalZ = Number(sample?.normal?.z);
  if (!Number.isFinite(normalX) || !Number.isFinite(normalZ)) {
    const tangentX = Number(sample?.tangent?.x);
    const tangentZ = Number(sample?.tangent?.z);
    if (!Number.isFinite(tangentX) || !Number.isFinite(tangentZ)) return INACTIVE_GUIDE;
    normalX = -tangentZ;
    normalZ = tangentX;
  }
  const normalLength = Math.hypot(normalX, normalZ);
  if (normalLength < EPSILON) return INACTIVE_GUIDE;
  normalX /= normalLength;
  normalZ /= normalLength;

  const anchor = sample.point;
  const dx = Number(state.position.x) - Number(anchor.x);
  const dz = Number(state.position.z) - Number(anchor.z);
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return INACTIVE_GUIDE;
  const signedDistance = dx * normalX + dz * normalZ;
  const side = signedDistance >= 0 ? 1 : -1;
  const outwardX = normalX * side;
  const outwardZ = normalZ * side;
  const distance = Math.abs(signedDistance);
  const range = side > 0 ? guide.positiveNormalRange : guide.negativeNormalRange;
  const influence = taperedRangeInfluence(routeIndex, range);
  if (influence <= 0) return INACTIVE_GUIDE;

  const safeBaselineLimit = positiveNumber(baselineLimit, positiveNumber(guide.baselineLimitDistance, 15.6));
  const baselineAssistStart = positiveNumber(
    guide.baselineAssistStartDistance,
    Math.max(1, safeBaselineLimit - 0.6)
  );
  const assistStart = mix(
    baselineAssistStart,
    positiveNumber(guide.assistStartDistance, baselineAssistStart),
    influence
  );
  const safetyAssistStart = mix(
    safeBaselineLimit,
    positiveNumber(guide.safetyAssistStartDistance, safeBaselineLimit),
    influence
  );
  const limit = mix(
    safeBaselineLimit,
    positiveNumber(guide.hardLimitDistance, safeBaselineLimit),
    influence
  );
  const seconds = clamp(Number(dt) || DEFAULT_SECONDS, 0, MAX_SECONDS);
  let assisted = false;

  if (distance > assistStart) {
    applySlipperyAssist({
      velocity: state.velocity,
      outwardX,
      outwardZ,
      penetration: distance - assistStart,
      seconds,
      influence,
      damping: positiveNumber(guide.railDamping, 6),
      acceleration: positiveNumber(guide.railAcceleration, 9),
      penetrationAcceleration: nonNegativeNumber(guide.penetrationAcceleration, 3.5),
      maximumPenetrationAcceleration: nonNegativeNumber(guide.maximumPenetrationAcceleration, 28)
    });
    assisted = true;
  }

  if (distance > safetyAssistStart) {
    applySlipperyAssist({
      velocity: state.velocity,
      outwardX,
      outwardZ,
      penetration: distance - safetyAssistStart,
      seconds,
      influence,
      damping: positiveNumber(guide.safetyDamping, 12),
      acceleration: positiveNumber(guide.safetyAcceleration, 24),
      penetrationAcceleration: nonNegativeNumber(guide.penetrationAcceleration, 3.5),
      maximumPenetrationAcceleration: nonNegativeNumber(guide.maximumPenetrationAcceleration, 28)
    });
    assisted = true;
  }

  if (assisted) {
    // Match TURN's ordinary off-road drag while the rail guide is engaged. This
    // slows a scrape without destroying the route-tangential component.
    const drag = nonNegativeNumber(guide.offRoadDrag, 0.34);
    const damping = Math.exp(-drag * influence * seconds);
    state.velocity.x *= damping;
    state.velocity.z *= damping;
  }

  let contained = false;
  if (distance > limit) {
    // Move only along the sampled route normal. Preserve the sub-sample
    // along-track offset instead of snapping the car back to sample.point.
    const excess = distance - limit;
    state.position.x -= outwardX * excess;
    state.position.z -= outwardZ * excess;

    // This fallback is normal-only: forward motion along the bridge is retained
    // exactly (apart from the off-road drag above), so it cannot act like an end cap.
    const outwardSpeed = (Number(state.velocity.x) || 0) * outwardX
      + (Number(state.velocity.z) || 0) * outwardZ;
    const minimumInwardSpeed = nonNegativeNumber(guide.minimumInwardSpeed, 2.4);
    if (outwardSpeed > -minimumInwardSpeed) {
      const correction = outwardSpeed + minimumInwardSpeed;
      state.velocity.x -= outwardX * correction;
      state.velocity.z -= outwardZ * correction;
    }
    contained = true;
  }

  if (assisted || contained) state.speed = vectorLength(state.velocity);
  return {
    active: true,
    assisted,
    contained,
    influence,
    limit,
    assistStart,
    safetyAssistStart,
    side
  };
}

function applySlipperyAssist({
  velocity,
  outwardX,
  outwardZ,
  penetration,
  seconds,
  influence,
  damping,
  acceleration,
  penetrationAcceleration,
  maximumPenetrationAcceleration
}) {
  const outwardSpeed = (Number(velocity.x) || 0) * outwardX
    + (Number(velocity.z) || 0) * outwardZ;
  if (outwardSpeed > 0) {
    const dampingAmount = 1 - Math.exp(-damping * influence * seconds);
    velocity.x -= outwardX * outwardSpeed * dampingAmount;
    velocity.z -= outwardZ * outwardSpeed * dampingAmount;
  }
  const inwardAcceleration = (
    acceleration
    + Math.min(maximumPenetrationAcceleration, penetration * penetrationAcceleration)
  ) * influence;
  velocity.x -= outwardX * inwardAcceleration * seconds;
  velocity.z -= outwardZ * inwardAcceleration * seconds;
}

function taperedRangeInfluence(value, range) {
  const start = Number(range?.startIndex);
  const end = Number(range?.endIndex);
  const feather = nonNegativeNumber(range?.featherSamples, 0);
  if (!Number.isFinite(value) || !Number.isFinite(start) || !Number.isFinite(end) || value <= start || value >= end) {
    return 0;
  }
  if (feather <= EPSILON) return 1;
  const fadeIn = smoothstep(start, Math.min(end, start + feather), value);
  const fadeOut = 1 - smoothstep(Math.max(start, end - feather), end, value);
  return Math.min(fadeIn, fadeOut);
}

function smoothstep(edge0, edge1, value) {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function vectorLength(vector) {
  if (typeof vector?.length === 'function') return vector.length();
  return Math.hypot(Number(vector?.x) || 0, Number(vector?.y) || 0, Number(vector?.z) || 0);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function mix(from, to, amount) {
  return from + (to - from) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
