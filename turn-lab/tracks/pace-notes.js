// TURN LAB pace-note overlay for BADLANDS, which occupies the MOUNTAIN slot.
import * as production from '../../turn/tracks/pace-notes.js?lab-base=badlands-r1';

export const PACE_NOTE_DIRECTION = production.PACE_NOTE_DIRECTION;
export const PACE_NOTE_LENGTH = production.PACE_NOTE_LENGTH;

function note(id, triggerStart, triggerEnd, groups) {
  return Object.freeze({
    id,
    triggerStart,
    triggerEnd,
    groups: Object.freeze(groups.map((group) => Object.freeze({ ...group })))
  });
}

const { LEFT, RIGHT } = PACE_NOTE_DIRECTION;
const { SHORT, MEDIUM, LONG } = PACE_NOTE_LENGTH;

export const BADLANDS_PACE_NOTES = Object.freeze([
  note('badlands-1', 0.105, 0.165, [{ direction: LEFT, severity: 2, length: LONG }]),
  note('badlands-2', 0.205, 0.255, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('badlands-3', 0.275, 0.345, [{ direction: LEFT, severity: 3, length: LONG }]),
  note('badlands-4', 0.425, 0.490, [{ direction: LEFT, severity: 2, length: LONG }]),
  note('badlands-5', 0.545, 0.605, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('badlands-6', 0.650, 0.705, [{ direction: LEFT, severity: 3, length: MEDIUM }]),
  note('badlands-7', 0.770, 0.825, [{ direction: RIGHT, severity: 2, length: SHORT }]),
  note('badlands-8', 0.865, 0.935, [{ direction: LEFT, severity: 2, length: LONG }])
]);

export function getTrackPaceNotes(trackId) {
  return String(trackId || '').toLowerCase() === 'mountain'
    ? BADLANDS_PACE_NOTES
    : production.getTrackPaceNotes(trackId);
}

export const speedAdjustedPaceNoteTrigger = production.speedAdjustedPaceNoteTrigger;
