export const PACE_NOTE_DIRECTION = Object.freeze({
  LEFT: -1,
  RIGHT: 1
});

export const PACE_NOTE_LENGTH = Object.freeze({
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long'
});

function createPaceNote(id, triggerStart, triggerEnd, groups) {
  return Object.freeze({
    id,
    triggerStart,
    triggerEnd,
    groups: Object.freeze(groups.map((group) => Object.freeze({ ...group })))
  });
}

const COUNTRYSIDE_PACE_NOTES = Object.freeze([
  createPaceNote('countryside-1', 0.918, 0.968, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }
  ]),
  createPaceNote('countryside-2', 0.300, 0.368, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 1 }
  ]),
  createPaceNote('countryside-3', 0.414, 0.482, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }
  ]),
  createPaceNote('countryside-4', 0.590, 0.658, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 1 }
  ])
]);

const AIRPORT_PACE_NOTES = Object.freeze([
  createPaceNote('airport-1', 0.948, 0.988, [
    {
      direction: PACE_NOTE_DIRECTION.RIGHT,
      severity: 2,
      length: PACE_NOTE_LENGTH.MEDIUM
    }
  ]),
  createPaceNote('airport-2', 0.155, 0.225, [
    {
      direction: PACE_NOTE_DIRECTION.RIGHT,
      severity: 1,
      length: PACE_NOTE_LENGTH.LONG
    }
  ]),
  createPaceNote('airport-3', 0.385, 0.455, [
    {
      direction: PACE_NOTE_DIRECTION.RIGHT,
      severity: 2,
      length: PACE_NOTE_LENGTH.LONG
    },
    {
      direction: PACE_NOTE_DIRECTION.LEFT,
      severity: 3,
      length: PACE_NOTE_LENGTH.MEDIUM
    }
  ]),
  createPaceNote('airport-4', 0.565, 0.625, [
    {
      direction: PACE_NOTE_DIRECTION.RIGHT,
      severity: 2,
      length: PACE_NOTE_LENGTH.LONG
    }
  ])
]);

const CLIFFSIDE_PACE_NOTES = Object.freeze([
  createPaceNote('cliffside-1', 0.925, 0.975, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }
  ]),
  createPaceNote('cliffside-2', 0.165, 0.230, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 1 }
  ]),
  createPaceNote('cliffside-3', 0.366, 0.434, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }
  ]),
  createPaceNote('cliffside-4', 0.505, 0.570, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 1 },
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }
  ]),
  createPaceNote('cliffside-5', 0.720, 0.785, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 1 }
  ])
]);

const HARBOR_PACE_NOTES = Object.freeze([
  createPaceNote('harbor-1', 0.928, 0.982, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }
  ]),
  createPaceNote('harbor-2', 0.108, 0.176, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3 }
  ]),
  createPaceNote('harbor-3', 0.344, 0.412, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3 }
  ]),
  createPaceNote('harbor-4', 0.548, 0.616, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3 }
  ]),
  createPaceNote('harbor-5', 0.766, 0.834, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }
  ])
]);

const MIDNIGHT_CITY_PACE_NOTES = Object.freeze([
  createPaceNote('midnight-city-1', 0.108, 0.136, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.LONG }
  ]),
  createPaceNote('midnight-city-2', 0.142, 0.169, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('midnight-city-3', 0.252, 0.280, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('midnight-city-4', 0.282, 0.310, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }
  ]),
  createPaceNote('midnight-city-5', 0.386, 0.414, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('midnight-city-6', 0.415, 0.443, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.LONG }
  ]),
  createPaceNote('midnight-city-7', 0.528, 0.558, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('midnight-city-8', 0.560, 0.592, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }
  ]),
  createPaceNote('midnight-city-9', 0.690, 0.725, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.LONG },
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }
  ]),
  createPaceNote('midnight-city-10', 0.824, 0.858, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('midnight-city-11', 0.974, 0.998, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ])
]);

const PACE_NOTE_MAPS = Object.freeze({
  countryside: COUNTRYSIDE_PACE_NOTES,
  airport: AIRPORT_PACE_NOTES,
  cliffside: CLIFFSIDE_PACE_NOTES,
  harbor: HARBOR_PACE_NOTES,
  'midnight-city': MIDNIGHT_CITY_PACE_NOTES
});

const EMPTY_PACE_NOTES = Object.freeze([]);

export function getTrackPaceNotes(trackId) {
  return PACE_NOTE_MAPS[String(trackId || '').toLowerCase()] || EMPTY_PACE_NOTES;
}

export function speedAdjustedPaceNoteTrigger(note, speed, maxSpeed = 88) {
  const start = clampProgress(note?.triggerStart);
  const end = clampProgress(note?.triggerEnd);
  const safeMaxSpeed = Math.max(20, Number(maxSpeed) || 88);
  const speedRatio = clamp((Math.max(0, Number(speed) || 0) - 6) / (safeMaxSpeed * 0.72), 0, 1);
  return end - (end - start) * speedRatio;
}

function clampProgress(value) {
  return clamp(Number(value) || 0, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
