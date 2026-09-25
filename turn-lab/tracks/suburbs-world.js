import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCarVisual } from '/turn/vehicle/emergency-livery-models.js';

const ROAD = 0x45474d;
const ROAD_EDGE = 0xf7f4e8;
const ROAD_LINE = 0xffd74d;
const SIDEWALK = 0xded9cc;
const SIDEWALK_EDGE = 0xb9b4a8;
const GRASS = 0x67c95f;
const GRASS_LIGHT = 0x82da6f;
const GRASS_DARK = 0x4eab50;
const WATER = 0x41b8e7;
const WOOD = 0xb57845;
const WOOD_DARK = 0x765039;
const START_TEAL = 0x13a7a0;
const START_YELLOW = 0xffd43b;
const ROAD_HEIGHT = 0.16;
const WATER_LEVEL = -0.72;
const ISLAND_RADIUS = 330;
const ISLAND_SCALE_X = 1.05;
const ISLAND_SCALE_Z = 0.90;
const ISLAND_CENTER_X = 20;
const ISLAND_CENTER_Z = -8;

const KIT_BASE = 'https://cdn.jsdelivr.net/gh/immaculate-lift-studio/CityCrafter3D@0831a1937a59562b6165ccfab30f64f35c957b6f/addons/citycrafter/assets/example_assets/kenney_city-kit-suburban_20/Models/';
const GLB_ROOT = KIT_BASE + 'GLB%20format/';
const PALETTES = Object.freeze({
  default: GLB_ROOT + 'Textures/colormap.png',
  a: KIT_BASE + 'Textures/variation-a.png',
  b: KIT_BASE + 'Textures/variation-b.png',
  c: KIT_BASE + 'Textures/variation-c.png'
});
const ROW_BOAT_URL = '/turn/assets/scenery/watercraft/boat-row-small.glb';
const BEACHFRONT_HOTEL_URL = '/postal/assets/kenney/city-commercial/building-skyscraper-a.glb';
const BEACHFRONT_PIRATE_ROOT = 'https://cdn.jsdelivr.net/gh/fluxoz/Sea-of-Friends@fd55881cdf6af657231e3ddc5790e65036452435/public/assets/kenney-pirate/';
const BEACHFRONT_WATERCRAFT_ROOT = 'https://cdn.jsdelivr.net/gh/fluxoz/Sea-of-Friends@fd55881cdf6af657231e3ddc5790e65036452435/public/assets/kenney-watercraft/';
const BEACHFRONT_PALM_URL = BEACHFRONT_PIRATE_ROOT + 'palm-detailed-straight.glb';
const BEACHFRONT_ROCK_URL = BEACHFRONT_PIRATE_ROOT + 'rocks-sand-a.glb';
const BEACHFRONT_SAILBOAT_URL = BEACHFRONT_WATERCRAFT_ROOT + 'boat-sail-a.glb';

const HOUSE_SITES = Object.freeze([
  Object.freeze({ progress: 0.025, type: 'a', palette: 'default', height: 10.0, along: -12, yaw: -0.08 }),
  Object.freeze({ progress: 0.070, type: 'c', palette: 'a', height: 10.6, along: 7, yaw: 0.06 }),
  Object.freeze({ progress: 0.115, type: 'f', palette: 'c', height: 9.7, along: -8, yaw: -0.04 }),
  Object.freeze({ progress: 0.165, type: 'h', palette: 'b', height: 11.0, along: 10, yaw: 0.08 }),
  Object.freeze({ progress: 0.310, type: 'j', palette: 'a', height: 10.2, along: -10, yaw: 0.05 }),
  Object.freeze({ progress: 0.355, type: 'l', palette: 'default', height: 11.5, along: 9, yaw: -0.05 }),
  Object.freeze({ progress: 0.405, type: 'm', palette: 'c', height: 9.9, along: -6, yaw: 0.04 }),
  Object.freeze({ progress: 0.455, type: 'o', palette: 'b', height: 10.8, along: 9, yaw: -0.07 }),
  Object.freeze({ progress: 0.555, type: 'q', palette: 'a', height: 10.7, along: -8, yaw: 0.06 }),
  Object.freeze({ progress: 0.605, type: 's', palette: 'default', height: 10.2, along: 10, yaw: -0.05 }),
  Object.freeze({ progress: 0.650, type: 'u', palette: 'c', height: 11.0, along: -7, yaw: 0.04 }),
  Object.freeze({ progress: 0.705, type: 'b', palette: 'b', height: 10.5, along: 7, yaw: -0.05 }),
  Object.freeze({ progress: 0.760, type: 'd', palette: 'a', height: 9.8, along: -7, yaw: 0.08 }),
  Object.freeze({ progress: 0.805, type: 'g', palette: 'default', height: 10.6, along: 8, yaw: -0.04 }),
  Object.freeze({ progress: 0.875, type: 'n', palette: 'c', height: 11.0, along: -9, yaw: 0.05 }),
  Object.freeze({ progress: 0.930, type: 't', palette: 'b', height: 10.4, along: 8, yaw: -0.06 })
]);

