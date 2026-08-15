import { installAirportWorld as installAirportWorldR53 } from './airport-world-r53.js?build=20260814-r57';
import { installAirportEmergency } from './airport-emergency-r492.js?revision=r492-playtest';

export function installAirportWorld(options = {}) {
  const world = installAirportWorldR53(options);
  installAirportEmergency({
    world,
    samples: options.samples,
    runtime: options.runtime || globalThis.__turnRuntime
  });

  world.name = 'TURN Airport r56';
  world.userData.turnAirportArtDirection = Object.freeze({
    ...(world.userData.turnAirportArtDirection || {}),
    version: 'r56',
    ambulanceEmergency: true,
    maydayPlaytestFixes: true,
    prewarmedMedicalResponders: true,
    positionedResponderSirens: true,
    broadMedicalBay: true,
    responderCentredMedicalBay: true,
    sceneLevelEmergencyLoop: true
  });
  return world;
}
