import * as THREE from 'three';
import { installCliffsideInnerBuildings } from './cliffside-inner-buildings-r202.js?revision=r202-kenney-suburban-village';

const REVISION = 'r203-inset-edge-houses';
const INNER_EDGE_EXTRA = 18.5;
const RING_BLENDS = Object.freeze([0, 0.28, 0.54, 0.75, 0.9]);
const TREE_MESH_NAMES = Object.freeze([
  'Cliffside Grounded Pine Trunks',
  'Cliffside Grounded Pine Crowns',
  'Cliffside Grounded Pine Tips'
]);

// These are the two near-edge houses visible around the ~3 o'clock and ~8 o'clock
// portions of the minimap in the supplied screenshots. Keep their cluster/fraction
// placement intact; only tuck them a few world units farther into the highland.
const HOUSE_INSETS = Object.freeze([
  Object.freeze({ childIndex: 0, fraction: 0.062, fromBlend: 0.018, toBlend: 0.040 }),
  Object.freeze({ childIndex: 6, fraction: 0.548, fromBlend: 0.020, toBlend: 0.042 })
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

function clearPinesAround(world, centre, radius = 7.5) {
  const meshes = TREE_MESH_NAMES
    .map((name) => world.getObjectByName(name))
    .filter((mesh) => mesh?.isInstancedMesh);
  if (!meshes.length) return 0;

  const reference = meshes[0];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const indices = [];
  const radiusSquared = radius * radius;

  for (let index = 0; index < reference.count; index += 1) {
    reference.getMatrixAt(index, matrix);
    matrix.decompose(position, quaternion, scale);
    const dx = position.x - centre.x;
    const dz = position.z - centre.z;
    if (dx * dx + dz * dz <= radiusSquared) indices.push(index);
  }

  for (const mesh of meshes) {
    for (const index of indices) {
      mesh.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      scale.setScalar(0);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return indices.length;
}

async function waitForVillage(runtime) {
  let village = await installCliffsideInnerBuildings(runtime);
  if (village) return village;

  // The r202 installer can already be fetching Kenney assets when this small polish
  // module executes. Wait for that one-shot async install rather than starting another.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    village = runtime.activeWorld?.getObjectByName('Cliffside Kenney Inner Village');
    if (village) return village;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 50));
  }
  return null;
}

async function insetEdgeHouses(runtime = globalThis.__turnRuntime) {
  if (!runtime || runtime.trackId !== 'cliffside' || !runtime.activeWorld || !runtime.samples?.length) return null;
  const world = runtime.activeWorld;
  const village = await waitForVillage(runtime);
  if (!village || village.userData.turnCliffsideHouseInset === REVISION) return village;

  const centre = trackCentre(runtime.samples);
  const peakCentre = new THREE.Vector3(centre.x + 12, 0, centre.z - 10);
  const trackWidth = runtime.trackWidth || 27;
  let clearedPines = 0;

  for (const inset of HOUSE_INSETS) {
    const house = village.children[inset.childIndex];
    if (!house) continue;

    const sampleIndex = Math.round(inset.fraction * runtime.samples.length) % runtime.samples.length;
    const sample = runtime.samples[sampleIndex];
    const oldPoint = highlandPoint(sample, trackWidth, peakCentre, inset.fromBlend);
    const newPoint = highlandPoint(sample, trackWidth, peakCentre, inset.toBlend);
    const oldGroundY = highlandHeight(sample, sampleIndex, peakCentre, inset.fromBlend);
    const newGroundY = highlandHeight(sample, sampleIndex, peakCentre, inset.toBlend);

    house.position.x += newPoint.x - oldPoint.x;
    house.position.z += newPoint.z - oldPoint.z;
    house.position.y += newGroundY - oldGroundY;
    house.updateMatrixWorld(true);
    clearedPines += clearPinesAround(world, newPoint);
  }

  village.userData.turnCliffsideHouseInset = REVISION;
  village.userData.turnCliffsideInsetHouseCount = HOUSE_INSETS.length;
  village.userData.turnCliffsideInsetClearedPines = clearedPines;
  world.userData.turnCliffsideArtDirection = Object.freeze({
    ...(world.userData.turnCliffsideArtDirection || {}),
    innerEdgeHouseInsetRevision: REVISION,
    gameplayGeometryUnchanged: true
  });
  return village;
}

function installForActiveTrack() {
  const runtime = globalThis.__turnRuntime;
  if (!runtime) return;
  const trackId = globalThis.__turnGetTrackId?.() || runtime.trackId;
  if (trackId !== 'cliffside') return;
  void insetEdgeHouses(runtime);
}

globalThis.addEventListener('turn:track-changed', (event) => {
  if (event.detail?.trackId === 'cliffside') installForActiveTrack();
});
globalThis.addEventListener('turn:runtime-ready', installForActiveTrack, { once: true });
installForActiveTrack();