const BACK_ROW_SITES = Object.freeze([
  Object.freeze({ progress: 0.050, type: 'e', palette: 'b', height: 10.2, along: -17, yaw: 0.08 }),
  Object.freeze({ progress: 0.145, type: 'i', palette: 'c', height: 10.8, along: 17, yaw: -0.07 }),
  Object.freeze({ progress: 0.335, type: 'k', palette: 'default', height: 11.1, along: -18, yaw: 0.06 }),
  Object.freeze({ progress: 0.430, type: 'p', palette: 'a', height: 10.4, along: 18, yaw: -0.05 }),
  Object.freeze({ progress: 0.585, type: 'r', palette: 'c', height: 10.9, along: -17, yaw: 0.07 }),
  Object.freeze({ progress: 0.690, type: 'a', palette: 'a', height: 9.8, along: 18, yaw: -0.08 }),
  Object.freeze({ progress: 0.825, type: 'm', palette: 'b', height: 10.3, along: -17, yaw: 0.05 }),
  Object.freeze({ progress: 0.955, type: 'u', palette: 'c', height: 10.8, along: 17, yaw: -0.06 })
]);

const PARKED_CARS = Object.freeze([
  Object.freeze({ progress: 0.040, carId: 'sedan', color: '#ff5d73', along: 8, outward: 7.5, yaw: 0.05 }),
  Object.freeze({ progress: 0.095, carId: 'suv', color: '#30c8d6', along: -6, outward: 7.0, yaw: -0.06 }),
  Object.freeze({ progress: 0.335, carId: 'van', color: '#ffd43b', along: 7, outward: 7.5, yaw: 0.08 }),
  Object.freeze({ progress: 0.430, carId: 'sedan', color: '#8d6df1', along: -7, outward: 7.0, yaw: -0.04 }),
  Object.freeze({ progress: 0.575, carId: 'suv', color: '#6dd66f', along: 8, outward: 7.5, yaw: 0.06 }),
  Object.freeze({ progress: 0.680, carId: 'sedan', color: '#ff8a3d', along: -7, outward: 7.0, yaw: -0.08 }),
  Object.freeze({ progress: 0.790, carId: 'truck', color: '#4e82ff', along: 6, outward: 8.5, yaw: 0.04 }),
  Object.freeze({ progress: 0.910, carId: 'sedan', color: '#f7f3e8', along: -8, outward: 7.5, yaw: -0.05 })
]);

const sourceCache = new Map();

export function installSuburbsWorld({ scene, samples, trackWidth = 27, runtime } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 16) {
    throw new Error('TURN LAB: Beachfront requires a scene and sampled route.');
  }

  const world = new THREE.Group();
  world.name = 'TURN LAB Beachfront';
  scene.add(world);

  makeSummerGround(world);
  makeRoad(world, samples, trackWidth);
  makeSidewalks(world, samples, trackWidth);
  makeRoadEdgeLines(world, samples, trackWidth);
  makeCenterDashes(world, samples);
  makeStartArea(world, samples, trackWidth);
  makeCoastalDock(world);
  makeParkPlayground(world);

  const metrics = {
    version: 'beachfront-summer',
    routeSamples: samples.length,
    theme: 'bright-beachfront-island-resort',
    easyTrack: false,
    islandCourse: true,
    flatCourse: true,
    houseCount: 0,
    drivewayCount: 0,
    fenceCount: 0,
    treeCount: 0,
    planterCount: 0,
    parkPathCount: 0,
    parkedCars: 0,
    islandCount: 1,
    surroundingWaterCount: 1,
    dockCount: 1,
    boatCount: 0,
    hotelCount: 0,
    palmCount: 0,
    beachRockCount: 0,
    sailboatCount: 0,
    playgroundPieces: 0,
    assetErrors: [],
    kenneyKit: 'City Kit Suburban 2.0 + City Kit Commercial 2.1 + Pirate Kit 2.1 + Watercraft Kit 2.1',
    paletteFamilies: Object.freeze(['default', 'variation-a', 'variation-b', 'variation-c']),
    dynamicLights: 0,
    shadowCasters: 0
  };
  world.userData.turnSuburbs = metrics;
  world.userData.turnBeachfront = metrics;

  metrics.playgroundPieces = world.getObjectByName('Beachfront playground')?.children.length || 0;

  world.ready = Promise.all([
    installNeighbourhoodAssets(world, samples, trackWidth),
    installParkedCars(world, samples, trackWidth),
    installBoat(world),
    installBeachfrontAssets(world, samples, trackWidth)
  ]).then(([neighbourhood, cars, boat, beachfront]) => {
    Object.assign(metrics, neighbourhood, beachfront);
    metrics.parkedCars = cars.placed;
    metrics.boatCount = boat.placed + beachfront.sailboatCount;
    metrics.assetErrors = [
      ...neighbourhood.errors,
      ...cars.errors,
      ...boat.errors,
      ...beachfront.errors
    ];
    return world;
  }).catch((error) => {
    metrics.assetErrors = [String(error?.message || error)];
    console.warn('TURN LAB: BEACHFRONT dressing failed; the course remains playable.', error);
    return world;
  });

  return world;
}

