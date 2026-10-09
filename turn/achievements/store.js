import {
  ACHIEVEMENTS,
  TRACK_IDS,
  getAchievement
} from './catalog.js';
import {
  DRIVE_BY_EAR_PART_IDS,
  HOW_TO_PLAY_DISCLOSURE_IDS
} from './learning-progress.js?revision=r1-learning-achievements';
import {
  TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_STORAGE_KEY,
  TROPHY_ROAD_STORAGE_VERSION,
  getTrophyRoadReward,
  grandfatheredRewardIdsForVersion,
  legacyTrackIdsForState,
  migrateStoredRewardIdsForVersion,
  rewardIdsForTrophies
} from '../progression/trophy-road.js';
import { activeSessionPolicy } from '../race/session-policy.js';

export const ACHIEVEMENT_STORAGE_KEY = TROPHY_ROAD_STORAGE_KEY;
const STORAGE_VERSION = TROPHY_ROAD_STORAGE_VERSION;

function defaultStoredState() {
  return {
    version: STORAGE_VERSION,
    generation: 0,
    unlocked: {},
    bonuses: {},
    seen: [],
    progress: {
      tracks: [],
      blankTracks: [],
      driveByEarParts: [],
      howToPlayDisclosures: []
    },
    rewards: {
      unlocked: [],
      seen: [],
      grandfathered: [],
      tracks: []
    }
  };
}

function normalizedStringArray(value, allowed = null) {
  if (!Array.isArray(value)) return [];
  const unique = [...new Set(value.filter((item) => typeof item === 'string'))];
  return allowed ? unique.filter((item) => allowed.includes(item)) : unique;
}

function normalizedUnlockRecord(record) {
  if (!record || typeof record !== 'object') return null;
  return {
    unlockedAt: Number.isFinite(Number(record.unlockedAt))
      ? Number(record.unlockedAt)
      : Date.now(),
    trackId: typeof record.trackId === 'string' ? record.trackId : '',
    vehicleId: typeof record.vehicleId === 'string' ? record.vehicleId : '',
    time: Number.isFinite(Number(record.time)) ? Number(record.time) : null
  };
}

function normalizedBonusRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const trophies = Number(record.trophies);
  if (!Number.isFinite(trophies) || trophies <= 0) return null;
  return {
    trophies: Math.max(1, Math.round(trophies)),
    grantedAt: Number.isFinite(Number(record.grantedAt))
      ? Number(record.grantedAt)
      : Date.now(),
    trackId: typeof record.trackId === 'string' ? record.trackId : '',
    vehicleId: typeof record.vehicleId === 'string' ? record.vehicleId : '',
    reason: typeof record.reason === 'string' ? record.reason : ''
  };
}

function totalTrophiesFromUnlocked(unlocked) {
  return Object.keys(unlocked).reduce((total, id) => {
    const achievement = getAchievement(id);
    if (achievement?.calibrationPending === true) return total;
    const trophies = Number(achievement?.trophies);
    return total + (Number.isFinite(trophies) ? trophies : 0);
  }, 0);
}

function totalTrophiesFromBonuses(bonuses) {
  return Object.values(bonuses || {}).reduce((total, record) => {
    const trophies = Number(record?.trophies);
    return total + (Number.isFinite(trophies) && trophies > 0 ? trophies : 0);
  }, 0);
}

function totalTrophies(unlocked, bonuses) {
  return totalTrophiesFromUnlocked(unlocked) + totalTrophiesFromBonuses(bonuses);
}

function knownUnlockedIds(unlocked) {
  return Object.keys(unlocked).filter((id) => Boolean(getAchievement(id)));
}

