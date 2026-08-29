import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const REVISION = 'mountain-long-r1';
const BRIDGE_URL = new URL('../assets/scenery/mountain/city-roads/road-bridge.glb', import.meta.url).href;
const PILLAR_URL = new URL('../assets/scenery/mountain/city-roads/bridge-pillar-wide.glb', import.meta.url).href;
const BRIDGE_CENTERS_X = Object.freeze([176, 208, 240, 272, 304, 336]);
const PILLAR_CENTERS_X = Object.freeze([208, 272, 336]);
const BRIDGE_TARGET_Z = -205;
const BRIDGE_MODULE_LENGTH = 33.4;
const BRIDGE_TARGET_WIDTH = 30.4;
const BRIDGE_TARGET_HEIGHT = 4.5;
const WARM_LIGHT = 0xffc766;
const WARM_POOL = 0xffb000;
const INK = 0x17191d;
const SNOW = 0xeaf1f4;
const GRANITE = 0x626b72;
const HOUSE_PREFIX = 'Mountain Kenney Suburban house r5';

const LOWER_VILLAGE_SITES = Object.freeze([
  Object.freeze({ x: -348, z: -180, side: 1 }),
  Object.freeze({ x: -315, z: -153, side: -1 }),
  Object.freeze({ x: -282, z: -167, side: 1 }),
  Object.freeze({ x: -258, z: -190, side: -1 }),
  Object.freeze({ x: -242, z: -218, side: 1 }),
  Object.freeze({ x: -218, z: -242, side: -1 }),
  Object.freeze({ x: -178, z: -262, side: 1 })
]);

const VIEW_SCREEN_SPECS = Object.freeze([
  Object.freeze({ x: 255, z: -258, sx: 28, sy: 11, sz: 17, yaw: 0.18 }),
  Object.freeze({ x: -286, z: -238, sx: 18, sy: 8, sz: 13, yaw: -0.32 }),
  Object.freeze({ x: 340, z: -263, sx: 13, sy: 7, sz: 11, yaw: 0.22 })
]);

function nearestSampleIndex(samples, x, z) {
  let nearest = 0;
  let distanceSq = Infinity;
  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index].point;
    const dx = point.x - x;
    const dz = point.z - z;
    const next = dx * dx + dz * dz;
    if (next < distanceSq) {
      nearest = index;
      distanceSq = next;
    }
  }
  return nearest;
}

function nearestNonLocalDistance(point, samples, ownIndex, exclusion = 28) {
  let nearest = Infinity;
  for (let index = 0; index < samples.length; index += 3) {
    const raw = Math.abs(index - ownIndex);
    if (Math.min(raw, samples.length - raw) <= exclusion) continue;
    const sample = samples[index].point;
    nearest = Math.min(nearest, Math.hypot(point.x - sample.x, point.z - sample.z));
  }
  return nearest;
}

function prepareImportedSource(scene) {
  const normalized = new THREE.Group();
  const root = scene.clone(true);
  normalized.add(root);
  root.traverse((node) => {
    if (!node?.isMesh) return;
    // The new valley is intentionally cheap. Keep the bridge shaded by the world
    // lighting, but do not add it to the already-expensive shadow caster set.
    node.castShadow = false;
    node.receiveShadow = true;
    node.userData.turnOutlined = true;
  });
  normalized.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root, true);
  if (bounds.isEmpty()) return null;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.y -= bounds.min.y;
  root.position.z -= center.z;
  normalized.updateWorldMatrix(true, true);
  normalized.userData.turnSourceSize = size;
  return normalized;
}

async function loadBridgeSources() {
  const loader = new GLTFLoader();
  const [bridge, pillar] = await Promise.all([
    loader.loadAsync(BRIDGE_URL),
    loader.loadAsync(PILLAR_URL)
  ]);
  return {
    bridge: prepareImportedSource(bridge.scene),
    pillar: prepareImportedSource(pillar.scene)
  };
}

function placeBridgeModule(world, source, sample, ordinal) {
  if (!source) return null;
  const size = source.userData.turnSourceSize || new THREE.Vector3(1, 1, 1);
  const module = source.clone(true);
  module.name = `Mountain Kenney City Roads bridge module LAB r1 ${ordinal}`;
  module.position.copy(sample.point);
  // Kenney road-bridge's road axis is local X (the raised rails occupy the local Z edges).
  module.rotation.y = Math.atan2(-sample.tangent.z, sample.tangent.x);
  module.scale.set(
    BRIDGE_MODULE_LENGTH / Math.max(0.001, size.x),
    BRIDGE_TARGET_HEIGHT / Math.max(0.001, size.y),
    BRIDGE_TARGET_WIDTH / Math.max(0.001, size.z)
  );
  // TURN's generated asphalt remains the authoritative drive surface. Sink the
  // imported bridge deck slightly under it so seams never create visual bumps.
  module.position.y -= 0.44;
  module.userData.turnMountainBridgeModule = true;
  world.add(module);
  return module;
}

