import {
  DEFAULT_TRACK_ID,
  TRACK_CATALOG,
  TRACK_SAMPLE_COUNT,
  createTrackRuntime,
  normalizeTrackId
} from './catalog.js';
import { isForgivingTrackSurface } from './airport-runoff.js?build=20260722-r52';
import './contextual-road-edges.js?revision=r518-signature-yellow';
import './start-area-polish-r519.js?revision=r519-midnight-full-width-accents';
import './airport-start-banner-r520.js?revision=r520-signature-yellow';
import './procedural-surface-polish-r522.js?revision=r524-procedural-surfaces-contrast-r171';
import './airport-surface-contrast-r525.js?revision=r525-airport-ground-contrast';

// Track metadata stays synchronous for Home, while each substantial world graph
// downloads and parses only after that track is selected.
const WORLD_INSTALLER_LOADERS = Object.freeze({
  async countryside({ initialWorld }) {
    if (!initialWorld) throw new Error('TURN: Countryside requires the initial production world.');
    return initialWorld;
  },
  async airport({ scene, samples, trackWidth, runtime }) {
    const { installAirportWorld } = await import('./airport-world-r56.js?build=20260815-r498');
    return installAirportWorld({ scene, samples, trackWidth, runtime });
  },
  async cliffside({ scene, samples, trackWidth }) {
    const { installCliffsideWorld } = await import('./cliffside-world.js');
    return installCliffsideWorld({ scene, samples, trackWidth });
  },
  async beachfront({ scene, samples, trackWidth, runtime }) {
    const { installBeachfrontWorld } = await import('./beachfront-world.js');
    return installBeachfrontWorld({ scene, samples, trackWidth, runtime });
  },
  async harbor({ scene, samples, trackWidth }) {
    const { installHarborWorld } = await import('./harbor-world.js');
    return installHarborWorld({ scene, samples, trackWidth });
  },
  async 'dead-canyon'({ scene, samples, trackWidth, runtime }) {
    const { installDeadCanyonWorld } = await import('./dead-canyon-world.js');
    return installDeadCanyonWorld({ scene, samples, trackWidth, runtime });
  },
  async 'midnight-city'({ scene, samples, trackWidth, runtime }) {
    const { installMidnightCityWorld } = await import(
      './midnight-city-world.js?build=20260927-r304'
    );
    return installMidnightCityWorld({ scene, samples, trackWidth, runtime });
  },
  async mountain({ scene, samples, trackWidth, runtime }) {
    const { installMountainWorld } = await import(
      './mountain-world.js'
    );
    return installMountainWorld({ scene, samples, trackWidth, runtime });
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
  beachfront() {
    return false;
  },
  harbor() {
    return false;
  },
  'dead-canyon'() {
    return false;
  },
  'midnight-city'() {
    return false;
  },
  mountain() {
    return false;
  }
});

export const TRACK_RUNTIME_REGISTRY = Object.freeze(TRACK_CATALOG.map((definition) => {
  const installWorld = WORLD_INSTALLER_LOADERS[definition.id];
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