function makeSummerGround(world) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1800, 1450),
    new THREE.MeshStandardMaterial({
      color: WATER,
      roughness: 0.36,
      metalness: 0,
      flatShading: true
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(ISLAND_CENTER_X, WATER_LEVEL, ISLAND_CENTER_Z);
  water.name = 'Beachfront surrounding water';
  world.add(water);

  const islandBody = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 9, 1.45, 64, 1, true),
    standardMaterial(0xc49a68, 1)
  );
  islandBody.scale.set(ISLAND_SCALE_X, 1, ISLAND_SCALE_Z);
  islandBody.position.set(ISLAND_CENTER_X, -0.69, ISLAND_CENTER_Z);
  islandBody.name = 'Beachfront island body';
  world.add(islandBody);

  const beachRim = new THREE.Mesh(
    new THREE.RingGeometry(316.6, ISLAND_RADIUS, 64),
    standardMaterial(0xf2d29d, 1)
  );
  beachRim.rotation.x = -Math.PI / 2;
  beachRim.scale.set(ISLAND_SCALE_X, ISLAND_SCALE_Z, 1);
  beachRim.position.set(ISLAND_CENTER_X, 0.04, ISLAND_CENTER_Z);
  beachRim.name = 'Beachfront island beach rim';
  world.add(beachRim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(316.4, 64),
    standardMaterial(GRASS, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.scale.set(ISLAND_SCALE_X, ISLAND_SCALE_Z, 1);
  ground.position.set(ISLAND_CENTER_X, 0.055, ISLAND_CENTER_Z);
  ground.name = 'Beachfront island grass';
  world.add(ground);

  const parkLawn = new THREE.Mesh(
    new THREE.CircleGeometry(112, 32),
    standardMaterial(GRASS_LIGHT, 1)
  );
  parkLawn.rotation.x = -Math.PI / 2;
  parkLawn.scale.set(1.25, 0.85, 1);
  parkLawn.position.set(-58, 0.075, 30);
  parkLawn.name = 'Beachfront park lawn';
  world.add(parkLawn);
}

function makeRoad(world, samples, trackWidth) {
  const road = makeRibbon(samples, -trackWidth / 2, trackWidth / 2, ROAD_HEIGHT);
  road.material = standardMaterial(ROAD, 0.98);
  road.name = 'Beachfront asphalt';
  world.add(road);
}

function makeSidewalks(world, samples, trackWidth) {
  const half = trackWidth / 2;
  for (const side of [-1, 1]) {
    world.add(makeInstancedTrackStrip(samples, {
      centerOffset: side * (half + 2.30),
      width: 4.20,
      y: ROAD_HEIGHT - 0.015,
      material: standardMaterial(SIDEWALK, 1),
      name: 'Beachfront sidewalk'
    }));

    world.add(makeInstancedTrackStrip(samples, {
      centerOffset: side * (half + 0.35),
      width: 0.36,
      y: ROAD_HEIGHT + 0.05,
      material: standardMaterial(SIDEWALK_EDGE, 1),
      name: 'Beachfront curb'
    }));
  }
}

function makeRoadEdgeLines(world, samples, trackWidth) {
  const half = trackWidth / 2;
  const material = new THREE.MeshBasicMaterial({ color: ROAD_EDGE, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    world.add(makeInstancedTrackStrip(samples, {
      centerOffset: side * (half - 0.42),
      width: 0.32,
      y: ROAD_HEIGHT + 0.037,
      material,
      name: 'Beachfront white road edge'
    }));
  }
}

function makeInstancedTrackStrip(samples, {
  centerOffset,
  width,
  y,
  material,
  name,
  step = 2,
  overlap = 1.10
}) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const segmentCount = Math.ceil(samples.length / step);
  const strip = new THREE.InstancedMesh(geometry, material, segmentCount);
  const dummy = new THREE.Object3D();
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const midpoint = new THREE.Vector3();

  let instanceIndex = 0;
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += step) {
    const nextIndex = (sampleIndex + step) % samples.length;
    const sample = samples[sampleIndex];
    const nextSample = samples[nextIndex];

    start.copy(sample.point).addScaledVector(sample.normal, centerOffset);
    end.copy(nextSample.point).addScaledVector(nextSample.normal, centerOffset);
    midpoint.copy(start).add(end).multiplyScalar(0.5);

    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(0.01, Math.hypot(dx, dz));
    const centreDx = nextSample.point.x - sample.point.x;
    const centreDz = nextSample.point.z - sample.point.z;
    const centreLength = Math.max(0.01, Math.hypot(centreDx, centreDz));
    const alignment = (dx * centreDx + dz * centreDz) / (length * centreLength);
    const stretch = length / centreLength;

    // Offset curves can form a cusp on the inside of a very tight hairpin.
    // Never bridge across that cusp: a tiny clean gap is preferable to the
    // old folded fan that stretched sidewalk/edge geometry across the road.
    if (alignment < 0.15 || stretch > 2.5) continue;

    dummy.position.set(midpoint.x, y, midpoint.z);
    dummy.rotation.set(0, Math.atan2(dx, dz), 0);
    dummy.scale.set(width, 1, length * overlap);
    dummy.updateMatrix();
    strip.setMatrixAt(instanceIndex, dummy.matrix);
    instanceIndex += 1;
  }

  strip.count = instanceIndex;
  strip.instanceMatrix.needsUpdate = true;
  strip.name = name;
  return strip;
}

