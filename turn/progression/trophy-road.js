export const TROPHY_ROAD_STORAGE_KEY = 'turn-achievements-v1';
export const TROPHY_ROAD_STORAGE_VERSION = 6;
export const TROPHY_ROAD_MAX_THRESHOLD = 1700;
export const TROPHY_ROAD_VIEWPORT_THRESHOLD = 600;

export const TROPHY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4h10v4c0 4-2 7-5 8-3-1-5-4-5-8V4Z"></path><path d="M7 6H4v2c0 2 1 3 4 4M17 6h3v2c0 2-1 3-4 4M9 20h6M12 16v4"></path></svg>';
export const LOCK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"></path></svg>';

export const TROPHY_ROAD_REWARD_ICONS = Object.freeze({
  skyline: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M3 43h58M8 43V24h10v19M21 43V13h13v30M37 43V20h8v23M48 43V9h10v34"></path><path d="M11 29h3M11 35h3M25 19h4M25 26h4M25 33h4M51 15h3M51 22h3M51 29h3"></path><path d="M8 8a8 8 0 1 0 9 9A7 7 0 0 1 8 8Z"></path></svg>',
  race: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M4 31h10l7-11h22l8 11h9v7H4Z"></path><path d="M22 20h17l7 11M16 27h33M27 20v11M47 17h11v7H51"></path><circle cx="17" cy="39" r="6"></circle><circle cx="50" cy="39" r="6"></circle></svg>',
  future: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M5 32h8l7-7h9l5-8h8l5 8h9l4 7v7H5Z"></path><path d="M21 25h26M36 17l5 8M47 13h12v6H45"></path><circle cx="17" cy="39" r="5"></circle><circle cx="50" cy="39" r="5"></circle><path d="M2 22h12M1 16h17M7 28h9"></path></svg>',
  paint: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M10 7h29v13H10Z"></path><path d="M39 11h8c5 0 7 3 7 7v4H31v8"></path><path d="M27 28h8v16h-8Z"></path><path d="M15 12h18M15 16h12"></path></svg>',
  emergency: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M18 35V21a14 14 0 0 1 28 0v14"></path><path d="M12 35h40v9H12Z"></path><path d="M32 2v7M9 9l6 6M55 9l-6 6M3 25h8M53 25h8"></path><path d="M24 34V22a8 8 0 0 1 16 0v12"></path></svg>',
  monster: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M10 28h8l5-10h20l7 10h5v9H9Z"></path><path d="M28 18v10M23 28h27M45 22h8l4 6"></path><circle cx="18" cy="38" r="8"></circle><circle cx="48" cy="38" r="8"></circle><circle cx="18" cy="38" r="3"></circle><circle cx="48" cy="38" r="3"></circle></svg>',
  vintage: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M5 31h9l7-8h20l8 4h9v10H5Z"></path><path d="M21 23l5-8h12l6 8M27 15v8M12 31h39"></path><circle cx="17" cy="38" r="6"></circle><circle cx="49" cy="38" r="6"></circle></svg>',
  rally: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M7 31h7l6-12h24l8 12h6v7H7Z"></path><path d="M24 19v12M20 24h27M11 27h7M47 15h8l3 7"></path><circle cx="18" cy="39" r="5"></circle><circle cx="49" cy="39" r="5"></circle></svg>',
  mountain: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M4 42 23 13l8 12L40 8l20 34Z"></path><path d="m17 22 6-9 5 8 4-6 8-7 7 13"></path><path d="M39 42c5-8 9-11 15-13M43 35l4 2-2 4 5 2"></path></svg>'
});

