import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { safeTracksidePosition } from './mountain-world-r3-terrain.js';

const REVISION = 'r5-kenney-suburban-village';
const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/immaculate-lift-studio/CityCrafter3D@0831a1937a59562b6165ccfab30f64f35c957b6f/addons/citycrafter/assets/example_assets/kenney_city-kit-suburban_20/Models/GLB%20format/';
const PALETTE_URL = `${ASSET_BASE}Textures/colormap.png`;
const HOUSE_TYPES = Object.freeze(['a', 'g', 'm', 'n', 'u']);

const SITES = Object.freeze([
  Object.freeze({ index: 4, side: 1, type: 'a', height: 8.8, yaw: -0.08 }),
  Object.freeze({ index: 18, side: 1, type: 'g', height: 9.4, yaw: 0.10 }),
  Object.freeze({ index: 34, side: -1, type: 'm', height: 9.1, yaw: -0.06 }),
  Object.freeze({ index: 52, side: 1, type: 'n', height: 10.5, yaw: 0.08 }),
  Object.freeze({ index: 70, side: -1, type: 'u', height: 10.0, yaw: -0.10 }),
  Object.freeze({ index: 1008, side: 1, type: 'u', height: 10.2, yaw: 0.08 }),
  Object.freeze({ index: 1025, side: -1, type: 'n', height: 10.8, yaw: -0.06 }),
  Object.freeze({ index: 1042, side: -1, type: 'm', height: 9.3, yaw: 0.07 }),
  Object.freeze({ index: 1058, side: 1, type: 'g', height: 9.6, yaw: -0.08 }),
  Object.freeze({ index: 1073, side: -1, type: 'a', height: 8.9, yaw: 0.06 })
]);

let palettePromise = null;

function rgbToHsv(r, g, b) {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;
  let hue = 0;
  if (delta > 1e-8) {
    if (max === rf) hue = ((gf - bf) / delta) % 6;
    else if (max === gf) hue = (bf - rf) / delta + 2;
    else hue = (rf - gf) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }
  return [hue, max <= 1e-8 ? 0 : delta / max, max];
}

function recolorPalettePixels(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const alpha = data[offset + 3];
    if (!alpha || (r < 8 && g < 8 && b < 8)) continue;

    const [hue, saturation, value] = rgbToHsv(r, g, b);

    // City Kit Suburban uses a green family for its roofs. Turn that family
    // into bright, slightly cool snow while preserving the palette shading.
    if (hue >= 0.28 && hue <= 0.50 && saturation >= 0.22 && value >= 0.28) {
      const shade = Math.round(210 + 45 * value);
      data[offset] = Math.min(255, shade + 4);
      data[offset + 1] = Math.min(255, shade + 6);
      data[offset + 2] = Math.min(255, shade + 8);
      continue;
    }

    // The houses' pale neutral wall family becomes dark-brown timber. Keep
    // the value gradient so windows, eaves and wall facets still have depth.
    if (saturation <= 0.22 && value >= 0.55) {
      const blend = THREE.MathUtils.clamp((value - 0.55) / 0.45, 0, 1);
      data[offset] = Math.round(THREE.MathUtils.lerp(66, 105, blend));
      data[offset + 1] = Math.round(THREE.MathUtils.lerp(38, 64, blend));
      data[offset + 2] = Math.round(THREE.MathUtils.lerp(22, 36, blend));
    }
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`TURN: could not load Suburban palette ${url}`));
    image.src = url;
  });
}

async function createMountainPaletteUrl() {
  if (palettePromise) return palettePromise;
  palettePromise = (async () => {
    if (typeof document === 'undefined') return PALETTE_URL;
    const image = await loadImage(PALETTE_URL);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return PALETTE_URL;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    recolorPalettePixels(pixels.data);
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
  })();
  return palettePromise;
}

function createLoader(paletteUrl) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => /(?:^|\/)Textures\/colormap\.png(?:\?|$)/i.test(url) ? paletteUrl : url);
  return new GLTFLoader(manager);
}

