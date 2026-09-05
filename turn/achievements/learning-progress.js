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

export const HOW_TO_PLAY_DISCLOSURE_IDS = Object.freeze([
  'choose-track-and-car',
  'turn-device-to-steer',
  'drive-with-one-thumb',
  'build-and-use-overcharge',
  'catch-and-use-overcharge',
  'shift',
  'drift-points',
  'flow-points',
  'drive-by-ear-sounds'
]);

export function completedLearningSet(completedIds, requiredIds) {
  const completed = new Set(Array.isArray(completedIds) ? completedIds : []);
  return requiredIds.every((id) => completed.has(id));
}
