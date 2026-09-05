export const TROPHY_ROAD_STORAGE_KEY = 'turn-achievements-v1';
export const TROPHY_ROAD_STORAGE_VERSION = 8;
export const TROPHY_ROAD_MAX_THRESHOLD = 2200;

export const TROPHY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4h10v4c0 4-2 7-5 8-3-1-5-4-5-8V4Z"></path><path d="M7 6H4v2c0 2 1 3 4 4M17 6h3v2c0 2-1 3-4 4M9 20h6M12 16v4"></path></svg>';
export const LOCK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"></path></svg>';

function authoredRewardIcon(name) {
  return `<span class="turn-trophy-road-authored-icon is-${name}" aria-hidden="true"></span>`;
}

export const TROPHY_ROAD_REWARD_ICONS = Object.freeze({
  skyline: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M3 43h58M8 43V24h10v19M21 43V13h13v30M37 43V20h8v23M48 43V9h10v34"></path><path d="M11 29h3M11 35h3M25 19h4M25 26h4M25 33h4M51 15h3M51 22h3M51 29h3"></path><path d="M8 8a8 8 0 1 0 9 9A7 7 0 0 1 8 8Z"></path></svg>',
  race: authoredRewardIcon('race-car'),
  future: authoredRewardIcon('future-racer'),
  paint: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M10 7h29v13H10Z"></path><path d="M39 11h8c5 0 7 3 7 7v4H31v8"></path><path d="M27 28h8v16h-8Z"></path><path d="M15 12h18M15 16h12"></path></svg>',
  emergency: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M18 35V21a14 14 0 0 1 28 0v14"></path><path d="M12 35h40v9H12Z"></path><path d="M32 2v7M9 9l6 6M55 9l-6 6M3 25h8M53 25h8"></path><path d="M24 34V22a8 8 0 0 1 16 0v12"></path></svg>',
  monster: authoredRewardIcon('monster-truck'),
  vintage: authoredRewardIcon('vintage-racer'),
  rally: authoredRewardIcon('rally-racer'),
  mountain: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M4 42 23 13l8 12L40 8l20 34Z"></path><path d="m17 22 6-9 5 8 4-6 8-7 7 13"></path><path d="M39 42c5-8 9-11 15-13M43 35l4 2-2 4 5 2"></path></svg>',
  shift: authoredRewardIcon('shift'),
  drift: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M7 10c24 2 35 13 32 33"></path><path d="M21 6c25 5 37 19 31 37"></path><path d="M5 21h8M17 29h8M31 38h8"></path></svg>',
  flow: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M4 24c8-16 18-16 28 0s20 16 28 0"></path><path d="M4 34c8-16 18-16 28 0s20 16 28 0"></path></svg>',
  perk: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M35 3 14 28h15l-3 17 24-28H35Z"></path><path d="M8 11h12M5 18h10M46 35h11"></path></svg>'
});

