import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCarVisual } from '../vehicle/emergency-livery-models.js?build=20260811-r164';

const REVISION = 'r202-kenney-suburban-village';
const INNER_EDGE_EXTRA = 18.5;
const RING_BLENDS = Object.freeze([0, 0.28, 0.54, 0.75, 0.9]);
const TREE_MESH_NAMES = Object.freeze([
  'Cliffside Grounded Pine Trunks',
  'Cliffside Grounded Pine Crowns',
  'Cliffside Grounded Pine Tips'
]);
const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/immaculate-lift-studio/CityCrafter3D@0831a1937a59562b6165ccfab30f64f35c957b6f/addons/citycrafter/assets/example_assets/kenney_city-kit-suburban_20/Models/GLB%20format/';
const loader = new GLTFLoader();
const sourceCache = new Map();

const BUILDINGS = Object.freeze([
  Object.freeze({ fraction: 0.062, blend: 0.018, asset: 'a', height: 8.8, rotation: -0.08 }),
  Object.freeze({ fraction: 0.080, blend: 0.050, asset: 'l', height: 10.6, rotation: 0.05 }),
  Object.freeze({ fraction: 0.101, blend: 0.078, asset: 'd', height: 9.6, rotation: -0.04 }),

  Object.freeze({ fraction: 0.292, blend: 0.022, asset: 'u', height: 9.2, rotation: 0.06 }),
  Object.freeze({ fraction: 0.312, blend: 0.052, asset: 'a', height: 9.0, rotation: -0.03 }),
  Object.freeze({ fraction: 0.334, blend: 0.082, asset: 'l', height: 10.8, rotation: 0.08 }),

  Object.freeze({ fraction: 0.548, blend: 0.020, asset: 'd', height: 9.3, rotation: -0.05 }),
  Object.freeze({ fraction: 0.568, blend: 0.050, asset: 'u', height: 9.8, rotation: 0.04 }),
  Object.freeze({ fraction: 0.590, blend: 0.080, asset: 'l', height: 10.9, rotation: -0.07 }),

  Object.freeze({ fraction: 0.796, blend: 0.020, asset: 'a', height: 8.9, rotation: 0.05 }),
  Object.freeze({ fraction: 0.816, blend: 0.052, asset: 'd', height: 9.5, rotation: -0.04 }),
  Object.freeze({ fraction: 0.838, blend: 0.080, asset: 'u', height: 10.0, rotation: 0.06 })
]);

const PARKED_CARS = Object.freeze([
  Object.freeze({ fraction: 0.070, blend: 0.008, carId: 'sedan', color: '#2b6a70', tangentOffset: -3.0, rotation: 0.08 }),
  Object.freeze({ fraction: 0.091, blend: 0.020, carId: 'suv', color: '#7b4f2d', tangentOffset: 2.5, rotation: -0.12 }),

  Object.freeze({ fraction: 0.300, blend: 0.010, carId: 'van', color: '#5d503f', tangentOffset: -2.8, rotation: 0.06 }),
  Object.freeze({ fraction: 0.323, blend: 0.024, carId: 'sedan', color: '#9775fa', tangentOffset: 2.8, rotation: -0.08 }),

  Object.freeze({ fraction: 0.556, blend: 0.010, carId: 'sedan', color: '#ff922b', tangentOffset: -2.7, rotation: 0.10 }),
  Object.freeze({ fraction: 0.579, blend: 0.024, carId: 'suv', color: '#3f5368', tangentOffset: 2.8, rotation: -0.10 }),

  Object.freeze({ fraction: 0.804, blend: 0.010, carId: 'van', color: '#f8f9fa', tangentOffset: -2.6, rotation: 0.07 }),
  Object.freeze({ fraction: 0.827, blend: 0.024, carId: 'truck', color: '#8b5a2b', tangentOffset: 2.7, rotation: -0.09 })
]);

function trackCentre(samples) {
  const centre = new THREE.Vector3();
  for (const sample of samples) centre.add(sample.point);
  centre.multiplyScalar(1 / Math.max(1, samples.length));
  centre.y = 0;
  return centre;
}

function ridgeLift(index) {
  return 7 + Math.sin(index * 0.083) * 2.4 + Math.sin(index * 0.027 + 1.2) * 1.8;
}

