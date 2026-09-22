// TURN LAB pace-note overlay for DEAD CANYON, which occupies the MOUNTAIN slot.
import * as production from '../../turn/tracks/pace-notes.js?lab-base=dead-canyon-r1';

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

export const DEAD_CANYON_PACE_NOTES = Object.freeze([
  note('dead-canyon-1', 0.035, 0.090, [{ direction: LEFT, severity: 1, length: LONG }]),
  note('dead-canyon-2', 0.105, 0.160, [{ direction: LEFT, severity: 2, length: LONG }]),
  note('dead-canyon-3', 0.180, 0.235, [{ direction: LEFT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-4', 0.268, 0.330, [{ direction: LEFT, severity: 3, length: LONG }]),
  note('dead-canyon-5', 0.338, 0.390, [{ direction: LEFT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-6', 0.455, 0.515, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-7', 0.545, 0.605, [{ direction: LEFT, severity: 2, length: LONG }]),
  note('dead-canyon-8', 0.625, 0.680, [{ direction: LEFT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-9', 0.695, 0.755, [{ direction: LEFT, severity: 3, length: LONG }]),
  note('dead-canyon-10', 0.770, 0.820, [{ direction: LEFT, severity: 2, length: SHORT }]),
  note('dead-canyon-11', 0.835, 0.875, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-12', 0.882, 0.925, [{ direction: LEFT, severity: 3, length: MEDIUM }]),
  note('dead-canyon-13', 0.935, 0.970, [{ direction: LEFT, severity: 2, length: LONG }])
]);

export function getTrackPaceNotes(trackId) {
  return String(trackId || '').toLowerCase() === 'mountain'
    ? DEAD_CANYON_PACE_NOTES
    : production.getTrackPaceNotes(trackId);
}

export const speedAdjustedPaceNoteTrigger = production.speedAdjustedPaceNoteTrigger;
