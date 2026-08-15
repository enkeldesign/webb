import { installAirportWorld as installAirportWorldR53 } from './airport-world-r53.js?build=20260814-r57';
import { installAirportEmergency } from './airport-emergency-r489.js?revision=r489-golden-hour';

export function installAirportWorld(options = {}) {
  const world = installAirportWorldR53(options);
  installAirportEmergency({
    world,
    samples: options.samples,
    runtime: options.runtime || globalThis.__turnRuntime
  });

  world.name = 'TURN Airport r54';
  world.userData.turnAirportArtDirection = Object.freeze({
    ...(world.userData.turnAirportArtDirection || {}),
    version: 'r54',
    ambulanceEmergency: true,
    sessionPersistentCrash: true,
    permanentTerminalMedicalMarker: true
  });
  return world;
}