function highlandPoint(sample, trackWidth, peakCentre, blend) {
  const edge = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2 + INNER_EDGE_EXTRA);
  edge.y = 0;
  return edge.lerp(peakCentre, blend);
}

function highlandHeight(sample, index, peakCentre, blend) {
  const angle = Math.atan2(sample.point.z - peakCentre.z, sample.point.x - peakCentre.x);
  const ridge = sample.point.y + ridgeLift(index) - 0.25;
  const wave = Math.sin(angle * 3 + 0.45) * 2.2 + Math.sin(angle * 5 - 0.8) * 1.15;
  const heights = [
    ridge,
    ridge * 0.42 + 9.4 + wave,
    18.5 + wave * 1.15 + Math.cos(angle * 2.1) * 1.8,
    25.5 + wave * 1.2,
    31.5 + wave * 0.9
  ];

  if (blend <= RING_BLENDS[0]) return heights[0];
  for (let ring = 1; ring < RING_BLENDS.length; ring += 1) {
    if (blend > RING_BLENDS[ring]) continue;
    const start = RING_BLENDS[ring - 1];
    const end = RING_BLENDS[ring];
    return THREE.MathUtils.lerp(heights[ring - 1], heights[ring], (blend - start) / (end - start));
  }
  return THREE.MathUtils.lerp(heights.at(-1), 39.5, Math.min(1, (blend - RING_BLENDS.at(-1)) / 0.1));
}

function createPlacement(spec, samples, trackWidth, peakCentre) {
  const sampleIndex = Math.round(spec.fraction * samples.length) % samples.length;
  const sample = samples[sampleIndex];
  const point = highlandPoint(sample, trackWidth, peakCentre, spec.blend);
  point.addScaledVector(sample.tangent, spec.tangentOffset || 0);
  const groundY = highlandHeight(sample, sampleIndex, peakCentre, spec.blend);
  return {
    ...spec,
    sample,
    sampleIndex,
    point,
    groundY,
    yaw: Math.atan2(sample.tangent.x, sample.tangent.z) + (spec.rotation || 0)
  };
}

function createPlacements(samples, trackWidth) {
  const centre = trackCentre(samples);
  const peakCentre = new THREE.Vector3(centre.x + 12, 0, centre.z - 10);
  return {
    buildings: BUILDINGS.map((spec) => createPlacement(spec, samples, trackWidth, peakCentre)),
    cars: PARKED_CARS.map((spec) => createPlacement(spec, samples, trackWidth, peakCentre))
  };
}

async function loadBuildingSource(asset) {
  if (!sourceCache.has(asset)) {
    sourceCache.set(asset, loader.loadAsync(`${ASSET_BASE}building-type-${asset}.glb`).then((gltf) => gltf.scene));
  }
  return sourceCache.get(asset);
}

function prepareBuilding(source, targetHeight) {
  const model = source.clone(true);
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.turnOutlined = true;
  });

  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 0.001);
  model.scale.multiplyScalar(scale);

  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  const centre = bounds.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.y -= bounds.min.y;
  model.position.z -= centre.z;
  return model;
}

async function makeKenneyVillage(world, placements) {
  const village = new THREE.Group();
  village.name = 'Cliffside Kenney Inner Village';
  village.userData.turnCliffsideVillage = REVISION;

  const sources = await Promise.all(
    [...new Set(placements.map(({ asset }) => asset))].map(async (asset) => [asset, await loadBuildingSource(asset)])
  );
  const sourceByAsset = new Map(sources);

  for (const placement of placements) {
    const source = sourceByAsset.get(placement.asset);
    if (!source) continue;
    const building = prepareBuilding(source, placement.height);
    building.position.add(placement.point);
    building.position.y += placement.groundY - 0.22;
    building.rotation.y = placement.yaw;
    building.userData.turnKenneySuburbanAsset = `building-type-${placement.asset}`;
    village.add(building);
  }

  world.add(village);
  return village;
}

