import { installAirportWorld as installAirportWorldR53 } from './airport-world-r53.js?build=20260814-r57';
import { installAirportEmergency } from './airport-emergency-r490.js?revision=r490-mayday-polish';

export function installAirportWorld(options = {}) {
  const world = installAirportWorldR53(options);
  installAirportEmergency({
    world,
    samples: options.samples,
    runtime: options.runtime || globalThis.__turnRuntime
  });

  world.name = 'TURN Airport r55';
  world.userData.turnAirportArtDirection = Object.freeze({
    ...(world.userData.turnAirportArtDirection || {}),
    version: 'r55',
    ambulanceEmergency: true,
    maydayAchievement: true,
    realB787Wreck: true,
    terminalMedicalBay: true,
    positionedEmergencyGuidance: true,
    sessionPersistentCrash: true
  });
  return world;
}