export function normalizeAchievementState(value) {
  if (!value || typeof value !== 'object') return defaultStoredState();

  const unlocked = {};
  for (const [id, record] of Object.entries(value.unlocked || {})) {
    const normalized = normalizedUnlockRecord(record);
    if (!normalized) continue;

    // Preserve syntactically valid unlock records even when the current catalog
    // does not recognize the id. Unknown records contribute zero trophies and
    // stay invisible, but survive temporary catalog regressions and can become
    // active again if a later production catalog restores the achievement.
    unlocked[id] = normalized;
  }

  const bonuses = {};
  for (const [id, record] of Object.entries(value.bonuses || {})) {
    if (typeof id !== 'string' || !id) continue;
    const normalized = normalizedBonusRecord(record);
    if (normalized) bonuses[id] = normalized;
  }

  const tracks = normalizedStringArray(value.progress?.tracks, TRACK_IDS);
  const blankTracks = normalizedStringArray(value.progress?.blankTracks, TRACK_IDS);
  const driveByEarParts = normalizedStringArray(
    value.progress?.driveByEarParts,
    DRIVE_BY_EAR_PART_IDS
  );
  const howToPlayDisclosures = normalizedStringArray(
    value.progress?.howToPlayDisclosures,
    HOW_TO_PLAY_DISCLOSURE_IDS
  );
  const existingTrustTrack = unlocked['trust-your-ears']?.trackId;
  if (TRACK_IDS.includes(existingTrustTrack) && !blankTracks.includes(existingTrustTrack)) {
    blankTracks.push(existingTrustTrack);
  }

  const sourceVersion = Number(value.version || 0);
  const rewardIds = TROPHY_ROAD_REWARDS.map((reward) => reward.id);
  const earnedRewardIds = rewardIdsForTrophies(totalTrophies(unlocked, bonuses));
  const storedRewardIds = migrateStoredRewardIdsForVersion(
    normalizedStringArray(value.rewards?.unlocked),
    sourceVersion
  );
  // Per-track access carried over from before the difficulty tiers (see trophy-road.js).
  const legacyTrackIds = legacyTrackIdsForState(value, totalTrophies(unlocked, bonuses));
  const migratedRewardIds = grandfatheredRewardIdsForVersion(sourceVersion);
  const storedGrandfatheredIds = normalizedStringArray(
    value.rewards?.grandfathered,
    rewardIds
  );
  const earnedRewardIdSet = new Set(earnedRewardIds);
  const migrationGrandfatheredIds = sourceVersion > 0 && sourceVersion < STORAGE_VERSION
    ? [...storedRewardIds, ...migratedRewardIds].filter((id) => !earnedRewardIdSet.has(id))
    : [];
  const grandfatheredRewardIds = [...new Set([
    ...storedGrandfatheredIds,
    ...migrationGrandfatheredIds
  ])];
  const unlockedRewards = [...new Set([
    ...storedRewardIds,
    ...earnedRewardIds,
    ...migratedRewardIds,
    ...grandfatheredRewardIds
  ])];
  const storedSeenRewards = normalizedStringArray(value.rewards?.seen, rewardIds)
    .filter((id) => unlockedRewards.includes(id));
  const seenRewards = [...new Set([...storedSeenRewards, ...migratedRewardIds])];

  const generation = Number(value.generation);

  return {
    version: STORAGE_VERSION,
    generation: Number.isInteger(generation) && generation > 0 ? generation : 0,
    unlocked,
    bonuses,
    seen: normalizedStringArray(value.seen).filter((id) => Boolean(unlocked[id])),
    progress: {
      tracks,
      blankTracks,
      driveByEarParts,
      howToPlayDisclosures
    },
    rewards: {
      unlocked: unlockedRewards,
      seen: seenRewards,
      grandfathered: grandfatheredRewardIds,
      tracks: legacyTrackIds
    }
  };
}

const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];

function earlierRecords(target, source, stamp) {
  let changed = false;
  for (const [id, record] of Object.entries(source)) {
    const current = target[id];
    if (current && !(record[stamp] < current[stamp])) continue;
    target[id] = { ...record };
    changed = true;
  }
  return changed;
}

function mergeList(owner, key, source) {
  const merged = union(owner[key], source);
  if (merged.length === (owner[key] || []).length) return false;
  owner[key] = merged;
  return true;
}

