import { normalizeReplayFrames } from './replay-system.js';
import {
  LEGACY_VEHICLE_ID,
  getVehicleDefaultColor,
  getVehicleDefaultSecondaryColor,
  isSportsSedanEasterEgg,
  normalizeStoredVehiclePaint
} from '../vehicle/catalog.js?build=20260720-r19';
import { getTrackStorageRevision } from '../tracks/definitions.js';

export const RIVAL_LIMIT = 4;
export const RIVAL_STORAGE_VERSION = 7;

const DEFAULT_TRACK_ID = 'countryside';
const GHOST_KEY = 'turn-three-ghost-v4';
const COMPETITOR_KEY = 'turn-personal-rivals-v1';
const pendingRivalSaves = new Map();
const bestLapSummaryCache = new Map();
let pendingRivalFlush = null;
let persistenceLifecycleInstalled = false;

function normalizeTrackId(trackId) {
  return typeof trackId === 'string' && trackId.trim() ? trackId.trim() : DEFAULT_TRACK_ID;
}

function storageTrackId(trackId) {
  return getTrackStorageRevision(normalizeTrackId(trackId));
}

function rivalKey(trackId) {
  const normalized = storageTrackId(trackId);
  return normalized === DEFAULT_TRACK_ID ? COMPETITOR_KEY : `${COMPETITOR_KEY}:${normalized}`;
}

function ghostKey(trackId) {
  const normalized = storageTrackId(trackId);
  return normalized === DEFAULT_TRACK_ID ? GHOST_KEY : `${GHOST_KEY}:${normalized}`;
}

function stateTrackId(state, explicitTrackId) {
  return normalizeTrackId(explicitTrackId || state?.trackId || DEFAULT_TRACK_ID);
}

function copyBestLapSummary(summary) {
  if (!summary) return null;
  const copy = {
    time: summary.time,
    carId: summary.carId
  };
  if (summary.carColor) copy.carColor = summary.carColor;
  if (summary.carSecondaryColor) copy.carSecondaryColor = summary.carSecondaryColor;
  return copy;
}

function bestValidLap(laps) {
  return Array.isArray(laps)
    ? laps
      .filter(isValidLap)
      .reduce((best, lap) => (!best || Number(lap.time) < Number(best.time) ? lap : best), null)
    : null;
}

function bestLapSummaryFromStoredLap(lap, sourceVersion) {
  if (!lap) return null;
  const paint = normalizeStoredLapPaint(lap, sourceVersion);
  return copyBestLapSummary({
    time: Number(lap.time),
    carId: paint.carId,
    carColor: paint.color,
    carSecondaryColor: paint.secondaryColor
  });
}

function rememberBestLapSummary(trackId, summary, { shareable = false } = {}) {
  const record = Object.freeze({
    summary: summary ? Object.freeze(copyBestLapSummary(summary)) : null,
    shareable: Boolean(summary && shareable)
  });
  bestLapSummaryCache.set(rivalKey(trackId), record);
  return record;
}

function pendingRivalPayload(trackId) {
  return pendingRivalSaves.get(rivalKey(trackId))?.value || null;
}

function readBestLapRecord(trackId) {
  const activeTrackId = normalizeTrackId(trackId);
  const cacheKey = rivalKey(activeTrackId);
  if (bestLapSummaryCache.has(cacheKey)) return bestLapSummaryCache.get(cacheKey);

  try {
    const pending = pendingRivalPayload(activeTrackId);
    const savedRivals = pending || JSON.parse(localStorage.getItem(cacheKey));
    const sourceVersion = Number(savedRivals?.version) || 0;
    const bestLap = bestValidLap(savedRivals?.laps);
    if (bestLap) {
      return rememberBestLapSummary(
        activeTrackId,
        bestLapSummaryFromStoredLap(bestLap, sourceVersion),
        { shareable: true }
      );
    }

    // Preserve the historical summary-only fallback. Very old Countryside saves
    // can contain a best time without enough replay frames to share as YOUR TURN;
    // Home should still display that record even though no share button is offered.
    if (activeTrackId === DEFAULT_TRACK_ID) {
      const oldGhost = JSON.parse(localStorage.getItem(ghostKey(activeTrackId)));
      const legacyTime = Number(oldGhost?.bestTime);
      if (Number.isFinite(legacyTime)) {
        const shareable = Array.isArray(oldGhost?.frames) && oldGhost.frames.length > 20;
        return rememberBestLapSummary(
          activeTrackId,
          shareable
            ? {
                time: legacyTime,
                carId: LEGACY_VEHICLE_ID,
                carColor: getVehicleDefaultColor(LEGACY_VEHICLE_ID),
                carSecondaryColor: getVehicleDefaultSecondaryColor(LEGACY_VEHICLE_ID)
              }
            : {
                time: legacyTime,
                carId: LEGACY_VEHICLE_ID
              },
          { shareable }
        );
      }
    }
  } catch (_) {}

  return rememberBestLapSummary(activeTrackId, null);
}