function placeBridgePillar(world, source, sample, terrainHeightAt, ordinal) {
  if (!source) return null;
  const size = source.userData.turnSourceSize || new THREE.Vector3(0.14, 0.5, 0.14);
  const groundY = terrainHeightAt(sample.point.x, sample.point.z);
  const deckY = sample.point.y - 0.36;
  const targetHeight = Math.max(1.2, deckY - groundY);
  const targetWidth = 4.8;
  const pillar = source.clone(true);
  pillar.name = `Mountain Kenney City Roads bridge pillar LAB r1 ${ordinal}`;
  pillar.position.set(sample.point.x, groundY, sample.point.z);
  pillar.rotation.y = Math.atan2(-sample.tangent.z, sample.tangent.x);
  pillar.scale.set(
    targetWidth / Math.max(0.001, size.x),
    targetHeight / Math.max(0.001, size.y),
    targetWidth / Math.max(0.001, size.z)
  );
  pillar.userData.turnMountainBridgePillar = true;
  world.add(pillar);
  return pillar;
}

async function installKenneyBridge(world, samples, terrainHeightAt) {
  const errors = [];
  let modules = 0;
  let pillars = 0;
  try {
    const sources = await loadBridgeSources();
    BRIDGE_CENTERS_X.forEach((x, index) => {
      const sample = samples[nearestSampleIndex(samples, x, BRIDGE_TARGET_Z)];
      if (placeBridgeModule(world, sources.bridge, sample, index + 1)) modules += 1;
    });
    PILLAR_CENTERS_X.forEach((x, index) => {
      const sample = samples[nearestSampleIndex(samples, x, BRIDGE_TARGET_Z)];
      if (placeBridgePillar(world, sources.pillar, sample, terrainHeightAt, index + 1)) pillars += 1;
    });
  } catch (error) {
    errors.push(String(error?.message || error));
  }
  return { modules, pillars, errors };
}

function collectNamed(world, prefix) {
  const result = [];
  world.traverse((object) => {
    if (object.name?.startsWith(prefix)) result.push(object);
  });
  return result;
}

function safeHousePoint(samples, ownIndex, side, trackWidth) {
  const sample = samples[ownIndex];
  for (const offset of [30, 35, 40, 45]) {
    const point = sample.point.clone().addScaledVector(sample.normal, side * offset);
    if (nearestNonLocalDistance(point, samples, ownIndex, 32) >= trackWidth + 8) return point;
  }
  return null;
}

function groundClone(world, clone, point, sample, terrainHeightAt, ordinal) {
  clone.position.set(point.x, 0, point.z);
  clone.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + Math.PI;
  clone.updateWorldMatrix(true, true);
  const before = new THREE.Box3().setFromObject(clone, true);
  if (before.isEmpty()) return null;
  clone.position.y += terrainHeightAt(point.x, point.z) - before.min.y - 0.04;
  clone.name = `Mountain lower valley cloned house LAB r1 ${ordinal}`;
  clone.userData.turnMountainLongHouse = true;
  // r6 has already run before this extension. These clones deliberately do not
  // inherit extra PointLights or per-house window-spill lights.
  world.add(clone);
  return clone;
}

function installLowerVillage(world, samples, trackWidth, terrainHeightAt) {
  const sources = collectNamed(world, HOUSE_PREFIX);
  if (!sources.length) return { houses: 0, houseCenters: [] };
  let placed = 0;
  const houseCenters = [];
  LOWER_VILLAGE_SITES.forEach((site, index) => {
    const sampleIndex = nearestSampleIndex(samples, site.x, site.z);
    const sample = samples[sampleIndex];
    const point = safeHousePoint(samples, sampleIndex, site.side, trackWidth);
    if (!point) return;
    const clone = sources[index % sources.length].clone(true);
    if (!groundClone(world, clone, point, sample, terrainHeightAt, index + 1)) return;
    const bounds = new THREE.Box3().setFromObject(clone, true);
    houseCenters.push(bounds.getCenter(new THREE.Vector3()));
    placed += 1;
  });
  return { houses: placed, houseCenters };
}

