import {
  ACHIEVEMENTS,
  TRACK_IDS,
  getAchievement
} from './catalog.js?revision=r153-trophy-road';
import {
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_STORAGE_KEY,
  TROPHY_ROAD_STORAGE_VERSION,
  getTrophyRoadReward,
  rewardIdsForTrophies
} from '../progression/trophy-road.js?revision=r153-trophy-road';

export const ACHIEVEMENT_STORAGE_KEY = TROPHY_ROAD_STORAGE_KEY;
const STORAGE_VERSION = TROPHY_ROAD_STORAGE_VERSION;

function defaultStoredState() {
  return {
    version: STORAGE_VERSION,
    unlocked: {},
    seen: [],
    progress: {
      tracks: [],
      blankTracks: []
    },
    rewards: {
      unlocked: [],
      seen: []
    }
  };
}

function normalizedStringArray(value, allowed = null) {
  if (!Array.isArray(value)) return [];
  const unique = [...new Set(value.filter((item) => typeof item === 'string'))];
  return allowed ? unique.filter((item) => allowed.includes(item)) : unique;
}

function totalTrophiesFromUnlocked(unlocked) {
  return Object.keys(unlocked).reduce((total, id) => {
    const trophies = Number(getAchievement(id)?.trophies);
    return total + (Number.isFinite(trophies) ? trophies : 0);
  }, 0);
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

  const tracks = normalizedStringArray(value.progress?.tracks, TRACK_IDS);
  const blankTracks = normalizedStringArray(value.progress?.blankTracks, TRACK_IDS);
  const existingTrustTrack = unlocked['trust-your-ears']?.trackId;
  if (TRACK_IDS.includes(existingTrustTrack) && !blankTracks.includes(existingTrustTrack)) {
    blankTracks.push(existingTrustTrack);
  }

  const rewardIds = TROPHY_ROAD_REWARDS.map((reward) => reward.id);
  const legacyProfile = Number(value.version || 0) < STORAGE_VERSION;
  const earnedRewardIds = rewardIdsForTrophies(totalTrophiesFromUnlocked(unlocked));
  const storedRewardIds = normalizedStringArray(value.rewards?.unlocked, rewardIds);
  const unlockedRewards = legacyProfile
    ? [...rewardIds]
    : [...new Set([...storedRewardIds, ...earnedRewardIds])];
  const storedSeenRewards = normalizedStringArray(value.rewards?.seen, rewardIds)
    .filter((id) => unlockedRewards.includes(id));
  const seenRewards = legacyProfile ? [...unlockedRewards] : storedSeenRewards;

  return {
    version: STORAGE_VERSION,
    unlocked,
    seen: normalizedStringArray(value.seen).filter((id) => Boolean(unlocked[id])),
    progress: {
      tracks,
      blankTracks
    },
    rewards: {
      unlocked: unlockedRewards,
      seen: seenRewards
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

  function trophyTotal() {
    return totalTrophiesFromUnlocked(state.unlocked);
  }

  function isRewardUnlocked(id) {
    return state.rewards.unlocked.includes(id);
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

  function syncRewards() {
    const newlyUnlocked = [];
    for (const rewardId of rewardIdsForTrophies(trophyTotal())) {
      if (isRewardUnlocked(rewardId)) continue;
      state.rewards.unlocked.push(rewardId);
      const reward = getTrophyRoadReward(rewardId);
      if (reward) newlyUnlocked.push(reward);
    }
    if (newlyUnlocked.length) save();
    return newlyUnlocked;
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
    state.rewards.seen = [...state.rewards.unlocked];
    save();
  }

  function unseenIds() {
    const seen = new Set(state.seen);
    return Object.keys(state.unlocked).filter((id) => !seen.has(id));
  }

  function unseenRewardIds() {
    const seen = new Set(state.rewards.seen);
    return state.rewards.unlocked.filter((id) => !seen.has(id));
  }

  function unseenCount() {
    return unseenIds().length + unseenRewardIds().length;
  }

  // Persist version and migration changes immediately, even when no new
  // achievement is unlocked during this session.
  save();

  return Object.freeze({
    state,
    isUnlocked,
    unlock,
    trophyTotal,
    isRewardUnlocked,
    syncRewards,
    addTrack,
    addBlankTrack,
    markAllSeen,
    unseenIds,
    unseenRewardIds,
    unseenCount,
    storageAvailable: () => storageAvailable
  });
}

export function totalAvailableTrophies() {
  return ACHIEVEMENTS.reduce((total, achievement) => total + achievement.trophies, 0);
}
