import {
  PACE_NOTE_DIRECTION,
  PACE_NOTE_LENGTH,
  getTrackPaceNotes as getCanonicalTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '/turn/tracks/pace-notes.js?build=20260808-r162&airport-runway-base=r2';
import { AIRPORT_RUNWAY_ID } from '/turn-next/airport-runway-spec.js';

function createPaceNote(id, triggerStart, triggerEnd, groups) {
  return Object.freeze({
    id,
    triggerStart,
    triggerEnd,
    groups: Object.freeze(groups.map((group) => Object.freeze({ ...group })))
  });
}

// Authored against airport-runway-layout.js r2. The runway sequence deliberately contains
// several square turns; keep these notes concise so the A380 detour remains understandable
// non-visually without becoming a wall of beeps.
const AIRPORT_RUNWAY_PACE_NOTES = Object.freeze([
  createPaceNote('airport-runway-1', 0.245, 0.286, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('airport-runway-2', 0.390, 0.424, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('airport-runway-3', 0.428, 0.455, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('airport-runway-4', 0.472, 0.500, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('airport-runway-5', 0.526, 0.555, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('airport-runway-6', 0.570, 0.600, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('airport-runway-7', 0.626, 0.656, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('airport-runway-8', 0.675, 0.704, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM }
  ]),
  createPaceNote('airport-runway-9', 0.765, 0.803, [
    { direction: PACE_NOTE_DIRECTION.LEFT, severity: 2, length: PACE_NOTE_LENGTH.MEDIUM },
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 3, length: PACE_NOTE_LENGTH.SHORT }
  ]),
  createPaceNote('airport-runway-10', 0.815, 0.885, [
    { direction: PACE_NOTE_DIRECTION.RIGHT, severity: 2, length: PACE_NOTE_LENGTH.LONG }
  ])
]);

export { PACE_NOTE_DIRECTION, PACE_NOTE_LENGTH, speedAdjustedPaceNoteTrigger };

export function getTrackPaceNotes(trackId) {
  if (String(trackId || '').toLowerCase() === AIRPORT_RUNWAY_ID) return AIRPORT_RUNWAY_PACE_NOTES;
  return getCanonicalTrackPaceNotes(trackId);
}
