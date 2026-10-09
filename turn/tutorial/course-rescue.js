// TURN TUTORIAL course rescue (#1133). The teaching lap leaves steering to the player,
// but one big mistake should not end the lesson. As in DRIVE BY EAR TUTORIAL's rails
// (training/drive-by-ear-training.js) it acts only off the road: a soft push back
// towards it, a firmer one further out, and a remote limit that keeps the car's forward
// motion instead of snapping it back. Ordinary off-road driving is left alone.
export const COURSE_RESCUE = Object.freeze({
  // Metres beyond the off-road line (physics.js: 0.58 of the track width).
  softFrom: 2,
  firmFrom: 8,
  limit: 14,
  soft: Object.freeze({ damping: 6, acceleration: 9 }),
  firm: Object.freeze({ damping: 12, acceleration: 24 })
});

const OFF_ROAD_SHARE = 0.58;

function push(velocity, normal, side, penetration, dt, profile) {
  const outward = (velocity.x * normal.x + velocity.z * normal.z) * side;
  if (outward > 0) {
    const damping = 1 - Math.exp(-profile.damping * dt);
    velocity.x -= normal.x * side * outward * damping;
    velocity.z -= normal.z * side * outward * damping;
  }
  const inward = (profile.acceleration + Math.min(28, penetration * 3.5)) * dt;
  velocity.x -= normal.x * side * inward;
  velocity.z -= normal.z * side * inward;
}

// One frame of rescue. Returns 'none', 'push' or 'limit'.
export function applyCourseRescue({ state, samples, trackWidth, dt, tuning = COURSE_RESCUE }) {
  const sample = samples?.[state?.nearestTrackIndex];
  if (!sample?.normal || !sample.point || !state.position || !state.velocity || !(dt > 0)) return 'none';
  const offset = (state.position.x - sample.point.x) * sample.normal.x
    + (state.position.z - sample.point.z) * sample.normal.z;
  const side = Math.sign(offset) || 1;
  const line = trackWidth * OFF_ROAD_SHARE;
  const beyond = Math.abs(offset) - line;
  if (beyond <= tuning.softFrom) return 'none';

  push(state.velocity, sample.normal, side, beyond - tuning.softFrom, dt, tuning.soft);
  if (beyond > tuning.firmFrom) push(state.velocity, sample.normal, side, beyond - tuning.firmFrom, dt, tuning.firm);
  let result = 'push';

  if (beyond > tuning.limit) {
    const edge = line + tuning.limit;
    state.position.x = sample.point.x + sample.normal.x * side * edge;
    state.position.z = sample.point.z + sample.normal.z * side * edge;
    if (Number.isFinite(sample.point.y)) state.position.y = sample.point.y;
    const along = state.velocity.x * sample.tangent.x + state.velocity.z * sample.tangent.z;
    state.velocity.x = sample.tangent.x * along * 0.82 - sample.normal.x * side * 4;
    state.velocity.z = sample.tangent.z * along * 0.82 - sample.normal.z * side * 4;
    result = 'limit';
  }
  state.speed = Math.hypot(state.velocity.x, state.velocity.z);
  return result;
}
