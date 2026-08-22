export const CHASE_CAMERA = Object.freeze({
  referenceViewportHeight: 390,
  baseZoom: 16.05,
  minimumZoom: 15.9,
  maximumZoom: 17.45,
  altitudePullbackStart: 80,
  altitudePullbackRange: 720,
  maximumAltitudePullback: 0.15
});

export function resolveChaseCameraZoom(viewportHeight, altitude) {
  const height = Math.max(
    1,
    Number(viewportHeight) || CHASE_CAMERA.referenceViewportHeight
  );
  const viewportCompensation = Math.log2(
    height / CHASE_CAMERA.referenceViewportHeight
  );
  const altitudeRatio = clamp(
    (Number(altitude) - CHASE_CAMERA.altitudePullbackStart)
      / CHASE_CAMERA.altitudePullbackRange,
    0,
    1
  );

  return clamp(
    CHASE_CAMERA.baseZoom
      + viewportCompensation
      - altitudeRatio * CHASE_CAMERA.maximumAltitudePullback,
    CHASE_CAMERA.minimumZoom,
    CHASE_CAMERA.maximumZoom
  );
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
