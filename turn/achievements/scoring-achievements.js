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
    cliffside: 20000,
    airport: 11000,
    beachfront: 20000,
    harbor: 18000,
    'dead-canyon': 20000,
    'midnight-city': 20000,
    mountain: 20000
  }),
  flow: Object.freeze({
    countryside: 7000,
    cliffside: 13000,
    airport: 12000,
    beachfront: 13000,
    harbor: 23000,
    'dead-canyon': 20000,
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
  recommendation: 'Clear both scoring targets on every track.',
  icon: 'trophy',
  progressMax: TRACK_SCORING_ACHIEVEMENT_IDS.length,
  calibrationPending: TRACK_SCORING_ACHIEVEMENTS.some((achievement) => achievement.calibrationPending)
});

export const SCORING_MASTER_ACHIEVEMENTS = Object.freeze(['drift', 'flow'].map((channel) => Object.freeze({
  id: `${channel}-master`, category: CATEGORY.SCORING, trophies: 0,
  title: `${channel.toUpperCase()} MASTER`,
  description: `Clear every track’s calibrated ${channel.toUpperCase()} achievement.`,
  icon: channel, scoreChannel: channel,
  progressMax: TRACK_IDS.length,
  reward: Object.freeze({ type: 'perk', perkId: channel === 'drift' ? 'precision' : 'locked-in' }),
  calibrationPending: TRACK_SCORING_ACHIEVEMENTS.some((item) => item.scoreChannel === channel && item.calibrationPending)
})));

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

  for (const master of SCORING_MASTER_ACHIEVEMENTS) {
    if (!master.calibrationPending && TRACK_SCORING_ACHIEVEMENTS
      .filter((item) => item.scoreChannel === master.scoreChannel)
      .every(({ id }) => isUnlocked(id) || pendingIds.has(id))) {
      entries.push({ id: master.id, context: { trackId: '', vehicleId: '', time: null } });
    }
  }

  return entries;
}

export function completedAllScoringAchievements(isUnlocked, additionalIds = []) {
  const pending = new Set(Array.isArray(additionalIds) ? additionalIds : [additionalIds]);
  return !SCORING_MASTER_ACHIEVEMENT.calibrationPending
    && TRACK_SCORING_ACHIEVEMENT_IDS.every((id) => isUnlocked(id) || pending.has(id));
}
