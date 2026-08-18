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
import { installProjectedHeadlightsForTrack } from './projected-player-headlights.js';

const MOUNTAIN_VILLAGE_BENCHES = new Set([
  'Mountain village bench r4',
  'Mountain village overlook bench r4'
]);
const MOUNTAIN_PLAYER_LIGHT_RIG_NAME = 'TURN Mountain player light rig';
const MOUNTAIN_HEADLIGHT_PROJECTION_NAME = 'Mountain projected headlights';
const MOUNTAIN_HEADLIGHT_FILL_INTENSITY = 3.1;
// The suburban village wraps around the start/finish seam. Its authored houses
// occupy roughly 93–100% and 0–6.5% of the sampled lap; this small buffer keeps
// the car lights off throughout the visibly lamp-lit settlement.
const MOUNTAIN_VILLAGE_PROGRESS_START = 0.915;
const MOUNTAIN_VILLAGE_PROGRESS_END = 0.085;

function faceMountainVillageBenchesTowardTrack(world) {
  world.traverse((object) => {
    if (!MOUNTAIN_VILLAGE_BENCHES.has(object.name)) return;
    if (object.userData.turnMountainBenchFacesTrack) return;
    object.rotation.y += Math.PI;
    object.userData.turnMountainBenchFacesTrack = true;
  });
}

function wrappedSampleIndex(index, sampleCount) {
  if (!sampleCount) return 0;
  const numeric = Number.isFinite(Number(index)) ? Math.round(Number(index)) : 0;
  return ((numeric % sampleCount) + sampleCount) % sampleCount;
}

function mountainVillageContainsSample(index, sampleCount) {
  if (!sampleCount) return false;
  const progress = wrappedSampleIndex(index, sampleCount) / sampleCount;
  return progress >= MOUNTAIN_VILLAGE_PROGRESS_START || progress <= MOUNTAIN_VILLAGE_PROGRESS_END;
}

function roadPitchAlongHeading(state, sample) {
  const tangent = sample?.tangent;
  const tx = Number(tangent?.x);
  const ty = Number(tangent?.y);
  const tz = Number(tangent?.z);
  const heading = Number(state?.heading);
  if (![tx, ty, tz, heading].every(Number.isFinite)) return 0;

  const horizontalLength = Math.hypot(tx, tz);
  if (horizontalLength <= 1e-6) return 0;

  const trackPitch = Math.atan2(ty, horizontalLength);
  const trackHeading = Math.atan2(tx, tz);
  const headingAlignment = Math.cos(heading - trackHeading);
  // Project the road gradient onto the direction the car actually faces. This
  // also makes the headlights pitch correctly if the player turns around.
  return Math.atan(Math.tan(trackPitch) * headingAlignment);
}

function installMountainHeadlightRoadFollowing(rig, runtime, samples) {
  const state = runtime?.state;
  const projection = rig?.getObjectByName?.(MOUNTAIN_HEADLIGHT_PROJECTION_NAME);
  const fill = rig?.children?.find((child) => child?.isPointLight);
  const beams = projection?.children?.filter((child) => child?.isMesh && child.material) || [];
  if (!state || !projection || !fill || !beams.length || !samples.length) return false;

  for (const beam of beams) {
    beam.frustumCulled = false;
    beam.userData.turnMountainHeadlightBaseOpacity = Number(beam.material.opacity) || 0;
  }

  const updateHeadlights = () => {
    const index = wrappedSampleIndex(state.nearestTrackIndex, samples.length);
    const sample = samples[index];
    projection.rotation.x = roadPitchAlongHeading(state, sample);

    const village = mountainVillageContainsSample(index, samples.length);
    fill.intensity = village ? 0 : MOUNTAIN_HEADLIGHT_FILL_INTENSITY;
    for (const beam of beams) {
      beam.material.opacity = village ? 0 : beam.userData.turnMountainHeadlightBaseOpacity;
    }

    rig.userData.turnMountainRoadPitch = projection.rotation.x;
    rig.userData.turnMountainVillageLightsOff = village;
  };

  // Keep one always-rendered projection mesh as the cheap per-frame driver.
  // We change opacity rather than visibility in the village so this hook still
  // runs and can restore the headlights immediately when the car leaves it.
  const driver = beams[0];
  const previousOnBeforeRender = driver.onBeforeRender;
  driver.onBeforeRender = function mountainHeadlightRoadFollow(...args) {
    previousOnBeforeRender?.apply(this, args);
    updateHeadlights();
  };
  updateHeadlights();

  rig.userData.turnMountainHeadlightBehavior = 'road-pitch-following-with-village-blackout';
  rig.userData.turnMountainVillageProgress = Object.freeze({
    start: MOUNTAIN_VILLAGE_PROGRESS_START,
    end: MOUNTAIN_VILLAGE_PROGRESS_END
  });
  return true;
}

export function installMountainWorld({ scene, samples, trackWidth = 27, runtime } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 3) {
    throw new Error('TURN: Mountain r3 requires a scene and sampled route.');
  }

  const world = new THREE.Group();
  world.name = 'TURN Mountain r3';
  scene.add(world);

  // Reuse MIDNIGHT CITY's deliberately cheap night-driving treatment exactly:
  // one short-range fill plus two additive projected road wedges. MOUNTAIN only
  // adds terrain-following pitch and switches that rig off in the lit village.
  const playerLightRig = installProjectedHeadlightsForTrack(runtime?.playerCar, {
    trackId: 'mountain',
    rigName: MOUNTAIN_PLAYER_LIGHT_RIG_NAME,
    label: 'Mountain',
    projectionName: MOUNTAIN_HEADLIGHT_PROJECTION_NAME
  });
  const roadFollowingHeadlights = installMountainHeadlightRoadFollowing(playerLightRig, runtime, samples);
  world.userData.turnPlayerLightRig = playerLightRig;

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
    .then(() => installMountainR7SkyFix(world))
    .then(() => world);
  world.userData.turnMountainTerrainHeightAt = terrainContext.terrainHeightAt;
  world.userData.turnMountainArtDirection = Object.freeze({
    version: 'r3',
    visualPolish: 'r7-horizon-sky-plus-r6-night-plus-r5-suburban-village-plus-r4-waterfall-landmarks',
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
    celestialLayer: 'r7-reparents-the-r6-moon-onto-the-star-plane-at-the-same-depth',
    moon: 'same-depth-star-plane-child-sharing-yaw-pitch-roll-and-parallax',
    moonlight: 'cool-hemisphere-and-directional-track-atmosphere',
    playerVisibilityLight: 'MIDNIGHT CITY short-range fill plus projected unlit headlights, road-pitched and off in village',
    playerHeadlightRoadFollowing: roadFollowingHeadlights,
    playerHeadlightsVillageBlackout: roadFollowingHeadlights,
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