function makeCenterDashes(world, samples) {
  const step = Math.max(18, Math.floor(samples.length / 90));
  const indices = [];
  for (let index = 0; index < samples.length; index += step) indices.push(index);

  const dashes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.42, 0.055, 5.2),
    new THREE.MeshBasicMaterial({ color: ROAD_LINE }),
    indices.length
  );
  const dummy = new THREE.Object3D();
  indices.forEach((sampleIndex, instanceIndex) => {
    const sample = samples[sampleIndex];
    dummy.position.copy(sample.point);
    dummy.position.y += ROAD_HEIGHT + 0.055;
    dummy.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    dashes.setMatrixAt(instanceIndex, dummy.matrix);
  });
  dashes.instanceMatrix.needsUpdate = true;
  dashes.name = 'Beachfront sunny centre dashes';
  world.add(dashes);
}

function makeStartArea(world, samples, trackWidth) {
  const sample = samples[0];
  const yaw = Math.atan2(sample.tangent.x, sample.tangent.z);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(trackWidth - 1, 0.07, 1.8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  stripe.position.copy(sample.point);
  stripe.position.y += ROAD_HEIGHT + 0.05;
  stripe.rotation.y = yaw;
  stripe.name = 'Beachfront start finish stripe';
  world.add(stripe);

  const arch = new THREE.Group();
  arch.name = 'Beachfront start arch';
  const postGeometry = new THREE.BoxGeometry(1.1, 8.0, 1.1);
  const beamGeometry = new THREE.BoxGeometry(trackWidth + 6.0, 1.35, 1.2);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, standardMaterial(side < 0 ? START_TEAL : START_YELLOW, 0.9));
    post.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 + 2.0));
    post.position.y += 4.0;
    arch.add(post);
  }
  const beam = new THREE.Mesh(beamGeometry, standardMaterial(0xffffff, 0.94));
  beam.position.copy(sample.point);
  beam.position.y += 7.35;
  beam.rotation.y = yaw;
  arch.add(beam);
  world.add(arch);
}

function makeCoastalDock(world) {
  const beach = new THREE.Mesh(
    new THREE.CircleGeometry(28, 28),
    standardMaterial(0xf2d29d, 1)
  );
  beach.rotation.x = -Math.PI / 2;
  beach.scale.set(1.25, 0.62, 1);
  beach.position.set(326, 0.075, 82);
  beach.name = 'Beachfront dock beach';
  world.add(beach);

  const dock = new THREE.Group();
  dock.name = 'Beachfront wooden dock';
  for (let index = 0; index < 12; index += 1) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.28, 1.65),
      standardMaterial(index % 2 ? WOOD_DARK : WOOD, 1)
    );
    plank.position.set(334 + index * 2.7, -0.05, 84);
    dock.add(plank);
  }
  for (const x of [337, 363]) {
    for (const z of [81.7, 86.3]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 2.5, 0.45),
        standardMaterial(WOOD_DARK, 1)
      );
      post.position.set(x, 0.15, z);
      dock.add(post);
    }
  }
  world.add(dock);
}

function makeParkPlayground(world) {
  const park = new THREE.Group();
  park.name = 'Beachfront playground';

  const path = new THREE.Mesh(
    new THREE.RingGeometry(35, 39, 28),
    standardMaterial(0xeadfc5, 1)
  );
  path.rotation.x = -Math.PI / 2;
  path.scale.set(1.25, 0.82, 1);
  path.position.set(-70, 0.03, 27);
  park.add(path);

  const slidePlatform = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 5), standardMaterial(0x42a5f5, 0.95));
  slidePlatform.position.set(-89, 1.8, 16);
  park.add(slidePlatform);

  const slide = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 9.5), standardMaterial(0xffcf33, 0.9));
  slide.position.set(-89, 1.15, 9.5);
  slide.rotation.x = -0.34;
  park.add(slide);

  const swingBeam = new THREE.Mesh(new THREE.BoxGeometry(12, 0.7, 0.7), standardMaterial(0xff6b6b, 0.9));
  swingBeam.position.set(-47, 4.8, 34);
  park.add(swingBeam);
  for (const x of [-52, -42]) {
    for (const z of [30.5, 37.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.65, 9, 0.65), standardMaterial(0x2f7fc1, 0.95));
      leg.position.set(x, 2.5, z);
      leg.rotation.z = x < -47 ? -0.12 : 0.12;
      park.add(leg);
    }
  }

  const picnic = new THREE.Mesh(new THREE.BoxGeometry(12, 0.35, 7), standardMaterial(0xff78ad, 1));
  picnic.position.set(-62, 0.24, 58);
  picnic.name = 'Beachfront picnic blanket';
  park.add(picnic);

  world.add(park);
}

