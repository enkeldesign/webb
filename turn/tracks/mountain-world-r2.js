import * as THREE from 'three';
import { installMountainTerrain } from './mountain-world-r2-terrain.js';
import { installMountainScenery } from './mountain-world-r2-scenery.js';

export function installMountainWorld({ scene, samples, trackWidth = 27, runtime } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 3) {
    throw new Error('TURN: Mountain r2 requires a scene and sampled route.');
  }
  const world = new THREE.Group();
  world.name = 'TURN Mountain r2';
  scene.add(world);
  installMountainTerrain(world, samples, trackWidth);
  installMountainScenery(world, samples, trackWidth);
  world.userData.turnMountainArtDirection = Object.freeze({
    version: 'r2',
    ground: 'snow-first-with-rock-patches',
    roadEdge: 'white-with-black-outer-contour',
    routeClearanceProtected: true,
    assetVillage: 'Kenney-Holiday-and-Fantasy-Town',
    waterfallCliff: 'Kenney-Nature',
    integratedSnowCaps: true,
    irregularSnowDrifts: true,
    riverHasBed: true,
    noIceGripModifier: true
  });
  if (runtime) runtime.mountainWorld = world;
  return world;
}
