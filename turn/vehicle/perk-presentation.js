import { getVehiclePerk } from './perks.js';
import { getCarDefinition } from './catalog.js';
import { getAchievement } from '../achievements/catalog.js';

export function perkSourceLabel(perk) {
  return perk.achievementId ? getAchievement(perk.achievementId)?.title || ''
    : perk.vehicleIds.map((id) => getCarDefinition(id).name).join(' · ');
}

// OVERDRIVE deliberately has no top-end ceiling; player-facing copy describes the fast, clean-driving requirement without exposing tuning numbers.
export const FUTURE_RACER_REWARD_PERK_DESCRIPTION =
  'The longer you drive fast and clean, the higher the speed cap becomes. Leaving the track or colliding resets it.';

export const FUTURE_RACER_CAR_PERK_DESCRIPTION =
  'The longer you drive fast and clean, the higher the speed cap becomes. Leaving the track or colliding resets it.';

// FLOW ×2 remains ordinary SHIFT; the no-reduction perk starts at the ×3 boundary.
export const SUPERCAR_FLOW_SHIFT_PERK_DESCRIPTION =
  'At FLOW ×3 or higher, SHIFT adds its three attribute points without reductions. SHIFT again moves the boost to the other three attributes.';

// A running perk's race pill as its slot fills, or empties (perk-runtime.js): by perk id,
// so an installed perk says the same as on its own car.
export function resolveVehiclePerkStatusFeedback({
  perkId = '',
  previousProgress = 0,
  nextProgress = 0
} = {}) {
  const previousFull = Number(previousProgress) >= 1;
  const nextFull = Number(nextProgress) >= 1;
  if (!previousFull && nextFull) {
    if (perkId === 'full-tank') return 'FULL TANK';
    if (perkId === 'torque') return 'BOOST TANK 5/5';
    if (perkId === 'drift-demon') return 'DRIFT 5/5';
  }
  if (perkId === 'full-tank' && previousFull && !nextFull) return 'FULL TANK LOST';
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

// The perks a lap ran (#1219), as SPECTATE and SHARE name them: its car's own, then the
// one installed beside it. "Torque + Driftage"; empty when it ran none.
export function lapPerksLabel(perks) {
  return [perks?.original, perks?.installed]
    .map((id) => getVehiclePerk(id)?.title)
    .filter(Boolean)
    .map((title) => title.toLocaleLowerCase('en').replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('en')))
    .join(' + ');
}