async function installNeighbourhoodAssets(world, samples, trackWidth) {
  const result = { houseCount: 0, drivewayCount: 0, fenceCount: 0, treeCount: 0, planterCount: 0, parkPathCount: 0, errors: [] };

  const settled = await Promise.allSettled(HOUSE_SITES.map(async (spec, index) => {
    const frame = frameAtProgress(samples, spec.progress, trackWidth);
    const source = await loadKitSource('building-type-' + spec.type + '.glb', spec.palette);
    const house = prepareModel(source, { targetHeight: spec.height });
    placePrepared(world, house, {
      name: 'Beachfront Kenney house ' + (index + 1),
      position: pointInsideFrame(frame, 13.5, spec.along, 0.03),
      rotation: frame.yaw + Math.PI + spec.yaw,
      metadata: { turnSuburbsAsset: 'building-type-' + spec.type, palette: spec.palette }
    });

    const drivewaySource = await loadKitSource('driveway-short.glb', spec.palette);
    const driveway = prepareModel(drivewaySource, { targetSpan: 12.5 });
    placePrepared(world, driveway, {
      name: 'Beachfront Kenney driveway ' + (index + 1),
      position: pointInsideFrame(frame, 6.6, spec.along, 0.035),
      rotation: frame.yaw,
      metadata: { turnSuburbsAsset: 'driveway-short' }
    });

    const treeFile = index % 3 === 0 ? 'tree-large.glb' : 'tree-small.glb';
    const treeSource = await loadKitSource(treeFile, 'default');
    const tree = prepareModel(treeSource, { targetHeight: index % 3 === 0 ? 11.5 : 8.2 });
    placePrepared(world, tree, {
      name: 'Beachfront Kenney garden tree ' + (index + 1),
      position: pointInsideFrame(frame, 15, spec.along + (index % 2 ? 12 : -12), 0.03),
      rotation: frame.yaw + index * 0.41,
      metadata: { turnSuburbsAsset: treeFile }
    });

    return { house: 1, driveway: 1, tree: 1 };
  }));

  for (const entry of settled) {
    if (entry.status === 'fulfilled') {
      result.houseCount += entry.value.house;
      result.drivewayCount += entry.value.driveway;
      result.treeCount += entry.value.tree;
    } else {
      result.errors.push(String(entry.reason?.message || entry.reason));
    }
  }

  const backRowSettled = await Promise.allSettled(BACK_ROW_SITES.map(async (spec, index) => {
    const frame = frameAtProgress(samples, spec.progress, trackWidth);
    const source = await loadKitSource('building-type-' + spec.type + '.glb', spec.palette);
    const house = prepareModel(source, { targetHeight: spec.height });
    placePrepared(world, house, {
      name: 'Beachfront Kenney back-row house ' + (index + 1),
      position: pointInsideFrame(frame, 24, spec.along, 0.03),
      rotation: frame.yaw + Math.PI + spec.yaw,
      metadata: {
        turnSuburbsAsset: 'building-type-' + spec.type,
        palette: spec.palette,
        turnSuburbsRow: 'back'
      }
    });
    return 1;
  }));
  for (const entry of backRowSettled) {
    if (entry.status === 'fulfilled') result.houseCount += entry.value;
    else result.errors.push(String(entry.reason?.message || entry.reason));
  }

  const fenceSettled = await Promise.allSettled([0.08, 0.35, 0.58, 0.76, 0.91].map(async (progress, clusterIndex) => {
    const frame = frameAtProgress(samples, progress, trackWidth);
    const source = await loadKitSource('fence-low.glb', 'default');
    let placed = 0;
    for (const along of [-18, -6, 6, 18]) {
      const fence = prepareModel(source, { targetSpan: 9.5 });
      placePrepared(world, fence, {
        name: 'Beachfront Kenney garden fence ' + clusterIndex + '-' + along,
        position: pointInsideFrame(frame, 21, along, 0.04),
        rotation: frame.yaw + Math.PI / 2,
        metadata: { turnSuburbsAsset: 'fence-low' }
      });
      placed += 1;
    }
    return placed;
  }));
  for (const entry of fenceSettled) {
    if (entry.status === 'fulfilled') result.fenceCount += entry.value;
    else result.errors.push(String(entry.reason?.message || entry.reason));
  }

  const parkAssets = await Promise.allSettled([
    installParkTrees(world),
    installParkPlanters(world),
    installParkPaths(world)
  ]);
  for (const entry of parkAssets) {
    if (entry.status === 'fulfilled') {
      result.treeCount += entry.value.trees || 0;
      result.planterCount += entry.value.planters || 0;
      result.parkPathCount += entry.value.paths || 0;
    } else {
      result.errors.push(String(entry.reason?.message || entry.reason));
    }
  }

  return result;
}

