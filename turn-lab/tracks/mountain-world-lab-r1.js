// TURN LAB world wrapper: build the current production MOUNTAIN first, then add
// only the long-course bridge/valley dressing. The query suffix deliberately avoids
// the LAB import-map key so this import cannot recurse back into this wrapper.
import { installMountainWorld as installProductionMountainWorld } from '/turn/tracks/mountain-world-r3.js?lab-base=mountain-long';
import { installMountainLongExtension } from './mountain-long-extension-r1.js';

const PRODUCTION_WORLD_SAMPLE_COUNT = 1080;

function productionWorldSamples(samples) {
  if (samples.length === PRODUCTION_WORLD_SAMPLE_COUNT) return samples;
  return Array.from({ length: PRODUCTION_WORLD_SAMPLE_COUNT }, (_, index) => (
    samples[Math.floor(index * samples.length / PRODUCTION_WORLD_SAMPLE_COUNT) % samples.length]
  ));
}

export function installMountainWorld(options = {}) {
  const fullSamples = options.samples;
  const worldSamples = productionWorldSamples(fullSamples);
  const world = installProductionMountainWorld({ ...options, samples: worldSamples });
  const baseReady = world?.ready;
  world.ready = Promise.resolve(baseReady)
    .then(() => installMountainLongExtension(world, fullSamples, options.trackWidth))
    .then(() => {
      world.userData.turnMountainLabSampling = Object.freeze({
        runtimeSamples: fullSamples.length,
        productionWorldSamples: worldSamples.length
      });
      return world;
    });
  return world;
}
