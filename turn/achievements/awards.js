// The amounts awarded before collection PERKS (#1247). A player may skip the
// foundation release entirely, so migration must never consult new master values.
export const LEGACY_MASTER_TROPHIES = Object.freeze({
  'faster-than-the-dev': 300,
  'on-course-of-course': 100,
  'an-army-of-me': 200,
  'drift-flow-master': 300
});

// Retired achievements (#1270) leave the catalog but not a player's total: a profile
// that earned one keeps its trophies, and the record stays out of every list.
export const RETIRED_ACHIEVEMENT_TROPHIES = Object.freeze({
  'chromatic-camouflage': 50
});

export function hasHistoricalTrophyAward(id) {
  return Object.hasOwn(LEGACY_MASTER_TROPHIES, id) || Object.hasOwn(RETIRED_ACHIEVEMENT_TROPHIES, id);
}

export function achievementTrophyAward(id, record, achievement) {
  const awarded = record?.awardedTrophies;
  if (typeof awarded === 'number' && Number.isFinite(awarded) && awarded >= 0) return awarded;
  if (Object.hasOwn(LEGACY_MASTER_TROPHIES, id)) return LEGACY_MASTER_TROPHIES[id];
  if (Object.hasOwn(RETIRED_ACHIEVEMENT_TROPHIES, id)) return RETIRED_ACHIEVEMENT_TROPHIES[id];
  return achievement?.calibrationPending !== true ? achievement?.trophies : undefined;
}
