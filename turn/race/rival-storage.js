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

function rivalSavePayload(state, trackId) {
  const activeTrackId = stateTrackId(state, trackId);
  return {
    key: rivalKey(activeTrackId),
    value: {
      version: RIVAL_STORAGE_VERSION,
      trackId: activeTrackId,
      trackRevision: storageTrackId(activeTrackId),
      laps: state.competitorLaps.filter(isValidLap)
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
    return state.competitorLaps;
  } catch (_) {
    state.trackId = activeTrackId;
    state.competitorLaps = [];
    syncPrimaryRivalState(state);
    return state.competitorLaps;
  }
}

export function clearRivalsState(state, { trackId } = {}) {
  const activeTrackId = stateTrackId(state, trackId);
  state.trackId = activeTrackId;
  state.competitorLaps = [];
  syncPrimaryRivalState(state);

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
    }
  } catch (_) {}

  state.trackId = activeTrackId;
  state.competitorLaps = [];
  syncPrimaryRivalState(state);
  return normalizedTrackIds.length;
}

export function getStoredBestLap(trackId = DEFAULT_TRACK_ID) {
  const bestReplay = getStoredBestReplayLap(trackId);
  if (bestReplay) {
    const summary = {
      time: bestReplay.time,
      carId: bestReplay.carId
    };
    if (bestReplay.carColor) summary.carColor = bestReplay.carColor;
    if (bestReplay.carSecondaryColor) summary.carSecondaryColor = bestReplay.carSecondaryColor;
    return summary;
  }

  // Preserve the historical summary-only fallback. Very old Countryside saves
  // can contain a best time without enough replay frames to share as YOUR TURN;
  // Home should still display that record even though no share button is offered.
  const activeTrackId = normalizeTrackId(trackId);
  if (activeTrackId === DEFAULT_TRACK_ID) {
    try {
      const oldGhost = JSON.parse(localStorage.getItem(ghostKey(activeTrackId)));
      const legacyTime = Number(oldGhost?.bestTime);
      if (Number.isFinite(legacyTime)) {
        return {
          time: legacyTime,
          carId: LEGACY_VEHICLE_ID
        };
      }
    } catch (_) {}
  }
  return null;
}

export function getStoredBestReplayLap(trackId = DEFAULT_TRACK_ID) {
  const activeTrackId = normalizeTrackId(trackId);
  try {
    const savedRivals = JSON.parse(localStorage.getItem(rivalKey(activeTrackId)));
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
