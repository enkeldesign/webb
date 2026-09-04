import {
  CATEGORY,
  TRACK_IDS,
  TRACK_NAMES
} from './catalog-base.js?revision=r222-awd-label';

export const SCORING_MASTER_ACHIEVEMENT_ID = 'drift-flow-master';

// Score targets deliberately stay unset until real DRIFT and FLOW lap
// distributions have been collected. Keeping calibration in one data object
// makes the eventual tuning change explicit and reviewable.
export const SCORING_ACHIEVEMENT_TARGETS = Object.freeze({
  drift: Object.freeze(Object.fromEntries(TRACK_IDS.map((trackId) => [trackId, null]))),
  flow: Object.freeze(Object.fromEntries(TRACK_IDS.map((trackId) => [trackId, null])))
});

function targetFor(channel, trackId) {
  const target = Number(SCORING_ACHIEVEMENT_TARGETS[channel]?.[trackId]);
  return Number.isFinite(target) && target > 0 ? Math.round(target) : null;
}

function achievementFor(channel, trackId) {
  const target = targetFor(channel, trackId);
  const label = channel.toUpperCase();
  const trackName = TRACK_NAMES[trackId];
  return Object.freeze({
    id: `${trackId}-${channel}-score`,
    category: CATEGORY.SCORING,
    trophies: 50,
    title: `${trackName.toUpperCase()} ${label}`,
    description: target == null
      ? `${label} target pending playtest calibration on ${trackName}.`
      : `Score ${target.toLocaleString('en-US')} ${label} points on ${trackName}.`,
    icon: channel === 'drift' ? 'drift' : 'flow',
    scoreChannel: channel,
    trackId,
    target,
    calibrationPending: target == null
  });
}

export const TRACK_SCORING_ACHIEVEMENTS = Object.freeze(
  ['drift', 'flow'].flatMap((channel) =>
    TRACK_IDS.map((trackId) => achievementFor(channel, trackId))
  )
);

export const TRACK_SCORING_ACHIEVEMENT_IDS = Object.freeze(
  TRACK_SCORING_ACHIEVEMENTS.map((achievement) => achievement.id)
);

export const SCORING_MASTER_ACHIEVEMENT = Object.freeze({
  id: SCORING_MASTER_ACHIEVEMENT_ID,
  category: CATEGORY.SCORING,
  trophies: 300,
  title: 'DRIFT & FLOW MASTER',
  description: 'Clear every track’s calibrated DRIFT and FLOW achievement.',
  recommendation: 'The twelve track targets are pending playtest calibration.',
  icon: 'trophy',
  progressMax: TRACK_SCORING_ACHIEVEMENT_IDS.length,
  calibrationPending: TRACK_SCORING_ACHIEVEMENTS.some((achievement) => achievement.calibrationPending)
});

export function qualifyingScoringAchievement(channel, trackId, score) {
  const normalizedChannel = channel === 'flow' ? 'flow' : 'drift';
  const target = targetFor(normalizedChannel, trackId);
  const value = Number(score);
  if (target == null || !Number.isFinite(value) || value < target) return null;
  return TRACK_SCORING_ACHIEVEMENTS.find((achievement) =>
    achievement.scoreChannel === normalizedChannel && achievement.trackId === trackId
  ) || null;
}

export function completedAllScoringAchievements(isUnlocked, additionalIds = []) {
  const pending = new Set(Array.isArray(additionalIds) ? additionalIds : [additionalIds]);
  return !SCORING_MASTER_ACHIEVEMENT.calibrationPending
    && TRACK_SCORING_ACHIEVEMENT_IDS.every((id) => isUnlocked(id) || pending.has(id));
}
