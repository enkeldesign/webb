import {
  DEFAULT_TRACK_ID,
  TRACK_CATALOG,
  TRACK_SAMPLE_COUNT,
  createTrackRuntime,
  normalizeTrackId
} from '/turn-next/airport-runway-catalog.js';
import { installAirportRunwayWorld } from '/turn-next/airport-runway-world.js';
import { installAirportWorld } from '/turn/tracks/airport-world-r52.js?build=20260722-r52';
import { installCliffsideWorld } from '/turn/tracks/cliffside-world-r76.js?build=20260808-r162';
import { installHarborWorld } from '/turn/tracks/harbor-world-r81.js?build=20260808-r162';
import { installMidnightCityWorld } from '/turn/tracks/midnight-city-world-r11.js?build=20260802-r11';
import { isForgivingTrackSurface } from '/turn/tracks/airport-runoff.js?build=20260722-r52';

const WORLD_INSTALLERS = Object.freeze({
  countryside({ initialWorld }) {
    if (!initialWorld) throw new Error('TURN NEXT: Countryside requires the initial production world.');
    return initialWorld;
  },
  airport({ scene, samples, trackWidth }) {
    return installAirportWorld({ scene, samples, trackWidth });
  },
  'airport-runway'({ scene, samples, trackWidth }) {
    return installAirportRunwayWorld({ scene, samples, trackWidth });
  },
  cliffside({ scene, samples, trackWidth }) {
    return installCliffsideWorld({ scene, samples, trackWidth });
  },
  harbor({ scene, samples, trackWidth }) {
    return installHarborWorld({ scene, samples, trackWidth });
  },
  'midnight-city'({ scene, samples, trackWidth, runtime }) {
    return installMidnightCityWorld({ scene, samples, trackWidth, runtime });
  }
});

const FORGIVING_SURFACES = Object.freeze({
  countryside: () => false,
  airport: (position) => isForgivingTrackSurface('airport', position),
  'airport-runway': (position) => isForgivingTrackSurface('airport', position),
  cliffside: () => false,
  harbor: () => false,
  'midnight-city': () => false
});

export const TRACK_RUNTIME_REGISTRY = Object.freeze(TRACK_CATALOG.map((definition) => {
  const installWorld = WORLD_INSTALLERS[definition.id];
  const isForgivingSurface = FORGIVING_SURFACES[definition.id];
  if (typeof installWorld !== 'function' || typeof isForgivingSurface !== 'function') {
    throw new Error(`TURN NEXT: track ${definition.id} has an incomplete runtime contract.`);
  }
  return Object.freeze({
    ...definition,
    storageRevision: definition.storageRevision,
    freeRoamDistance: definition.freeRoamDistance,
    collisionProfile: definition.collisionProfile,
    createRuntime(sampleCount = TRACK_SAMPLE_COUNT) {
      return createTrackRuntime(definition.id, definition.sampleCount || sampleCount);
    },
    installWorld,
    isForgivingSurface
  });
}));

export function getTrackRuntimeEntry(trackId = DEFAULT_TRACK_ID) {
  const normalized = normalizeTrackId(trackId);
  return TRACK_RUNTIME_REGISTRY.find((track) => track.id === normalized) || TRACK_RUNTIME_REGISTRY[0];
}