const TROPHY_ROAD_REWARD_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'vintage-racer',
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
    title: 'MIDNIGHT CITY',
    shortTitle: 'Midnight City',
    type: 'track',
    trackId: 'midnight-city',
    icon: 'skyline',
    description: 'Unlock MIDNIGHT CITY: an ADVANCED ≈4.7 km night-time city endurance lap through neon avenues and technical corners.'
  }),
  Object.freeze({
    id: 'race-car',
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
    title: 'MOUNTAIN',
    shortTitle: 'Mountain',
    type: 'track',
    trackId: 'mountain',
    icon: 'mountain',
    description: 'Unlock MOUNTAIN: an EXPERT ≈3.8 km alpine route from the snowy village through the summit and waterfall, across the lake bridge, then through the lower valley and village tunnel return.'
  }),
  Object.freeze({
    id: 'monster',
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
    title: 'PAINTJOB',
    shortTitle: 'Paintjob',
    type: 'feature',
    featureId: 'vehicle-paint',
    icon: 'paint',
    description: 'Unlock body and secondary paint controls in The Lot. Every vehicle keeps its own distinctive factory colour until then.'
  }),
  Object.freeze({
    id: 'future-racer',
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
    title: 'RALLY RACER',
    shortTitle: 'Rally Racer',
    type: 'vehicle',
    vehicleIds: Object.freeze(['toy-racer']),
    icon: 'rally',
    perkTitle: 'TWITCHY TURNY',
    perkDescription: 'DRIFT fills BOOST even faster than normal.',
    description: 'Unlock the Rally Racer: twitchy and perfect for curvy tracks.<br><strong>TWITCHY TURNY:</strong> DRIFT fills BOOST even faster than normal.'
  }),
  Object.freeze({
    id: 'awd-traction',
    title: 'AWD · TRACTION',
    shortTitle: 'AWD Traction',
    type: 'vehicle-perk',
    vehicleId: 'convertible',
    icon: 'perk',
    perkTitle: 'TRACTION',
    perkDescription: 'Shallow off-road driving causes much less slowdown, while deep off-road remains punishing.',
    description: 'Unlock <strong>TRACTION</strong> for AWD. Shallow off-road driving causes much less slowdown, while deep off-road remains punishing.'
  }),
  Object.freeze({
    id: 'truck-torque',
    title: 'TRUCK · TORQUE',
    shortTitle: 'Truck Torque',
    type: 'vehicle-perk',
    vehicleId: 'truck',
    icon: 'perk',
    perkTitle: 'TORQUE',
    perkDescription: 'ACCELERATION builds while GAS is held, up to 5/5.',
    description: 'Unlock <strong>TORQUE</strong> for Truck. ACCELERATION builds while GAS is held, up to 5/5.'
  }),
  Object.freeze({
    id: 'van-carry-on',
    title: 'VAN · CARRY ON',
    shortTitle: 'Van Carry On',
    type: 'vehicle-perk',
    vehicleId: 'van',
    icon: 'perk',
    perkTitle: 'CARRY ON',
    perkDescription: 'LOCK loses much less speed.',
    description: 'Unlock <strong>CARRY ON</strong> for Van. LOCK loses much less speed.'
  }),
  Object.freeze({
    id: 'shift',
    title: 'SHIFT',
    shortTitle: 'Shift',
    type: 'feature',
    featureId: 'vehicle-shift',
    icon: 'shift',
    description: 'Unlock SHIFT for every car. Move one point away from three attributes and into the other three, then toggle between STANDARD and SHIFT while racing.'
  }),
  Object.freeze({
    id: 'drift-attack',
    title: 'DRIFT ATTACK',
    shortTitle: 'Drift Attack',
    type: 'scoring-system',
    featureId: 'drift-attack',
    icon: 'drift',
    description: 'Unlock DRIFT scoring on every normal lap. Build and bank slides, set a best score for each track, and keep racing against the clock.'
  }),
  Object.freeze({
    id: 'flow',
    title: 'FLOW',
    shortTitle: 'Flow',
    type: 'scoring-system',
    featureId: 'flow',
    icon: 'flow',
    description: 'Unlock FLOW scoring on every normal lap. Link varied driving techniques and clever SHIFT outcomes while DRIFT and lap timing continue alongside it.'
  }),
  Object.freeze({
    id: 'suv-full-tank',
    title: 'SUV · FULL TANK',
    shortTitle: 'SUV Full Tank',
    type: 'vehicle-perk',
    vehicleId: 'suv',
    icon: 'perk',
    perkTitle: 'FULL TANK',
    perkDescription: 'Clean driving builds BOOST TANK up to 5/5.',
    description: 'Unlock <strong>FULL TANK</strong> for SUV. Clean driving builds BOOST TANK up to 5/5.'
  }),
  Object.freeze({
    id: 'sedan-double-shift',
    title: 'SEDAN · DOUBLE SHIFT',
    shortTitle: 'Sedan Double Shift',
    type: 'vehicle-perk',
    vehicleId: 'sedan',
    icon: 'perk',
    perkTitle: 'DOUBLE SHIFT',
    perkDescription: 'SHIFT moves 2 points between attributes instead of 1.',
    description: 'Unlock <strong>DOUBLE SHIFT</strong> for Sedan. SHIFT moves 2 points between attributes instead of 1.'
  }),
  Object.freeze({
    id: 'sports-car-drift-demon',
    title: 'SPORTS CAR · DRIFT DEMON',
    shortTitle: 'Sports Car Drift Demon',
    type: 'vehicle-perk',
    vehicleId: 'sedan-sports',
    icon: 'perk',
    perkTitle: 'DRIFT DEMON',
    perkDescription: 'DRIFT builds during sustained DRIFT or LOCK, up to 5/5.',
    description: 'Unlock <strong>DRIFT DEMON</strong> for Sports Car. DRIFT builds during sustained DRIFT or LOCK, up to 5/5.'
  }),
  Object.freeze({
    id: 'learner-graduated',
    title: 'LEARNER CAR · GRADUATED',
    shortTitle: 'Learner Car Graduated',
    type: 'vehicle-perk',
    vehicleId: 'classic',
    icon: 'perk',
    perkTitle: 'GRADUATED',
    perkDescription: 'Clean driving improves CONTROL, then ACCELERATION, then TOP SPEED.',
    description: 'Unlock <strong>GRADUATED</strong> for Learner Car. Clean driving improves CONTROL, then ACCELERATION, then TOP SPEED.'
  })
]);