function installCheapVillageLights(world, samples, trackWidth, terrainHeightAt) {
  const placements = [];
  for (const site of LOWER_VILLAGE_SITES) {
    const index = nearestSampleIndex(samples, site.x, site.z);
    const sample = samples[index];
    const side = site.side;
    const point = sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 4.2));
    point.y = terrainHeightAt(point.x, point.z);
    placements.push({ point, yaw: Math.atan2(sample.tangent.x, sample.tangent.z) });
  }

  if (!placements.length) return 0;
  const pole = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.13, 0.16, 5.2, 7),
    new THREE.MeshStandardMaterial({ color: INK, roughness: 0.92 }),
    placements.length
  );
  pole.name = 'Mountain lower valley streetlight poles LAB r1';
  const lamp = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.33, 8, 6),
    new THREE.MeshBasicMaterial({ color: WARM_LIGHT, toneMapped: false }),
    placements.length
  );
  lamp.name = 'Mountain lower valley emissive lamps LAB r1';
  const pool = new THREE.InstancedMesh(
    new THREE.CircleGeometry(7.8, 18),
    new THREE.MeshBasicMaterial({
      color: WARM_POOL,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false
    }),
    placements.length
  );
  pool.name = 'Mountain lower valley cheap light pools LAB r1';

  const marker = new THREE.Object3D();
  placements.forEach((entry, index) => {
    marker.position.set(entry.point.x, entry.point.y + 2.6, entry.point.z);
    marker.rotation.set(0, entry.yaw, 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    pole.setMatrixAt(index, marker.matrix);

    marker.position.y = entry.point.y + 5.15;
    marker.updateMatrix();
    lamp.setMatrixAt(index, marker.matrix);

    marker.position.y = entry.point.y + 0.12;
    marker.rotation.set(-Math.PI / 2, 0, 0);
    marker.updateMatrix();
    pool.setMatrixAt(index, marker.matrix);
  });
  for (const mesh of [pole, lamp, pool]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    world.add(mesh);
  }
  return placements.length;
}

function installSparseViewScreens(world, terrainHeightAt) {
  const rockMaterial = new THREE.MeshStandardMaterial({ color: GRANITE, roughness: 1, flatShading: true });
  const snowMaterial = new THREE.MeshStandardMaterial({ color: SNOW, roughness: 1, flatShading: true });
  let count = 0;
  VIEW_SCREEN_SPECS.forEach((spec, index) => {
    const ground = terrainHeightAt(spec.x, spec.z);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockMaterial);
    rock.position.set(spec.x, ground + spec.sy * 0.68, spec.z);
    rock.rotation.set(0.05, spec.yaw, 0.03);
    rock.scale.set(spec.sx, spec.sy, spec.sz);
    rock.castShadow = false;
    rock.receiveShadow = true;
    rock.name = `Mountain lower valley sightline granite LAB r1 ${index + 1}`;
    world.add(rock);

    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), snowMaterial);
    cap.position.set(spec.x, ground + spec.sy * 1.42, spec.z);
    cap.rotation.copy(rock.rotation);
    cap.scale.set(spec.sx * 0.82, spec.sy * 0.20, spec.sz * 0.80);
    cap.castShadow = false;
    cap.receiveShadow = true;
    cap.name = `Mountain lower valley sightline snow cap LAB r1 ${index + 1}`;
    world.add(cap);
    count += 1;
  });
  return count;
}

export async function installMountainLongExtension(world, samples, trackWidth = 27) {
  if (!world || !Array.isArray(samples) || samples.length < 3) return world;
  const terrainHeightAt = world.userData.turnMountainTerrainHeightAt;
  if (typeof terrainHeightAt !== 'function') return world;

  const bridge = await installKenneyBridge(world, samples, terrainHeightAt);
  const village = installLowerVillage(world, samples, trackWidth, terrainHeightAt);
  const streetlights = installCheapVillageLights(world, samples, trackWidth, terrainHeightAt);
  const viewScreens = installSparseViewScreens(world, terrainHeightAt);

  world.userData.turnMountainLongExtension = Object.freeze({
    revision: REVISION,
    bridgeModules: bridge.modules,
    bridgePillars: bridge.pillars,
    bridgeAssetErrors: Object.freeze([...bridge.errors]),
    lowerVillageHouses: village.houses,
    cheapStreetlights: streetlights,
    dynamicPointLightsAdded: 0,
    viewScreens,
    noDropEnvelope: true,
    performanceStrategy: 'reuse-production-terrain-and-houses; no new shadow casters or dynamic point lights'
  });
  return world;
}
