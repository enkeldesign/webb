// TURN LAB pace-note overlay for DEAD CANYON, which occupies the MOUNTAIN slot.
import * as production from '../../turn/tracks/pace-notes.js?lab-base=dead-canyon-r6';

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
  note('dead-canyon-chicane', 0.030, 0.095, [
    { direction: RIGHT, severity: 3, length: SHORT },
    { direction: LEFT, severity: 3, length: SHORT },
    { direction: RIGHT, severity: 2, length: SHORT }
  ]),
  note('dead-canyon-2', 0.115, 0.175, [{ direction: LEFT, severity: 2, length: LONG }]),
  note('dead-canyon-3', 0.205, 0.265, [{ direction: LEFT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-north-sweep', 0.345, 0.445, [{ direction: LEFT, severity: 2, length: LONG }]),
  note('dead-canyon-5', 0.470, 0.525, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-6', 0.555, 0.615, [{ direction: LEFT, severity: 2, length: LONG }]),
  note('dead-canyon-7', 0.640, 0.695, [{ direction: LEFT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-black-tunnel', 0.695, 0.790, [
    { direction: RIGHT, severity: 2, length: LONG },
    { direction: LEFT, severity: 2, length: LONG }
  ]),
  note('dead-canyon-9', 0.785, 0.835, [{ direction: LEFT, severity: 2, length: SHORT }]),
  note('dead-canyon-10', 0.850, 0.890, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-11', 0.900, 0.940, [{ direction: LEFT, severity: 3, length: MEDIUM }]),
  note('dead-canyon-12', 0.948, 0.982, [{ direction: LEFT, severity: 2, length: LONG }])
]);

export function getTrackPaceNotes(trackId) {
  return String(trackId || '').toLowerCase() === 'mountain'
    ? DEAD_CANYON_PACE_NOTES
    : production.getTrackPaceNotes(trackId);
}

export const speedAdjustedPaceNoteTrigger = production.speedAdjustedPaceNoteTrigger;
