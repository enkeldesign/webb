import * as THREE from 'three';

const REVISION = 'r521-ground-detail';

export const GROUND_DETAIL_BUDGET = Object.freeze({
  airport: Object.freeze({ patches: 46, repairs: 18, seams: 24, covers: 8 }),
  harbor: Object.freeze({ patches: 56, repairs: 22, seams: 28, covers: 10 })
});

const TRACKS = new Set(['airport', 'harbor']);

function currentTrackId(runtime, fallback = '') {
  return globalThis.__turnGetTrackId?.() || runtime?.trackId || fallback;
}

function activeWorld(runtime, trackId) {
  return runtime?.activeWorld || (trackId === 'countryside' ? runtime?.world : null);
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function isTrackClear(samples, trackWidth, x, z, margin = 5) {
  if (!Array.isArray(samples) || samples.length === 0) return true;
  const minimum = trackWidth / 2 + margin;
  const minimumSq = minimum * minimum;
  for (const sample of samples) {
    const point = sample?.point;
    if (!point) continue;
    const dx = point.x - x;
    const dz = point.z - z;
    if (dx * dx + dz * dz < minimumSq) return false;
  }
  return true;
}

function makeFlatMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    toneMapped: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
}

function populateSurfaceInstances({
  world,
  samples,
  trackWidth,
  count,
  bounds,
  y,
  geometry,
  material,
  scaleX,
  scaleZ,
  seed = 1,
  margin = 5,
  name
}) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const marker = new THREE.Object3D();
  let cursor = 0;
  let attempt = 0;
  const maxAttempts = count * 14;

  while (cursor < count && attempt < maxAttempts) {
    const unitX = pseudo(seed + attempt * 2.17);
    const unitZ = pseudo(seed * 1.73 + attempt * 3.11);
    const x = THREE.MathUtils.lerp(bounds.minX, bounds.maxX, unitX);
    const z = THREE.MathUtils.lerp(bounds.minZ, bounds.maxZ, unitZ);
    attempt += 1;
    if (!isTrackClear(samples, trackWidth, x, z, margin)) continue;

    marker.position.set(x, y, z);
    marker.rotation.set(-Math.PI / 2, 0, pseudo(seed + attempt * 0.91) * Math.PI);
    marker.scale.set(
      scaleX[0] + pseudo(seed + attempt * 1.31) * (scaleX[1] - scaleX[0]),
      scaleZ[0] + pseudo(seed + attempt * 1.79) * (scaleZ[1] - scaleZ[0]),
      1
    );
    marker.updateMatrix();
    mesh.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }

  mesh.count = cursor;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = true;
  mesh.renderOrder = 1;
  mesh.name = name;
  mesh.userData.turnGroundDetail = REVISION;
  world.add(mesh);
  return cursor;
}

function addAirportDetail(world, samples, trackWidth) {
  const budget = GROUND_DETAIL_BUDGET.airport;
  const bounds = { minX: -286, maxX: 286, minZ: -166, maxZ: 132 };
  let instances = 0;

  instances += populateSurfaceInstances({
    world, samples, trackWidth, count: budget.patches, bounds, y: 0.022,
    geometry: new THREE.CircleGeometry(1, 10),
    material: makeFlatMaterial(0x6f777a, 0.13),
    scaleX: [2.4, 8.2], scaleZ: [1.2, 4.4], seed: 21, margin: 4.5,
    name: 'Airport subtle apron discoloration'
  });

  instances += populateSurfaceInstances({
    world, samples, trackWidth, count: budget.repairs, bounds, y: 0.024,
    geometry: new THREE.PlaneGeometry(1, 1),
    material: makeFlatMaterial(0xc3c0ad, 0.20),
    scaleX: [4.5, 13], scaleZ: [1.8, 5.2], seed: 73, margin: 5.5,
    name: 'Airport concrete repair patches'
  });

  instances += populateSurfaceInstances({
    world, samples, trackWidth, count: budget.seams, bounds, y: 0.026,
    geometry: new THREE.PlaneGeometry(1, 1),
    material: makeFlatMaterial(0x596166, 0.18),
    scaleX: [8, 23], scaleZ: [0.10, 0.18], seed: 131, margin: 6,
    name: 'Airport apron expansion seams'
  });

  instances += populateSurfaceInstances({
    world, samples, trackWidth, count: budget.covers, bounds, y: 0.03,
    geometry: new THREE.PlaneGeometry(1, 1),
    material: makeFlatMaterial(0x4f575a, 0.38),
    scaleX: [1.8, 3.1], scaleZ: [1.2, 2.2], seed: 211, margin: 7,
    name: 'Airport utility covers'
  });

  world.userData.turnGroundDetailPolish = REVISION;
  world.userData.turnGroundDetailInstances = instances;
  world.userData.turnGroundDetailDrawCalls = 4;
  return true;
}

