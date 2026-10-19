import { BOOST_OVERCHARGE_MAX_SECONDS, BOOST_OVERCHARGE_DECAY_SECONDS, BOOST_OVERCHARGE_PHASE, boostOverchargeBuildRate } from './boost-overcharge.js?revision=r219-overcharge-state';

export const ROAD_RAGE_CONVERSION_SECONDS = 8;
export const ROAD_RAGE_MIN_SPEED = 8;

// A scorer sample already includes the DRIFT/LOCK rate that earned it. Credit it
// once, before processing the next input: a release or BOOST press cannot lose it
// or retroactively multiply it. Only credit left after filling base fuel builds OC.
export function rechargeScoringBoost(tank, weightedSeconds, rechargeSeconds, overchargeOn) {
  let credit = Math.max(0, Number(weightedSeconds) || 0);
  const filled = Math.min(Math.max(0, 1 - tank.charge), credit / rechargeSeconds);
  tank.charge += filled;
  credit = Math.max(0, credit - filled * rechargeSeconds);
  if (!credit || !overchargeOn || (tank.overcharge > 0 && tank.overchargePhase === BOOST_OVERCHARGE_PHASE.DECAYING)) return false;
  tank.overcharge = Math.min(1, tank.overcharge + credit * boostOverchargeBuildRate(1));
  const peaked = tank.overcharge >= 1;
  tank.overchargePhase = peaked ? BOOST_OVERCHARGE_PHASE.DECAYING : BOOST_OVERCHARGE_PHASE.BUILDING;
  return peaked;
}

// The canonical tank keeps charge as its TOTAL base fill. converted is a purple
// portion of that fill, never extra fuel. The existing 0.6-second OVERCHARGE bonus
// remains separate. All quantities use the same BOOST drain path, OC first.
export function convertBoostTank(tank, dt, { enabled, requested, offRoad, collided, speed }) {
  if (!enabled || requested || offRoad || collided || speed < ROAD_RAGE_MIN_SPEED
    || tank.charge < 0.999999 || !(tank.overcharge > 0 || tank.converted > 0)) return;
  tank.converted = Math.min(tank.charge, tank.converted + Math.max(0, dt) / ROAD_RAGE_CONVERSION_SECONDS);
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

export function decayConvertedBoost(tank, dt, caught, decayMultiplier = 1) {
  if (caught || tank.converted <= 0) return;
  const leaked = Math.min(tank.converted, Math.max(0, dt) / (BOOST_OVERCHARGE_DECAY_SECONDS * decayMultiplier));
  tank.converted -= leaked;
  tank.charge = Math.max(0, tank.charge - leaked);
}
