import * as THREE from 'three';
import { installMountainTerrain } from './mountain-world-r3-terrain.js';
import { installMountainScenery } from './mountain-world-r3-scenery.js';
import { installMountainR3Polish } from './mountain-world-r3-polish.js';
import { installMountainR4VisualPolish } from './mountain-world-r4-visual-polish.js';
import { installMountainR4CabinFix } from './mountain-world-r4-cabin-fix.js';

export function installMountainWorld({ scene, samples, trackWidth = 27, runtime } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 3) {
    throw new Error('TURN: Mountain r3 requires a scene and sampled route.');
  }

  const world = new THREE.Group();
  world.name = 'TURN Mountain r3';
  scene.add(world);

  const terrainContext = installMountainTerrain(world, samples, trackWidth);
  installMountainR3Polish(world, samples, trackWidth);
  const sceneryReady = installMountainScenery(world, samples, trackWidth, terrainContext);
  world.ready = Promise.resolve(sceneryReady)
    .then(() => installMountainR4VisualPolish(world, samples, trackWidth, terrainContext))
    .then(() => installMountainR4CabinFix(world, samples, trackWidth, terrainContext))
    .then(() => world);
  world.userData.turnMountainTerrainHeightAt = terrainContext.terrainHeightAt;
  world.userData.turnMountainArtDirection = Object.freeze({
    version: 'r3',
    visualPolish: 'r4-village-waterfall-landmarks-native-cabins',
    ground: 'continuous-snow-and-granite-terrain-body',
    roadEdge: 'white-with-black-outer-contour',
    roadbed: 'opaque-and-terrain-supported',
    retainingFoundation: '4.6m-granite-skirt',
    routeClearanceProtected: true,
    assetVillage: 'Kenney-Holiday-native-pivot-cabins-and-Fantasy-Town-market',
    villageSquare: 'winter-market-no-fountain',
    streetlights: 'warm-static-halos',
    waterfallCliff: 'terrain-plus-Kenney-Nature-modules-open-to-track',
    visibleWaterfallCurtain: true,
    layeredMountainBackdrop: true,
    integratedSnowCaps: true,
    authoredSnowDrifts: true,
    riverHasChannelBanksAndBed: true,
    boundingBoxGroundedAssets: true,
    noIceGripModifier: true
  });

  if (runtime) runtime.mountainWorld = world;
  return world;
}
