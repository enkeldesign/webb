// TURN LAB pace-note overlay for SUBURBS, which occupies the MOUNTAIN slot.
import * as production from '../../turn/tracks/pace-notes.js?lab-base=suburbs';

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

// Deliberately sparse and early: SUBURBS is the easy, readable first-drive course.
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
  return String(trackId || '').toLowerCase() === 'mountain'
    ? SUBURBS_PACE_NOTES
    : production.getTrackPaceNotes(trackId);
}

export const speedAdjustedPaceNoteTrigger = production.speedAdjustedPaceNoteTrigger;
