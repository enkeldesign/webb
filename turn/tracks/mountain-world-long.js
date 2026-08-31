// Production MOUNTAIN long-course wrapper. Build the established production
// mountain first, then add the tested bridge/lower-valley extension.
import { installMountainWorld as installBaseMountainWorld } from './mountain-world-r3.js?revision=r177-ipad-sky-aspect&base=mountain-long-r1';
import { installMountainLongExtension } from './mountain-long-extension-r1.js?revision=mountain-long-r18';

const BASE_WORLD_SAMPLE_COUNT = 1080;

function baseWorldSamples(samples) {
  if (samples.length === BASE_WORLD_SAMPLE_COUNT) return samples;
  return Array.from({ length: BASE_WORLD_SAMPLE_COUNT }, (_, index) => (
    samples[Math.floor(index * samples.length / BASE_WORLD_SAMPLE_COUNT) % samples.length]
  ));
}

export function installMountainWorld(options = {}) {
  const fullSamples = options.samples;
  const worldSamples = baseWorldSamples(fullSamples);
  const world = installBaseMountainWorld({ ...options, samples: worldSamples });
  const baseReady = world?.ready;
  world.ready = Promise.resolve(baseReady)
    .then(() => installMountainLongExtension(world, fullSamples, options.trackWidth))
    .then(() => {
      world.userData.turnMountainSampling = Object.freeze({
        runtimeSamples: fullSamples.length,
        baseWorldSamples: worldSamples.length
      });
      return world;
    });
  return world;
}
