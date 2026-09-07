import {
  getCarDefinition,
  getVehicleDefaultColor,
  getVehicleDefaultSecondaryColor,
  normalizeVehicleColor,
  normalizeVehicleId,
  normalizeVehicleSecondaryColor
} from '../vehicle/catalog.js?build=20260720-r20&revision=r246-lot-saved-paint';

export const LOT_SAVED_PAINT_KEY = 'turn-lot-saved-paint-v1';
export const LOT_SAVED_PAINT_VERSION = 1;

function factoryPaint(carId) {
  const id = normalizeVehicleId(carId);
  return {
    color: getVehicleDefaultColor(id),
    secondaryColor: getVehicleDefaultSecondaryColor(id)
  };
}

export function lotPaintMatches(left, right) {
  return Boolean(left && right)
    && String(left.color || '').toLowerCase() === String(right.color || '').toLowerCase()
    && String(left.secondaryColor || '').toLowerCase() === String(right.secondaryColor || '').toLowerCase();
}

function normalizeLotPaint(carId, paint) {
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
    const stored = JSON.parse(localStorage.getItem(LOT_SAVED_PAINT_KEY));
    if (!stored || typeof stored !== 'object') return { paints: {} };
    const paints = stored.paints && typeof stored.paints === 'object' ? stored.paints : {};
    return { paints: { ...paints } };
  } catch (_) {
    return { paints: {} };
  }
}

function writeStore(paints) {
  try {
    localStorage.setItem(LOT_SAVED_PAINT_KEY, JSON.stringify({
      version: LOT_SAVED_PAINT_VERSION,
      paints
    }));
  } catch (_) {}
}

export function getSavedLotPaint(carId) {
  const id = normalizeVehicleId(carId);
  const car = getCarDefinition(id);
  if (car.fixedLivery) return null;

  const raw = readStore().paints[id];
  if (!raw) return null;
  const paint = normalizeLotPaint(id, raw);
  return lotPaintMatches(paint, factoryPaint(id)) ? null : paint;
}

export function resolveLotPaint(carId) {
  return getSavedLotPaint(carId) || factoryPaint(carId);
}

export function saveLotPaint(carId, paint) {
  const id = normalizeVehicleId(carId);
  const car = getCarDefinition(id);
  if (car.fixedLivery) return null;

  const normalized = normalizeLotPaint(id, paint);
  const store = readStore();
  if (lotPaintMatches(normalized, factoryPaint(id))) delete store.paints[id];
  else store.paints[id] = normalized;
  writeStore(store.paints);
  return getSavedLotPaint(id);
}

export function resetLotPaint(carId) {
  const id = normalizeVehicleId(carId);
  const store = readStore();
  delete store.paints[id];
  writeStore(store.paints);
  return factoryPaint(id);
}
