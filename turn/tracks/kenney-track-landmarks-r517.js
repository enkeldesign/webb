import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const REVISION = 'r531-countryside-world-redesign';
const INK = 0x08090a;
const SEA_LEVEL = -16.5;
const WINDMILL_TRACK_FRACTION = 0.52;
const WINDMILL_TRACKSIDE_DISTANCE = 55;
const WINDMILL_LANDMARK_SCALE = 1.35;
const OCEAN_LINER_TRACK_FRACTION = 0.55;
const OCEAN_LINER_OFFSHORE_DISTANCE = 94;
const OCEAN_LINER_TARGET_LENGTH = 92;

const ASSET_URLS = Object.freeze({
  windmill: new URL(
    '../assets/scenery/fantasy-town/windmill.glb?asset=kenney-fantasy-town-kit-2.0-palette-4aac939d',
    import.meta.url
  ).href,
  oceanLiner: new URL(
    '../assets/scenery/watercraft/ship-ocean-liner.glb?asset=kenney-watercraft-kit-2.1-luxury-palette-31113835',
    import.meta.url
  ).href
});

const loader = new GLTFLoader();
const sourceCache = new Map();
const inkMaterial = new THREE.MeshBasicMaterial({
  color: INK,
  side: THREE.BackSide
});

function currentTrackId(runtime) {
  return globalThis.__turnGetTrackId?.() || runtime?.trackId || '';
}

function loadSource(key) {
  if (!sourceCache.has(key)) {
    const request = loader.loadAsync(ASSET_URLS[key])
      .then((gltf) => gltf.scene)
      .catch((error) => {
        sourceCache.delete(key);
        throw error;
      });
    sourceCache.set(key, request);
  }
  return sourceCache.get(key);
}

function addInkOutline(root, scale = 1.02) {
  const surfaces = [];
  root.traverse((node) => {
    if (node?.isMesh) surfaces.push(node);
  });

  for (const surface of surfaces) {
    surface.userData.turnOutlined = true;
    const outline = new THREE.Mesh(surface.geometry, inkMaterial);
    outline.name = `${surface.name || 'Landmark surface'} outline`;
    outline.scale.setScalar(scale);
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.userData.turnOutline = true;
    outline.userData.turnOutlined = true;
    surface.add(outline);
  }
}

function prepareModel(source, {
  targetSpan,
  horizontalSpan = false,
  outlineScale = 1.02,
  castShadow = false,
  receiveShadow = false,
  paletteLocked = false
}) {
  const model = source.clone(true);
  model.traverse((node) => {
    if (!node?.isMesh) return;
    node.castShadow = castShadow;
    node.receiveShadow = receiveShadow;
    node.userData.turnOutlined = true;
    if (paletteLocked) {
      node.userData.turnPaletteLocked = true;
      node.userData.turnZoneStyled = true;
    }
  });

  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const reference = horizontalSpan
    ? Math.max(size.x, size.z, 0.001)
    : Math.max(size.x, size.y, size.z, 0.001);
  model.scale.multiplyScalar(targetSpan / reference);

  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  const centre = bounds.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.y -= bounds.min.y;
  model.position.z -= centre.z;
  addInkOutline(model, outlineScale);
  return model;
}

function outlinedPrimitive(geometry, surfaceMaterial, outlineScale = 1.035) {
  const root = new THREE.Group();
  const outline = new THREE.Mesh(geometry, inkMaterial);
  const surface = new THREE.Mesh(geometry, surfaceMaterial);
  outline.scale.setScalar(outlineScale);
  outline.userData.turnOutline = true;
  outline.userData.turnOutlined = true;
  surface.castShadow = true;
  surface.receiveShadow = true;
  surface.userData.turnOutlined = true;
  root.add(outline, surface);
  return root;
}

function trackCentre(samples) {
  const centre = new THREE.Vector3();
  for (const sample of samples) centre.add(sample.point);
  centre.multiplyScalar(1 / Math.max(1, samples.length));
  centre.y = 0;
  return centre;
}

