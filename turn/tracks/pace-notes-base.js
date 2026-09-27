import { assertTrackConfigCoverage } from './definitions.js';

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
  createPaceNote('countryside-1', 0.918, 0.968, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }]),
  createPaceNote('countryside-2', 0.300, 0.368, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 1 }]),
  createPaceNote('countryside-3', 0.414, 0.482, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }]),
  createPaceNote('countryside-4', 0.590, 0.658, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 1 }])
]);

const AIRPORT_PACE_NOTES = Object.freeze([
  createPaceNote('airport-1', 0.948, 0.988, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('airport-2', 0.155, 0.225, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 1, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('airport-3', 0.385, 0.455, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG },
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('airport-4', 0.565, 0.625, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }])
]);

const CLIFFSIDE_PACE_NOTES = Object.freeze([
  createPaceNote('cliffside-1', 0.925, 0.975, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }]),
  createPaceNote('cliffside-2', 0.165, 0.230, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 1 }]),
  createPaceNote('cliffside-3', 0.366, 0.434, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }]),
  createPaceNote('cliffside-4', 0.505, 0.570, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 1 },
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }
  ]),
  createPaceNote('cliffside-5', 0.720, 0.785, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 1 }])
]);

const HARBOR_PACE_NOTES = Object.freeze([
  createPaceNote('harbor-1', 0.928, 0.982, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }]),
  createPaceNote('harbor-2', 0.108, 0.176, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3 }]),
  createPaceNote('harbor-3', 0.344, 0.412, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 3 }]),
  createPaceNote('harbor-4', 0.548, 0.616, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3 }]),
  createPaceNote('harbor-5', 0.766, 0.834, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2 }])
]);

// MIDNIGHT CITY was rebuilt after its first pace-note map. The trigger windows still
// line up with the new bends, but the old left/right sequence was mirrored. These
// directions follow the current route geometry in increasing track-progress order.
const MIDNIGHT_CITY_PACE_NOTES = Object.freeze([
  createPaceNote('midnight-city-1', 0.102, 0.128, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('midnight-city-2', 0.145, 0.176, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('midnight-city-3', 0.232, 0.262, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM },
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('midnight-city-4', 0.266, 0.292, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('midnight-city-5', 0.338, 0.372, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM },
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('midnight-city-6', 0.450, 0.480, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('midnight-city-7', 0.490, 0.520, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('midnight-city-8', 0.622, 0.656, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG },
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('midnight-city-9', 0.722, 0.754, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM },
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('midnight-city-10', 0.818, 0.852, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM },
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('midnight-city-11', 0.906, 0.938, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('midnight-city-12', 0.958, 0.982, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }])
]);

// MOUNTAIN's first Codespace drive exposed the usual coordinate-handness trap: the
// original map was exactly mirrored. These are the verified driver-perspective calls.
const MOUNTAIN_PACE_NOTES = Object.freeze([
  createPaceNote('mountain-1', 0.052, 0.145, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 1, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('mountain-2', 0.180, 0.285, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('mountain-3', 0.438, 0.535, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('mountain-4', 0.590, 0.652, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('mountain-5', 0.686, 0.744, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('mountain-6', 0.790, 0.846, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('mountain-7', 0.884, 0.938, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('mountain-8', 0.962, 0.995, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.SHORT }])
]);

// BEACHFRONT and DEAD CANYON: authored in TURN LAB with corrected left/right ears.
const BEACHFRONT_PACE_NOTES = Object.freeze([
  createPaceNote('beachfront-west-sweeper', 0.055, 0.120, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('beachfront-west-top', 0.135, 0.205, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('beachfront-park-s', 0.225, 0.275, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('beachfront-north-gardens', 0.305, 0.405, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('beachfront-lakeside-left', 0.485, 0.545, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('beachfront-east-sweep', 0.570, 0.645, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('beachfront-culdesac-entry', 0.675, 0.730, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('beachfront-culdesac-exit', 0.735, 0.805, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('beachfront-backyard-hairpin', 0.825, 0.855, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 4, length: PACE_NOTE_LENGTH.SHORT }]),
  createPaceNote('beachfront-home-sweeper', 0.880, 0.965, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }])
]);

const DEAD_CANYON_PACE_NOTES = Object.freeze([
  createPaceNote('dead-canyon-chicane', 0.030, 0.095, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.SHORT },
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.SHORT },
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('dead-canyon-2', 0.115, 0.175, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('dead-canyon-3', 0.205, 0.265, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('dead-canyon-north-sweep', 0.345, 0.445, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('dead-canyon-5', 0.470, 0.525, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('dead-canyon-6', 0.555, 0.615, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('dead-canyon-7', 0.640, 0.695, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('dead-canyon-8', 0.710, 0.765, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.LONG }]),
  createPaceNote('dead-canyon-9', 0.785, 0.835, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.SHORT }]),
  createPaceNote('dead-canyon-10', 0.850, 0.890, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('dead-canyon-11', 0.900, 0.940, [{ direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }]),
  createPaceNote('dead-canyon-12', 0.948, 0.982, [{ direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.LONG }])
]);

export const TRACK_PACE_NOTE_MAPS = Object.freeze({
  countryside: COUNTRYSIDE_PACE_NOTES,
  airport: AIRPORT_PACE_NOTES,
  cliffside: CLIFFSIDE_PACE_NOTES,
  beachfront: BEACHFRONT_PACE_NOTES,
  harbor: HARBOR_PACE_NOTES,
  'dead-canyon': DEAD_CANYON_PACE_NOTES,
  'midnight-city': MIDNIGHT_CITY_PACE_NOTES,
  mountain: MOUNTAIN_PACE_NOTES
});
assertTrackConfigCoverage(TRACK_PACE_NOTE_MAPS, 'track pace-note maps');

const EMPTY_PACE_NOTES = Object.freeze([]);

export function getTrackPaceNotes(trackId) {
  return TRACK_PACE_NOTE_MAPS[String(trackId || '').toLowerCase()] || EMPTY_PACE_NOTES;
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
