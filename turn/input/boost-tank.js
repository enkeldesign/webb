import { BOOST_OVERCHARGE_MAX_SECONDS } from './boost-overcharge.js?revision=r219-overcharge-state';

export const ROAD_RAGE_CONVERSION_SECONDS = 8;
export const ROAD_RAGE_MIN_SPEED = 8;

// The canonical tank keeps charge as its TOTAL base fill. converted is a purple
// portion of that fill, never extra fuel. The existing 0.6-second OVERCHARGE bonus
// remains separate. All quantities use the same BOOST drain path, OC first.
// Converted fuel is stored, not loose: only BOOST spends it (#1265). Leaking it
// would drop a full tank below full, stop conversion and re-cross the full cue.
export function convertBoostTank(tank, dt, { enabled, requested, offRoad, collided, speed }) {
  if (!enabled || requested || offRoad || collided || speed < ROAD_RAGE_MIN_SPEED
    || tank.charge < 0.999999 || !(tank.overcharge > 0 || tank.converted > 0)) return false;
  const before = tank.converted;
  tank.converted = Math.min(tank.charge, tank.converted + Math.max(0, dt) / ROAD_RAGE_CONVERSION_SECONDS);
  // A fully converted tank is still eligible but no longer converting.
  return tank.converted > before;
}

// Mutate the caller's reused step record: no per-frame resource object allocation.
export function consumeBoostTank(tank, dt, duration, multiplier = 1) {
  let seconds = Math.max(0, dt) * Math.max(1, multiplier);
  tank.burningOvercharge = seconds > 0 && (tank.overcharge > 0 || tank.converted > 0);
  const bonusSeconds = Math.min(seconds, tank.overcharge * BOOST_OVERCHARGE_MAX_SECONDS);
  tank.overcharge = Math.max(0, tank.overcharge - bonusSeconds / BOOST_OVERCHARGE_MAX_SECONDS);
  seconds -= bonusSeconds;
  const used = Math.min(tank.charge, seconds / Math.max(0.001, duration));
  tank.converted = Math.max(0, tank.converted - used);
  tank.charge = Math.max(0, tank.charge - used);
}
