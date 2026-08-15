import {
  TROPHY_ROAD_REWARDS as BASE_TROPHY_ROAD_REWARDS
} from './trophy-road.js?revision=r164-vintage-rally-perks';
import {
  FUTURE_RACER_REWARD_PERK_DESCRIPTION
} from '../vehicle/perk-presentation.js?revision=r164-post-soak';

export * from './trophy-road.js?revision=r164-vintage-rally-perks';

export const TROPHY_ROAD_MAX_THRESHOLD = 1850;

export const TROPHY_ROAD_REWARDS = Object.freeze(BASE_TROPHY_ROAD_REWARDS.map((reward) => {
  if (reward.id !== 'future-racer') return reward;
  return Object.freeze({
    ...reward,
    perkDescription: FUTURE_RACER_REWARD_PERK_DESCRIPTION,
    description: `Unlock the Future Racer: built for advanced time trials.<br><strong>OVERDRIVE:</strong> ${FUTURE_RACER_REWARD_PERK_DESCRIPTION}`
  });
}));

const REWARD_BY_ID = new Map(TROPHY_ROAD_REWARDS.map((reward) => [reward.id, reward]));
const REWARD_BY_TRACK = new Map(
  TROPHY_ROAD_REWARDS.filter((reward) => reward.trackId).map((reward) => [reward.trackId, reward])
);
const REWARD_BY_VEHICLE = new Map(
  TROPHY_ROAD_REWARDS.flatMap((reward) => (reward.vehicleIds || []).map((vehicleId) => [vehicleId, reward]))
);
const REWARD_BY_FEATURE = new Map(
  TROPHY_ROAD_REWARDS.filter((reward) => reward.featureId).map((reward) => [reward.featureId, reward])
);

export function getTrophyRoadReward(id) {
  return REWARD_BY_ID.get(id) || null;
}

export function rewardForTrack(trackId) {
  return REWARD_BY_TRACK.get(trackId) || null;
}

export function rewardForVehicle(vehicleId) {
  return REWARD_BY_VEHICLE.get(vehicleId) || null;
}

export function rewardForFeature(featureId) {
  return REWARD_BY_FEATURE.get(featureId) || null;
}