function prepareSource(root) {
  root.traverse((node) => {
    if (!node?.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.turnOutlined = true;
  });
  return root;
}

function preparedBuilding(source, targetHeight) {
  const building = prepareSource(source.clone(true));
  building.position.set(0, 0, 0);
  building.rotation.set(0, 0, 0);
  building.scale.set(1, 1, 1);
  building.updateWorldMatrix(true, true);

  let bounds = new THREE.Box3().setFromObject(building, true);
  if (bounds.isEmpty()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  building.scale.setScalar(targetHeight / Math.max(0.001, size.y));
  building.updateWorldMatrix(true, true);

  bounds = new THREE.Box3().setFromObject(building, true);
  const center = bounds.getCenter(new THREE.Vector3());
  building.position.x -= center.x;
  building.position.y -= bounds.min.y;
  building.position.z -= center.z;
  building.updateWorldMatrix(true, true);
  return building;
}

function removeAssembledCabins(world) {
  const removals = [];
  world.traverse((object) => {
    if (object === world || !object.name) return;
    if (/Mountain .*Holiday.*cabin/i.test(object.name)
        || /Mountain Kenney Holiday cabin prefab/i.test(object.name)) {
      removals.push(object);
    }
  });
  removals.sort((a, b) => objectDepth(b) - objectDepth(a));
  for (const object of removals) object.parent?.remove(object);
  return removals.length;
}

function objectDepth(object) {
  let depth = 0;
  for (let node = object?.parent; node; node = node.parent) depth += 1;
  return depth;
}

function trackYaw(sample, side, adjustment) {
  return Math.atan2(sample.tangent.x, sample.tangent.z)
    + (side > 0 ? Math.PI : 0)
    + adjustment;
}

function groundingDiagnostics(world) {
  if (!Array.isArray(world.userData.turnMountainGroundingDiagnostics)) {
    world.userData.turnMountainGroundingDiagnostics = [];
  }
  return world.userData.turnMountainGroundingDiagnostics;
}

function groundBuilding(world, building, spec, point, sample, terrainHeightAt) {
  building.position.set(point.x, 0, point.z);
  building.rotation.y = trackYaw(sample, spec.side, spec.yaw);
  building.updateWorldMatrix(true, true);
  const before = new THREE.Box3().setFromObject(building, true);
  if (before.isEmpty()) return null;
  const groundY = terrainHeightAt(point.x, point.z);
  building.position.y += groundY - before.min.y - 0.06;
  building.updateWorldMatrix(true, true);
  const after = new THREE.Box3().setFromObject(building, true);
  building.name = `Mountain Kenney Suburban house r5 type-${spec.type}`;
  building.userData.turnKenneySuburbanAsset = `building-type-${spec.type}`;
  building.userData.turnMountainVillageRevision = REVISION;
  world.add(building);
  groundingDiagnostics(world).push(Object.freeze({
    name: building.name,
    groundY,
    minY: after.min.y,
    maxY: after.max.y,
    delta: after.min.y - groundY,
    height: after.max.y - after.min.y
  }));
  return building;
}

async function loadSources() {
  const paletteUrl = await createMountainPaletteUrl();
  const loader = createLoader(paletteUrl);
  const pairs = await Promise.all(HOUSE_TYPES.map(async (type) => {
    const gltf = await loader.loadAsync(`${ASSET_BASE}building-type-${type}.glb`);
    return [type, prepareSource(gltf.scene)];
  }));
  return { sourceByType: new Map(pairs), paletteUrl };
}

export async function installMountainR5SuburbanVillage(world, samples, trackWidth, terrainContext) {
  if (!world || !Array.isArray(samples) || !terrainContext?.terrainHeightAt) return world;
  const removed = removeAssembledCabins(world);
  const retiredCabinsSkipped = world.userData.turnMountainRetiredR3CabinsSkipped === true
    && world.userData.turnMountainR4VisualPolish?.retiredCabinsSkipped === true;
  const errors = [];
  let placed = 0;
  let paletteMode = 'mountain-brown-snow';

  try {
    const { sourceByType, paletteUrl } = await loadSources();
    if (paletteUrl === PALETTE_URL) paletteMode = 'original-fallback';

    for (const spec of SITES) {
      const source = sourceByType.get(spec.type);
      if (!source) continue;
      const building = preparedBuilding(source, spec.height);
      if (!building) continue;
      building.updateWorldMatrix(true, true);
      const localBounds = new THREE.Box3().setFromObject(building, true);
      const size = localBounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.z) * 0.56;
      const point = safeTracksidePosition(samples, spec.index, spec.side, trackWidth, radius, 31, 64, 4.5);
      if (!point) continue;
      const sample = samples[spec.index % samples.length];
      if (groundBuilding(world, building, spec, point, sample, terrainContext.terrainHeightAt)) placed += 1;
    }
  } catch (error) {
    errors.push(String(error?.message || error));
  }

  world.userData.turnMountainR5SuburbanVillage = Object.freeze({
    revision: REVISION,
    removedAssembledCabins: removed,
    retiredCabinsSkipped,
    placed,
    requestedTypes: [...HOUSE_TYPES],
    paletteMode,
    source: 'Kenney City Kit Suburban',
    completeBuildings: true
  });
  world.userData.turnMountainR5AssetErrors = errors;
  return world;
}
