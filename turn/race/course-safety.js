// SAFETY achievements use the visible road edge rather than the softer physics
// shoulder. The rule is deliberately vehicle-independent: off-road-capable cars
// may keep their handling perk, but they do not get a clean-lap exemption.
export const COURSE_SAFETY_ROAD_EDGE_FACTOR = 0.5;

export function isOutsideCourseForSafety({
  distance,
  trackWidth,
  forgivingSurface = false
} = {}) {
  if (forgivingSurface === true) return false;
  const measuredDistance = Number(distance);
  const width = Number(trackWidth);
  if (!Number.isFinite(measuredDistance) || !Number.isFinite(width) || width <= 0) return false;
  return measuredDistance > width * COURSE_SAFETY_ROAD_EDGE_FACTOR;
}

export function recordLapCourseSafetyState({
  state,
  nearestTrack,
  trackWidth,
  forgivingSurface = false
} = {}) {
  if (!state) return false;
  const outside = isOutsideCourseForSafety({
    distance: nearestTrack?.distance,
    trackWidth,
    forgivingSurface
  });
  state.courseSafetyOffRoad = outside;
  if (state.lapActive === true && outside) state.lapCourseViolation = true;
  return outside;
}