async function installParkTrees(world) {
  const largeSource = await loadKitSource('tree-large.glb', 'default');
  const smallSource = await loadKitSource('tree-small.glb', 'default');
  const sites = [
    [-125, 4, 12.8], [-111, 64, 10.0], [-82, 83, 12.2], [-42, 78, 9.0],
    [-18, 43, 11.2], [-23, -3, 8.8], [-63, -24, 12.4], [-112, -24, 9.4],
    [31, 72, 9.2], [45, -20, 10.0]
  ];
  sites.forEach(([x, z, height], index) => {
    const source = index % 3 === 0 ? largeSource : smallSource;
    const tree = prepareModel(source, { targetHeight: height });
    placePrepared(world, tree, {
      name: 'Beachfront Kenney park tree ' + (index + 1),
      position: new THREE.Vector3(x, 0.03, z),
      rotation: index * 0.63,
      metadata: { turnSuburbsAsset: index % 3 === 0 ? 'tree-large' : 'tree-small' }
    });
  });
  return { trees: sites.length, planters: 0, paths: 0 };
}

async function installParkPlanters(world) {
  const source = await loadKitSource('planter.glb', 'a');
  const sites = [
    [-83, 46, 0.1], [-54, 49, -0.2], [-35, 19, 0.3],
    [-91, -4, -0.25], [-126, 31, 0.18], [-47, 71, -0.1]
  ];
  sites.forEach(([x, z, yaw], index) => {
    const planter = prepareModel(source, { targetSpan: 4.8 });
    placePrepared(world, planter, {
      name: 'Beachfront Kenney flower planter ' + (index + 1),
      position: new THREE.Vector3(x, 0.04, z),
      rotation: yaw,
      metadata: { turnSuburbsAsset: 'planter' }
    });
  });
  return { trees: 0, planters: sites.length, paths: 0 };
}

async function installParkPaths(world) {
  const [longPathSource, messyPathSource] = await Promise.all([
    loadKitSource('path-long.glb', 'default'),
    loadKitSource('path-stones-messy.glb', 'default')
  ]);
  const sites = [
    { source: longPathSource, x: -112, z: 31, span: 15, yaw: 1.52, asset: 'path-long' },
    { source: longPathSource, x: -30, z: 34, span: 15, yaw: 1.61, asset: 'path-long' },
    { source: messyPathSource, x: -98, z: 64, span: 8, yaw: 0.20, asset: 'path-stones-messy' },
    { source: messyPathSource, x: -61, z: 80, span: 8, yaw: -0.35, asset: 'path-stones-messy' },
    { source: messyPathSource, x: -32, z: 3, span: 8, yaw: 0.48, asset: 'path-stones-messy' },
    { source: messyPathSource, x: -111, z: -3, span: 8, yaw: -0.22, asset: 'path-stones-messy' }
  ];
  sites.forEach((spec, index) => {
    const path = prepareModel(spec.source, { targetSpan: spec.span });
    placePrepared(world, path, {
      name: 'Beachfront Kenney park path ' + (index + 1),
      position: new THREE.Vector3(spec.x, 0.035, spec.z),
      rotation: spec.yaw,
      metadata: { turnSuburbsAsset: spec.asset }
    });
  });
  return { trees: 0, planters: 0, paths: sites.length };
}

async function installParkedCars(world, samples, trackWidth) {
  const errors = [];
  let placed = 0;
  const settled = await Promise.allSettled(PARKED_CARS.map(async (spec, index) => {
    const frame = frameAtProgress(samples, spec.progress, trackWidth);
    const car = await createCarVisual({
      carId: spec.carId,
      color: spec.color,
      targetLength: spec.carId === 'truck' ? 6.4 : 5.1,
      outline: false
    });
    car.name = 'Beachfront parked ' + spec.carId + ' ' + (index + 1);
    car.position.copy(pointInsideFrame(frame, spec.outward, spec.along, 0.12));
    car.rotation.y = frame.yaw + Math.PI + spec.yaw;
    car.userData.turnStaticSceneryCar = true;
    car.userData.turnSceneryOnly = true;
    car.traverse((node) => {
      if (!node?.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = false;
    });
    world.add(car);
    return true;
  }));

  for (const entry of settled) {
    if (entry.status === 'fulfilled') placed += 1;
    else errors.push(String(entry.reason?.message || entry.reason));
  }
  return { placed, errors };
}

async function installBoat(world) {
  const errors = [];
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(ROW_BOAT_URL);
    const boat = prepareModel(gltf.scene, { targetSpan: 5.8 });
    placePrepared(world, boat, {
      name: 'Beachfront moored summer boat',
      position: new THREE.Vector3(370, WATER_LEVEL + 0.20, 94),
      rotation: -0.18,
      metadata: { turnSuburbsAsset: 'Kenney Watercraft row boat' }
    });
    return { placed: 1, errors };
  } catch (error) {
    errors.push(String(error?.message || error));
    return { placed: 0, errors };
  }
}

