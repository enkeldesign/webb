import * as baseLapSystem from './lap-system.js?base=20260725-r85';
import { isSportsSedanEasterEgg } from '../vehicle/catalog.js?build=20260720-r20';

export const LAP_CHECKPOINTS = baseLapSystem.LAP_CHECKPOINTS;
export const beginTimedLapState = baseLapSystem.beginTimedLapState;
export const updateLapProgressState = baseLapSystem.updateLapProgressState;
export const crossedForwardGate = baseLapSystem.crossedForwardGate;

export function completeLapState(options) {
  const state = options?.state;
  const unranked = isSportsSedanEasterEgg({
    carId: state?.vehicleId,
    secondaryColor: state?.vehicleSecondaryColor
  });

  if (!unranked) {
    const result = baseLapSystem.completeLapState(options);
    return { ...result, savedLap: result.validLap === true };
  }

  const savedState = {
    competitorLaps: state.competitorLaps,
    bestTime: state.bestTime,
    ghostFrames: state.ghostFrames,
    ghostVisible: state.ghostVisible
  };

  const result = baseLapSystem.completeLapState({
    ...options,
    saveGhost: undefined
  });

  state.competitorLaps = savedState.competitorLaps;
  state.bestTime = savedState.bestTime;
  state.ghostFrames = savedState.ghostFrames;
  state.ghostVisible = savedState.ghostVisible;

  return { ...result, savedLap: false };
}
