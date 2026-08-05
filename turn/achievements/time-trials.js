export const TIME_TRIALS = Object.freeze([
  Object.freeze({
    id: 'countryside-sprint',
    trackId: 'countryside',
    targetSeconds: 12,
    title: 'COUNTRYSIDE SPRINT',
    description: 'Finish Countryside in under 12 seconds.'
  }),
  Object.freeze({
    id: 'airport-sprint',
    trackId: 'airport',
    targetSeconds: 17,
    title: 'AIRPORT SPRINT',
    description: 'Finish Airport in under 17 seconds.'
  }),
  Object.freeze({
    id: 'cliffside-sprint',
    trackId: 'cliffside',
    targetSeconds: 16,
    title: 'CLIFFSIDE SPRINT',
    description: 'Finish Cliffside in under 16 seconds.'
  }),
  Object.freeze({
    id: 'harbor-sprint',
    trackId: 'harbor',
    targetSeconds: 24,
    title: 'HARBOR SPRINT',
    description: 'Finish Harbor in under 24 seconds.'
  }),
  Object.freeze({
    id: 'midnight-sprint',
    trackId: 'midnight-city',
    targetSeconds: 55,
    title: 'MIDNIGHT SPRINT',
    description: 'Finish Midnight City in under 55 seconds.'
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
