// OVERDRIVE deliberately has no top-end ceiling; player-facing copy describes the fast, clean-driving requirement without exposing tuning numbers.
export const FUTURE_RACER_REWARD_PERK_DESCRIPTION =
  'The longer you drive fast and clean, the higher the speed cap becomes. Leaving the track or colliding resets it.';

export const FUTURE_RACER_CAR_PERK_DESCRIPTION =
  'The longer you drive fast and clean, the higher the speed cap becomes. Leaving the track or colliding resets it.';

// FLOW ×2 remains ordinary SHIFT; the no-reduction perk starts at the ×3 boundary.
export const SUPERCAR_FLOW_SHIFT_PERK_DESCRIPTION =
  'At FLOW ×3 or higher, SHIFT adds its three attribute points without reductions. SHIFT again moves the boost to the other three attributes.';

export function resolveVehiclePerkStatusFeedback({
  vehicleId = '',
  perkUnlocked = false,
  previousProgress = 0,
  nextProgress = 0
} = {}) {
  if (perkUnlocked !== true) return null;

  const previousFull = Number(previousProgress) >= 1;
  const nextFull = Number(nextProgress) >= 1;
  if (!previousFull && nextFull) {
    if (vehicleId === 'suv') return 'FULL TANK';
    if (vehicleId === 'truck') return 'BOOST TANK 5/5';
    if (vehicleId === 'sedan-sports') return 'DRIFT 5/5';
  }
  if (vehicleId === 'suv' && previousFull && !nextFull) return 'FULL TANK LOST';
  return null;
}

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
