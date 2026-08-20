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
