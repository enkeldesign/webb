import {
  TROPHY_ROAD_REWARDS as BASE_TROPHY_ROAD_REWARDS
} from './trophy-road.js?revision=r164-vintage-rally-perks';

export * from './trophy-road.js?revision=r164-vintage-rally-perks';

export const TROPHY_ROAD_MAX_THRESHOLD = 3075;

const BASE_REWARD_BY_ID = new Map(
  BASE_TROPHY_ROAD_REWARDS.map((reward) => [reward.id, reward])
);

const REWARD_ORDER = Object.freeze([
  Object.freeze(['vintage-racer', 300]),
  Object.freeze(['midnight-city', 400]),
  Object.freeze(['future-racer', 500]),
  Object.freeze(['emergency-pack', 600]),
  Object.freeze(['mountain', 700]),
  Object.freeze(['monster', 800]),
  Object.freeze(['paintjob', 900]),
  Object.freeze(['rally-racer', 1000])
]);

export const TROPHY_ROAD_REWARDS = Object.freeze(REWARD_ORDER.map(([id, threshold]) => {
  const reward = BASE_REWARD_BY_ID.get(id);
  if (!reward) throw new Error(`TURN Trophy Road is missing reward ${id}.`);
  return Object.freeze({ ...reward, threshold });
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

export function rewardIdsForTrophies(trophies) {
  const total = Math.max(0, Number(trophies) || 0);
  return TROPHY_ROAD_REWARDS
    .filter((reward) => total >= reward.threshold)
    .map((reward) => reward.id);
}
