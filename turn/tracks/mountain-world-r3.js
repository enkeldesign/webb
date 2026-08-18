import * as THREE from 'three';
import { installMountainTerrain } from './mountain-world-r3-terrain.js';
import { installMountainScenery } from './mountain-world-r3-scenery.js';
import { installMountainR3Polish } from './mountain-world-r3-polish.js';
import { installMountainR4VisualPolish } from './mountain-world-r4-visual-polish.js';
import { installMountainR4WaterfallNotch } from './mountain-world-r4-waterfall-notch.js';
import { installMountainR4DriverFacingWaterfall } from './mountain-world-r4-waterfall-face.js';
import { installMountainR5SuburbanVillage } from './mountain-world-r5-suburban-village.js';
import { installMountainR6Night } from './mountain-world-r6-night.js';
import { installMountainR7SkyFix } from './mountain-world-r7-sky.js';
import { installMountainSpotlightHeadlight } from './mountain-player-headlight-r8.js?revision=r175-reconcile';

const MOUNTAIN_VILLAGE_BENCHES = new Set([
  'Mountain village bench r4',
  'Mountain village overlook bench r4'
]);
const MOUNTAIN_MOONLIGHT_FILL = 0x18314c;
const MOUNTAIN_MOONLIGHT_FILL_INTENSITY = 0.16;

function faceMountainVillageBenchesTowardTrack(world) {
  world.traverse((object) => {
    if (!MOUNTAIN_VILLAGE_BENCHES.has(object.name)) return;
    if (object.userData.turnMountainBenchFacesTrack) return;
    object.rotation.y += Math.PI;
    object.userData.turnMountainBenchFacesTrack = true;
  });
}

function addStaticMoonlitHillFill(world) {
  let meshCount = 0;
  world.traverse((object) => {
    if (!object?.isMesh || !/^Mountain (continuous terrain body|integrated snowy (peak backdrop|ridge)) r3$/.test(object.name || '')) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    let changed = false;
    for (const material of materials) {
      if (!material?.isMeshStandardMaterial || !material.emissive) continue;
      material.emissive.setHex(MOUNTAIN_MOONLIGHT_FILL);
      material.emissiveIntensity = MOUNTAIN_MOONLIGHT_FILL_INTENSITY;
      material.needsUpdate = true;
      changed = true;
    }
    if (changed) meshCount += 1;
  });
  world.userData.turnMountainMoonlitHillMeshes = meshCount;
  return meshCount;
}

export function installMountainWorld({ scene, samples, trackWidth = 27, runtime } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 3) {
    throw new Error('TURN: Mountain r3 requires a scene and sampled route.');
  }

  const world = new THREE.Group();
  world.name = 'TURN Mountain r3';
  scene.add(world);

  // One real shadowless light shared with MIDNIGHT CITY. The lamp and target
  // are children of the player car, so TURN's existing vehicle pitch carries
  // the beam naturally over MOUNTAIN's grades without terrain-specific work.
  const playerHeadlightRig = installMountainSpotlightHeadlight(runtime?.playerCar, runtime);
  world.userData.turnMountainPlayerHeadlightRig = playerHeadlightRig;

  const terrainContext = installMountainTerrain(world, samples, trackWidth);
  installMountainR3Polish(world, samples, trackWidth);
  const sceneryReady = installMountainScenery(world, samples, trackWidth, terrainContext);
  world.ready = Promise.resolve(sceneryReady)
    .then(() => installMountainR4VisualPolish(world, samples, trackWidth, terrainContext))
    .then(() => installMountainR4WaterfallNotch(world))
    .then(() => installMountainR4DriverFacingWaterfall(world, samples))
    .then(() => installMountainR5SuburbanVillage(world, samples, trackWidth, terrainContext))
    .then(() => {
      faceMountainVillageBenchesTowardTrack(world);
      return installMountainR6Night(world, samples, trackWidth, terrainContext);
    })
    .then(() => {
      installMountainR7SkyFix(world);
      addStaticMoonlitHillFill(world);
      return world;
    });
  world.userData.turnMountainTerrainHeightAt = terrainContext.terrainHeightAt;
  world.userData.turnMountainArtDirection = Object.freeze({
    version: 'r3',
    visualPolish: 'r560-shared-night-spotlight-plus-r7-horizon-sky-plus-r6-night-plus-r5-suburban-village-plus-r4-waterfall-landmarks',
    ground: 'continuous-snow-and-granite-terrain-body',
    roadEdge: 'white-with-black-outer-contour',
    roadbed: 'opaque-and-terrain-supported',
    retainingFoundation: '4.6m-granite-skirt',
    routeClearanceProtected: true,
    assetVillage: 'Kenney-City-Kit-Suburban-complete-buildings-A-G-M-N-U',
    villagePalette: 'dark-brown-walls-and-snow-white-roofs',
    villageSquare: 'winter-market-no-fountain',
    nightSky: 'local-star-field-skydome-with-separate-moon-sprite',
    skyBehavior: 'flat-star-backdrop-with-world-up-roll-lock-and-world-yaw-uv-lock-with-gentle-drag',
    reducedMotionSky: 'solid-deep-blue-track-background-with-moon-retained-and-parallax-suppressed',
    celestialLayer: 'r7-reparents-the-r6-moon-onto-the-star-plane-at-the-same-depth',
    moon: 'same-depth-star-plane-child-sharing-yaw-pitch-roll-and-parallax',
    moonlight: 'cool-hemisphere-and-directional-track-atmosphere-plus-static-blue-hill-fill',
    playerVisibilityLight: playerHeadlightRig
      ? 'shared-warm-shadowless-spotlight-identical-to-midnight-city'
      : 'static-moonlight-only-when-no-player-car-is-present',
    streetlights: 'warm-static-halos-plus-midnight-city-style-ground-pools-and-local-fill',
    houseWindows: 'warm-emissive-looking-panels-on-every-suburban-house-with-limited-local-spill',
    waterfallLight: 'cool-moonlit-emissive-water-surfaces',
    waterfallCliff: 'terrain-plus-Kenney-Nature-rock-shoulders-open-at-centre',
    visibleWaterfallCurtain: true,
    waterfallDriverSightline: 'open-rock-cleft-plus-driver-facing-water-plane',
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
