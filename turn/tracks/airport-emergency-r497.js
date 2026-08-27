import {
  AIRPORT_EMERGENCY_CONFIG,
  installAirportEmergency as installAirportEmergencyR496
} from './airport-emergency-r496.js?revision=r497-depth-fire';

export { AIRPORT_EMERGENCY_CONFIG };

const AMBULANCE_ID = 'ambulance';
const PREPARED_WRECK_NAME = 'Airport B787 Prepared Wreck';
const FIRE_NAME = 'Airport MAYDAY fire';
const R496_TARGET_PENETRATION_Y = 10.5;
// The r497 playtest is close, but the fuselage still reads too high above the ground.
// Lower it another 4 world units from the tested 12-unit result.
const TARGET_WRECK_PENETRATION_Y = 16.0;
const EXTRA_WRECK_PENETRATION_Y = TARGET_WRECK_PENETRATION_Y - R496_TARGET_PENETRATION_Y;
// Production defers the two parent calibration layers, so r497 owns one single lookup
// and applies the already-tested final 16-unit penetration in one cheap position change.
const WRECK_FIND_INTERVAL_MS = 250;
const WRECK_FIND_ATTEMPTS = 80;
// The original layered flame works well up close but is too small relative to the
// full-scale 62-unit B787. Scaling the existing fire group keeps the same animation,
// materials and cost while making the emergency legible from the racing line.
const FIRE_SCALE = 1.7;

export function installAirportEmergency(options = {}) {
  const runtime = options.runtime || globalThis.__turnRuntime;
  const deferredParentCalibration = options.deferWreckCalibration === true;
  const installation = installAirportEmergencyR496(options);
  enlargeCrashFire(options.world);
  installFinalWreckDepth(options.world, runtime, { deferredParentCalibration });
  return installation;
}

function enlargeCrashFire(world) {
  if (!world || world.userData.turnMaydayR497FireScaleApplied) return;
  const fire = world.getObjectByName(FIRE_NAME);
  if (!fire) return;
  fire.scale.setScalar(FIRE_SCALE);
  world.userData.turnMaydayR497FireScaleApplied = Object.freeze({ scale: FIRE_SCALE });
}

function installFinalWreckDepth(world, runtime, { deferredParentCalibration = false } = {}) {
  if (!world || world.userData.turnMaydayR497WreckCalibration) return;

  let timer = 0;
  let attempts = 0;
  let applied = false;
  let preparedWreck = null;

  const tryApply = () => {
    timer = 0;
    if (applied) return;

    preparedWreck ||= world.getObjectByName(PREPARED_WRECK_NAME);
    const wreck = preparedWreck;
    const mount = wreck?.parent;
    if (wreck && mount && !mount.userData.turnMaydayR497DepthApplied) {
      if (deferredParentCalibration) {
        mount.position.y -= TARGET_WRECK_PENETRATION_Y;
        // Preserve the historical layer flags for diagnostics and any code that only
        // cares whether those approved depth stages have effectively been applied.
        mount.userData.turnMaydayR494DepthApplied = true;
        mount.userData.turnMaydayR496DepthApplied = true;
      } else {
        mount.position.y -= EXTRA_WRECK_PENETRATION_Y;
      }
      mount.userData.turnMaydayR497DepthApplied = true;
      // No forced full-world matrix refresh: normal rendering updates this small transform
      // on the next frame instead of synchronously traversing the entire Airport scene.
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
    basePenetration: deferredParentCalibration ? 0 : R496_TARGET_PENETRATION_Y,
    targetPenetration: TARGET_WRECK_PENETRATION_Y,
    additionalPenetration: deferredParentCalibration ? TARGET_WRECK_PENETRATION_Y : EXTRA_WRECK_PENETRATION_Y,
    deferredParentCalibration,
    basis: 'r498 playtest correction; production applies the same final depth in one calibration pass'
  });
}
