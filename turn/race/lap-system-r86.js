import * as baseLapSystem from './lap-system.js?revision=r262-forgiving-lap-void';
import { isSportsSedanEasterEgg } from '../vehicle/catalog.js?build=20260720-r20';
import { sessionPolicy } from './session-policy.js';

export const LAP_CHECKPOINTS = baseLapSystem.LAP_CHECKPOINTS;
export const MOUNTAIN_LONG_CHECKPOINTS = Object.freeze(
  Array.from({ length: 24 }, (_, index) => (index + 1) / 25)
);
export const BEACHFRONT_CHECKPOINTS = Object.freeze(
  Array.from({ length: 20 }, (_, index) => (index + 1) / 21)
);
// The uniform 60% gate lands on DEAD CANYON's hairpin cusp. A legal
// inside line can pass the apex without crossing that finite gate, then meet the
// 64% gate and be marked LAP VOID. Move only that gate just before the cusp.
export const DEAD_CANYON_CHECKPOINTS = Object.freeze(
  Array.from({ length: 24 }, (_, index) => (index === 14 ? 0.59 : (index + 1) / 25))
);
// Track-specific checkpoint sets; every other track uses LAP_CHECKPOINTS.
const TRACK_CHECKPOINTS = Object.freeze({
  mountain: MOUNTAIN_LONG_CHECKPOINTS,
  beachfront: BEACHFRONT_CHECKPOINTS,
  'dead-canyon': DEAD_CANYON_CHECKPOINTS
});
export const COUNTRYSIDE_CHECKPOINT_GATE_HALF_WIDTH_FACTOR = 3;
export const LAP_VOID_DISABLED_TRACKS = Object.freeze(['cliffside']);
const COUNTRYSIDE_TRACK_CENTER = Object.freeze({ x: 0, z: 0 });
const NO_CHECKPOINTS = Object.freeze([]);

export const beginTimedLapState = baseLapSystem.beginTimedLapState;
export const crossedForwardGate = baseLapSystem.crossedForwardGate;

export function updateLapProgressState(options = {}) {
  const trackId = options.state?.trackId || globalThis.__turnGetTrackId?.();
  const checkpoints = options.checkpoints ?? (
    LAP_VOID_DISABLED_TRACKS.includes(trackId)
      ? NO_CHECKPOINTS
      : TRACK_CHECKPOINTS[trackId] || LAP_CHECKPOINTS
  );
  const checkpointGateHalfWidthFactor = options.checkpointGateHalfWidthFactor ?? (
    trackId === 'countryside' ? COUNTRYSIDE_CHECKPOINT_GATE_HALF_WIDTH_FACTOR : undefined
  );
  const checkpointGateCenterPoint = options.checkpointGateCenterPoint ?? (
    trackId === 'countryside' ? COUNTRYSIDE_TRACK_CENTER : undefined
  );
  const checkpointGateOuterHalfWidthFactor = options.checkpointGateOuterHalfWidthFactor ?? (
    trackId === 'countryside' ? Infinity : undefined
  );

  return baseLapSystem.updateLapProgressState({
    ...options,
    checkpoints,
    ...(checkpointGateHalfWidthFactor == null ? {} : { checkpointGateHalfWidthFactor }),
    ...(checkpointGateCenterPoint == null ? {} : { checkpointGateCenterPoint }),
    ...(checkpointGateOuterHalfWidthFactor == null ? {} : { checkpointGateOuterHalfWidthFactor })
  });
}

export function completeLapState(options) {
  const state = options?.state;
  // A trial lap (reward preview, tutorial teaching lap) sets no best time or
  // DRIFT/FLOW record; the session policy says whether it becomes a ghost.
  const policy = sessionPolicy(state);
  const ranked = !isSportsSedanEasterEgg({
    carId: state?.vehicleId,
    secondaryColor: state?.vehicleSecondaryColor
  }) && policy.records;

  return baseLapSystem.completeLapState({
    ...options,
    ranked,
    // The hidden Sports Sedan setup never becomes a rival. A teaching lap does, for
    // this run only.
    ghost: ranked || policy.ghost === 'session' ? policy.ghost : 'none',
    saveGhost: ranked ? options?.saveGhost : undefined
  });
}
