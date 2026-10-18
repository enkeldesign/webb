// The amounts awarded before collection PERKS (#1247). A player may skip the
// foundation release entirely, so migration must never consult new master values.
export const LEGACY_MASTER_TROPHIES = Object.freeze({
  'faster-than-the-dev': 300,
  'on-course-of-course': 100,
  'an-army-of-me': 200,
  'drift-flow-master': 300
});

export function achievementTrophyAward(id, record, achievement) {
  const awarded = record?.awardedTrophies;
  if (typeof awarded === 'number' && Number.isFinite(awarded) && awarded >= 0) return awarded;
  if (Object.hasOwn(LEGACY_MASTER_TROPHIES, id)) return LEGACY_MASTER_TROPHIES[id];
  return achievement?.calibrationPending !== true ? achievement?.trophies : undefined;
}
