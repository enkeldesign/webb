// TURN LAB world wrapper: build the current production MOUNTAIN first, then add
// only the long-course bridge/valley dressing. The query suffix deliberately avoids
// the LAB import-map key so this import cannot recurse back into this wrapper.
import { installMountainWorld as installProductionMountainWorld } from '/turn/tracks/mountain-world-r3.js?revision=r177-ipad-sky-aspect&lab-base=mountain-long-r1';
import { installMountainLongExtension } from './mountain-long-extension-r1.js?revision=mountain-long-r1';

export function installMountainWorld(options = {}) {
  const world = installProductionMountainWorld(options);
  const baseReady = world?.ready;
  world.ready = Promise.resolve(baseReady)
    .then(() => installMountainLongExtension(world, options.samples, options.trackWidth));
  return world;
}
