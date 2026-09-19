import {
  buildWorldPlaygroundV2Environment as buildWorldPlaygroundV2EnvironmentR3,
  disposeWorldPlaygroundV2Environment
} from './world-playground-v2-environment-r3.js?revision=r3-single-terrain';
import { installWorldPlaygroundV2Landmarks } from './world-playground-v2-landmarks-r1.js?revision=r1-macro-landmarks';

export function buildWorldPlaygroundV2Environment() {
  const environment = buildWorldPlaygroundV2EnvironmentR3();
  const landmarks = installWorldPlaygroundV2Landmarks({
    world: environment.world,
    terrainHeight: environment.terrainHeight
  });

  environment.world.userData.environmentOnly = false;
  environment.world.userData.macroLandmarksInstalled = true;
  environment.world.userData.turnWorldLabBuild = '2026.09.12-lab-r216';

  return Object.freeze({
    ...environment,
    landmarks,
    landmarksReady: landmarks.userData.ready
  });
}

export { disposeWorldPlaygroundV2Environment };