function outwardSide(sample, centre) {
  const towardsCentre = centre.clone().sub(sample.point).setY(0);
  return sample.normal.dot(towardsCentre) > 0 ? -1 : 1;
}

function createCountrysideWindmill(source, samples, trackWidth) {
  const sampleIndex = Math.round(WINDMILL_TRACK_FRACTION * samples.length) % samples.length;
  const sample = samples[sampleIndex];
  const centre = trackCentre(samples);
  const side = outwardSide(sample, centre);
  const position = sample.point.clone().addScaledVector(
    sample.normal,
    side * (trackWidth / 2 + WINDMILL_TRACKSIDE_DISTANCE)
  );
  const towardsTrack = sample.point.clone().sub(position).setY(0).normalize();

  const landmark = new THREE.Group();
  landmark.name = 'Countryside Kenney Windmill';
  landmark.userData.turnKenneyAsset = 'Fantasy Town Kit 2.0 / windmill.glb';
  landmark.userData.turnSceneryOnly = true;
  landmark.userData.gameplayGeometryUnchanged = true;

  const tower = outlinedPrimitive(
    new THREE.CylinderGeometry(4.15, 6.3, 17, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2dfbd, roughness: 0.96, metalness: 0 })
  );
  tower.name = 'Countryside Windmill Tower';
  tower.position.y = 8.5;

  const roof = outlinedPrimitive(
    new THREE.ConeGeometry(5.15, 4.6, 10),
    new THREE.MeshStandardMaterial({ color: 0xa85b3f, roughness: 0.94, metalness: 0 })
  );
  roof.name = 'Countryside Windmill Roof';
  roof.position.y = 19.3;

  const door = outlinedPrimitive(
    new THREE.BoxGeometry(2.35, 4.7, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x6f4932, roughness: 1, metalness: 0 }),
    1.055
  );
  door.name = 'Countryside Windmill Door';
  door.position.set(0, 2.45, 6.02);

  const rotor = prepareModel(source, {
    targetSpan: 18.6,
    outlineScale: 1.025,
    castShadow: true,
    receiveShadow: true,
    paletteLocked: true
  });
  rotor.name = 'Kenney Fantasy Town Windmill Rotor';
  rotor.userData.turnBladePalette = 'authored warm wood and pale sail cloth';
  // The source rotor lies in its local Y/Z plane. Turn its normal toward local +Z,
  // then turn the complete landmark so the blades face the road.
  rotor.rotation.y = -Math.PI / 2;
  rotor.position.add(new THREE.Vector3(0, 8.2, 6.55));

  landmark.add(tower, roof, door, rotor);
  landmark.traverse((node) => {
    if (!node?.isMesh) return;
    // The former global zone tint pushed the Fantasy Town blades toward orange/pink.
    // Keep both the supplied blade palette and the deliberately neutral mill body.
    node.userData.turnPaletteLocked = true;
    node.userData.turnZoneStyled = true;
  });
  landmark.scale.setScalar(WINDMILL_LANDMARK_SCALE);
  landmark.position.copy(position);
  landmark.position.y = sample.point.y + 0.08;
  landmark.rotation.y = Math.atan2(towardsTrack.x, towardsTrack.z);
  return landmark;
}

function createCliffsideOceanLiner(source, samples, trackWidth) {
  const sampleIndex = Math.round(OCEAN_LINER_TRACK_FRACTION * samples.length) % samples.length;
  const sample = samples[sampleIndex];
  const liner = prepareModel(source, {
    targetSpan: OCEAN_LINER_TARGET_LENGTH,
    horizontalSpan: true,
    outlineScale: 1.012
  });

  liner.name = 'Cliffside Kenney Ocean Liner';
  liner.userData.turnKenneyAsset = 'Watercraft Kit 2.1 / ship-ocean-liner.glb';
  liner.userData.turnSceneryOnly = true;
  liner.userData.gameplayGeometryUnchanged = true;
  const normalizedBaseY = liner.position.y;
  const oceanPosition = sample.point.clone().addScaledVector(
    sample.normal,
    -(trackWidth / 2 + OCEAN_LINER_OFFSHORE_DISTANCE)
  );
  liner.position.x += oceanPosition.x;
  liner.position.y = SEA_LEVEL - 4.3 + normalizedBaseY;
  liner.position.z += oceanPosition.z;
  liner.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + 0.1;
  return liner;
}

