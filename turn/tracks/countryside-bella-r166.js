import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r166-bella-records';

// Kenney Cube Pets · animal-cat.glb · CC0.
// Pinned mirror of the original pack asset so the model cannot drift between releases.
const BELLA_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/satoLG/defend_the_crystal@99136ff0d498d327d912528be5c1931d24d6a8d1/apps/web/public/models/pets/animal-cat.glb';
const BELLA_SAMPLE_INDEX = 500;
const BELLA_SIDE = -1;
const BELLA_DISTANCE_FROM_ROAD = 48;
const BELLA_TANGENT_OFFSET = 8;
const BELLA_HEIGHT = 5.2;
const REQUIRED_VEHICLE_ID = 'firetruck';
const DISCOVERY_DISTANCE = 58;
const DISCOVERY_DISTANCE_SQUARED = DISCOVERY_DISTANCE * DISCOVERY_DISTANCE;
const DISCOVERY_VIEW_DOT = 0.58;
const DISCOVERY_HOLD_MS = 650;

const loader = new GLTFLoader();
let sourcePromise = null;

function loadKenneyCat() {
  if (!sourcePromise) sourcePromise = loader.loadAsync(BELLA_MODEL_URL);
  return sourcePromise;
}

function material(color, roughness = 0.92) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
}

function outlinedPrimitive(geometry, fillMaterial, outlineScale = 1.065) {
  const group = new THREE.Group();
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x08090a, side: THREE.BackSide })
  );
  outline.scale.setScalar(outlineScale);
  const fill = new THREE.Mesh(geometry, fillMaterial);
  fill.castShadow = true;
  fill.receiveShadow = true;
  group.add(outline, fill);
  return group;
}