function addHarborDetail(world, samples, trackWidth) {
  const budget = GROUND_DETAIL_BUDGET.harbor;
  const bounds = { minX: -292, maxX: 292, minZ: -158, maxZ: 184 };
  let instances = 0;

  instances += populateSurfaceInstances({
    world, samples, trackWidth, count: budget.patches, bounds, y: -0.035,
    geometry: new THREE.CircleGeometry(1, 10),
    material: makeFlatMaterial(0x4f5759, 0.15),
    scaleX: [2.2, 7.8], scaleZ: [1.1, 4.1], seed: 307, margin: 4.5,
    name: 'Harbor subtle oil and weather patches'
  });

  instances += populateSurfaceInstances({
    world, samples, trackWidth, count: budget.repairs, bounds, y: -0.032,
    geometry: new THREE.PlaneGeometry(1, 1),
    material: makeFlatMaterial(0xb4b7ae, 0.18),
    scaleX: [5, 15], scaleZ: [2, 6], seed: 401, margin: 5.5,
    name: 'Harbor apron repair patches'
  });

  instances += populateSurfaceInstances({
    world, samples, trackWidth, count: budget.seams, bounds, y: -0.029,
    geometry: new THREE.PlaneGeometry(1, 1),
    material: makeFlatMaterial(0x596164, 0.20),
    scaleX: [9, 25], scaleZ: [0.10, 0.18], seed: 503, margin: 6,
    name: 'Harbor concrete seams'
  });

  instances += populateSurfaceInstances({
    world, samples, trackWidth, count: budget.covers, bounds, y: -0.025,
    geometry: new THREE.PlaneGeometry(1, 1),
    material: makeFlatMaterial(0x3f4749, 0.45),
    scaleX: [2.1, 3.6], scaleZ: [0.8, 1.35], seed: 607, margin: 7,
    name: 'Harbor drainage covers'
  });

  world.userData.turnGroundDetailPolish = REVISION;
  world.userData.turnGroundDetailInstances = instances;
  world.userData.turnGroundDetailDrawCalls = 4;
  return true;
}

export function applyGroundDetailPolish(world, trackId, {
  samples = [],
  trackWidth = 27
} = {}) {
  if (!world || !TRACKS.has(trackId)) return false;
  if (world.userData?.turnGroundDetailPolish === REVISION) return true;
  if (trackId === 'airport') return addAirportDetail(world, samples, trackWidth);
  return addHarborDetail(world, samples, trackWidth);
}

function polishRuntime(runtime, fallbackTrackId = '') {
  if (!runtime) return;
  const trackId = currentTrackId(runtime, fallbackTrackId);
  const world = activeWorld(runtime, trackId);
  applyGroundDetailPolish(world, trackId, {
    samples: runtime.samples || [],
    trackWidth: runtime.trackWidth || 27
  });
}

function bootstrap() {
  if (globalThis.__turnRuntime) polishRuntime(globalThis.__turnRuntime);
  else {
    window.addEventListener('turn:runtime-ready', (event) => {
      polishRuntime(event.detail || globalThis.__turnRuntime);
    }, { once: true });
  }

  window.addEventListener('turn:track-changed', (event) => {
    polishRuntime(globalThis.__turnRuntime, event?.detail?.trackId || '');
  });
}

if (typeof window !== 'undefined') bootstrap();
