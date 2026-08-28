export const FUTURE_RACER_REWARD_PERK_DESCRIPTION =
  'After a few seconds of clean driving on-track the speed cap starts increasing. Leaving the track or colliding resets it.';

export const FUTURE_RACER_CAR_PERK_DESCRIPTION =
  'A few seconds of staying on-track raises the speed cap. Leaving the track or colliding resets it.';

export function vehiclePerkPresentation(vehicleId, perk) {
  if (!perk) return null;
  if (vehicleId !== 'race-future') return perk;
  return Object.freeze({
    ...perk,
    description: FUTURE_RACER_CAR_PERK_DESCRIPTION
  });
}
