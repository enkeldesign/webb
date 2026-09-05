import {
  TROPHY_ROAD_REWARDS as PERK_TROPHY_ROAD_REWARDS,
  TROPHY_ROAD_REWARD_ICONS as BASE_TROPHY_ROAD_REWARD_ICONS
} from './trophy-road-perks-r164.js?revision=r230-vehicle-perks';
import {
  FUTURE_RACER_REWARD_PERK_DESCRIPTION
} from '../vehicle/perk-presentation.js?revision=r220-apex-grip';

export * from './trophy-road-perks-r164.js?revision=r230-vehicle-perks';

export const TROPHY_ROAD_MAX_THRESHOLD = 3975;

export const TROPHY_ROAD_REWARD_ICONS = Object.freeze({
  ...BASE_TROPHY_ROAD_REWARD_ICONS,
  future: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M3 32h12l7-5 4-10h10l5 9h10l3-8h7v7h-7l7 7v5H4Z"></path><path d="M23 27h28M29 17l5 10M5 27v-6h13M52 18h9M53 24h8"></path><circle cx="18" cy="39" r="5"></circle><circle cx="49" cy="39" r="5"></circle></svg>',
  vintage: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M5 31h11l5-8h19l7 8h11v7H5Z"></path><path d="M24 23l4-9h10l5 9M32 14v9M8 27h10M47 27h10"></path><circle cx="17" cy="38" r="7"></circle><circle cx="49" cy="38" r="7"></circle><path d="M29 20h7"></path></svg>',
  rally: '<svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><path d="M6 31h8l6-12h25l8 12h5v7H6Z"></path><path d="M23 19h18l5 12M24 25h23M12 27h7M48 16h7l3 7"></path><circle cx="18" cy="39" r="6"></circle><circle cx="49" cy="39" r="6"></circle><circle cx="27" cy="29" r="2"></circle><circle cx="34" cy="29" r="2"></circle></svg>'
});

export const TROPHY_ROAD_REWARDS = Object.freeze(PERK_TROPHY_ROAD_REWARDS.map((reward) => {
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
const REWARD_BY_VEHICLE_PERK = new Map(
  TROPHY_ROAD_REWARDS
    .filter((reward) => reward.type === 'vehicle-perk' && reward.vehicleId)
    .map((reward) => [reward.vehicleId, reward])
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

export function rewardForVehiclePerk(vehicleId) {
  return REWARD_BY_VEHICLE_PERK.get(vehicleId) || null;
}
