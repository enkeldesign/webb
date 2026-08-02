import {
  DEFAULT_TRACK_ID,
  TRACK_CATALOG,
  TRACK_SAMPLE_COUNT,
  createTrackRuntime,
  normalizeTrackId
} from './catalog.js';
import { installAirportWorld } from './airport-world-r52.js?build=20260722-r52';
import { installCliffsideWorld } from './cliffside-world.js';
import { installHarborWorld } from './harbor-world.js';
import { installMidnightCityWorld } from './midnight-city-world-r10.js?build=20260802-r10';
import { isForgivingTrackSurface } from './airport-runoff.js?build=20260722-r52';

const WORLD_INSTALLERS = Object.freeze({
  countryside({ initialWorld }) {
    if (!initialWorld) throw new Error('TURN: Countryside requires the initial production world.');
    return initialWorld;
  },
  airport({ scene, samples, trackWidth }) {
    return installAirportWorld({ scene, samples, trackWidth });
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
  countryside() {
    return false;
  },
  airport(position) {
    return isForgivingTrackSurface('airport', position);
  },
  cliffside() {
    return false;
  },
  harbor() {
    return false;
  },
  'midnight-city'() {
    return false;
  }
});

export const TRACK_RUNTIME_REGISTRY = Object.freeze(TRACK_CATALOG.map((definition) => {
  const installWorld = WORLD_INSTALLERS[definition.id];
  const isForgivingSurface = FORGIVING_SURFACES[definition.id];
  if (typeof installWorld !== 'function' || typeof isForgivingSurface !== 'function') {
    throw new Error(`TURN: track ${definition.id} has an incomplete runtime contract.`);
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
