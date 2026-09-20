import * as THREE from 'three';
import { installMountainTerrain } from './mountain-world-r3-terrain.js';
import { installMountainScenery } from './mountain-world-r3-scenery.js';
import { installMountainR3Polish } from './mountain-world-r3-polish.js';
import { installMountainR4VisualPolish } from './mountain-world-r4-visual-polish.js';
import { installMountainR4WaterfallNotch } from './mountain-world-r4-waterfall-notch.js';
import { installMountainR4DriverFacingWaterfall } from './mountain-world-r4-waterfall-face.js';
import { installMountainR5SuburbanVillage } from './mountain-world-r5-suburban-village.js';
import { installMountainR6Night } from './mountain-world-r6-night.js';
import { installMountainSpotlightHeadlight } from './mountain-player-headlight-r8.js?revision=r175-reconcile';

const MOUNTAIN_VILLAGE_BENCHES = new Set([
  'Mountain village bench r4',
  'Mountain village overlook bench r4'
]);
const MOUNTAIN_MOONLIGHT_FILL = 0x18314c;
const MOUNTAIN_MOONLIGHT_FILL_INTENSITY = 0.16;
const FINAL_VILLAGE_OPTIONS = Object.freeze({ skipRetiredHolidayCabins: true });
const MOUNTAIN_SLALOM_WARNING_TARGET = Object.freeze({ x: 138, z: 168 });
const MOUNTAIN_WARNING_YELLOW = 0xffc400;
const MOUNTAIN_WARNING_INK = 0x08090a;
const MOUNTAIN_WARNING_POST = 0x34383d;
const MOUNTAIN_WARNING_PLATE_Y = 5.0;

function warningTriangleShape(scale = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.72 * scale);
  shape.lineTo(1.82 * scale, -1.38 * scale);
  shape.lineTo(-1.82 * scale, -1.38 * scale);
  shape.closePath();
  return shape;
}

function warningExclamationBarShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.19, 0.70);
  shape.lineTo(0.19, 0.70);
  shape.lineTo(0.12, -0.54);
  shape.lineTo(-0.12, -0.54);
  shape.closePath();
  return shape;
}

function makeDownhillSlalomWarningSign() {
  const root = new THREE.Group();
  root.name = 'Mountain downhill slalom warning sign';
  root.userData.turnGameplayLandmark = true;
  root.userData.turnCollision = false;

  const yellow = new THREE.MeshBasicMaterial({ color: MOUNTAIN_WARNING_YELLOW, side: THREE.DoubleSide });
  const ink = new THREE.MeshBasicMaterial({ color: MOUNTAIN_WARNING_INK, side: THREE.DoubleSide });
  const postMaterial = new THREE.MeshStandardMaterial({ color: MOUNTAIN_WARNING_POST, roughness: 0.82, metalness: 0.18 });
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xeaf1f4, roughness: 1, metalness: 0 });

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.38, 4.6, 0.38), postMaterial);
  // Keep the support fully behind the plate so it cannot read as part of the symbol.
  post.position.set(0, 2.3, -0.30);
  post.name = 'Mountain warning sign dark post';
  root.add(post);

  const snowFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.02, 0.30, 8), snowMaterial);
  snowFoot.position.y = 0.15;
  snowFoot.name = 'Mountain warning sign snow foot';
  root.add(snowFoot);

  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(warningTriangleShape(1), {
      depth: 0.18,
      bevelEnabled: false,
      curveSegments: 1
    }),
    yellow
  );
  plate.position.set(0, MOUNTAIN_WARNING_PLATE_Y, -0.09);
  plate.name = 'Mountain warning sign yellow plate';
  root.add(plate);

  const border = new THREE.Mesh(new THREE.ShapeGeometry(warningTriangleShape(0.86)), ink);
  border.position.set(0, MOUNTAIN_WARNING_PLATE_Y, 0.105);
  border.name = 'Mountain warning sign black border';
  root.add(border);

  const face = new THREE.Mesh(new THREE.ShapeGeometry(warningTriangleShape(0.70)), yellow);
  face.position.set(0, MOUNTAIN_WARNING_PLATE_Y, 0.115);
  face.name = 'Mountain warning sign yellow face';
  root.add(face);

  // A flat front graphic keeps the symbol independent of the post and plate depth.
  const exclamationBar = new THREE.Mesh(new THREE.ShapeGeometry(warningExclamationBarShape()), ink);
  exclamationBar.position.set(0, MOUNTAIN_WARNING_PLATE_Y + 0.20, 0.14);
  exclamationBar.name = 'Mountain warning sign exclamation bar';
  root.add(exclamationBar);

  const exclamationDot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), ink);
  exclamationDot.position.set(0, MOUNTAIN_WARNING_PLATE_Y - 0.76, 0.142);
  exclamationDot.name = 'Mountain warning sign exclamation dot';
  root.add(exclamationDot);

  return root;
}