export async function installCountrysideWindmill(runtime = globalThis.__turnRuntime) {
  if (!runtime || currentTrackId(runtime) !== 'countryside' || !runtime.activeWorld || !runtime.samples?.length) {
    return null;
  }

  const world = runtime.activeWorld;
  if (world.userData.turnCountrysideWindmill === REVISION) {
    return world.getObjectByName('Countryside Kenney Windmill');
  }
  if (world.userData.turnCountrysideWindmillPending === REVISION) return null;

  world.userData.turnCountrysideWindmillPending = REVISION;
  const samples = runtime.samples.slice();
  const trackWidth = runtime.trackWidth || 27;

  try {
    const source = await loadSource('windmill');
    if (runtime.activeWorld !== world || currentTrackId(runtime) !== 'countryside') {
      world.userData.turnCountrysideWindmillPending = null;
      return null;
    }

    const landmark = createCountrysideWindmill(source, samples, trackWidth);
    world.add(landmark);
    world.userData.turnCountrysideWindmill = REVISION;
    world.userData.turnCountrysideWindmillPending = null;
    return landmark;
  } catch (error) {
    world.userData.turnCountrysideWindmillPending = null;
    console.warn('TURN: Countryside Kenney windmill failed to load.', error);
    return null;
  }
}

export async function installCliffsideOceanLiner(runtime = globalThis.__turnRuntime) {
  if (!runtime || currentTrackId(runtime) !== 'cliffside' || !runtime.activeWorld || !runtime.samples?.length) {
    return null;
  }

  const world = runtime.activeWorld;
  if (world.userData.turnCliffsideOceanLiner === REVISION) {
    return world.getObjectByName('Cliffside Kenney Ocean Liner');
  }
  if (world.userData.turnCliffsideOceanLinerPending === REVISION) return null;

  world.userData.turnCliffsideOceanLinerPending = REVISION;
  const samples = runtime.samples.slice();
  const trackWidth = runtime.trackWidth || 27;

  try {
    const source = await loadSource('oceanLiner');
    if (runtime.activeWorld !== world || currentTrackId(runtime) !== 'cliffside') {
      world.userData.turnCliffsideOceanLinerPending = null;
      return null;
    }

    const liner = createCliffsideOceanLiner(source, samples, trackWidth);
    world.add(liner);
    world.userData.turnCliffsideOceanLiner = REVISION;
    world.userData.turnCliffsideOceanLinerPending = null;
    return liner;
  } catch (error) {
    world.userData.turnCliffsideOceanLinerPending = null;
    console.warn('TURN: Cliffside Kenney ocean liner failed to load.', error);
    return null;
  }
}

async function installForActiveTrack(runtime = globalThis.__turnRuntime) {
  const trackId = currentTrackId(runtime);
  if (trackId === 'countryside') return installCountrysideWindmill(runtime);
  if (trackId === 'cliffside') return installCliffsideOceanLiner(runtime);
  return null;
}

function scheduleActiveTrackInstall() {
  void installForActiveTrack().catch((error) => {
    console.warn('TURN: Kenney track landmark installation failed.', error);
  });
}

globalThis.addEventListener('turn:track-changed', scheduleActiveTrackInstall);
globalThis.addEventListener('turn:runtime-ready', scheduleActiveTrackInstall, { once: true });
scheduleActiveTrackInstall();