function rivalSavePayload(state, trackId) {
  const activeTrackId = stateTrackId(state, trackId);
  const laps = state.competitorLaps.filter(isValidLap);
  const bestLap = bestValidLap(laps);
  rememberBestLapSummary(
    activeTrackId,
    bestLapSummaryFromStoredLap(bestLap, RIVAL_STORAGE_VERSION),
    { shareable: Boolean(bestLap) }
  );
  return {
    key: rivalKey(activeTrackId),
    value: {
      version: RIVAL_STORAGE_VERSION,
      trackId: activeTrackId,
      trackRevision: storageTrackId(activeTrackId),
      laps
    }
  };
}

function writeRivalPayload(payload) {
  localStorage.setItem(payload.key, JSON.stringify(payload.value));
}

function cancelScheduledRivalFlush() {
  if (!pendingRivalFlush) return;
  if (pendingRivalFlush.type === 'idle') globalThis.cancelIdleCallback?.(pendingRivalFlush.id);
  else globalThis.clearTimeout?.(pendingRivalFlush.id);
  pendingRivalFlush = null;
}

export function flushScheduledRivalsState() {
  cancelScheduledRivalFlush();
  if (!pendingRivalSaves.size) return true;
  let success = true;
  const payloads = [...pendingRivalSaves.values()];
  pendingRivalSaves.clear();
  for (const payload of payloads) {
    try {
      writeRivalPayload(payload);
    } catch (_) {
      success = false;
    }
  }
  return success;
}

function ensurePersistenceLifecycle() {
  if (persistenceLifecycleInstalled) return;
  persistenceLifecycleInstalled = true;
  globalThis.addEventListener?.('pagehide', flushScheduledRivalsState);
  globalThis.addEventListener?.('storage', (event) => {
    const key = String(event?.key || '');
    if (!key || key.startsWith(COMPETITOR_KEY) || key.startsWith(GHOST_KEY)) {
      bestLapSummaryCache.clear();
    }
  });
  globalThis.document?.addEventListener?.('visibilitychange', () => {
    if (globalThis.document?.visibilityState === 'hidden') flushScheduledRivalsState();
  });
}

function schedulePendingRivalFlush() {
  if (pendingRivalFlush) return;
  const flush = () => {
    pendingRivalFlush = null;
    flushScheduledRivalsState();
  };
  if (typeof globalThis.requestIdleCallback === 'function') {
    const id = globalThis.requestIdleCallback(flush, { timeout: 800 });
    pendingRivalFlush = { type: 'idle', id };
  } else {
    const id = globalThis.setTimeout(flush, 32);
    pendingRivalFlush = { type: 'timeout', id };
  }
}

export function scheduleRivalsStateSave(state, { trackId } = {}) {
  try {
    const payload = rivalSavePayload(state, trackId);
    pendingRivalSaves.set(payload.key, payload);
    ensurePersistenceLifecycle();
    schedulePendingRivalFlush();
    return true;
  } catch (_) {
    return false;
  }
}

export function saveRivalsState(state, { trackId } = {}) {
  try {
    const payload = rivalSavePayload(state, trackId);
    pendingRivalSaves.delete(payload.key);
    if (!pendingRivalSaves.size) cancelScheduledRivalFlush();
    writeRivalPayload(payload);
    return true;
  } catch (_) {
    return false;
  }
}

export function loadRivalsState({ state, samples, findNearestTrack, trackId }) {
  const activeTrackId = stateTrackId(state, trackId);

  try {
    const savedRivals = JSON.parse(localStorage.getItem(rivalKey(activeTrackId)));
    let laps = Array.isArray(savedRivals?.laps) ? savedRivals.laps : [];
    let sourceVersion = Number(savedRivals?.version) || 0;

    if (!laps.length && activeTrackId === DEFAULT_TRACK_ID) {
      const oldGhost = JSON.parse(localStorage.getItem(ghostKey(activeTrackId)));
      if (
        oldGhost &&
        Number.isFinite(oldGhost.bestTime) &&
        Array.isArray(oldGhost.frames) &&
        oldGhost.frames.length > 20
      ) {
        laps = [{
          time: oldGhost.bestTime,
          hitAt: null,
          carId: LEGACY_VEHICLE_ID,
          frames: oldGhost.frames
        }];
        sourceVersion = 0;
      }
    }

    const startSample = samples[0];
    const findProgress = (frame) => findNearestTrack(frame).index / samples.length;

    state.trackId = activeTrackId;
    state.competitorLaps = laps
      .filter(isValidLap)
      .map((lap) => {
        const paint = normalizeStoredLapPaint(lap, sourceVersion);
        return {
          ...lap,
          hitAt: lap.hitAt != null && Number.isFinite(Number(lap.hitAt)) ? Number(lap.hitAt) : null,
          carId: paint.carId,
          carColor: paint.color,
          carSecondaryColor: paint.secondaryColor,
          factoryPaint: paint.factoryPaint,
          frames: normalizeReplayFrames(lap.frames, { startSample, findProgress })
        };
      })
      .sort((a, b) => a.time - b.time)
      .slice(0, RIVAL_LIMIT);

    syncPrimaryRivalState(state);
    if (state.competitorLaps.length) scheduleRivalsStateSave(state, { trackId: activeTrackId });
    else rememberBestLapSummary(activeTrackId, null);
    return state.competitorLaps;
  } catch (_) {
    state.trackId = activeTrackId;
    state.competitorLaps = [];
    syncPrimaryRivalState(state);
    rememberBestLapSummary(activeTrackId, null);
    return state.competitorLaps;
  }
}

