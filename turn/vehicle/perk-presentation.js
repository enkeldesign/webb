export const FUTURE_RACER_REWARD_PERK_DESCRIPTION =
  'After a few seconds of clean driving on-track the speed cap starts increasing. Leaving the track or colliding resets it.';

export const FUTURE_RACER_CAR_PERK_DESCRIPTION =
  'A few seconds of staying on-track raises the speed cap. Leaving the track or colliding resets it.';

export const SUPERCAR_FLOW_SHIFT_PERK_DESCRIPTION =
  'At FLOW ×2 or higher, SHIFT adds its three attribute points without reductions. SHIFT again moves the boost to the other three attributes.';

export function vehiclePerkPresentation(vehicleId, perk) {
  if (!perk) return null;
  if (vehicleId === 'race-future') {
    return Object.freeze({
      ...perk,
      description: FUTURE_RACER_CAR_PERK_DESCRIPTION
    });
  }
  if (vehicleId === 'supercar') {
    return Object.freeze({
      ...perk,
      description: SUPERCAR_FLOW_SHIFT_PERK_DESCRIPTION
    });
  }
  return perk;
}
