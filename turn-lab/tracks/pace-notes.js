// TURN LAB pace-note overlay for the extended MOUNTAIN route.
// All non-MOUNTAIN tracks delegate directly to the current production maps.
import * as production from '../../turn/tracks/pace-notes.js?lab-base=mountain-long';

export const PACE_NOTE_DIRECTION = production.PACE_NOTE_DIRECTION;
export const PACE_NOTE_LENGTH = production.PACE_NOTE_LENGTH;

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

// These windows follow increasing arc-length progress in the long route. The
// summit/slalom calls occupy the first half; the bridge exit, lower-village sweep
// and final climbing hairpin each get their own advance warning.
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
    : production.getTrackPaceNotes(trackId);
}

export const speedAdjustedPaceNoteTrigger = production.speedAdjustedPaceNoteTrigger;
