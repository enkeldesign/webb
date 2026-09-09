import * as baseLapSystem from './lap-system.js?revision=r223-training-car-taxi';
import { isSportsSedanEasterEgg } from '../vehicle/catalog.js?build=20260720-r20';

export const LAP_CHECKPOINTS = baseLapSystem.LAP_CHECKPOINTS;
export const MOUNTAIN_LONG_CHECKPOINTS = Object.freeze(
  Array.from({ length: 24 }, (_, index) => (index + 1) / 25)
);
export const COUNTRYSIDE_CHECKPOINT_GATE_HALF_WIDTH_FACTOR = 3;
export const LAP_VOID_DISABLED_TRACKS = Object.freeze(['cliffside']);
const NO_CHECKPOINTS = Object.freeze([]);

export const beginTimedLapState = baseLapSystem.beginTimedLapState;
export const crossedForwardGate = baseLapSystem.crossedForwardGate;

export function updateLapProgressState(options = {}) {
  const trackId = options.state?.trackId || globalThis.__turnGetTrackId?.();
  const checkpoints = options.checkpoints ?? (
    LAP_VOID_DISABLED_TRACKS.includes(trackId)
      ? NO_CHECKPOINTS
      : trackId === 'mountain'
        ? MOUNTAIN_LONG_CHECKPOINTS
        : LAP_CHECKPOINTS
  );
  const checkpointGateHalfWidthFactor = options.checkpointGateHalfWidthFactor ?? (
    trackId === 'countryside' ? COUNTRYSIDE_CHECKPOINT_GATE_HALF_WIDTH_FACTOR : undefined
  );

  return baseLapSystem.updateLapProgressState({
    ...options,
    checkpoints,
    ...(checkpointGateHalfWidthFactor == null ? {} : { checkpointGateHalfWidthFactor })
  });
}

export function completeLapState(options) {
  const state = options?.state;
  const ranked = !isSportsSedanEasterEgg({
    carId: state?.vehicleId,
    secondaryColor: state?.vehicleSecondaryColor
  });

  return baseLapSystem.completeLapState({
    ...options,
    ranked,
    saveGhost: ranked ? options?.saveGhost : undefined
  });
}
