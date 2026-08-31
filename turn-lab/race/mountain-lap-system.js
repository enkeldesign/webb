import * as production from '../../turn/race/lap-system-r86.js?lab-base=mountain-long';

export const LAP_CHECKPOINTS = production.LAP_CHECKPOINTS;
export const MOUNTAIN_LAB_CHECKPOINTS = Object.freeze(
  Array.from({ length: 24 }, (_, index) => (index + 1) / 25)
);

export const beginTimedLapState = production.beginTimedLapState;
export const completeLapState = production.completeLapState;
export const crossedForwardGate = production.crossedForwardGate;

export function updateLapProgressState(options = {}) {
  const trackId = options.state?.trackId || globalThis.__turnGetTrackId?.();
  const checkpoints = options.checkpoints || (
    trackId === 'mountain' ? MOUNTAIN_LAB_CHECKPOINTS : LAP_CHECKPOINTS
  );
  return production.updateLapProgressState({ ...options, checkpoints });
}
