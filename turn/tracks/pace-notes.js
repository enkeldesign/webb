import {
  PACE_NOTE_DIRECTION,
  PACE_NOTE_LENGTH,
  circularProgressSpan,
  getCompiledTrackPaceNotes
} from './pace-note-compiler.js';
import {
  getTrackPaceNoteRecipes,
  validatePaceNoteRecipes
} from './pace-note-recipes.js';

export {
  PACE_NOTE_DIRECTION,
  PACE_NOTE_LENGTH,
  getTrackPaceNoteRecipes,
  validatePaceNoteRecipes
};

const EMPTY_PACE_NOTES = Object.freeze([]);

export function getTrackPaceNotes(trackId, samples) {
  if (!Array.isArray(samples) || samples.length < 8) return EMPTY_PACE_NOTES;
  return getCompiledTrackPaceNotes(trackId, samples);
}

export function speedAdjustedPaceNoteTrigger(note, speed, maxSpeed = 88) {
  const start = clampProgress(note?.triggerStart);
  const end = clampProgress(note?.triggerEnd);
  const safeMaxSpeed = Math.max(20, Number(maxSpeed) || 88);
  const speedRatio = clamp((Math.max(0, Number(speed) || 0) - 6) / (safeMaxSpeed * 0.72), 0, 1);
  const span = circularProgressSpan(start, end);
  return clampProgress(start + span * (1 - speedRatio));
}

function clampProgress(value) {
  const progress = Number(value) || 0;
  return ((progress % 1) + 1) % 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
