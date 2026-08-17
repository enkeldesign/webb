import * as THREE from 'three';
import { installMountainTerrain } from './mountain-world-r3-terrain.js';
import { installMountainScenery } from './mountain-world-r3-scenery.js';

export function installMountainWorld({ scene, samples, trackWidth = 27, runtime } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 3) {
    throw new Error('TURN: Mountain r3 requires a scene and sampled route.');
  }

  const world = new THREE.Group();
  world.name = 'TURN Mountain r3';
  scene.add(world);

  const terrainContext = installMountainTerrain(world, samples, trackWidth);
  const sceneryReady = installMountainScenery(world, samples, trackWidth, terrainContext);
  world.ready = Promise.resolve(sceneryReady).then(() => world);
  world.userData.turnMountainTerrainHeightAt = terrainContext.terrainHeightAt;
  world.userData.turnMountainArtDirection = Object.freeze({
    version: 'r3',
    ground: 'continuous-snow-and-granite-terrain-body',
    roadEdge: 'white-with-black-outer-contour',
    roadbed: 'opaque-and-terrain-supported',
    routeClearanceProtected: true,
    assetVillage: 'Kenney-Holiday-and-Fantasy-Town',
    waterfallCliff: 'terrain-plus-Kenney-Nature-modules',
    integratedSnowCaps: true,
    authoredSnowDrifts: true,
    riverHasChannelBanksAndBed: true,
    boundingBoxGroundedAssets: true,
    noIceGripModifier: true
  });

  if (runtime) runtime.mountainWorld = world;
  return world;
}
