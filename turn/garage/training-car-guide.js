import { installLotSelectionBayPolish } from './lot-selection-bay.js?revision=r594-m8-entry';

export const TRAINING_CAR_ID = 'classic';
export const TRAINING_CAR_TRIED_STORAGE_KEY = 'turn-training-car-tried-v1';

let installed = false;

export function hasTriedTrainingCar(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(TRAINING_CAR_TRIED_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function markTrainingCarTried(storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(TRAINING_CAR_TRIED_STORAGE_KEY, '1');
  } catch (_) {}
  globalThis.dispatchEvent?.(new CustomEvent('turn:training-car-tried'));
  return true;
}

export function installTrainingCarGuide() {
  // lot-r10 calls this synchronously at the start of every showTheLot() invocation,
  // before any parking pads are constructed. Use that canonical entry boundary so
  // both the active M8 Home route and the older wrapper route receive the same bay
  // treatment. The temporary Three.js construction hook restores itself after all
  // 15 pads have been created.
  installLotSelectionBayPolish();

  if (installed) return globalThis.__turnTrainingCarGuide;
  installed = true;

  const handleRaceState = (event) => {
    if (event.detail?.running !== true) return;
    const vehicleId = event.detail?.vehicleId || globalThis.__turnRuntime?.state?.vehicleId || '';
    if (vehicleId === TRAINING_CAR_ID && !hasTriedTrainingCar()) markTrainingCarTried();
  };

  globalThis.addEventListener?.('turn:ui-state-change', handleRaceState);

  const api = Object.freeze({
    vehicleId: TRAINING_CAR_ID,
    get tried() { return hasTriedTrainingCar(); },
    markTried: markTrainingCarTried
  });
  globalThis.__turnTrainingCarGuide = api;
  return api;
}
