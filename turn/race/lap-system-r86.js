import * as baseLapSystem from './lap-system.js?revision=r223-training-car-taxi';
import { isSportsSedanEasterEgg } from '../vehicle/catalog.js?build=20260720-r20';

export const LAP_CHECKPOINTS = baseLapSystem.LAP_CHECKPOINTS;
export const MOUNTAIN_LONG_CHECKPOINTS = Object.freeze(
  Array.from({ length: 24 }, (_, index) => (index + 1) / 25)
);

export const beginTimedLapState = baseLapSystem.beginTimedLapState;
export const crossedForwardGate = baseLapSystem.crossedForwardGate;

export function updateLapProgressState(options = {}) {
  const trackId = options.state?.trackId || globalThis.__turnGetTrackId?.();
  const checkpoints = options.checkpoints || (
    trackId === 'mountain' ? MOUNTAIN_LONG_CHECKPOINTS : LAP_CHECKPOINTS
  );
  return baseLapSystem.updateLapProgressState({ ...options, checkpoints });
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