function nearestMountainSampleIndex(samples, target) {
  let nearestIndex = 0;
  let nearestDistanceSq = Infinity;
  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index].point;
    const dx = point.x - target.x;
    const dz = point.z - target.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= nearestDistanceSq) continue;
    nearestDistanceSq = distanceSq;
    nearestIndex = index;
  }
  return nearestIndex;
}

function installDownhillSlalomWarningSign(world, samples, trackWidth, terrainHeightAt) {
  const sampleIndex = nearestMountainSampleIndex(samples, MOUNTAIN_SLALOM_WARNING_TARGET);
  const sample = samples[sampleIndex];
  const roadOffset = trackWidth / 2 + 6.8;
  const positive = sample.point.clone().addScaledVector(sample.normal, roadOffset);
  const negative = sample.point.clone().addScaledVector(sample.normal, -roadOffset);
  // The old tree landmark sat on the right/outside shoulder of the broad summit
  // bend, well before the plunge. Choosing the higher-z candidate preserves that
  // approach sightline even if the sampled normal flips direction.
  const point = positive.z >= negative.z ? positive : negative;
  point.y = terrainHeightAt(point.x, point.z) + 0.02;

  const sign = makeDownhillSlalomWarningSign();
  sign.position.copy(point);
  sign.rotation.y = Math.atan2(-sample.tangent.x, -sample.tangent.z);
  world.add(sign);

  world.userData.turnMountainSlalomWarningSign = Object.freeze({
    sampleIndex,
    targetX: MOUNTAIN_SLALOM_WARNING_TARGET.x,
    targetZ: MOUNTAIN_SLALOM_WARNING_TARGET.z,
    x: point.x,
    y: point.y,
    z: point.z,
    roadOffset,
    side: 'north-outside',
    facesApproach: true,
    collidable: false
  });
  return sign;
}

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
  installDownhillSlalomWarningSign(world, samples, trackWidth, terrainContext.terrainHeightAt);
  const sceneryReady = installMountainScenery(
    world,
    samples,
    trackWidth,
    terrainContext,
    FINAL_VILLAGE_OPTIONS
  );
  world.ready = Promise.resolve(sceneryReady)
    .then(() => installMountainR4VisualPolish(
      world,
      samples,
      trackWidth,
      terrainContext,
      FINAL_VILLAGE_OPTIONS
    ))
    .then(() => installMountainR4WaterfallNotch(world))
    .then(() => installMountainR4DriverFacingWaterfall(world, samples))
    .then(() => installMountainR5SuburbanVillage(world, samples, trackWidth, terrainContext))
    .then(() => {
      faceMountainVillageBenchesTowardTrack(world);
      return installMountainR6Night(world, samples, trackWidth, terrainContext);
    })
    .then(() => {
      addStaticMoonlitHillFill(world);
      return world;
    });
  world.userData.turnMountainTerrainHeightAt = terrainContext.terrainHeightAt;
  world.userData.turnMountainArtDirection = Object.freeze({
    version: 'r3',
    visualPolish: 'r266-shared-procedural-night-sky-plus-r6-night-plus-r5-suburban-village-plus-r4-waterfall-landmarks',
    ground: 'continuous-snow-and-granite-terrain-body',
    roadEdge: 'solid-white',
    roadbed: 'opaque-and-terrain-supported',
    retainingFoundation: '4.6m-granite-skirt',
    routeClearanceProtected: true,
    downhillSlalomLandmark: 'authored-yellow-warning-sign-on-north-outside-shoulder',
    assetVillage: 'Kenney-City-Kit-Suburban-complete-buildings-A-G-M-N-U',
    villagePalette: 'dark-brown-walls-and-snow-white-roofs',
    villageSquare: 'winter-market-no-fountain',
    nightSky: 'shared-procedural-gradient-and-star-shader-with-canonical-moon-image',
    skyBehavior: 'shared-world-up-celestial-plane-with-world-yaw-lock-and-gentle-drag',
    reducedMotionSky: 'shared-sky-retained-with-drag-and-parallax-suppressed',
    celestialLayer: 'shared-procedural-sky-and-canonical-moon-on-one-world-locked-plane',
    moon: 'canonical-mountain-image-on-shared-southern-celestial-anchor',
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
