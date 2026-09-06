export const HOW_TO_PLAY_REWARD_IDS = Object.freeze([
  'drift-attack',
  'shift',
  'flow'
]);

const HOW_TO_PLAY_REWARDS = new Set(HOW_TO_PLAY_REWARD_IDS);

export function rewardBatchNeedsHowToPlay(rewards = []) {
  return rewards.some((reward) => HOW_TO_PLAY_REWARDS.has(reward?.id));
}
