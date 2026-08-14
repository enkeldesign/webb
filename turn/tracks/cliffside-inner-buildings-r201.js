import * as THREE from 'three';

const REVISION = 'r201-inner-edge-village';
const INK = 0x08090a;
const INNER_EDGE_EXTRA = 18.5;
const RING_BLENDS = Object.freeze([0, 0.28, 0.54, 0.75, 0.9]);
const TREE_MESH_NAMES = Object.freeze([
  'Cliffside Grounded Pine Trunks',
  'Cliffside Grounded Pine Crowns',
  'Cliffside Grounded Pine Tips'
]);

const BUILDINGS = Object.freeze([
  Object.freeze({ fraction: 0.062, blend: 0.018, radial: 6.4, frontage: 8.2, height: 5.6, roof: 3.0, rotation: -0.08, wall: 0xf3e6c8, roofColor: 0x4e4642, door: 0x6f4a32 }),
  Object.freeze({ fraction: 0.080, blend: 0.050, radial: 7.2, frontage: 10.2, height: 6.3, roof: 3.5, rotation: 0.05, wall: 0xc9d7d2, roofColor: 0x42515a, door: 0x694a38 }),
  Object.freeze({ fraction: 0.101, blend: 0.078, radial: 8.4, frontage: 12.0, height: 7.1, roof: 4.0, rotation: -0.04, wall: 0xa85f49, roofColor: 0x4b423d, door: 0x3e322b, barn: true }),

  Object.freeze({ fraction: 0.292, blend: 0.022, radial: 6.6, frontage: 8.6, height: 5.8, roof: 3.1, rotation: 0.06, wall: 0xe8dcae, roofColor: 0x5c4a3f, door: 0x6f4a32 }),
  Object.freeze({ fraction: 0.312, blend: 0.052, radial: 7.6, frontage: 10.5, height: 6.6, roof: 3.6, rotation: -0.03, wall: 0xd7c0a0, roofColor: 0x4c5550, door: 0x694a38 }),
  Object.freeze({ fraction: 0.334, blend: 0.082, radial: 8.8, frontage: 12.4, height: 7.4, roof: 4.1, rotation: 0.08, wall: 0x9b604e, roofColor: 0x493f3b, door: 0x3e322b, barn: true }),

  Object.freeze({ fraction: 0.548, blend: 0.020, radial: 6.5, frontage: 8.4, height: 5.5, roof: 3.0, rotation: -0.05, wall: 0xd4d9bd, roofColor: 0x4c5351, door: 0x66503a }),
  Object.freeze({ fraction: 0.568, blend: 0.050, radial: 7.4, frontage: 10.0, height: 6.4, roof: 3.5, rotation: 0.04, wall: 0xc6d5d2, roofColor: 0x475660, door: 0x694a38 }),
  Object.freeze({ fraction: 0.590, blend: 0.080, radial: 8.5, frontage: 11.8, height: 7.0, roof: 4.0, rotation: -0.07, wall: 0xa9604c, roofColor: 0x4a413d, door: 0x3d312a, barn: true }),

  Object.freeze({ fraction: 0.796, blend: 0.020, radial: 6.4, frontage: 8.3, height: 5.6, roof: 3.0, rotation: 0.05, wall: 0xefe2bd, roofColor: 0x58483e, door: 0x6f4a32 }),
  Object.freeze({ fraction: 0.816, blend: 0.052, radial: 7.5, frontage: 10.4, height: 6.5, roof: 3.6, rotation: -0.04, wall: 0xcbd7c1, roofColor: 0x46534d, door: 0x67503a }),
  Object.freeze({ fraction: 0.838, blend: 0.080, radial: 8.8, frontage: 12.2, height: 7.3, roof: 4.1, rotation: 0.06, wall: 0x9f614c, roofColor: 0x493f3b, door: 0x3d312a, barn: true })
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

function createPlacements(samples, trackWidth) {
  const centre = trackCentre(samples);
  const peakCentre = new THREE.Vector3(centre.x + 12, 0, centre.z - 10);

  return BUILDINGS.map((building) => {
    const sampleIndex = Math.round(building.fraction * samples.length) % samples.length;
    const sample = samples[sampleIndex];
    const point = highlandPoint(sample, trackWidth, peakCentre, building.blend);
    const groundY = highlandHeight(sample, sampleIndex, peakCentre, building.blend);
    const yaw = Math.atan2(sample.tangent.x, sample.tangent.z) + building.rotation;
    return {
      ...building,
      sample,
      sampleIndex,
      point,
      groundY,
      yaw,
      clearingRadius: Math.max(building.radial, building.frontage) * 0.62 + 2.6
    };
  });
}

function setTransform(mesh, index, position, yaw, scale) {
  const marker = new THREE.Object3D();
  marker.position.copy(position);
  marker.rotation.set(0, yaw, 0);
  marker.scale.copy(scale);
  marker.updateMatrix();
  mesh.setMatrixAt(index, marker.matrix);
}

function makeVillage(world, placements) {
  const village = new THREE.Group();
  village.name = 'Cliffside Inner Edge Village';
  village.userData.turnCliffsideVillage = REVISION;

  const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
  const roofGeometry = new THREE.ConeGeometry(1, 1, 4);
  const windowGeometry = new THREE.BoxGeometry(0.16, 1.45, 1.5);
  const doorGeometry = new THREE.BoxGeometry(0.18, 2.7, 1.55);
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0 });
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x93c9d6, roughness: 0.52, metalness: 0.02 });
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });

  const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, placements.length);
  const wallOutlines = new THREE.InstancedMesh(wallGeometry, outlineMaterial, placements.length);
  const roofs = new THREE.InstancedMesh(roofGeometry, roofMaterial, placements.length);
  const roofOutlines = new THREE.InstancedMesh(roofGeometry, outlineMaterial, placements.length);
  const doors = new THREE.InstancedMesh(doorGeometry, doorMaterial, placements.length);
  const windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, placements.length * 2);

  walls.name = 'Cliffside Village Walls';
  wallOutlines.name = 'Cliffside Village Wall Outlines';
  roofs.name = 'Cliffside Village Roofs';
  roofOutlines.name = 'Cliffside Village Roof Outlines';
  doors.name = 'Cliffside Village Doors';
  windows.name = 'Cliffside Village Windows';

  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let windowCursor = 0;

  placements.forEach((building, index) => {
    const sink = 0.28;
    position.copy(building.point);
    position.y = building.groundY + building.height / 2 - sink;
    scale.set(building.radial, building.height, building.frontage);
    setTransform(walls, index, position, building.yaw, scale);
    scale.multiplyScalar(1.035);
    setTransform(wallOutlines, index, position, building.yaw, scale);

    position.copy(building.point);
    position.y = building.groundY + building.height + building.roof / 2 - sink;
    scale.set(building.radial * 0.58, building.roof, building.frontage * 0.58);
    setTransform(roofs, index, position, building.yaw + Math.PI / 4, scale);
    scale.multiplyScalar(1.04);
    setTransform(roofOutlines, index, position, building.yaw + Math.PI / 4, scale);

    const facadeDistance = building.radial / 2 + 0.12;
    position.copy(building.point).addScaledVector(building.sample.normal, -facadeDistance);
    position.y = building.groundY + (building.barn ? 1.7 : 1.35);
    scale.set(building.barn ? 1.25 : 1, building.barn ? 1.35 : 1, building.barn ? 1.3 : 1);
    setTransform(doors, index, position, building.yaw, scale);

    const windowY = building.groundY + Math.min(building.height * 0.58, 3.7);
    const windowOffset = building.frontage * 0.28;
    for (const side of [-1, 1]) {
      position.copy(building.point)
        .addScaledVector(building.sample.normal, -facadeDistance - 0.02)
        .addScaledVector(building.sample.tangent, side * windowOffset);
      position.y = windowY;
      scale.set(building.barn ? 0.9 : 1, building.barn ? 0.9 : 1, building.barn ? 1.15 : 1);
      setTransform(windows, windowCursor, position, building.yaw, scale);
      windowCursor += 1;
    }

    walls.setColorAt(index, new THREE.Color(building.wall));
    roofs.setColorAt(index, new THREE.Color(building.roofColor));
    doors.setColorAt(index, new THREE.Color(building.door));
  });

  for (const mesh of [walls, roofs, doors, windows]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  for (const mesh of [wallOutlines, roofOutlines]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }

  village.add(wallOutlines, walls, roofOutlines, roofs, doors, windows);
  world.add(village);
  return village;
}

