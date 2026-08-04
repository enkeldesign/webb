export const TROPHY_ROAD_STORAGE_KEY = 'turn-achievements-v1';
export const TROPHY_ROAD_STORAGE_VERSION = 3;
export const TROPHY_ROAD_MAX_THRESHOLD = 1300;

export const TROPHY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4h10v4c0 4-2 7-5 8-3-1-5-4-5-8V4Z"></path><path d="M7 6H4v2c0 2 1 3 4 4M17 6h3v2c0 2-1 3-4 4M9 20h6M12 16v4"></path></svg>';

export const TROPHY_ROAD_REWARD_ICONS = Object.freeze({
  skyline: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M3 43h58M8 43V24h10v19M21 43V13h13v30M37 43V20h8v23M48 43V9h10v34"></path><path d="M11 29h3M11 35h3M25 19h4M25 26h4M25 33h4M51 15h3M51 22h3M51 29h3"></path><path d="M8 8a8 8 0 1 0 9 9A7 7 0 0 1 8 8Z"></path></svg>',
  emergency: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M18 35V21a14 14 0 0 1 28 0v14"></path><path d="M12 35h40v9H12Z"></path><path d="M32 2v7M9 9l6 6M55 9l-6 6M3 25h8M53 25h8"></path><path d="M24 34V22a8 8 0 0 1 16 0v12"></path></svg>',
  future: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M7 31h7l6-12h23l9 12h5v9h-6"></path><path d="M13 40H7v-9M22 40h20"></path><circle cx="18" cy="40" r="5"></circle><circle cx="47" cy="40" r="5"></circle><path d="M24 19l5-8h10l4 8M28 25h17M4 20h10M1 14h18"></path></svg>'
});

export const TROPHY_ROAD_REWARDS = Object.freeze([
  Object.freeze({
    id: 'midnight-city',
    threshold: 200,
    title: 'MIDNIGHT CITY',
    shortTitle: 'Midnight City',
    type: 'track',
    trackId: 'midnight-city',
    icon: 'skyline',
    description: 'Unlock TURN’s night-time city track, with neon streets, technical corners and the longest lap in the current track collection.'
  }),
  Object.freeze({
    id: 'emergency-pack',
    threshold: 400,
    title: 'EMERGENCY!',
    shortTitle: 'Emergency Pack',
    type: 'vehicle-pack',
    vehicleIds: Object.freeze(['firetruck', 'ambulance', 'police']),
    icon: 'emergency',
    description: 'Unlock the Fire Truck, Ambulance and Police Car. During Boost, their emergency lights flash and their sirens sound. All three have maximum Boost tanks.'
  }),
  Object.freeze({
    id: 'future-racer',
    threshold: 500,
    title: 'FUTURE RACER',
    shortTitle: 'Future Racer',
    type: 'vehicle',
    vehicleIds: Object.freeze(['race-future']),
    icon: 'future',
    description: 'Unlock a high-speed racing vehicle built for advanced laps and hard time-trial targets.'
  })
]);

const REWARD_BY_ID = new Map(TROPHY_ROAD_REWARDS.map((reward) => [reward.id, reward]));
const REWARD_BY_TRACK = new Map(
  TROPHY_ROAD_REWARDS
    .filter((reward) => reward.trackId)
    .map((reward) => [reward.trackId, reward])
);
const REWARD_BY_VEHICLE = new Map(
  TROPHY_ROAD_REWARDS.flatMap((reward) =>
    (reward.vehicleIds || []).map((vehicleId) => [vehicleId, reward])
  )
);
const PREPARED_STORAGE = new WeakSet();

export function getTrophyRoadReward(id) {
  return REWARD_BY_ID.get(id) || null;
}

export function rewardForTrack(trackId) {
  return REWARD_BY_TRACK.get(trackId) || null;
}

export function rewardForVehicle(vehicleId) {
  return REWARD_BY_VEHICLE.get(vehicleId) || null;
}

