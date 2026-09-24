// TURN LAB pace-note overlay for both experimental courses.
import * as production from '../../turn/tracks/pace-notes.js?lab-base=dead-canyon-suburbs';

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
  note('dead-canyon-2', 0.115, 0.175, [{ direction: RIGHT, severity: 2, length: LONG }]),
  note('dead-canyon-3', 0.205, 0.265, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-north-sweep', 0.345, 0.445, [{ direction: RIGHT, severity: 2, length: LONG }]),
  note('dead-canyon-5', 0.470, 0.525, [{ direction: LEFT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-6', 0.555, 0.615, [{ direction: RIGHT, severity: 2, length: LONG }]),
  note('dead-canyon-7', 0.640, 0.695, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-8', 0.710, 0.765, [{ direction: RIGHT, severity: 3, length: LONG }]),
  note('dead-canyon-9', 0.785, 0.835, [{ direction: LEFT, severity: 2, length: SHORT }]),
  note('dead-canyon-10', 0.850, 0.890, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('dead-canyon-11', 0.900, 0.940, [{ direction: RIGHT, severity: 3, length: MEDIUM }]),
  note('dead-canyon-12', 0.948, 0.982, [{ direction: LEFT, severity: 2, length: LONG }])
]);

export const SUBURBS_PACE_NOTES = Object.freeze([
  note('suburbs-west-sweeper', 0.055, 0.120, [{ direction: RIGHT, severity: 2, length: LONG }]),
  note('suburbs-west-top', 0.135, 0.205, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('suburbs-park-s', 0.225, 0.275, [{ direction: LEFT, severity: 3, length: MEDIUM }]),
  note('suburbs-north-gardens', 0.305, 0.405, [{ direction: RIGHT, severity: 2, length: LONG }]),
  note('suburbs-lakeside-left', 0.485, 0.545, [{ direction: LEFT, severity: 2, length: LONG }]),
  note('suburbs-east-sweep', 0.570, 0.645, [{ direction: RIGHT, severity: 2, length: MEDIUM }]),
  note('suburbs-culdesac-entry', 0.675, 0.730, [{ direction: LEFT, severity: 3, length: MEDIUM }]),
  note('suburbs-culdesac-exit', 0.735, 0.805, [{ direction: RIGHT, severity: 3, length: MEDIUM }]),
  note('suburbs-backyard-hairpin', 0.825, 0.855, [{ direction: LEFT, severity: 4, length: SHORT }]),
  note('suburbs-home-sweeper', 0.880, 0.965, [{ direction: RIGHT, severity: 2, length: LONG }])
]);

export function getTrackPaceNotes(trackId) {
  const id = String(trackId || '').toLowerCase();
  if (id === 'mountain') return DEAD_CANYON_PACE_NOTES;
  if (id === 'cliffside') return SUBURBS_PACE_NOTES;
  return production.getTrackPaceNotes(trackId);
}

export const speedAdjustedPaceNoteTrigger = production.speedAdjustedPaceNoteTrigger;
