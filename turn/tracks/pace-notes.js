// Production pace-note overlay for the promoted long MOUNTAIN course.
// All non-MOUNTAIN tracks delegate to the previous production maps unchanged.
import * as base from './pace-notes-base.js';

export const PACE_NOTE_DIRECTION = base.PACE_NOTE_DIRECTION;
export const PACE_NOTE_LENGTH = base.PACE_NOTE_LENGTH;

function createPaceNote(id, triggerStart, triggerEnd, groups) {
  return Object.freeze({
    id,
    triggerStart,
    triggerEnd,
    groups: Object.freeze(groups.map((group) => Object.freeze({ ...group })))
  });
}

const { LEFT, RIGHT } = PACE_NOTE_DIRECTION;
const { SHORT, MEDIUM, LONG } = PACE_NOTE_LENGTH;

export const MOUNTAIN_LONG_PACE_NOTES = Object.freeze([
  createPaceNote('mountain-long-1', 0.045, 0.150, [{ direction: LEFT, severity: 1, length: LONG }]),
  createPaceNote('mountain-long-2', 0.215, 0.270, [{ direction: LEFT, severity: 2, length: LONG }]),
  createPaceNote('mountain-long-3', 0.278, 0.307, [{ direction: RIGHT, severity: 3, length: MEDIUM }]),
  createPaceNote('mountain-long-4', 0.318, 0.352, [{ direction: LEFT, severity: 3, length: MEDIUM }]),
  createPaceNote('mountain-long-5', 0.366, 0.405, [{ direction: RIGHT, severity: 3, length: MEDIUM }]),
  createPaceNote('mountain-long-6', 0.409, 0.451, [
    { direction: LEFT, severity: 2, length: SHORT },
    { direction: RIGHT, severity: 2, length: MEDIUM }
  ]),
  createPaceNote('mountain-long-7', 0.488, 0.558, [{ direction: LEFT, severity: 2, length: LONG }]),
  createPaceNote('mountain-long-8', 0.725, 0.825, [{ direction: LEFT, severity: 2, length: LONG }]),
  createPaceNote('mountain-long-9', 0.835, 0.872, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  createPaceNote('mountain-long-10', 0.935, 0.970, [{ direction: RIGHT, severity: 3, length: MEDIUM }])
]);

export function getTrackPaceNotes(trackId) {
  return String(trackId || '').toLowerCase() === 'mountain'
    ? MOUNTAIN_LONG_PACE_NOTES
    : base.getTrackPaceNotes(trackId);
}

export const speedAdjustedPaceNoteTrigger = base.speedAdjustedPaceNoteTrigger;
