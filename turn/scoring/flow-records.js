export const FLOW_RECORDS_STORAGE_KEY = 'turn-flow-records-v1';
export const FLOW_RECORDS_STORAGE_VERSION = 1;

const DEFAULT_TRACK_ID = 'countryside';

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

function normalizeRecord(record) {
  const score = Math.round(finitePositive(record?.score, 0));
  if (score <= 0) return null;
  const normalized = {
    score,
    carId: String(record?.carId || 'classic'),
    hitAt: finitePositive(record?.hitAt)
  };
  const lapTime = finitePositive(record?.lapTime);
  if (lapTime != null) normalized.lapTime = lapTime;
  return Object.freeze(normalized);
}

function readPayload(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(FLOW_RECORDS_STORAGE_KEY));
    return parsed && typeof parsed === 'object' && parsed.tracks && typeof parsed.tracks === 'object'
      ? parsed
      : null;
  } catch (_) {
    return null;
  }
}

export function getBestFlowRecord(trackId, storage) {
  const payload = readPayload(storageOrDefault(storage));
  return normalizeRecord(payload?.tracks?.[normalizeTrackId(trackId)]);
}

export function saveBestFlowRecord({
  trackId,
  score,
  carId,
  lapTime,
  hitAt = Date.now()
} = {}, storage) {
  const targetStorage = storageOrDefault(storage);
  const normalizedTrackId = normalizeTrackId(trackId);
  const candidate = normalizeRecord({ score, carId, lapTime, hitAt });
  const current = getBestFlowRecord(normalizedTrackId, targetStorage);
  if (!candidate || (current && candidate.score <= current.score)) {
    return Object.freeze({ record: current, isNewBest: false, saved: false });
  }
  if (!targetStorage || typeof targetStorage.setItem !== 'function') {
    return Object.freeze({ record: current, isNewBest: false, saved: false });
  }

  const existing = readPayload(targetStorage);
  const tracks = { ...(existing?.tracks || {}), [normalizedTrackId]: candidate };
  try {
    targetStorage.setItem(FLOW_RECORDS_STORAGE_KEY, JSON.stringify({
      version: FLOW_RECORDS_STORAGE_VERSION,
      tracks
    }));
    return Object.freeze({ record: candidate, isNewBest: true, saved: true });
  } catch (_) {
    return Object.freeze({ record: current, isNewBest: false, saved: false });
  }
}
