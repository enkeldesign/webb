import {
  CUSTOM_CAR_SCHEMA_VERSION,
  normalizeCustomCarBuild,
  validateCustomCarBuild
} from './schema.js';

export const CUSTOM_CAR_STORAGE_KEY = 'turn-custom-cars-v1';
export const CUSTOM_CAR_STORAGE_VERSION = 1;

export function loadCustomCar(storage = globalThis.localStorage) {
  if (!storage?.getItem) return null;
  try {
    const envelope = JSON.parse(storage.getItem(CUSTOM_CAR_STORAGE_KEY));
    if (envelope?.version !== CUSTOM_CAR_STORAGE_VERSION || !Array.isArray(envelope.slots)) return null;
    const candidate = envelope.slots.find((slot) => slot?.schemaVersion === CUSTOM_CAR_SCHEMA_VERSION);
    if (!candidate) return null;
    const normalized = normalizeCustomCarBuild(candidate, { now: candidate.updatedAt });
    return validateCustomCarBuild(normalized).valid ? normalized : null;
  } catch {
    return null;
  }
}

export function saveCustomCar(candidate, storage = globalThis.localStorage) {
  if (!storage?.setItem) throw new Error('Custom-car storage is unavailable.');
  const normalized = normalizeCustomCarBuild(candidate);
  const validation = validateCustomCarBuild(normalized);
  if (!validation.valid) throw new Error(validation.errors[0] || 'The custom car is invalid.');
  storage.setItem(CUSTOM_CAR_STORAGE_KEY, JSON.stringify({
    version: CUSTOM_CAR_STORAGE_VERSION,
    slots: [normalized]
  }));
  return normalized;
}

export function clearCustomCar(storage = globalThis.localStorage) {
  storage?.removeItem?.(CUSTOM_CAR_STORAGE_KEY);
}
