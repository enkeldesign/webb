export const DRIFT_RECORDS_STORAGE_KEY = 'turn-drift-records-v1';
export const DRIFT_RECORDS_STORAGE_VERSION = 2;

const DEFAULT_TRACK_ID = 'countryside';
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function storageOrDefault(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

function normalizeTrackId(trackId) {
  const value = String(trackId || '').trim();
  return value && /^[a-z0-9-]+$/i.test(value) ? value : DEFAULT_TRACK_ID;
}

function finitePositive(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizePaint(value) {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
}

function normalizeRecord(record) {
  const score = Math.round(finitePositive(record?.score, 0));
  if (score <= 0) return null;
  const normalized = {
    score,
    carId: String(record?.carId || 'classic'),
    hitAt: finitePositive(record?.hitAt)
  };
  const carColor = normalizePaint(record?.carColor);
  const carSecondaryColor = normalizePaint(record?.carSecondaryColor);
  if (carColor) normalized.carColor = carColor;
  if (carSecondaryColor) normalized.carSecondaryColor = carSecondaryColor;
  const lapTime = finitePositive(record?.lapTime);
  if (lapTime != null) normalized.lapTime = lapTime;
  return Object.freeze(normalized);
}

function readPayload(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(DRIFT_RECORDS_STORAGE_KEY));
    return parsed && typeof parsed === 'object' && parsed.tracks && typeof parsed.tracks === 'object'
      ? parsed
      : null;
  } catch (_) {
    return null;
  }
}

export function getBestDriftRecord(trackId, storage) {
  const payload = readPayload(storageOrDefault(storage));
  return normalizeRecord(payload?.tracks?.[normalizeTrackId(trackId)]);
}

export function saveBestDriftRecord({
  trackId,
  score,
  carId,
  carColor,
  carSecondaryColor,
  lapTime,
  hitAt = Date.now()
} = {}, storage) {
  const targetStorage = storageOrDefault(storage);
  const normalizedTrackId = normalizeTrackId(trackId);
  const candidate = normalizeRecord({
    score,
    carId,
    carColor,
    carSecondaryColor,
    lapTime,
    hitAt
  });
  const current = getBestDriftRecord(normalizedTrackId, targetStorage);
  if (!candidate || (current && candidate.score <= current.score)) {
    return Object.freeze({ record: current, isNewBest: false, saved: false });
  }
  if (!targetStorage || typeof targetStorage.setItem !== 'function') {
    return Object.freeze({ record: current, isNewBest: false, saved: false });
  }

  const existing = readPayload(targetStorage);
  const tracks = { ...(existing?.tracks || {}), [normalizedTrackId]: candidate };
  const payload = {
    version: DRIFT_RECORDS_STORAGE_VERSION,
    tracks
  };
  try {
    targetStorage.setItem(DRIFT_RECORDS_STORAGE_KEY, JSON.stringify(payload));
    return Object.freeze({ record: candidate, isNewBest: true, saved: true });
  } catch (_) {
    return Object.freeze({ record: current, isNewBest: false, saved: false });
  }
}
