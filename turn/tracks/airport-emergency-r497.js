import {
  AIRPORT_EMERGENCY_CONFIG,
  installAirportEmergency as installAirportEmergencyR496
} from './airport-emergency-r496.js?revision=r497-depth-fire';

export { AIRPORT_EMERGENCY_CONFIG };

const AMBULANCE_ID = 'ambulance';
const PREPARED_WRECK_NAME = 'Airport B787 Prepared Wreck';
const FIRE_NAME = 'Airport MAYDAY fire';
const R496_TARGET_PENETRATION_Y = 10.5;
// The latest r496 playtest is close, but the fuselage still reads slightly suspended
// from several approach angles. Add a modest final 1.5 world units rather than making
// another large correction.
const TARGET_WRECK_PENETRATION_Y = 12.0;
const EXTRA_WRECK_PENETRATION_Y = TARGET_WRECK_PENETRATION_Y - R496_TARGET_PENETRATION_Y;
// The original layered flame works well up close but is too small relative to the
// full-scale 62-unit B787. Scaling the existing fire group keeps the same animation,
// materials and cost while making the emergency legible from the racing line.
const FIRE_SCALE = 1.7;
const WRECK_FIND_INTERVAL_MS = 120;
const WRECK_FIND_ATTEMPTS = 160;

export function installAirportEmergency(options = {}) {
  const runtime = options.runtime || globalThis.__turnRuntime;
  const installation = installAirportEmergencyR496(options);
  enlargeCrashFire(options.world);
  installFinalWreckDepth(options.world, runtime);
  return installation;
}

function enlargeCrashFire(world) {
  if (!world || world.userData.turnMaydayR497FireScaleApplied) return;
  const fire = world.getObjectByName(FIRE_NAME);
  if (!fire) return;
  fire.scale.setScalar(FIRE_SCALE);
  world.userData.turnMaydayR497FireScaleApplied = Object.freeze({ scale: FIRE_SCALE });
  world.updateMatrixWorld(true);
}

function installFinalWreckDepth(world, runtime) {
  if (!world || world.userData.turnMaydayR497WreckCalibration) return;

  let timer = 0;
  let attempts = 0;
  let applied = false;

  const tryApply = () => {
    timer = 0;
    if (applied) return;

    const wreck = world.getObjectByName(PREPARED_WRECK_NAME);
    const mount = wreck?.parent;
    if (
      wreck
      && mount
      && mount.userData.turnMaydayR496DepthApplied
      && !mount.userData.turnMaydayR497DepthApplied
    ) {
      mount.position.y -= EXTRA_WRECK_PENETRATION_Y;
      mount.userData.turnMaydayR497DepthApplied = true;
      world.updateMatrixWorld(true);
      applied = true;
      return;
    }

    attempts += 1;
    if (
      attempts < WRECK_FIND_ATTEMPTS
      && String(runtime?.state?.vehicleId || '').toLowerCase() === AMBULANCE_ID
    ) {
      timer = globalThis.setTimeout(tryApply, WRECK_FIND_INTERVAL_MS);
    }
  };

  const arm = () => {
    if (applied || timer) return;
    if (String(runtime?.state?.vehicleId || '').toLowerCase() !== AMBULANCE_ID) return;
    attempts = 0;
    timer = globalThis.setTimeout(tryApply, 0);
  };

  globalThis.addEventListener?.('turn:ui-state-change', arm);
  globalThis.addEventListener?.('turn:track-changed', arm);
  arm();

  world.userData.turnMaydayR497WreckCalibration = Object.freeze({
    basePenetration: R496_TARGET_PENETRATION_Y,
    targetPenetration: TARGET_WRECK_PENETRATION_Y,
    additionalPenetration: EXTRA_WRECK_PENETRATION_Y,
    basis: 'small final playtest correction after r496; lowers the wreck another 1.5 world units'
  });
}