function clearNearbyPines(world, placements) {
  const meshes = TREE_MESH_NAMES
    .map((name) => world.getObjectByName(name))
    .filter((mesh) => mesh?.isInstancedMesh);
  if (!meshes.length) return 0;

  const reference = meshes[0];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const cleared = [];

  for (let index = 0; index < reference.count; index += 1) {
    reference.getMatrixAt(index, matrix);
    matrix.decompose(position, quaternion, scale);
    const shouldClear = placements.some((building) => {
      const dx = position.x - building.point.x;
      const dz = position.z - building.point.z;
      return dx * dx + dz * dz <= building.clearingRadius * building.clearingRadius;
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

export function installCliffsideInnerBuildings(runtime = globalThis.__turnRuntime) {
  if (!runtime || runtime.trackId !== 'cliffside' || !runtime.activeWorld || !runtime.samples?.length) return null;
  const world = runtime.activeWorld;
  if (world.userData.turnCliffsideInnerBuildings === REVISION) return world.getObjectByName('Cliffside Inner Edge Village');

  const placements = createPlacements(runtime.samples, runtime.trackWidth || 27);
  const clearedPines = clearNearbyPines(world, placements);
  const village = makeVillage(world, placements);

  world.userData.turnCliffsideInnerBuildings = REVISION;
  world.userData.turnCliffsideArtDirection = Object.freeze({
    ...(world.userData.turnCliffsideArtDirection || {}),
    innerEdgeBuildings: true,
    innerEdgeBuildingCount: placements.length,
    gameplayGeometryUnchanged: true
  });
  village.userData.clearedPines = clearedPines;
  return village;
}

function installForActiveTrack() {
  const runtime = globalThis.__turnRuntime;
  if (!runtime) return;
  const trackId = globalThis.__turnGetTrackId?.() || runtime.trackId;
  if (trackId !== 'cliffside') return;
  installCliffsideInnerBuildings(runtime);
}

globalThis.addEventListener('turn:track-changed', (event) => {
  if (event.detail?.trackId === 'cliffside') installForActiveTrack();
});
globalThis.addEventListener('turn:runtime-ready', installForActiveTrack, { once: true });
installForActiveTrack();
