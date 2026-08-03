import {
  TRACK_IDS,
  getAchievement
} from './catalog.js?revision=r146-achievement-expansion';

export const ACHIEVEMENT_STORAGE_KEY = 'turn-achievements-v1';
const STORAGE_VERSION = 2;

function defaultStoredState() {
  return {
    version: STORAGE_VERSION,
    unlocked: {},
    seen: [],
    progress: {
      tracks: [],
      blankTracks: []
    }
  };
}

function normalizedStringArray(value, allowed = null) {
  if (!Array.isArray(value)) return [];
  const unique = [...new Set(value.filter((item) => typeof item === 'string'))];
  return allowed ? unique.filter((item) => allowed.includes(item)) : unique;
}

export function normalizeAchievementState(value) {
  if (!value || typeof value !== 'object') return defaultStoredState();

  const unlocked = {};
  for (const [id, record] of Object.entries(value.unlocked || {})) {
    if (!getAchievement(id) || !record || typeof record !== 'object') continue;
    unlocked[id] = {
      unlockedAt: Number.isFinite(Number(record.unlockedAt))
        ? Number(record.unlockedAt)
        : Date.now(),
      trackId: typeof record.trackId === 'string' ? record.trackId : '',
      vehicleId: typeof record.vehicleId === 'string' ? record.vehicleId : '',
      time: Number.isFinite(Number(record.time)) ? Number(record.time) : null
    };
  }

  return {
    version: STORAGE_VERSION,
    unlocked,
    seen: normalizedStringArray(value.seen).filter((id) => Boolean(unlocked[id])),
    progress: {
      tracks: normalizedStringArray(value.progress?.tracks, TRACK_IDS),
      blankTracks: normalizedStringArray(value.progress?.blankTracks, TRACK_IDS)
    }
  };
}

export function loadAchievementState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(ACHIEVEMENT_STORAGE_KEY);
    return {
      state: normalizeAchievementState(raw ? JSON.parse(raw) : null),
      storageAvailable: Boolean(storage)
    };
  } catch (_) {
    return { state: defaultStoredState(), storageAvailable: false };
  }
}

export function createAchievementStore(storage = globalThis.localStorage) {
  const loaded = loadAchievementState(storage);
  const state = loaded.state;
  let storageAvailable = loaded.storageAvailable;

  function save() {
    try {
      storage?.setItem?.(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      storageAvailable = false;
      return false;
    }
  }

  function isUnlocked(id) {
    return Boolean(state.unlocked[id]);
  }

  function unlock(id, context = {}) {
    const achievement = getAchievement(id);
    if (!achievement || isUnlocked(id)) return null;
    state.unlocked[id] = {
      unlockedAt: Date.now(),
      trackId: context.trackId || '',
      vehicleId: context.vehicleId || '',
      time: Number.isFinite(Number(context.time)) ? Number(context.time) : null
    };
    save();
    return achievement;
  }

  function addProgressTrack(key, trackId) {
    const collection = state.progress[key];
    if (!Array.isArray(collection) || !TRACK_IDS.includes(trackId) || collection.includes(trackId)) {
      return false;
    }
    collection.push(trackId);
    save();
    return true;
  }

  function addTrack(trackId) {
    return addProgressTrack('tracks', trackId);
  }

  function addBlankTrack(trackId) {
    return addProgressTrack('blankTracks', trackId);
  }

  function markAllSeen() {
    state.seen = Object.keys(state.unlocked);
    save();
  }

  function unseenIds() {
    const seen = new Set(state.seen);
    return Object.keys(state.unlocked).filter((id) => !seen.has(id));
  }

  return Object.freeze({
    state,
    isUnlocked,
    unlock,
    addTrack,
    addBlankTrack,
    markAllSeen,
    unseenIds,
    storageAvailable: () => storageAvailable
  });
}
