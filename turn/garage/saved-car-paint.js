import {
  getCarDefinition,
  getVehicleDefaultColor,
  getVehicleDefaultSecondaryColor,
  normalizeVehicleColor,
  normalizeVehicleId,
  normalizeVehicleSecondaryColor
} from '../vehicle/catalog.js?build=20260720-r20&revision=r246-lot-saved-paint';

// The storage key keeps its original name, so colours saved in The Lot carry over.
export const SAVED_CAR_PAINT_KEY = 'turn-lot-saved-paint-v1';
export const SAVED_CAR_PAINT_VERSION = 1;

function factoryPaint(carId) {
  const id = normalizeVehicleId(carId);
  return {
    color: getVehicleDefaultColor(id),
    secondaryColor: getVehicleDefaultSecondaryColor(id)
  };
}

export function carPaintMatches(left, right) {
  return Boolean(left && right)
    && String(left.color || '').toLowerCase() === String(right.color || '').toLowerCase()
    && String(left.secondaryColor || '').toLowerCase() === String(right.secondaryColor || '').toLowerCase();
}

function normalizeCarPaint(carId, paint) {
  const id = normalizeVehicleId(carId);
  return {
    color: normalizeVehicleColor(paint?.color, getVehicleDefaultColor(id)),
    secondaryColor: normalizeVehicleSecondaryColor(
      paint?.secondaryColor,
      getVehicleDefaultSecondaryColor(id)
    )
  };
}

function readStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVED_CAR_PAINT_KEY));
    if (!stored || typeof stored !== 'object') return { paints: {} };
    const paints = stored.paints && typeof stored.paints === 'object' ? stored.paints : {};
    return { paints: { ...paints } };
  } catch (_) {
    return { paints: {} };
  }
}

function writeStore(paints) {
  try {
    localStorage.setItem(SAVED_CAR_PAINT_KEY, JSON.stringify({
      version: SAVED_CAR_PAINT_VERSION,
      paints
    }));
  } catch (_) {}
}

export function getSavedCarPaint(carId) {
  const id = normalizeVehicleId(carId);
  const car = getCarDefinition(id);
  if (car.fixedLivery) return null;

  const raw = readStore().paints[id];
  if (!raw) return null;
  const paint = normalizeCarPaint(id, raw);
  return carPaintMatches(paint, factoryPaint(id)) ? null : paint;
}

export function resolveCarPaint(carId) {
  return getSavedCarPaint(carId) || factoryPaint(carId);
}

export function saveCarPaint(carId, paint) {
  const id = normalizeVehicleId(carId);
  const car = getCarDefinition(id);
  if (car.fixedLivery) return null;

  const normalized = normalizeCarPaint(id, paint);
  const store = readStore();
  if (carPaintMatches(normalized, factoryPaint(id))) delete store.paints[id];
  else store.paints[id] = normalized;
  writeStore(store.paints);
  return getSavedCarPaint(id);
}

export function resetCarPaint(carId) {
  const id = normalizeVehicleId(carId);
  const store = readStore();
  delete store.paints[id];
  writeStore(store.paints);
  return factoryPaint(id);
}
