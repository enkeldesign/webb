import {
  ACHIEVEMENT_STORAGE_KEY,
  normalizeAchievementState
} from '../achievements/store.js?revision=r243-mountain-1300';
import {
  TROPHY_ROAD_REWARDS
} from '../progression/trophy-road.js';
import {
  CHALLENGE_PROGRESS_STORAGE_KEY
} from '../achievements/challenge-expansion-r166.js?revision=r166-bella-records';
import {
  markDeveloperDevice
} from '../telemetry/client.js?revision=r4-offline-hold';

// Home only, on controls every fresh profile can use: COUNTRYSIDE, CLIFFSIDE twice,
// TRACK SHEET four times, then GIVE FEEDBACK reloads into the test profile. The
// repetition keeps ordinary exploration from completing it; any other Home button
// resets it. Closing the Track sheet between taps is navigation, not a step.
export const ADMIN_UNLOCK_SEQUENCE = Object.freeze([
  'track:countryside',
  'track:cliffside',
  'track:countryside',
  'track:cliffside',
  'action:records',
  'action:records',
  'action:records',
  'action:records',
  'action:feedback'
]);

const INSTALL_FLAG = '__turnAdminUnlockSequenceInstalled';
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
const ADMIN_REWARD_PROFILE_VERSION = 2;
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
  snapshot.rewards.grandfathered = [];

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
    seen: [...snapshot.rewards.seen],
    grandfathered: [...(snapshot.rewards.grandfathered || [])],
    tracks: [...(snapshot.rewards.tracks || [])]
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
    if (!markDeveloperDevice(storage)) return false;
  } catch (_) {
    return false;
  }

  if (repairedLegacyAdminState) resetLegacyChallengeProgress(storage);
  copyStateIntoLiveStore(snapshot);
  if (globalThis.document?.documentElement) {
    globalThis.document.documentElement.dataset.turnAdminRewardsUnlocked = 'true';
    globalThis.document.documentElement.dataset.turnDeveloperDevice = 'true';
  }
  console.info('TURN: hidden test rewards unlocked; this browser is marked as a developer/tester.');
  return true;
}

const FEEDBACK_TRIGGER = '.m8-home-menu .m8-feedback-button:not(.m8-achievements-button):not(.turn-dbe-training-home)';

function homeTokenFromClick(target) {
  const track = target.closest('.roadbook-card[data-track-id]');
  if (track) return `track:${track.dataset.trackId || ''}`;
  // The Track sheet button, or on spacious iPads the overview's route that replaces it.
  if (target.closest('.roadbook-sheet-button, .roadbook-overview .turn-pr-detail-route')) return 'action:records';
  if (target.closest(FEEDBACK_TRIGGER)) return 'action:feedback';
  if (target.closest('.m8-track-continue')) return 'action:race';
  // Opening or closing the menu sheet is navigation, not a step: GIVE FEEDBACK lives
  // inside it.
  if (target.closest('.turn-home-menu-button, .turn-home-sheet-close, .roadbook-sheet .turn-pr-close')) return '';
  // Any other Home control breaks a partial sequence.
  if (target.closest('.m8-home button, .m8-home a')) return 'action:other';
  return '';
}

export function installAdminUnlockSequence({
  documentRef = globalThis.document,
  storage = globalThis.localStorage,
  reload = () => globalThis.location?.reload?.()
} = {}) {
  if (!documentRef?.addEventListener) return null;
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];

  let sequenceIndex = 0;

  const handleClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const token = homeTokenFromClick(target);
    if (!token) return;
    const result = advanceAdminUnlockSequence(sequenceIndex, token);
    sequenceIndex = result.nextIndex;
    if (!result.completed || !unlockRewardsForTesting(storage)) return;

    // Home was rendered from the pre-unlock snapshot. Skip the feedback dialog and
    // reload once so every reward gate rebuilds from the test profile.
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