const REWARD_ORDER = Object.freeze([
  Object.freeze(['paintjob', 400]),
  Object.freeze(['awd-traction', 500]),
  Object.freeze(['drift-attack', 600]),
  Object.freeze(['midnight-city', 700]),
  Object.freeze(['truck-torque', 800]),
  Object.freeze(['vintage-racer', 900]),
  Object.freeze(['shift', 1000]),
  Object.freeze(['race-car', 1100]),
  Object.freeze(['emergency-pack', 1200]),
  Object.freeze(['van-carry-on', 1300]),
  Object.freeze(['mountain', 1400]),
  Object.freeze(['flow', 1500]),
  Object.freeze(['future-racer', 1600]),
  Object.freeze(['suv-full-tank', 1700]),
  Object.freeze(['monster', 1800]),
  Object.freeze(['sedan-double-shift', 1900]),
  Object.freeze(['rally-racer', 2000]),
  Object.freeze(['sports-car-drift-demon', 2100]),
  Object.freeze(['learner-graduated', 2200])
]);
const MAJOR_REWARD_IDS = new Set([
  'drift-attack',
  'midnight-city',
  'shift',
  'mountain',
  'flow'
]);
const REWARD_DEFINITION_BY_ID = new Map(
  TROPHY_ROAD_REWARD_DEFINITIONS.map((reward) => [reward.id, reward])
);

export const TROPHY_ROAD_REWARDS = Object.freeze(REWARD_ORDER.map(([id, threshold]) => {
  const reward = REWARD_DEFINITION_BY_ID.get(id);
  if (!reward) throw new Error(`TURN Trophy Road 2 is missing reward ${id}.`);
  return Object.freeze({
    ...reward,
    threshold,
    major: MAJOR_REWARD_IDS.has(id)
  });
}));

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
const REWARD_BY_VEHICLE_PERK = new Map(
  TROPHY_ROAD_REWARDS
    .filter((reward) => reward.type === 'vehicle-perk' && reward.vehicleId)
    .map((reward) => [reward.vehicleId, reward])
);
const PREPARED_STORAGE = new WeakSet();
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
const LEGACY_VEHICLE_SELECTION_KEY = 'turn-vehicle-selection-v1';
const RIVAL_STORAGE_PREFIX = 'turn-personal-rivals-v1';
const LEGACY_GHOST_STORAGE_PREFIX = 'turn-three-ghost-v4';
const VERSION_THREE_GRANDFATHERED_REWARDS = Object.freeze([
  'paintjob',
  'monster',
  'vintage-racer',
  'rally-racer'
]);
const VERSION_FOUR_GRANDFATHERED_REWARDS = Object.freeze(['vintage-racer', 'rally-racer']);
const PRE_SHIFT_GRANDFATHERED_REWARDS = Object.freeze([
  'vintage-racer',
  'midnight-city',
  'race-car',
  'emergency-pack',
  'mountain',
  'monster',
  'paintjob',
  'future-racer',
  'rally-racer'
]);

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