async function makeParkedCars(world, placements) {
  const parked = new THREE.Group();
  parked.name = 'Cliffside Village Parked Cars';
  parked.userData.turnCliffsideVillageCars = REVISION;

  await Promise.all(placements.map(async (placement) => {
    const car = await createCarVisual({
      carId: placement.carId,
      color: placement.color,
      ghost: false,
      targetLength: 5.0,
      outline: true
    });
    car.position.copy(placement.point);
    car.position.y = placement.groundY + 0.08;
    car.rotation.y = placement.yaw;
    car.userData.turnStaticSceneryCar = true;
    parked.add(car);
  }));

  world.add(parked);
  return parked;
}

function clearNearbyPines(world, buildingPlacements, carPlacements) {
  const meshes = TREE_MESH_NAMES
    .map((name) => world.getObjectByName(name))
    .filter((mesh) => mesh?.isInstancedMesh);
  if (!meshes.length) return 0;

  const clearings = [
    ...buildingPlacements.map((placement) => ({ point: placement.point, radius: placement.height * 0.82 + 3.5 })),
    ...carPlacements.map((placement) => ({ point: placement.point, radius: 4.6 }))
  ];
  const reference = meshes[0];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const cleared = [];

  for (let index = 0; index < reference.count; index += 1) {
    reference.getMatrixAt(index, matrix);
    matrix.decompose(position, quaternion, scale);
    const shouldClear = clearings.some(({ point, radius }) => {
      const dx = position.x - point.x;
      const dz = position.z - point.z;
      return dx * dx + dz * dz <= radius * radius;
    });
    if (shouldClear) cleared.push(index);
  }

  for (const mesh of meshes) {
    for (const index of cleared) {
      mesh.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      scale.setScalar(0);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return cleared.length;
}

function removeProceduralVillage(world) {
  for (const name of ['Cliffside Inner Edge Village', 'Cliffside Kenney Inner Village', 'Cliffside Village Parked Cars']) {
    const existing = world.getObjectByName(name);
    if (existing?.parent) existing.parent.remove(existing);
  }
}

export async function installCliffsideInnerBuildings(runtime = globalThis.__turnRuntime) {
  if (!runtime || runtime.trackId !== 'cliffside' || !runtime.activeWorld || !runtime.samples?.length) return null;
  const world = runtime.activeWorld;
  if (world.userData.turnCliffsideInnerBuildings === REVISION) {
    return world.getObjectByName('Cliffside Kenney Inner Village');
  }
  if (world.userData.turnCliffsideInnerBuildingsPending === REVISION) return null;
  world.userData.turnCliffsideInnerBuildingsPending = REVISION;

  try {
    removeProceduralVillage(world);
    const { buildings, cars } = createPlacements(runtime.samples, runtime.trackWidth || 27);
    const clearedPines = clearNearbyPines(world, buildings, cars);
    const [village, parkedCars] = await Promise.all([
      makeKenneyVillage(world, buildings),
      makeParkedCars(world, cars)
    ]);

    world.userData.turnCliffsideInnerBuildings = REVISION;
    world.userData.turnCliffsideInnerBuildingsPending = null;
    world.userData.turnCliffsideArtDirection = Object.freeze({
      ...(world.userData.turnCliffsideArtDirection || {}),
      innerEdgeBuildings: true,
      innerEdgeBuildingCount: buildings.length,
      innerEdgeParkedCarCount: cars.length,
      innerEdgeAssetSource: 'Kenney City Kit Suburban 2.0',
      gameplayGeometryUnchanged: true
    });
    village.userData.clearedPines = clearedPines;
    parkedCars.userData.clearedPines = clearedPines;
    return village;
  } catch (error) {
    world.userData.turnCliffsideInnerBuildingsPending = null;
    console.warn('TURN: Cliffside Kenney village failed to load.', error);
    return null;
  }
}

function installForActiveTrack() {
  const runtime = globalThis.__turnRuntime;
  if (!runtime) return;
  const trackId = globalThis.__turnGetTrackId?.() || runtime.trackId;
  if (trackId !== 'cliffside') return;
  void installCliffsideInnerBuildings(runtime);
}

globalThis.addEventListener('turn:track-changed', (event) => {
  if (event.detail?.trackId === 'cliffside') installForActiveTrack();
});
globalThis.addEventListener('turn:runtime-ready', installForActiveTrack, { once: true });
installForActiveTrack();
