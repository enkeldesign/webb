import { installAirportWorld as installAirportWorldR53 } from './airport-world-r53.js?build=20260814-r57';
import { installAirportEmergency } from './airport-emergency-r493.js?revision=r493-playtest';

export function installAirportWorld(options = {}) {
  const world = installAirportWorldR53(options);
  removeMedicalBayJetBridge(world);
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
    sceneLevelEmergencyLoop: true,
    clearMedicalSignSightline: true,
    prebuiltCrashWreck: true,
    continuousEmergencyAudio: true
  });
  return world;
}

function removeMedicalBayJetBridge(world) {
  const obstruction = world.children.find((node) => (
    node?.isGroup
    && nearly(node.position?.x, -52)
    && nearly(node.position?.z, -32)
    && node.children?.length === 2
  ));
  if (!obstruction) return false;
  world.remove(obstruction);
  return true;
}

function nearly(value, expected) {
  return Math.abs(Number(value) - expected) < 0.01;
}
