export const TIME_TRIALS = Object.freeze([
  Object.freeze({
    id: 'countryside-sprint',
    trackId: 'countryside',
    targetSeconds: 11,
    title: 'COUNTRYSIDE SPRINT',
    description: 'Finish Countryside in under 11 seconds.'
  }),
  Object.freeze({
    id: 'airport-sprint',
    trackId: 'airport',
    targetSeconds: 16,
    title: 'AIRPORT SPRINT',
    description: 'Finish Airport in under 16 seconds.'
  }),
  Object.freeze({
    id: 'cliffside-sprint',
    trackId: 'cliffside',
    targetSeconds: 15,
    title: 'CLIFFSIDE SPRINT',
    description: 'Finish Cliffside in under 15 seconds.'
  }),
  Object.freeze({
    id: 'harbor-sprint',
    trackId: 'harbor',
    targetSeconds: 22,
    title: 'HARBOR SPRINT',
    description: 'Finish Harbor in under 22 seconds.'
  }),
  Object.freeze({
    id: 'midnight-sprint',
    trackId: 'midnight-city',
    targetSeconds: 52,
    title: 'MIDNIGHT SPRINT',
    description: 'Finish Midnight City in under 52 seconds.'
  }),
  Object.freeze({
    id: 'mountain-sprint',
    trackId: 'mountain',
    targetSeconds: 25,
    title: 'MOUNTAIN SPRINT',
    description: 'Finish Mountain in under 25 seconds.'
  })
]);

export const TIME_TRIAL_ACHIEVEMENT_IDS = Object.freeze(
  TIME_TRIALS.map((trial) => trial.id)
);

export const TIME_TRIAL_MASTER_ID = 'faster-than-the-dev';

const TIME_TRIAL_BY_TRACK = new Map(
  TIME_TRIALS.map((trial) => [trial.trackId, trial])
);

export function qualifyingTimeTrial(trackId, time) {
  const trial = TIME_TRIAL_BY_TRACK.get(trackId);
  const seconds = Number(time);
  if (!trial || !Number.isFinite(seconds) || seconds >= trial.targetSeconds) return null;
  return trial;
}

export function completedAllTimeTrials(isUnlocked, pendingId = '') {
  if (typeof isUnlocked !== 'function') return false;
  return TIME_TRIAL_ACHIEVEMENT_IDS.every((id) => id === pendingId || isUnlocked(id));
}
