import {
  MIDNIGHT_CITY_ID,
  POLICE_CAR_ID
} from './catalog.js?revision=r146-achievement-expansion';

const RIVAL_COUNT = 4;
const PROGRESS_EPSILON = 0.002;

export function createNightShiftAttempt({ trackId = '', vehicleId = '', rivals = [] } = {}) {
  const rivalSnapshot = Array.isArray(rivals) ? rivals.slice(0, RIVAL_COUNT) : [];
  const eligible = trackId === MIDNIGHT_CITY_ID
    && vehicleId === POLICE_CAR_ID
    && rivalSnapshot.length === RIVAL_COUNT
    && rivalSnapshot.every((rival) => rival?.carId !== POLICE_CAR_ID);

  return {
    eligible,
    rivals: rivalSnapshot,
    rivalStates: rivalSnapshot.map(() => ({ previousRelation: 0 })),
    overtakenRivals: new Set()
  };
}

export function sampleNightShiftOvertakes(
  attempt,
  {
    playerProgress = 0,
    lapElapsed = 0,
    boostActive = false
  } = {},
  replayFrameAt
) {
  if (!attempt?.eligible || typeof replayFrameAt !== 'function') {
    return attempt?.overtakenRivals?.size || 0;
  }

  const playerDistance = Number(playerProgress);
  const elapsed = Math.max(0, Number(lapElapsed) || 0);
  if (!Number.isFinite(playerDistance)) return attempt.overtakenRivals.size;

  attempt.rivals.forEach((rival, index) => {
    if (attempt.overtakenRivals.has(index)) return;
    const frame = replayFrameAt(rival, elapsed);
    const rivalProgress = Number(frame?.p);
    if (!Number.isFinite(rivalProgress)) return;

    const completedRivalLaps = Number.isFinite(Number(rival?.time)) && Number(rival.time) > 0
      ? Math.floor(elapsed / Number(rival.time))
      : 0;
    const rivalDistance = completedRivalLaps + rivalProgress;
    const difference = playerDistance - rivalDistance;
    const relation = difference > PROGRESS_EPSILON
      ? 1
      : difference < -PROGRESS_EPSILON
        ? -1
        : 0;
    const rivalState = attempt.rivalStates[index];

    if (relation > 0 && rivalState.previousRelation <= 0 && boostActive) {
      attempt.overtakenRivals.add(index);
    }
    rivalState.previousRelation = relation;
  });

  return attempt.overtakenRivals.size;
}

export function completedNightShiftSheriff(attempt, detail = {}) {
  return attempt?.eligible === true
    && attempt.overtakenRivals.size === RIVAL_COUNT
    && Number(detail.position) === 1
    && Number(detail.total) >= RIVAL_COUNT + 1;
}