async function installBeachfrontAssets(world, samples, trackWidth) {
  const result = {
    hotelCount: 0,
    palmCount: 0,
    beachRockCount: 0,
    sailboatCount: 0,
    errors: []
  };

  let sources;
  try {
    sources = await Promise.all([
      loadExternalSource(BEACHFRONT_HOTEL_URL),
      loadExternalSource(BEACHFRONT_PALM_URL),
      loadExternalSource(BEACHFRONT_ROCK_URL),
      loadExternalSource(BEACHFRONT_SAILBOAT_URL)
    ]);
  } catch (error) {
    result.errors.push(String(error?.message || error));
    return result;
  }

  const [hotelSource, palmSource, rockSource, sailboatSource] = sources;
  const hotelSites = [
    [-58, -62, 42, 0.18],
    [4, -76, 52, -0.12],
    [70, -44, 45, 0.34],
    [82, 28, 40, -0.26],
    [32, 78, 48, 0.12],
    [-38, 72, 43, -0.31]
  ];
  hotelSites.forEach(([x, z, height, yaw], index) => {
    const hotel = prepareModel(hotelSource, { targetHeight: height });
    placePrepared(world, hotel, {
      name: 'Beachfront hotel tower ' + (index + 1),
      position: new THREE.Vector3(x, 0.06, z),
      rotation: yaw,
      metadata: { turnBeachfrontAsset: 'Kenney City Kit Commercial skyscraper' }
    });
    result.hotelCount += 1;
  });

  const tropicalSites = [
    [-142, -68, 14.0, 0.3], [-128, -5, 15.5, 1.1], [-125, 62, 13.5, 2.0],
    [-92, 116, 16.0, 0.6], [-35, 132, 14.5, 1.6], [28, 132, 15.0, 2.5],
    [92, 110, 16.5, 0.9], [136, 62, 14.0, 1.9], [148, -4, 15.5, 2.8],
    [128, -76, 14.5, 0.4], [78, -126, 16.0, 1.4], [18, -142, 13.5, 2.2],
    [-45, -135, 15.0, 0.7], [-102, -112, 14.5, 1.8]
  ];
  tropicalSites.forEach(([x, z, height, yaw], index) => {
    const palm = prepareModel(palmSource, { targetHeight: height });
    placePrepared(world, palm, {
      name: 'Beachfront tropical interior palm ' + (index + 1),
      position: new THREE.Vector3(x, 0.055, z),
      rotation: yaw,
      metadata: { turnBeachfrontAsset: 'Kenney Pirate Kit palm' }
    });
    result.palmCount += 1;
  });

  const coastRadius = ISLAND_RADIUS - 6.5;
  for (let index = 0; index < 32; index += 1) {
    const angle = (index / 32) * Math.PI * 2 + 0.08;
    const point = new THREE.Vector3(
      ISLAND_CENTER_X + Math.cos(angle) * coastRadius * ISLAND_SCALE_X,
      0.055,
      ISLAND_CENTER_Z + Math.sin(angle) * coastRadius * ISLAND_SCALE_Z
    );
    if (distanceToTrackXZ(samples, point) < trackWidth / 2 + 15) continue;

    if (index % 2 === 0) {
      const palm = prepareModel(palmSource, { targetHeight: 11.5 + (index % 3) * 1.5 });
      placePrepared(world, palm, {
        name: 'Beachfront beach palm ' + (index + 1),
        position: point,
        rotation: angle + Math.PI / 2,
        metadata: { turnBeachfrontAsset: 'Kenney Pirate Kit beach palm' }
      });
      result.palmCount += 1;
    } else {
      const rock = prepareModel(rockSource, { targetSpan: 6.2 + (index % 4) * 0.7 });
      placePrepared(world, rock, {
        name: 'Beachfront beach rock ' + (index + 1),
        position: point,
        rotation: angle * 0.7,
        metadata: { turnBeachfrontAsset: 'Kenney Pirate Kit sand rocks' }
      });
      result.beachRockCount += 1;
    }
  }

  const sailboatSites = [
    [492, -255, 13.5, 0.32],
    [-438, -244, 12.5, -0.68],
    [515, 168, 14.0, 1.12],
    [-455, 226, 13.0, 0.54],
    [92, 426, 12.0, -0.38]
  ];
  sailboatSites.forEach(([x, z, span, yaw], index) => {
    const sailboat = prepareModel(sailboatSource, { targetSpan: span });
    placePrepared(world, sailboat, {
      name: 'Beachfront offshore sailboat ' + (index + 1),
      position: new THREE.Vector3(x, WATER_LEVEL + 0.12, z),
      rotation: yaw,
      metadata: { turnBeachfrontAsset: 'Kenney Watercraft sailboat' }
    });
    result.sailboatCount += 1;
  });

  return result;
}

