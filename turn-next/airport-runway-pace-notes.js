import {
  PACE_NOTE_DIRECTION,
  PACE_NOTE_LENGTH,
  getTrackPaceNotes as getCanonicalTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '/turn/tracks/pace-notes.js?build=20260808-r162';

function createPaceNote(id, triggerStart, triggerEnd, groups) {
  return Object.freeze({
    id,
    triggerStart,
    triggerEnd,
    groups: Object.freeze(groups.map((group) => Object.freeze({ ...group })))
  });
}

const AIRPORT_RUNWAY_PACE_NOTES = Object.freeze([
  createPaceNote('airport-runway-1', 0.225, 0.272, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('airport-runway-2', 0.304, 0.352, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('airport-runway-3', 0.387, 0.425, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('airport-runway-4', 0.456, 0.498, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('airport-runway-5', 0.530, 0.575, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('airport-runway-6', 0.610, 0.666, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('airport-runway-7', 0.685, 0.742, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.LONG }
  ]),
  createPaceNote('airport-runway-8', 0.882, 0.930, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }
  ])
]);

export { PACE_NOTE_DIRECTION, PACE_NOTE_LENGTH, speedAdjustedPaceNoteTrigger };

export function getTrackPaceNotes(trackId) {
  if (String(trackId || '').toLowerCase() === 'airport-runway') return AIRPORT_RUNWAY_PACE_NOTES;
  return getCanonicalTrackPaceNotes(trackId);
}
