import {
  ACHIEVEMENT_STORAGE_KEY,
  normalizeAchievementState
} from '../achievements/store.js?revision=r166-bella-records';
import {
  TROPHY_ROAD_REWARDS
} from '../progression/trophy-road.js?revision=r166-bella-records';
import {
  CHALLENGE_PROGRESS_STORAGE_KEY
} from '../achievements/challenge-expansion-r166.js?revision=r166-bella-records';

export const ADMIN_UNLOCK_SEQUENCE = Object.freeze([
  'track:countryside',
  'track:airport',
  'track:countryside',
  'track:airport',
  'track:cliffside',
  'track:countryside',
  'track:airport',
  'track:cliffside',
  'track:harbor',
  'action:race',
  'vehicle:convertible',
  'action:race-this-car'
]);

export const ADMIN_SESSION_KEY = 'turn-admin-unlock-session-v1';
const INSTALL_FLAG = '__turnAdminUnlockSequenceInstalled';
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
const ADMIN_REWARD_PROFILE_VERSION = 3;
const FINAL_VEHICLE_ID = 'convertible';
const LEGACY_TIMESTAMP_TOLERANCE_MS = 5000;

function safeGet(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch (_) {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem?.(key, String(value));
    return true;
  } catch (_) {
    return false;
  }
}

function safeRemove(storage, key) {
  try {
    storage?.removeItem?.(key);
    return true;
  } catch (_) {
    return false;
  }
}