// Several TURN windows can share this storage, each holding its own copy. A save
// merges the stored copy first, so one window never erases progress another has
// saved: achievements, bonuses, progress and rewards only accumulate, keeping the
// earliest unlock. A deliberate rewrite (the admin profile) raises `generation`;
// a copy from an older generation adopts the stored one instead of merging.
// Returns true when `target` changed.
export function mergeAchievementState(target, source) {
  if (!source) return false;
  if (source.generation < target.generation) return false;
  if (source.generation > target.generation) {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, JSON.parse(JSON.stringify(source)));
    return true;
  }
  let changed = earlierRecords(target.unlocked, source.unlocked, 'unlockedAt');
  changed = earlierRecords(target.bonuses, source.bonuses, 'grantedAt') || changed;
  changed = mergeList(target, 'seen', source.seen) || changed;
  for (const key of Object.keys(source.progress)) {
    changed = mergeList(target.progress, key, source.progress[key]) || changed;
  }
  for (const key of ['unlocked', 'seen', 'grandfathered', 'tracks']) {
    changed = mergeList(target.rewards, key, source.rewards[key]) || changed;
  }
  return changed;
}

function readStoredState(storage) {
  try {
    const raw = storage?.getItem?.(ACHIEVEMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const stored = normalizeAchievementState(parsed);
    // Only rewards actually stored merge in. Normalising also lists every reward the
    // trophy total has reached, and taking those here would claim a reward before this
    // window's syncRewards() announces it.
    const kept = new Set([...normalizedStringArray(parsed?.rewards?.unlocked), ...stored.rewards.grandfathered]);
    stored.rewards.unlocked = stored.rewards.unlocked.filter((id) => kept.has(id));
    return stored;
  } catch (_) {
    // Unreadable: this copy stands.
    return null;
  }
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
  let batchDepth = 0;
  let savePending = false;

  function save() {
    mergeAchievementState(state, readStoredState(storage));
    try {
      storage?.setItem?.(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      storageAvailable = false;
      return false;
    }
  }

  function requestSave() {
    if (batchDepth > 0) {
      savePending = true;
      return true;
    }
    return save();
  }

  function batch(callback) {
    batchDepth += 1;
    try {
      return callback();
    } finally {
      batchDepth -= 1;
      if (batchDepth === 0 && savePending) {
        savePending = false;
        requestSave();
      }
    }
  }

  function isUnlocked(id) {
    const achievement = getAchievement(id);
    return Boolean(achievement && achievement.calibrationPending !== true && state.unlocked[id]);
  }

  function trophyTotal() {
    return totalTrophies(state.unlocked, state.bonuses);
  }

  function isRewardUnlocked(id) {
    return state.rewards.unlocked.includes(id);
  }

  function hasLegacyTrack(trackId) {
    return Array.isArray(state.rewards.tracks) && state.rewards.tracks.includes(trackId);
  }

  function hasBonus(id) {
    return Boolean(typeof id === 'string' && id && state.bonuses[id]);
  }

  function unlock(id, context = {}) {
    // A trial session (reward preview, tutorial teaching lap) unlocks nothing. Bonuses
    // such as a challenge's own reward are granted separately and still land.
    if (!activeSessionPolicy().achievements) return null;
    const achievement = getAchievement(id);
    if (!achievement || achievement.calibrationPending === true || isUnlocked(id)) return null;
    state.unlocked[id] = {
      unlockedAt: Date.now(),
      trackId: context.trackId || '',
      vehicleId: context.vehicleId || '',
      time: Number.isFinite(Number(context.time)) ? Number(context.time) : null
    };
    requestSave();
    return achievement;
  }

  function grantBonus(id, trophies, context = {}) {
    const normalizedId = typeof id === 'string' ? id.trim() : '';
    const normalizedTrophies = Math.round(Number(trophies));
    if (!normalizedId || !Number.isFinite(normalizedTrophies) || normalizedTrophies <= 0 || hasBonus(normalizedId)) {
      return null;
    }
    const bonus = {
      trophies: normalizedTrophies,
      grantedAt: Date.now(),
      trackId: typeof context.trackId === 'string' ? context.trackId : '',
      vehicleId: typeof context.vehicleId === 'string' ? context.vehicleId : '',
      reason: typeof context.reason === 'string' ? context.reason : ''
    };
    state.bonuses[normalizedId] = bonus;
    requestSave();
    return Object.freeze({ id: normalizedId, ...bonus });
  }

  function syncRewards() {
    const newlyUnlocked = [];
    for (const rewardId of rewardIdsForTrophies(trophyTotal())) {
      if (isRewardUnlocked(rewardId)) continue;
      state.rewards.unlocked.push(rewardId);
      const reward = getTrophyRoadReward(rewardId);
      if (reward) newlyUnlocked.push(reward);
    }
    if (newlyUnlocked.length) requestSave();
    return newlyUnlocked;
  }

  function addProgressTrack(key, trackId) {
    if (!activeSessionPolicy().progress) return false;
    const collection = state.progress[key];
    if (!Array.isArray(collection) || !TRACK_IDS.includes(trackId) || collection.includes(trackId)) {
      return false;
    }
    collection.push(trackId);
    requestSave();
    return true;
  }

  function addTrack(trackId) {
    return addProgressTrack('tracks', trackId);
  }

  function addBlankTrack(trackId) {
    return addProgressTrack('blankTracks', trackId);
  }

  function addProgressItem(key, id, allowedIds) {
    const collection = state.progress[key];
    if (!Array.isArray(collection) || !allowedIds.includes(id) || collection.includes(id)) {
      return false;
    }
    collection.push(id);
    requestSave();
    return true;
  }

  function addDriveByEarPart(partId) {
    return addProgressItem('driveByEarParts', partId, DRIVE_BY_EAR_PART_IDS);
  }

  function addHowToPlayDisclosure(disclosureId) {
    return addProgressItem(
      'howToPlayDisclosures',
      disclosureId,
      HOW_TO_PLAY_DISCLOSURE_IDS
    );
  }

  function markAllSeen() {
    state.seen = [...new Set([...state.seen, ...knownUnlockedIds(state.unlocked)])];
    state.rewards.seen = [...state.rewards.unlocked];
    requestSave();
  }

  function unseenIds() {
    const seen = new Set(state.seen);
    return knownUnlockedIds(state.unlocked).filter((id) => !seen.has(id));
  }

  function unseenRewardIds() {
    const seen = new Set(state.rewards.seen);
    return state.rewards.unlocked.filter((id) => !seen.has(id));
  }

  function unseenCount() {
    return unseenIds().length + unseenRewardIds().length;
  }

  save();

  // Another window saved: take in what it earned, so this one shows it and keeps it.
  // Two saves at the same moment can each miss the other's progress; whichever window
  // still holds something the stored copy lacks writes it back, so both end up whole.
  if (storage && storage === globalThis.localStorage) {
    globalThis.addEventListener?.('storage', (event) => {
      if (event.key !== ACHIEVEMENT_STORAGE_KEY) return;
      const stored = readStoredState(storage);
      if (!stored) return;
      mergeAchievementState(state, stored);
      if (mergeAchievementState(JSON.parse(JSON.stringify(stored)), state)) save();
    });
  }

  return Object.freeze({
    state,
    batch,
    isUnlocked,
    unlock,
    grantBonus,
    hasBonus,
    trophyTotal,
    isRewardUnlocked,
    hasLegacyTrack,
    syncRewards,
    addTrack,
    addBlankTrack,
    addDriveByEarPart,
    addHowToPlayDisclosure,
    markAllSeen,
    unseenIds,
    unseenRewardIds,
    unseenCount,
    storageAvailable: () => storageAvailable
  });
}

export function totalAvailableTrophies() {
  return ACHIEVEMENTS.reduce((total, achievement) => (
    achievement.calibrationPending === true
      ? total
      : total + achievement.trophies
  ), 0);
}
