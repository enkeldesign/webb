import {
  CATEGORY,
  TRACK_IDS,
  TRACK_NAMES
} from './catalog-base.js?revision=r241-trophy-balance';
import { getBestDriftRecord } from '../scoring/drift-records.js';
import { getBestFlowRecord } from '../scoring/flow-records.js';

export const SCORING_MASTER_ACHIEVEMENT_ID = 'drift-flow-master';

// Calibrated from production playtesting. Keep all track/channel targets in one
// reviewable data object so future balance changes remain explicit.
export const SCORING_ACHIEVEMENT_TARGETS = Object.freeze({
  drift: Object.freeze({
    countryside: 8000,
    airport: 11000,
    cliffside: 20000,
    harbor: 18000,
    'midnight-city': 20000,
    mountain: 20000
  }),
  flow: Object.freeze({
    countryside: 7000,
    airport: 12000,
    cliffside: 13000,
    harbor: 23000,
    'midnight-city': 25000,
    mountain: 20000
  })
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
    trophies: channel === 'drift' ? 75 : 50,
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
  recommendation: 'Clear both scoring targets on all six tracks.',
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

export function storedScoringAchievementUnlockEntries(storage, isUnlocked = () => false) {
  const channels = [
    ['drift', getBestDriftRecord],
    ['flow', getBestFlowRecord]
  ];
  const entries = [];
  const pendingIds = new Set();

  for (const [channel, getRecord] of channels) {
    for (const trackId of TRACK_IDS) {
      const record = getRecord(trackId, storage);
      const achievement = qualifyingScoringAchievement(channel, trackId, record?.score);
      if (!achievement) continue;
      pendingIds.add(achievement.id);
      entries.push({
        id: achievement.id,
        context: {
          trackId,
          vehicleId: record?.carId || '',
          time: Number(record?.lapTime) || null
        }
      });
    }
  }

  if (completedAllScoringAchievements(isUnlocked, [...pendingIds])) {
    entries.push({
      id: SCORING_MASTER_ACHIEVEMENT_ID,
      context: { trackId: '', vehicleId: '', time: null }
    });
  }

  return entries;
}

export function completedAllScoringAchievements(isUnlocked, additionalIds = []) {
  const pending = new Set(Array.isArray(additionalIds) ? additionalIds : [additionalIds]);
  return !SCORING_MASTER_ACHIEVEMENT.calibrationPending
    && TRACK_SCORING_ACHIEVEMENT_IDS.every((id) => isUnlocked(id) || pending.has(id));
}
