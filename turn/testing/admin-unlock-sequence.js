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

const INSTALL_FLAG = '__turnAdminUnlockSequenceInstalled';
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
const ADMIN_REWARD_PROFILE_VERSION = 2;
const FINAL_VEHICLE_ID = 'convertible';
const LEGACY_TIMESTAMP_TOLERANCE_MS = 5000;

function parseStoredState(storage) {
  try {
    const raw = storage?.getItem?.(ACHIEVEMENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function readLegacyAdminTimestamp(storage) {
  try {
    const raw = storage?.getItem?.(ADMIN_UNLOCK_MARKER);
    if (!raw) return null;

    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric;

    const marker = JSON.parse(raw);
    if (Number(marker?.version) >= ADMIN_REWARD_PROFILE_VERSION) return null;
    const timestamp = Number(marker?.activatedAt);
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch (_) {
    return null;
  }
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
    // The previous admin implementation overwrote these collections with all tracks.
    // Their earlier values cannot be recovered, so reset them rather than leaving
    // achievement progress falsely complete.
    snapshot.progress.tracks = [];
    snapshot.progress.blankTracks = [];
  }

  snapshot.rewards.unlocked = [...rewardIds];
  snapshot.rewards.seen = [...rewardIds];

  return Object.freeze({
    snapshot,
    repairedLegacyAdminState: removedLegacyAchievements
  });
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

export function unlockRewardsForTesting(storage = globalThis.localStorage) {
  const legacyAdminTimestamp = readLegacyAdminTimestamp(storage);
  const { snapshot, repairedLegacyAdminState } = createAdminRewardState(
    parseStoredState(storage),
    legacyAdminTimestamp
  );
  const marker = {
    version: ADMIN_REWARD_PROFILE_VERSION,
    activatedAt: Date.now(),
    rewardsOnly: true
  };

  try {
    storage?.setItem?.(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(snapshot));
    storage?.setItem?.(ADMIN_UNLOCK_MARKER, JSON.stringify(marker));
  } catch (_) {
    return false;
  }

  if (repairedLegacyAdminState) resetLegacyChallengeProgress(storage);
  copyStateIntoLiveStore(snapshot);
  if (globalThis.document?.documentElement) {
    globalThis.document.documentElement.dataset.turnAdminRewardsUnlocked = 'true';
  }
  console.info('TURN: hidden test rewards unlocked.');
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
  reload = () => globalThis.location?.reload?.()
} = {}) {
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
    if (!result.completed || !unlockRewardsForTesting(storage)) return;

    // The current Home and Lot were rendered from the pre-unlock snapshot. Stop this
    // race launch and reload once so every reward gate rebuilds from the test profile.
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