function parseStoredState(storage) {
  try {
    const raw = safeGet(storage, ACHIEVEMENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function parseAdminMarker(storage) {
  const raw = safeGet(storage, ADMIN_UNLOCK_MARKER);
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return Object.freeze({ version: 1, activatedAt: numeric, rewardsOnly: false });
  }

  try {
    const marker = JSON.parse(raw);
    return marker && typeof marker === 'object' ? marker : null;
  } catch (_) {
    return null;
  }
}

function activeAdminSession(sessionStore) {
  return safeGet(sessionStore, ADMIN_SESSION_KEY) === '1';
}

function readLegacyAdminTimestamp(marker) {
  if (!marker || Number(marker.version) >= 2) return null;
  const timestamp = Number(marker.activatedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isLegacyAdminAchievementRecord(record, legacyAdminTimestamp) {
  if (!Number.isFinite(Number(legacyAdminTimestamp))) return false;
  const unlockedAt = Number(record?.unlockedAt);
  const time = record?.time;
  return Number.isFinite(unlockedAt)
    && Math.abs(unlockedAt - Number(legacyAdminTimestamp)) <= LEGACY_TIMESTAMP_TOLERANCE_MS
    && record?.trackId === ''
    && record?.vehicleId === ''
    && (time == null || Number(time) === 0);
}

export function createAdminRewardState(existing, legacyAdminTimestamp = null) {
  const snapshot = normalizeAchievementState(existing);
  const rewardIds = TROPHY_ROAD_REWARDS.map((reward) => reward.id);
  let removedLegacyAchievements = false;

  for (const [achievementId, record] of Object.entries(snapshot.unlocked)) {
    if (!isLegacyAdminAchievementRecord(record, legacyAdminTimestamp)) continue;
    delete snapshot.unlocked[achievementId];
    removedLegacyAchievements = true;
  }

  if (removedLegacyAchievements) {
    snapshot.seen = snapshot.seen.filter((achievementId) => Boolean(snapshot.unlocked[achievementId]));
    // The first admin implementation overwrote these collections with all tracks.
    // Their earlier values cannot be recovered, so reset them rather than leaving
    // achievement progress falsely complete.
    snapshot.progress.tracks = [];
    snapshot.progress.blankTracks = [];
  }

  // This snapshot is temporary. unlockRewardsForTesting() always stores an exact
  // pre-admin backup before this all-rewards view is written to the canonical key.
  snapshot.rewards.unlocked = [...rewardIds];
  snapshot.rewards.seen = [...rewardIds];

  return Object.freeze({
    snapshot,
    repairedLegacyAdminState: removedLegacyAchievements
  });
}

function createRepairedPersistentState(existing, legacyAdminTimestamp = null) {
  const normalized = normalizeAchievementState(existing);
  let removedLegacyAchievements = false;

  for (const [achievementId, record] of Object.entries(normalized.unlocked)) {
    if (!isLegacyAdminAchievementRecord(record, legacyAdminTimestamp)) continue;
    delete normalized.unlocked[achievementId];
    removedLegacyAchievements = true;
  }

  if (removedLegacyAchievements) {
    normalized.seen = normalized.seen.filter((achievementId) => Boolean(normalized.unlocked[achievementId]));
    normalized.progress.tracks = [];
    normalized.progress.blankTracks = [];
  }

  const previouslySeenRewards = new Set(
    Array.isArray(existing?.rewards?.seen) ? existing.rewards.seen : []
  );

  // Version 2 of the hidden sequence permanently wrote every reward id into
  // rewards.unlocked. Re-normalize with that contaminated list removed so the store
  // derives only rewards actually earned from genuine achievement trophies.
  const repaired = normalizeAchievementState({
    ...normalized,
    rewards: { unlocked: [], seen: [] }
  });
  repaired.rewards.seen = repaired.rewards.unlocked.filter((rewardId) => previouslySeenRewards.has(rewardId));

  return Object.freeze({
    snapshot: repaired,
    repairedLegacyAdminState: removedLegacyAchievements
  });
}

export function repairPersistedAdminState(
  storage = globalThis.localStorage,
  sessionStore = globalThis.sessionStorage
) {
  const marker = parseAdminMarker(storage);
  if (!marker) return Object.freeze({ repaired: false, activeSession: false });

  if (Number(marker.version) >= ADMIN_REWARD_PROFILE_VERSION && marker.sessionOnly === true) {
    if (activeAdminSession(sessionStore)) {
      return Object.freeze({ repaired: false, activeSession: true });
    }

    const restored = marker.backup == null
      ? safeRemove(storage, ACHIEVEMENT_STORAGE_KEY)
      : safeSet(storage, ACHIEVEMENT_STORAGE_KEY, marker.backup);
    if (!restored) return Object.freeze({ repaired: false, activeSession: false });
    safeRemove(storage, ADMIN_UNLOCK_MARKER);
    return Object.freeze({ repaired: true, activeSession: false });
  }

  // Repair profiles polluted by either historical admin implementation. Version 1
  // fabricated achievement records as well as rewards; version 2 stopped fabricating
  // achievements but still made every reward permanent. Preserve genuine achievements
  // and let their trophy total derive the legitimate reward set again.
  const existing = parseStoredState(storage);
  const legacyAdminTimestamp = readLegacyAdminTimestamp(marker);
  const { snapshot, repairedLegacyAdminState } = createRepairedPersistentState(
    existing,
    legacyAdminTimestamp
  );
  if (!safeSet(storage, ACHIEVEMENT_STORAGE_KEY, JSON.stringify(snapshot))) {
    return Object.freeze({ repaired: false, activeSession: false });
  }
  if (repairedLegacyAdminState) resetLegacyChallengeProgress(storage);
  safeRemove(storage, ADMIN_UNLOCK_MARKER);
  safeRemove(sessionStore, ADMIN_SESSION_KEY);
  return Object.freeze({ repaired: true, activeSession: false });
}

export function advanceAdminUnlockSequence(currentIndex, token) {
  const index = Number.isInteger(currentIndex) && currentIndex >= 0
    ? currentIndex
    : 0;
  if (token === ADMIN_UNLOCK_SEQUENCE[index]) {
    const nextIndex = index + 1;
    return Object.freeze({
      nextIndex: nextIndex === ADMIN_UNLOCK_SEQUENCE.length ? 0 : nextIndex,
      completed: nextIndex === ADMIN_UNLOCK_SEQUENCE.length
    });
  }

  return Object.freeze({
    nextIndex: token === ADMIN_UNLOCK_SEQUENCE[0] ? 1 : 0,
    completed: false
  });
}

export function completeAdminUnlockFromLot(currentIndex, selectedVehicleId) {
  if (selectedVehicleId !== FINAL_VEHICLE_ID) {
    return Object.freeze({ nextIndex: 0, completed: false });
  }

  let index = currentIndex;
  if (ADMIN_UNLOCK_SEQUENCE[index] === `vehicle:${FINAL_VEHICLE_ID}`) {
    index = advanceAdminUnlockSequence(index, `vehicle:${FINAL_VEHICLE_ID}`).nextIndex;
  }
  return advanceAdminUnlockSequence(index, 'action:race-this-car');
}

function copyStateIntoLiveStore(snapshot) {
  const liveState = globalThis.__turnAchievements?.store?.state;
  if (!liveState) return;
  liveState.version = snapshot.version;
  liveState.unlocked = { ...snapshot.unlocked };
  liveState.seen = [...snapshot.seen];
  liveState.progress = {
    tracks: [...snapshot.progress.tracks],
    blankTracks: [...snapshot.progress.blankTracks]
  };
  liveState.rewards = {
    unlocked: [...snapshot.rewards.unlocked],
    seen: [...snapshot.rewards.seen]
  };
}

function resetLegacyChallengeProgress(storage) {
  const progress = { armyTracks: [], cleanTracks: [] };
  try {
    storage?.setItem?.(CHALLENGE_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (_) {
    return false;
  }

  const liveProgress = globalThis.__turnAchievementChallengeExpansion?.progress;
  if (liveProgress) {
    liveProgress.armyTracks = [];
    liveProgress.cleanTracks = [];
  }
  return true;
}

export function unlockRewardsForTesting(
  storage = globalThis.localStorage,
  sessionStore = globalThis.sessionStorage
) {
  const existingMarker = parseAdminMarker(storage);
  if (
    Number(existingMarker?.version) >= ADMIN_REWARD_PROFILE_VERSION
    && existingMarker?.sessionOnly === true
    && activeAdminSession(sessionStore)
  ) {
    return true;
  }

  const backup = safeGet(storage, ACHIEVEMENT_STORAGE_KEY);
  const { snapshot } = createAdminRewardState(parseStoredState(storage));
  const marker = {
    version: ADMIN_REWARD_PROFILE_VERSION,
    activatedAt: Date.now(),
    rewardsOnly: true,
    sessionOnly: true,
    backup
  };

  if (!safeSet(sessionStore, ADMIN_SESSION_KEY, '1')) return false;
  if (!safeSet(storage, ADMIN_UNLOCK_MARKER, JSON.stringify(marker))) {
    safeRemove(sessionStore, ADMIN_SESSION_KEY);
    return false;
  }
  if (!safeSet(storage, ACHIEVEMENT_STORAGE_KEY, JSON.stringify(snapshot))) {
    if (backup == null) safeRemove(storage, ACHIEVEMENT_STORAGE_KEY);
    else safeSet(storage, ACHIEVEMENT_STORAGE_KEY, backup);
    safeRemove(storage, ADMIN_UNLOCK_MARKER);
    safeRemove(sessionStore, ADMIN_SESSION_KEY);
    return false;
  }

  copyStateIntoLiveStore(snapshot);
  if (globalThis.document?.documentElement) {
    globalThis.document.documentElement.dataset.turnAdminRewardsUnlocked = 'true';
  }
  console.info('TURN: hidden test rewards unlocked for this session.');
  return true;
}

function homeTokenFromClick(target) {
  const track = target.closest('.track-card[data-track-id]:not([disabled])');
  if (track) return `track:${track.dataset.trackId || ''}`;
  if (target.closest('.m8-track-continue')) return 'action:race';
  return '';
}

function selectedVehicleFromLot(lotScreen, rememberedVehicleId = '') {
  if (rememberedVehicleId) return rememberedVehicleId;
  return lotScreen
    ?.querySelector('.lot-car-option[data-car-id][aria-checked="true"]')
    ?.dataset.carId || '';
}

export function installAdminUnlockSequence({
  documentRef = globalThis.document,
  storage = globalThis.localStorage,
  sessionStore = globalThis.sessionStorage,
  reload = () => globalThis.location?.reload?.()
} = {}) {
  const repair = repairPersistedAdminState(storage, sessionStore);
  if (repair.activeSession && documentRef?.documentElement) {
    documentRef.documentElement.dataset.turnAdminRewardsUnlocked = 'true';
  }

  if (!documentRef?.addEventListener) return null;
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];

  let sequenceIndex = 0;
  let lotArmed = false;
  let rememberedVehicleId = '';

  function resetSequence() {
    sequenceIndex = 0;
    lotArmed = false;
    rememberedVehicleId = '';
  }

  const handleClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const homeToken = homeTokenFromClick(target);
    if (homeToken) {
      const result = advanceAdminUnlockSequence(sequenceIndex, homeToken);
      sequenceIndex = result.nextIndex;
      lotArmed = homeToken === 'action:race'
        && ADMIN_UNLOCK_SEQUENCE[sequenceIndex] === `vehicle:${FINAL_VEHICLE_ID}`;
      if (!lotArmed) rememberedVehicleId = '';
      return;
    }

    if (!lotArmed) return;
    const lotScreen = target.closest('.lot-screen');
    if (!lotScreen) return;

    const vehicle = target.closest('.lot-car-option[data-car-id]');
    if (vehicle) {
      rememberedVehicleId = vehicle.dataset.carId || '';
      if (rememberedVehicleId === FINAL_VEHICLE_ID
          && ADMIN_UNLOCK_SEQUENCE[sequenceIndex] === `vehicle:${FINAL_VEHICLE_ID}`) {
        sequenceIndex = advanceAdminUnlockSequence(
          sequenceIndex,
          `vehicle:${FINAL_VEHICLE_ID}`
        ).nextIndex;
      }
      return;
    }

    if (target.closest('.lot-back')) {
      resetSequence();
      return;
    }

    if (!target.closest('.lot-race')) return;
    const selectedVehicleId = selectedVehicleFromLot(lotScreen, rememberedVehicleId);
    const result = completeAdminUnlockFromLot(sequenceIndex, selectedVehicleId);
    resetSequence();
    if (!result.completed || !unlockRewardsForTesting(storage, sessionStore)) return;

    // The current Home and Lot were rendered from the pre-unlock snapshot. Stop this
    // race launch and reload once so every reward gate rebuilds from the temporary
    // session profile. A later fresh browser/PWA session restores the exact backup.
    event.preventDefault();
    event.stopImmediatePropagation();
    globalThis.setTimeout?.(reload, 0);
  };

  documentRef.addEventListener('click', handleClick, true);
  const api = Object.freeze({
    sequence: ADMIN_UNLOCK_SEQUENCE,
    disconnect() {
      documentRef.removeEventListener('click', handleClick, true);
      delete globalThis[INSTALL_FLAG];
    }
  });
  globalThis[INSTALL_FLAG] = api;
  return api;
}

installAdminUnlockSequence();