function distanceToTrackXZ(samples, point) {
  let closest = Infinity;
  for (const sample of samples) {
    const dx = sample.point.x - point.x;
    const dz = sample.point.z - point.z;
    closest = Math.min(closest, Math.hypot(dx, dz));
  }
  return closest;
}

function loadExternalSource(url) {
  const key = 'external:' + url;
  if (!sourceCache.has(key)) {
    const loader = new GLTFLoader();
    sourceCache.set(key, loader.loadAsync(url).then((gltf) => gltf.scene).catch((error) => {
      sourceCache.delete(key);
      throw error;
    }));
  }
  return sourceCache.get(key);
}

function loadKitSource(file, palette = 'default') {
  const key = palette + ':' + file;
  if (!sourceCache.has(key)) {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (/(?:^|\/)Textures\/colormap\.png(?:\?|$)/i.test(url)) {
        return PALETTES[palette] || PALETTES.default;
      }
      return url;
    });
    const loader = new GLTFLoader(manager);
    sourceCache.set(key, loader.loadAsync(GLB_ROOT + file).then((gltf) => gltf.scene).catch((error) => {
      sourceCache.delete(key);
      throw error;
    }));
  }
  return sourceCache.get(key);
}

function prepareModel(source, { targetHeight = null, targetSpan = null } = {}) {
  const model = source.clone(true);
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.traverse((node) => {
    if (!node?.isMesh) return;
    if (Array.isArray(node.material)) node.material = node.material.map((entry) => entry.clone());
    else if (node.material) node.material = node.material.clone();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of materials) {
      if (!mat) continue;
      if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.85, 0.85);
      if ('metalness' in mat) mat.metalness = 0;
      mat.needsUpdate = true;
    }
    node.castShadow = false;
    node.receiveShadow = false;
  });
  model.updateWorldMatrix(true, true);

  let bounds = new THREE.Box3().setFromObject(model, true);
  const size = bounds.getSize(new THREE.Vector3());
  if (targetHeight) {
    model.scale.setScalar(targetHeight / Math.max(0.001, size.y));
  } else if (targetSpan) {
    model.scale.setScalar(targetSpan / Math.max(0.001, size.x, size.z));
  }
  model.updateWorldMatrix(true, true);

  bounds = new THREE.Box3().setFromObject(model, true);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
  model.updateWorldMatrix(true, true);
  return model;
}

function placePrepared(parent, object, { name, position, rotation = 0, metadata = {} }) {
  object.name = name;
  object.position.add(position);
  object.rotation.y += rotation;
  Object.assign(object.userData, metadata, {
    turnSceneryOnly: true,
    turnSuburbs: true,
    turnBeachfront: true
  });
  parent.add(object);
  return object;
}

function frameAtProgress(samples, progress, trackWidth) {
  const index = ((Math.round(progress * samples.length) % samples.length) + samples.length) % samples.length;
  const sample = samples[index];
  const centre = trackCentre(samples);
  const towardsCentre = centre.clone().sub(sample.point).setY(0);
  const side = sample.normal.dot(towardsCentre) > 0 ? -1 : 1;
  return {
    sample,
    trackWidth,
    tangent: sample.tangent.clone().setY(0).normalize(),
    outward: sample.normal.clone().setY(0).normalize().multiplyScalar(side),
    inward: sample.normal.clone().setY(0).normalize().multiplyScalar(-side),
    yaw: Math.atan2(sample.tangent.x, sample.tangent.z)
  };
}

function pointInsideFrame(frame, inwardDistance, tangentDistance = 0, y = 0) {
  const point = frame.sample.point.clone()
    .addScaledVector(frame.inward, frame.trackWidth / 2 + inwardDistance)
    .addScaledVector(frame.tangent, tangentDistance);
  point.y = y;
  return point;
}

function trackCentre(samples) {
  const centre = new THREE.Vector3();
  for (const sample of samples) centre.add(sample.point);
  centre.multiplyScalar(1 / Math.max(1, samples.length));
  centre.y = 0;
  return centre;
}

function makeRibbon(samples, left, right, yOffset) {
  const positions = [];
  const indices = [];
  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const a = sample.point.clone().addScaledVector(sample.normal, left);
    const b = sample.point.clone().addScaledVector(sample.normal, right);
    a.y += yOffset;
    b.y += yOffset;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  for (let index = 0; index < samples.length; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, standardMaterial(ROAD, 1));
}

function standardMaterial(color, roughness = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide
  });
}
