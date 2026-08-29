import * as baseLapSystem from './lap-system.js?revision=r222-awd-suv-paint';
import { isSportsSedanEasterEgg } from '../vehicle/catalog.js?build=20260720-r20';

export const LAP_CHECKPOINTS = baseLapSystem.LAP_CHECKPOINTS;
export const beginTimedLapState = baseLapSystem.beginTimedLapState;
export const updateLapProgressState = baseLapSystem.updateLapProgressState;
export const crossedForwardGate = baseLapSystem.crossedForwardGate;

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
