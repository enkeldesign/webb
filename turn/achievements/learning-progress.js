export const DRIVE_BY_EAR_ACHIEVEMENT_ID = 'drive-by-ear';
export const LEARN_TO_PLAY_ACHIEVEMENT_ID = 'learn-to-play';
export const DRIVE_BY_EAR_PART_COMPLETED_EVENT = 'turn:dbe-training-stage-completed';
export const HOW_TO_PLAY_DISCLOSURE_OPENED_EVENT = 'turn:how-to-play-disclosure-opened';
export const LEARNING_FEEDBACK_READY_EVENT = 'turn:learning-feedback-ready';

export const DRIVE_BY_EAR_PART_IDS = Object.freeze([
  'dbe-training-1',
  'dbe-training-2',
  'dbe-training-3',
  'dbe-training-4',
  'dbe-training-5'
]);

// LEARN TO PLAY: the five parts of HOW TO PLAY's QUICK REFERENCE (#748), which every
// player can open: STEER, DRIVE PAD, BOOST, RIVALS and the Drive By Ear sounds. The ids
// are the cards' old ones, so parts a player opened before still count; SHIFT, DRIFT
// ATTACK and FLOW unlock later and are no longer part of it.
export const HOW_TO_PLAY_DISCLOSURE_IDS = Object.freeze([
  'turn-device-to-steer',
  'drive-with-one-thumb',
  'build-and-use-overcharge',
  'choose-track-and-car',
  'drive-by-ear-sounds'
]);

export function completedLearningSet(completedIds, requiredIds) {
  const completed = new Set(Array.isArray(completedIds) ? completedIds : []);
  return requiredIds.every((id) => completed.has(id));
}