export const TROPHY_ROAD_REWARDS = Object.freeze([
  Object.freeze({
    id: 'vintage-racer',
    threshold: 300,
    title: 'VINTAGE RACER',
    shortTitle: 'Vintage Racer',
    type: 'vehicle',
    vehicleIds: Object.freeze(['vintage-racer']),
    icon: 'vintage',
    perkTitle: 'DRIFTAGE',
    perkDescription: 'DRIFT drains less speed, steering becomes more aggressive and the car can hold larger slip angles.',
    description: 'Unlock the Vintage Racer: the car for linking corners beautifully.<br><strong>DRIFTAGE:</strong> DRIFT drains less speed, steering becomes more aggressive and it can hold larger slip angles.'
  }),
  Object.freeze({
    id: 'midnight-city',
    threshold: 400,
    title: 'MIDNIGHT CITY',
    shortTitle: 'Midnight City',
    type: 'track',
    trackId: 'midnight-city',
    icon: 'skyline',
    description: 'Unlock TURN’s night-time city track, with neon streets, technical corners and the longest lap in the current track collection.'
  }),
  Object.freeze({
    id: 'race-car',
    threshold: 500,
    title: 'RACE CAR',
    shortTitle: 'Race Car',
    type: 'vehicle',
    vehicleIds: Object.freeze(['race']),
    icon: 'race',
    perkTitle: 'APEX GRIP',
    perkDescription: 'Increased CONTROL when OVERCHARGED.',
    description: 'Unlock the Race Car: high-speed handling built for precise lines.<br><strong>APEX GRIP:</strong> Increased CONTROL when OVERCHARGED.'
  }),
  Object.freeze({
    id: 'emergency-pack',
    threshold: 600,
    title: 'EMERGENCY!',
    shortTitle: 'Emergency Pack',
    type: 'vehicle-pack',
    vehicleIds: Object.freeze(['firetruck', 'ambulance', 'police']),
    icon: 'emergency',
    perkTitle: 'SIRENS',
    perkDescription: 'Boost activates flashing emergency lights and sirens.',
    description: 'Unlock the Fire Truck, Ambulance and Police Car. All three have maximum Boost tanks.<br><strong>SIRENS:</strong> Boost activates flashing emergency lights and sirens.'
  }),
  Object.freeze({
    id: 'mountain',
    threshold: 700,
    title: 'MOUNTAIN',
    shortTitle: 'Mountain',
    type: 'track',
    trackId: 'mountain',
    icon: 'mountain',
    description: 'Unlock MOUNTAIN: leave a snowy village on a long alpine climb, round the summit river and attack the front-face hairpin descent beside the waterfall.'
  }),
  Object.freeze({
    id: 'monster',
    threshold: 800,
    title: 'MONSTER',
    shortTitle: 'Monster Truck',
    type: 'vehicle',
    vehicleIds: Object.freeze(['monster-truck']),
    icon: 'monster',
    perkTitle: 'OVERSIZED',
    perkDescription: 'Going off-road doesn’t slow it down.',
    description: 'Unlock the Monster Truck: a military-green heavyweight.<br><strong>OVERSIZED:</strong> Going off-road doesn’t slow it down.'
  }),
  Object.freeze({
    id: 'paintjob',
    threshold: 900,
    title: 'PAINTJOB',
    shortTitle: 'Paintjob',
    type: 'feature',
    featureId: 'vehicle-paint',
    icon: 'paint',
    description: 'Unlock body and secondary paint controls in The Lot. Every vehicle keeps its own distinctive factory colour until then.'
  }),
  Object.freeze({
    id: 'future-racer',
    threshold: 1000,
    title: 'FUTURE RACER',
    shortTitle: 'Future Racer',
    type: 'vehicle',
    vehicleIds: Object.freeze(['race-future']),
    icon: 'future',
    perkTitle: 'OVERDRIVE',
    perkDescription: 'A few seconds of staying on-track raises the speed cap. Leaving the track or colliding resets it.',
    description: 'Unlock the Future Racer: built for advanced time trials.<br><strong>OVERDRIVE:</strong> A few seconds of staying on-track raises the speed cap. Leaving the track or colliding resets it.'
  }),
  Object.freeze({
    id: 'rally-racer',
    threshold: 1100,
    title: 'RALLY RACER',
    shortTitle: 'Rally Racer',
    type: 'vehicle',
    vehicleIds: Object.freeze(['toy-racer']),
    icon: 'rally',
    perkTitle: 'TWITCHY TURNY',
    perkDescription: 'DRIFT fills BOOST even faster than normal.',
    description: 'Unlock the Rally Racer: twitchy and perfect for curvy tracks.<br><strong>TWITCHY TURNY:</strong> DRIFT fills BOOST even faster than normal.'
  })
]);

const REWARD_BY_ID = new Map(TROPHY_ROAD_REWARDS.map((reward) => [reward.id, reward]));
const REWARD_BY_TRACK = new Map(
  TROPHY_ROAD_REWARDS.filter((reward) => reward.trackId).map((reward) => [reward.trackId, reward])
);
const REWARD_BY_VEHICLE = new Map(
  TROPHY_ROAD_REWARDS.flatMap((reward) => (reward.vehicleIds || []).map((vehicleId) => [vehicleId, reward]))
);
const REWARD_BY_FEATURE = new Map(
  TROPHY_ROAD_REWARDS.filter((reward) => reward.featureId).map((reward) => [reward.featureId, reward])
);
const PREPARED_STORAGE = new WeakSet();
const VERSION_THREE_GRANDFATHERED_REWARDS = Object.freeze([
  'paintjob',
  'monster',
  'vintage-racer',
  'rally-racer'
]);
const VERSION_FOUR_GRANDFATHERED_REWARDS = Object.freeze(['vintage-racer', 'rally-racer']);

let unlockNotice = null;
let unlockNoticeTimer = 0;

export function getTrophyRoadReward(id) {
  return REWARD_BY_ID.get(id) || null;
}