export function rewardIdsForTrophies(trophies) {
  const total = Math.max(0, Number(trophies) || 0);
  return TROPHY_ROAD_REWARDS
    .filter((reward) => total >= reward.threshold)
    .map((reward) => reward.id);
}

function safeParse(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function canRememberStorage(storage) {
  return Boolean(storage) && (typeof storage === 'object' || typeof storage === 'function');
}

function preparationAlreadyChecked(storage) {
  return canRememberStorage(storage) && PREPARED_STORAGE.has(storage);
}

function markPreparationChecked(storage) {
  if (canRememberStorage(storage)) PREPARED_STORAGE.add(storage);
}

function hasLegacyTurnProfile(storage) {
  const exactKeys = [
    'turn-vehicle-selection-v1',
    'turn-selected-track-v1',
    'turn-steering-mode-v1',
    'turn-drive-by-ear-v1',
    'turn-personal-rivals-v1',
    'turn-three-ghost-v4'
  ];
  for (const key of exactKeys) {
    try {
      if (storage?.getItem?.(key) != null) return true;
    } catch (_) {
      return false;
    }
  }

  try {
    const length = Number(storage?.length) || 0;
    for (let index = 0; index < length; index += 1) {
      const key = storage?.key?.(index) || '';
      if (key.startsWith('turn-personal-rivals-v1:') || key.startsWith('turn-three-ghost-v4:')) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

export function prepareTrophyRoadProfile(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(TROPHY_ROAD_STORAGE_KEY);
    const existing = safeParse(raw);
    if (existing) return existing;

    // Legacy detection runs once per Storage object. A setting created later in
    // the same fresh session must not accidentally grandfather a new player.
    if (preparationAlreadyChecked(storage)) return null;
    markPreparationChecked(storage);
    if (!hasLegacyTurnProfile(storage)) return null;

    // A version-2 shell lets the achievement store recognise a pre-Trophy Road
    // profile and permanently grandfather the content that was previously open.
    const legacyShell = {
      version: 2,
      unlocked: {},
      seen: [],
      progress: { tracks: [], blankTracks: [] }
    };
    storage?.setItem?.(TROPHY_ROAD_STORAGE_KEY, JSON.stringify(legacyShell));
    return legacyShell;
  } catch (_) {
    return null;
  }
}

export function readTrophyRoadSnapshot(storage = globalThis.localStorage) {
  const prepared = prepareTrophyRoadProfile(storage);
  let state = prepared;
  if (!state) {
    try {
      state = safeParse(storage?.getItem?.(TROPHY_ROAD_STORAGE_KEY));
    } catch (_) {
      state = null;
    }
  }

  const isLegacyProfile = Boolean(state) && Number(state.version || 0) < TROPHY_ROAD_STORAGE_VERSION;
  const unlockedRewardIds = isLegacyProfile
    ? TROPHY_ROAD_REWARDS.map((reward) => reward.id)
    : [...new Set(
        Array.isArray(state?.rewards?.unlocked)
          ? state.rewards.unlocked.filter((id) => REWARD_BY_ID.has(id))
          : []
      )];

  return Object.freeze({
    isLegacyProfile,
    unlockedRewardIds: Object.freeze(unlockedRewardIds)
  });
}

export function isTrophyRoadRewardUnlocked(rewardId, storage = globalThis.localStorage) {
  if (!REWARD_BY_ID.has(rewardId)) return true;
  const liveStore = globalThis.__turnAchievements?.store;
  if (liveStore?.isRewardUnlocked?.(rewardId)) return true;
  return readTrophyRoadSnapshot(storage).unlockedRewardIds.includes(rewardId);
}

export function isTrackUnlocked(trackId, storage = globalThis.localStorage) {
  const reward = rewardForTrack(trackId);
  return !reward || isTrophyRoadRewardUnlocked(reward.id, storage);
}

export function isVehicleUnlocked(vehicleId, storage = globalThis.localStorage) {
  const reward = rewardForVehicle(vehicleId);
  return !reward || isTrophyRoadRewardUnlocked(reward.id, storage);
}