export function clearRivalsState(state, { trackId } = {}) {
  const activeTrackId = stateTrackId(state, trackId);
  state.trackId = activeTrackId;
  state.competitorLaps = [];
  syncPrimaryRivalState(state);
  rememberBestLapSummary(activeTrackId, null);

  try {
    localStorage.removeItem(rivalKey(activeTrackId));
    localStorage.removeItem(ghostKey(activeTrackId));
  } catch (_) {}
}

export function clearAllRivalsState(state, trackIds = []) {
  const activeTrackId = stateTrackId(state);
  const normalizedTrackIds = [...new Set([
    activeTrackId,
    ...trackIds
  ].map(normalizeTrackId))];

  try {
    for (const trackId of normalizedTrackIds) {
      localStorage.removeItem(rivalKey(trackId));
      localStorage.removeItem(ghostKey(trackId));
      rememberBestLapSummary(trackId, null);
    }
  } catch (_) {}

  state.trackId = activeTrackId;
  state.competitorLaps = [];
  syncPrimaryRivalState(state);
  return normalizedTrackIds.length;
}

export function getStoredBestLap(trackId = DEFAULT_TRACK_ID) {
  return copyBestLapSummary(readBestLapRecord(trackId).summary);
}

export function hasStoredBestReplayLap(trackId = DEFAULT_TRACK_ID) {
  return readBestLapRecord(trackId).shareable === true;
}

export function getStoredBestReplayLap(trackId = DEFAULT_TRACK_ID) {
  const activeTrackId = normalizeTrackId(trackId);
  const cachedRecord = bestLapSummaryCache.get(rivalKey(activeTrackId));
  if (cachedRecord && cachedRecord.shareable !== true) return null;

  try {
    const pending = pendingRivalPayload(activeTrackId);
    const savedRivals = pending || JSON.parse(localStorage.getItem(rivalKey(activeTrackId)));
    const sourceVersion = Number(savedRivals?.version) || 0;
    const bestLap = Array.isArray(savedRivals?.laps)
      ? savedRivals.laps
        .filter(isValidLap)
        .reduce((best, lap) => {
          const time = Number(lap?.time);
          if (!best || time < best.time) {
            const paint = normalizeStoredLapPaint(lap, sourceVersion);
            return {
              time,
              hitAt: lap.hitAt != null && Number.isFinite(Number(lap.hitAt)) ? Number(lap.hitAt) : null,
              carId: paint.carId,
              carColor: paint.color,
              carSecondaryColor: paint.secondaryColor,
              factoryPaint: paint.factoryPaint,
              frames: lap.frames.map((frame) => ({ ...frame }))
            };
          }
          return best;
        }, null)
      : null;
    if (bestLap) return bestLap;

    if (activeTrackId === DEFAULT_TRACK_ID) {
      const oldGhost = JSON.parse(localStorage.getItem(ghostKey(activeTrackId)));
      const legacyTime = Number(oldGhost?.bestTime);
      if (Number.isFinite(legacyTime) && Array.isArray(oldGhost?.frames) && oldGhost.frames.length > 20) {
        return {
          time: legacyTime,
          hitAt: null,
          carId: LEGACY_VEHICLE_ID,
          carColor: getVehicleDefaultColor(LEGACY_VEHICLE_ID),
          carSecondaryColor: getVehicleDefaultSecondaryColor(LEGACY_VEHICLE_ID),
          factoryPaint: true,
          frames: oldGhost.frames.map((frame) => ({ ...frame }))
        };
      }
    }
  } catch (_) {}
  return null;
}

function normalizeStoredLapPaint(lap, sourceVersion) {
  return normalizeStoredVehiclePaint({
    carId: lap?.carId || LEGACY_VEHICLE_ID,
    color: lap?.carColor,
    secondaryColor: lap?.carSecondaryColor,
    factoryPaint: lap?.factoryPaint
  }, {
    migrateReplacedFactoryPaint: sourceVersion < RIVAL_STORAGE_VERSION
  });
}

export function getStoredBestTime(trackId = DEFAULT_TRACK_ID) {
  return getStoredBestLap(trackId)?.time ?? Infinity;
}

export function syncPrimaryRivalState(state) {
  state.bestTime = state.competitorLaps[0]?.time ?? Infinity;
  state.ghostFrames = state.competitorLaps[0]?.frames ?? [];
  state.ghostVisible = state.competitorLaps.length > 0;
}

function isValidLap(lap) {
  return Number.isFinite(lap?.time)
    && Array.isArray(lap?.frames)
    && lap.frames.length > 20
    && !isSportsSedanEasterEgg({
      carId: lap?.carId,
      secondaryColor: lap?.carSecondaryColor
    });
}