export function rewardForTrack(trackId) {
  return REWARD_BY_TRACK.get(trackId) || null;
}

export function rewardForVehicle(vehicleId) {
  return REWARD_BY_VEHICLE.get(vehicleId) || null;
}

export function rewardForFeature(featureId) {
  return REWARD_BY_FEATURE.get(featureId) || null;
}

export function grandfatheredRewardIdsForVersion(version) {
  const numericVersion = Number(version) || 0;
  if (numericVersion < 3) return TROPHY_ROAD_REWARDS.map((reward) => reward.id);
  if (numericVersion === 3) return [...VERSION_THREE_GRANDFATHERED_REWARDS];
  if (numericVersion === 4) return [...VERSION_FOUR_GRANDFATHERED_REWARDS];
  return [];
}

export function migrateStoredRewardIdsForVersion(ids, version) {
  const storedIds = Array.isArray(ids) ? [...new Set(ids)] : [];
  if (Number(version) !== 5) return storedIds;
  return storedIds.filter((id) => id !== 'future-racer' && id !== 'rally-racer');
}

export function rewardIdsForTrophies(trophies) {
  const total = Math.max(0, Number(trophies) || 0);
  return TROPHY_ROAD_REWARDS
    .filter((reward) => total >= reward.threshold)
    .map((reward) => reward.id);
}

function ensureUnlockNotice() {
  if (unlockNotice?.isConnected) return unlockNotice;
  const documentRef = globalThis.document;
  if (!documentRef?.body) return null;

  unlockNotice = documentRef.createElement('div');
  unlockNotice.className = 'turn-unlock-notice';
  unlockNotice.hidden = true;
  unlockNotice.setAttribute('role', 'status');
  unlockNotice.setAttribute('aria-live', 'polite');
  unlockNotice.setAttribute('aria-atomic', 'true');
  unlockNotice.innerHTML = `
    <span class="turn-unlock-notice-icon" aria-hidden="true">${LOCK_ICON}</span>
    <span class="turn-unlock-notice-copy"><strong></strong><span></span></span>`;
  documentRef.body.appendChild(unlockNotice);
  return unlockNotice;
}

export function showTrophyUnlockNotice({ reward, itemName = reward?.shortTitle } = {}) {
  if (!reward) return null;
  const notice = ensureUnlockNotice();
  if (!notice) return null;
  const name = itemName || reward.shortTitle;
  notice.querySelector('strong').textContent = `LOCKED · ${reward.threshold} TROPHIES`;
  notice.querySelector('.turn-unlock-notice-copy > span').textContent =
    `${name} unlocks on Trophy Road. Complete achievements to reach ${reward.threshold} trophies.`;
  notice.setAttribute('aria-label', `${name} is locked. Unlocks at ${reward.threshold} trophies on Trophy Road.`);
  notice.hidden = false;
  notice.classList.remove('is-visible');
  void notice.offsetWidth;
  notice.classList.add('is-visible');
  globalThis.clearTimeout?.(unlockNoticeTimer);
  unlockNoticeTimer = globalThis.setTimeout?.(() => {
    notice.classList.remove('is-visible');
    globalThis.setTimeout?.(() => {
      if (!notice.classList.contains('is-visible')) notice.hidden = true;
    }, 180);
  }, 4200) || 0;
  return notice;
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
      if (key.startsWith('turn-personal-rivals-v1:') || key.startsWith('turn-three-ghost-v4:')) return true;
    }
  } catch (_) {}
  return false;
}

export function prepareTrophyRoadProfile(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(TROPHY_ROAD_STORAGE_KEY);
    const existing = safeParse(raw);
    if (existing) return existing;
    if (preparationAlreadyChecked(storage)) return null;
    markPreparationChecked(storage);
    if (!hasLegacyTurnProfile(storage)) return null;

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

  const sourceVersion = Number(state?.version || 0);
  const stored = Array.isArray(state?.rewards?.unlocked)
    ? state.rewards.unlocked.filter((id) => REWARD_BY_ID.has(id))
    : [];
  const migratedStored = migrateStoredRewardIdsForVersion(stored, sourceVersion);
  const migrated = state ? grandfatheredRewardIdsForVersion(sourceVersion) : [];
  const unlockedRewardIds = [...new Set([...migratedStored, ...migrated])];

  return Object.freeze({
    isLegacyProfile: Boolean(state) && sourceVersion < 3,
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

export function isFeatureUnlocked(featureId, storage = globalThis.localStorage) {
  const reward = rewardForFeature(featureId);
  return !reward || isTrophyRoadRewardUnlocked(reward.id, storage);
}

export function isPaintUnlocked(storage = globalThis.localStorage) {
  return isFeatureUnlocked('vehicle-paint', storage);
}