export function rewardForVehiclePerk(vehicleId) {
  return REWARD_BY_VEHICLE_PERK.get(vehicleId) || null;
}

export function grandfatheredRewardIdsForVersion(version) {
  const numericVersion = Number(version) || 0;
  if (numericVersion < 3) return [...PRE_SHIFT_GRANDFATHERED_REWARDS];
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

export function trophyRoadOverview({
  trophies = 0,
  unlockedRewardIds = [],
  unseenRewardIds = []
} = {}) {
  const total = Math.max(0, Number(trophies) || 0);
  const unlocked = new Set(Array.isArray(unlockedRewardIds) ? unlockedRewardIds : []);
  const unseen = Array.isArray(unseenRewardIds) ? unseenRewardIds : [];
  const next = TROPHY_ROAD_REWARDS.find((reward) => !unlocked.has(reward.id)) || null;
  const newRewards = unseen
    .map((id) => getTrophyRoadReward(id))
    .filter((reward) => reward && unlocked.has(reward.id));
  const newEarned = newRewards.at(-1) || null;
  const earned = newEarned || [...TROPHY_ROAD_REWARDS]
    .reverse()
    .find((reward) => unlocked.has(reward.id)) || null;
  const horizon = TROPHY_ROAD_REWARDS.find((reward) => (
    reward.major
    && !unlocked.has(reward.id)
    && reward.id !== next?.id
    && reward.threshold > (next?.threshold || total)
  )) || null;

  return Object.freeze({
    total,
    progress: Math.min(1, total / TROPHY_ROAD_MAX_THRESHOLD),
    earned,
    earnedIsNew: Boolean(newEarned),
    newRewards: Object.freeze(newRewards),
    next,
    remaining: next ? Math.max(0, next.threshold - total) : 0,
    horizon
  });
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

function storageKeys(storage) {
  const keys = [];
  try {
    const length = Number(storage?.length) || 0;
    for (let index = 0; index < length; index += 1) {
      const key = storage?.key?.(index);
      if (typeof key === 'string' && key) keys.push(key);
    }
  } catch (_) {}
  return keys;
}

function hasPlayedRivalPayload(payload) {
  return Array.isArray(payload?.laps)
    && payload.laps.some((lap) => Number.isFinite(Number(lap?.time)) && Number(lap.time) > 5);
}

function hasPlayedLegacyGhost(payload) {
  return Number.isFinite(Number(payload?.bestTime)) && Number(payload.bestTime) > 5;
}

function hasLegacyRaceProgress(storage) {
  const keys = new Set([
    RIVAL_STORAGE_PREFIX,
    LEGACY_GHOST_STORAGE_PREFIX,
    ...storageKeys(storage).filter((key) =>
      key.startsWith(`${RIVAL_STORAGE_PREFIX}:`) || key.startsWith(`${LEGACY_GHOST_STORAGE_PREFIX}:`)
    )
  ]);

  for (const key of keys) {
    try {
      const payload = safeParse(storage?.getItem?.(key));
      if (key.startsWith(RIVAL_STORAGE_PREFIX) && hasPlayedRivalPayload(payload)) return true;
      if (key.startsWith(LEGACY_GHOST_STORAGE_PREFIX) && hasPlayedLegacyGhost(payload)) return true;
    } catch (_) {
      return false;
    }
  }
  return false;
}

function hasLegacyVehicleChoice(storage) {
  try {
    const selection = safeParse(storage?.getItem?.(LEGACY_VEHICLE_SELECTION_KEY));
    const carId = typeof selection?.carId === 'string' ? selection.carId : '';
    return Boolean(carId && carId !== 'classic');
  } catch (_) {
    return false;
  }
}

function hasLegacyProfileEvidence(storage) {
  return hasLegacyRaceProgress(storage) || hasLegacyVehicleChoice(storage);
}

function hasAdminRewardMarker(storage) {
  try {
    return storage?.getItem?.(ADMIN_UNLOCK_MARKER) != null;
  } catch (_) {
    return false;
  }
}

function hasAchievementProgress(state) {
  return Object.keys(state?.unlocked || {}).length > 0
    || (Array.isArray(state?.progress?.tracks) && state.progress.tracks.length > 0)
    || (Array.isArray(state?.progress?.blankTracks) && state.progress.blankTracks.length > 0);
}

function hasEveryRewardStored(state) {
  const stored = new Set(Array.isArray(state?.rewards?.unlocked) ? state.rewards.unlocked : []);
  return PRE_SHIFT_GRANDFATHERED_REWARDS.every((rewardId) => stored.has(rewardId));
}

function cleanTrophyRoadState() {
  return {
    version: TROPHY_ROAD_STORAGE_VERSION,
    unlocked: {},
    seen: [],
    progress: { tracks: [], blankTracks: [] },
    rewards: { unlocked: [], seen: [], grandfathered: [] }
  };
}

function repairFalseFreshProfile(state, storage) {
  if (!state || hasAchievementProgress(state) || hasAdminRewardMarker(storage) || hasLegacyProfileEvidence(storage)) {
    return state;
  }

  const sourceVersion = Number(state.version || 0);
  const looksLikeSettingsOnlyLegacyShell = sourceVersion < 3;
  const looksLikeFalseGrandfather = sourceVersion >= 5 && hasEveryRewardStored(state);
  if (!looksLikeSettingsOnlyLegacyShell && !looksLikeFalseGrandfather) return state;

  const clean = cleanTrophyRoadState();
  try {
    storage?.setItem?.(TROPHY_ROAD_STORAGE_KEY, JSON.stringify(clean));
  } catch (_) {
    return state;
  }
  return clean;
}

export function prepareTrophyRoadProfile(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(TROPHY_ROAD_STORAGE_KEY);
    const existing = safeParse(raw);
    if (existing) return repairFalseFreshProfile(existing, storage);
    if (preparationAlreadyChecked(storage)) return null;
    markPreparationChecked(storage);

    // Default settings can be written during a brand-new startup, so their mere
    // presence is not proof of an older TURN profile. Grandfather only when there
    // is meaningful pre-Trophy-Road evidence: a completed saved lap/ghost or a
    // genuinely non-default historical vehicle choice.
    if (!hasLegacyProfileEvidence(storage)) return null;

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
  const stored = [
    ...(Array.isArray(state?.rewards?.unlocked) ? state.rewards.unlocked : []),
    ...(Array.isArray(state?.rewards?.grandfathered) ? state.rewards.grandfathered : [])
  ].filter((id) => REWARD_BY_ID.has(id));
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

export function isVehiclePerkUnlocked(vehicleId, storage = globalThis.localStorage) {
  const reward = rewardForVehiclePerk(vehicleId);
  return !reward || isTrophyRoadRewardUnlocked(reward.id, storage);
}

export function isPaintUnlocked(storage = globalThis.localStorage) {
  return isFeatureUnlocked('vehicle-paint', storage);
}
