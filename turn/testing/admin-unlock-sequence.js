import {
  ACHIEVEMENTS,
  TRACK_IDS
} from '../achievements/catalog.js?revision=r166-bella-records';
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
  'vehicle:race',
  'vehicle:convertible',
  'action:race-this-car'
]);

const INSTALL_FLAG = '__turnAdminUnlockSequenceInstalled';
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';

function parseStoredState(storage) {
  try {
    const raw = storage?.getItem?.(ACHIEVEMENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function createAdminUnlockedState(existing, timestamp = Date.now()) {
  const state = normalizeAchievementState(existing);
  const achievementIds = ACHIEVEMENTS.map((achievement) => achievement.id);
  const rewardIds = TROPHY_ROAD_REWARDS.map((reward) => reward.id);

  for (const achievementId of achievementIds) {
    if (state.unlocked[achievementId]) continue;
    state.unlocked[achievementId] = {
      unlockedAt: timestamp,
      trackId: '',
      vehicleId: '',
      time: null
    };
  }

  state.seen = [...achievementIds];
  state.progress.tracks = [...TRACK_IDS];
  state.progress.blankTracks = [...TRACK_IDS];
  state.rewards.unlocked = [...rewardIds];
  state.rewards.seen = [...rewardIds];
  return state;
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
    seen: [...snapshot.rewards.seen]
  };
}

function copyChallengeProgressIntoLiveRuntime(progress) {
  const liveProgress = globalThis.__turnAchievementChallengeExpansion?.progress;
  if (!liveProgress) return;
  liveProgress.armyTracks = [...progress.armyTracks];
  liveProgress.cleanTracks = [...progress.cleanTracks];
}

export function unlockEverythingForTesting(storage = globalThis.localStorage) {
  const snapshot = createAdminUnlockedState(parseStoredState(storage));
  const challengeProgress = {
    armyTracks: [...TRACK_IDS],
    cleanTracks: [...TRACK_IDS]
  };

  try {
    storage?.setItem?.(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(snapshot));
    storage?.setItem?.(CHALLENGE_PROGRESS_STORAGE_KEY, JSON.stringify(challengeProgress));
    storage?.setItem?.(ADMIN_UNLOCK_MARKER, String(Date.now()));
  } catch (_) {
    return false;
  }

  copyStateIntoLiveStore(snapshot);
  copyChallengeProgressIntoLiveRuntime(challengeProgress);
  document.documentElement.dataset.turnAdminUnlocked = 'true';
  console.info('TURN: hidden test profile unlocked.');
  return true;
}

function tokenFromClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return '';

  const track = target.closest('.track-card[data-track-id]:not([disabled])');
  if (track) return `track:${track.dataset.trackId || ''}`;

  const vehicle = target.closest('.lot-car-option[data-car-id]');
  if (vehicle) return `vehicle:${vehicle.dataset.carId || ''}`;

  if (target.closest('.lot-race')) return 'action:race-this-car';
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
    const token = tokenFromClick(event);
    if (!token) return;

    const result = advanceAdminUnlockSequence(sequenceIndex, token);
    sequenceIndex = result.nextIndex;
    if (!result.completed) return;

    if (!unlockEverythingForTesting(storage)) return;

    // The existing Home and Lot were rendered from the pre-unlock snapshot. Stop the
    // normal race action and reload once so every track, vehicle and paint control is
    // rebuilt from the complete test profile without emitting achievement events.
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
