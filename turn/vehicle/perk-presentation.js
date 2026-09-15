// OVERDRIVE deliberately has no top-end ceiling; keep the five-second gain explicit in player-facing copy.
export const FUTURE_RACER_REWARD_PERK_DESCRIPTION =
  'The longer you drive cleanly and stay on track, the higher the speed cap becomes. Leaving the track or colliding resets it.';

export const FUTURE_RACER_CAR_PERK_DESCRIPTION =
  'The longer you drive cleanly and stay on track, the higher the speed cap becomes. Leaving the track or colliding resets it.';

// FLOW ×2 remains ordinary SHIFT; the no-reduction perk starts at the ×3 boundary.
export const SUPERCAR_FLOW_SHIFT_PERK_DESCRIPTION =
  'At FLOW ×3 or higher, SHIFT adds its three attribute points without reductions. SHIFT again moves the boost to the other three attributes.';

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
