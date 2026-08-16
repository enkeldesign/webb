import {
  DEFAULT_TRACK_ID,
  TRACK_CATALOG,
  TRACK_SAMPLE_COUNT,
  createTrackRuntime,
  normalizeTrackId
} from './catalog.js';
import { installAirportWorld } from './airport-world-r56.js?build=20260815-r498';
import { installCliffsideWorld } from './cliffside-world.js';
import { installHarborWorld } from './harbor-world.js';
// Historical regression markers: midnight-city-world-r9.js?build=20260802-r9, midnight-city-world-r10.js?build=20260802-r10
import { installMidnightCityWorld } from './midnight-city-world-r11.js?build=20260802-r11';
import { isForgivingTrackSurface } from './airport-runoff.js?build=20260722-r52';
import './contextual-road-edges.js?revision=r518-signature-yellow';
import './road-contour-color-r512.js?revision=r513-countryside';

const WORLD_INSTALLERS = Object.freeze({
  countryside({ initialWorld }) {
    if (!initialWorld) throw new Error('TURN: Countryside requires the initial production world.');
    return initialWorld;
  },
  airport({ scene, samples, trackWidth, runtime }) {
    return installAirportWorld({ scene, samples, trackWidth, runtime });
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

export {
  DEFAULT_TRACK_ID,
  TRACK_CATALOG,
  TRACK_SAMPLE_COUNT,
  createTrackRuntime,
  normalizeTrackId
};

export function installTrackWorld(trackId, context = {}) {
  const id = normalizeTrackId(trackId);
  const installer = WORLD_INSTALLERS[id] || WORLD_INSTALLERS[DEFAULT_TRACK_ID];
  return installer(context);
}

export function isTrackForgivingSurface(trackId, position) {
  const id = normalizeTrackId(trackId);
  return FORGIVING_SURFACES[id]?.(position) || false;
}
