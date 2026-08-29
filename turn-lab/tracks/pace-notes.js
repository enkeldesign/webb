// TURN LAB pace-note overlay for the extended MOUNTAIN route.
// All non-MOUNTAIN tracks delegate directly to the current production maps.
import * as production from '/turn/tracks/pace-notes.js?lab-base=mountain-long-r1';

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

// These windows follow increasing arc-length progress in mountain-long-r1.
// The original summit/slalom calls are compressed into the first half because
// the new lake bridge and lower valley roughly double the old return journey.
const MOUNTAIN_LONG_PACE_NOTES = Object.freeze([
  createPaceNote('mountain-long-1', 0.050, 0.145, [{ direction: LEFT, severity: 1, length: LONG }]),
  createPaceNote('mountain-long-2', 0.235, 0.286, [{ direction: LEFT, severity: 2, length: LONG }]),
  createPaceNote('mountain-long-3', 0.305, 0.342, [{ direction: RIGHT, severity: 3, length: MEDIUM }]),
  createPaceNote('mountain-long-4', 0.355, 0.394, [{ direction: LEFT, severity: 3, length: MEDIUM }]),
  createPaceNote('mountain-long-5', 0.414, 0.445, [{ direction: RIGHT, severity: 3, length: MEDIUM }]),
  createPaceNote('mountain-long-6', 0.462, 0.487, [{ direction: LEFT, severity: 2, length: MEDIUM }]),
  createPaceNote('mountain-long-7', 0.489, 0.514, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  createPaceNote('mountain-long-8', 0.542, 0.598, [{ direction: LEFT, severity: 2, length: LONG }]),
  createPaceNote('mountain-long-9', 0.780, 0.850, [{ direction: LEFT, severity: 2, length: LONG }]),
  createPaceNote('mountain-long-10', 0.947, 0.979, [{ direction: RIGHT, severity: 3, length: MEDIUM }]),
  createPaceNote('mountain-long-11', 0.982, 0.997, [{ direction: RIGHT, severity: 2, length: SHORT }])
]);

export function getTrackPaceNotes(trackId) {
  return String(trackId || '').toLowerCase() === 'mountain'
    ? MOUNTAIN_LONG_PACE_NOTES
    : production.getTrackPaceNotes(trackId);
}

export const speedAdjustedPaceNoteTrigger = production.speedAdjustedPaceNoteTrigger;