function recolorSourceModel(scene) {
  const cream = new THREE.Color(0xe8d9bd);
  scene.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const recolored = sourceMaterials.map((source) => {
      const clone = source.clone();
      clone.map = null;
      clone.color?.copy(cream);
      clone.roughness = 0.92;
      clone.metalness = 0;
      clone.needsUpdate = true;
      return clone;
    });
    node.material = Array.isArray(node.material) ? recolored : recolored[0];
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function normalizeCat(scene) {
  recolorSourceModel(scene);
  scene.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  scene.scale.multiplyScalar(BELLA_HEIGHT / Math.max(size.y, 0.001));
  scene.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(scene);
  const center = bounds.getCenter(new THREE.Vector3());
  scene.position.set(-center.x, -bounds.min.y, -center.z);
  return scene;
}

function addBellaMarkings(holder) {
  const dark = material(0x241d1b);
  const white = material(0xf7f2e7);

  const face = outlinedPrimitive(new THREE.BoxGeometry(1.65, 1.35, 0.42), dark, 1.045);
  face.position.set(0, 3.82, 1.13);
  holder.add(face);

  for (const x of [-0.55, 0.55]) {
    const ear = outlinedPrimitive(new THREE.ConeGeometry(0.42, 0.95, 4), dark, 1.055);
    ear.position.set(x, 4.86, 0.92);
    ear.rotation.y = Math.PI / 4;
    holder.add(ear);
  }

  const legPositions = [
    [-0.83, 0.92, 0.82],
    [0.83, 0.92, 0.82],
    [-0.83, 0.92, -0.72],
    [0.83, 0.92, -0.72]
  ];
  for (const [x, y, z] of legPositions) {
    const leg = outlinedPrimitive(new THREE.BoxGeometry(0.62, 1.35, 0.62), dark, 1.045);
    leg.position.set(x, y, z);
    holder.add(leg);
    const paw = outlinedPrimitive(new THREE.BoxGeometry(0.72, 0.38, 0.82), white, 1.045);
    paw.position.set(x, 0.28, z + 0.08);
    holder.add(paw);
  }

  const tail = outlinedPrimitive(new THREE.BoxGeometry(0.54, 0.54, 2.7), dark, 1.05);
  tail.position.set(-1.18, 1.45, -1.58);
  tail.rotation.set(-0.34, 0.36, -0.18);
  holder.add(tail);
}

function createFallbackCat() {
  const holder = new THREE.Group();
  const cream = material(0xe8d9bd);
  const body = outlinedPrimitive(new THREE.BoxGeometry(2.55, 2.25, 3.05), cream);
  body.position.y = 2.05;
  holder.add(body);
  const head = outlinedPrimitive(new THREE.BoxGeometry(2.2, 1.95, 1.9), cream);
  head.position.set(0, 3.65, 1.15);
  holder.add(head);
  addBellaMarkings(holder);
  return holder;
}

async function createBellaModel() {
  const holder = new THREE.Group();
  try {
    const gltf = await loadKenneyCat();
    holder.add(normalizeCat(gltf.scene));
  } catch (error) {
    console.warn('TURN: Kenney Cube Pets cat could not load; using Bella fallback.', error);
    holder.add(createFallbackCat());
  }
  addBellaMarkings(holder);
  holder.name = 'Countryside Bella · Kenney Cube Pets cat';
  holder.userData.turnEasterEgg = 'save-bella';
  holder.userData.turnBellaRequiredVehicle = REQUIRED_VEHICLE_ID;
  return holder;
}

function sampleAt(samples, index) {
  return samples[((Math.round(index) % samples.length) + samples.length) % samples.length];
}

function placeBella(model, samples, trackWidth) {
  const sample = sampleAt(samples, BELLA_SAMPLE_INDEX);
  model.position.copy(sample.point)
    .addScaledVector(sample.normal, BELLA_SIDE * (trackWidth / 2 + BELLA_DISTANCE_FROM_ROAD))
    .addScaledVector(sample.tangent, BELLA_TANGENT_OFFSET);
  model.position.y = 0;
  const inward = sample.normal.clone().multiplyScalar(-BELLA_SIDE);
  model.rotation.y = Math.atan2(inward.x, inward.z);
  model.userData.turnBellaPlacement =
    'south-west Countryside forest edge beside the trackside building near sample 500';
  return model;
}

function armBellaDiscovery(model, runtime) {
  const renderAnchor = model.getObjectByProperty('isMesh', true)
    || model.getObjectByProperty('isSkinnedMesh', true);
  if (!renderAnchor) return false;

  const bellaPosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const cameraToBella = new THREE.Vector3();
  const previousOnBeforeRender = renderAnchor.onBeforeRender;
  let discoveryStartedAt = null;

  renderAnchor.onBeforeRender = function discoverBella(...args) {
    previousOnBeforeRender?.call(this, ...args);
    if (model.userData.turnSecretAchievementFound) return;

    const state = runtime?.state;
    const camera = args[2];
    const countrysideActive = state?.running === true
      && (state.trackId || globalThis.__turnGetTrackId?.()) === 'countryside';
    if (!countrysideActive || state.vehicleId !== REQUIRED_VEHICLE_ID || !camera?.isCamera) {
      discoveryStartedAt = null;
      return;
    }

    model.getWorldPosition(bellaPosition);
    camera.getWorldPosition(cameraPosition);
    if (cameraPosition.distanceToSquared(bellaPosition) > DISCOVERY_DISTANCE_SQUARED) {
      discoveryStartedAt = null;
      return;
    }

    camera.getWorldDirection(cameraForward);
    cameraToBella.copy(bellaPosition).sub(cameraPosition).normalize();
    if (cameraForward.dot(cameraToBella) < DISCOVERY_VIEW_DOT) {
      discoveryStartedAt = null;
      return;
    }

    const now = globalThis.performance?.now?.() ?? Date.now();
    if (discoveryStartedAt == null) {
      discoveryStartedAt = now;
      return;
    }
    if (now - discoveryStartedAt < DISCOVERY_HOLD_MS) return;

    model.userData.turnSecretAchievementFound = true;
    renderAnchor.onBeforeRender = previousOnBeforeRender;
    signalSecretAchievement('save-bella', {
      trackId: 'countryside',
      vehicleId: REQUIRED_VEHICLE_ID
    });
  };
  return true;
}

export async function installCountrysideBella({ world, samples, trackWidth, runtime } = {}) {
  if (!world || !Array.isArray(samples) || !samples.length || !Number.isFinite(trackWidth)) return null;
  const existing = world.children.find((child) => child?.userData?.turnEasterEgg === 'save-bella');
  if (existing) return existing;

  const bella = placeBella(await createBellaModel(), samples, trackWidth);
  world.add(bella);
  armBellaDiscovery(bella, runtime || globalThis.__turnRuntime);
  world.userData.turnBellaDiscovery = Object.freeze({
    model: 'Kenney Cube Pets animal-cat',
    palette: 'Bella cream, seal brown and white paws',
    requiredVehicle: 'Fire Truck',
    sampleIndex: BELLA_SAMPLE_INDEX,
    discoveryHoldMs: DISCOVERY_HOLD_MS
  });
  return bella;
}
