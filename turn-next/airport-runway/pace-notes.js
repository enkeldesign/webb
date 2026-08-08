import {
  PACE_NOTE_DIRECTION,
  PACE_NOTE_LENGTH,
  getTrackPaceNotes as getCanonicalTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '/turn/tracks/pace-notes.js?airport-runway-base=r2';
import { AIRPORT_RUNWAY_PACE_NOTE_BLUEPRINT } from '/turn-next/airport-runway/spec.js';

const DIRECTION = Object.freeze({
  left: PACE_NOTE_DIRECTION.LEFT,
  right: PACE_NOTE_DIRECTION.RIGHT
});

const LENGTH = Object.freeze({
  short: PACE_NOTE_LENGTH.SHORT,
  medium: PACE_NOTE_LENGTH.MEDIUM,
  long: PACE_NOTE_LENGTH.LONG
});

const AIRPORT_RUNWAY_PACE_NOTES = Object.freeze(AIRPORT_RUNWAY_PACE_NOTE_BLUEPRINT.map((note) => Object.freeze({
  id: note.id,
  triggerStart: note.triggerStart,
  triggerEnd: note.triggerEnd,
  groups: Object.freeze([
    Object.freeze({
      direction: DIRECTION[note.direction],
      severity: note.severity,
      length: LENGTH[note.length]
    })
  ])
})));

export { PACE_NOTE_DIRECTION, PACE_NOTE_LENGTH, speedAdjustedPaceNoteTrigger };

export function getTrackPaceNotes(trackId) {
  if (String(trackId || '').toLowerCase() === 'airport') return AIRPORT_RUNWAY_PACE_NOTES;
  return getCanonicalTrackPaceNotes(trackId);
}
