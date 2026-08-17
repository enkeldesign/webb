import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  MOUNTAIN_R3,
  material,
  safeTracksidePosition,
  seededRandom
} from './mountain-world-r3-terrain.js';

const {
  GRANITE_DARK,
  SNOW,
  WATER_LIGHT,
  WATERFALL,
  LAKE,
  HOLIDAY_ROOT,
  FANTASY_ROOT
} = MOUNTAIN_R3;

function prepareAsset(root) {
  root.traverse((node) => {
    if (!node?.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.turnOutlined = true;
  });
  return root;
}

function clonePrepared(root) {
  return prepareAsset(root.clone(true));
}

function removeNamed(world, predicate) {
  const removals = [];
  world.traverse((object) => {
    if (object !== world && predicate(object)) removals.push(object);
  });
  removals.sort((a, b) => depth(b) - depth(a));
  for (const object of removals) object.parent?.remove(object);
  return removals.length;
}

function depth(object) {
  let value = 0;
  for (let node = object?.parent; node; node = node.parent) value += 1;
  return value;
}

function groundingDiagnostics(world) {
  if (!Array.isArray(world.userData.turnMountainGroundingDiagnostics)) {
    world.userData.turnMountainGroundingDiagnostics = [];
  }
  return world.userData.turnMountainGroundingDiagnostics;
}

function groundImportedAsset(root, {
  x,
  z,
  yaw = 0,
  scale = 1,
  terrainHeightAt,
  sink = 0.05,
  world,
  name
}) {
  root.position.set(x, 0, z);
  root.rotation.set(0, yaw, 0);
  root.scale.setScalar(scale);
  root.updateWorldMatrix(true, true);
  const before = new THREE.Box3().setFromObject(root, true);
  if (before.isEmpty()) return null;
  const groundY = terrainHeightAt(x, z);
  root.position.y += groundY - before.min.y - sink;
  root.updateWorldMatrix(true, true);
  const after = new THREE.Box3().setFromObject(root, true);
  root.name = name;
  world.add(root);
  groundingDiagnostics(world).push(Object.freeze({
    name,
    groundY,
    minY: after.min.y,
    maxY: after.max.y,
    delta: after.min.y - groundY,
    height: after.max.y - after.min.y
  }));
  return root;
}

function localGroundedClone(template) {
  const clone = clonePrepared(template);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(clone, true);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -box.min.y, -center.z);
  }
  return clone;
}

function addWall(cabin, template, x, z, yaw, name) {
  const wall = localGroundedClone(template);
  wall.position.x += x;
  wall.position.z += z;
  wall.rotation.y = yaw;
  wall.name = name;
  cabin.add(wall);
  return wall;
}

function makeGable(z, color = 0x8a5c3f) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1.02, 0.96, z,
     1.02, 0.96, z,
     0.00, 1.93, z,
  ], 3));
  geometry.computeVertexNormals();
  const gable = new THREE.Mesh(geometry, material(color, 1, 0, { side: THREE.DoubleSide }));
  gable.castShadow = true;
  gable.receiveShadow = true;
  gable.userData.turnOutlined = true;
  gable.name = 'Mountain closed Holiday cabin gable r4';
  return gable;
}

function makeAssembledHolidayCabin(templates, variant = 0) {
  const cabin = new THREE.Group();

  // Kenney Holiday cabin panels use a one-unit modular grid. The old r3
  // assembly put every wall through the centre. r4 places the panels around
  // a genuine 2 x 2 footprint, then closes both triangular gables.
  addWall(cabin, templates.doorway, -0.5, 1.0, 0, 'Mountain Holiday front doorway panel r4');
  addWall(cabin, templates.window, 0.5, 1.0, 0, 'Mountain Holiday front window panel r4');
  addWall(cabin, templates.wall, -0.5, -1.0, Math.PI, 'Mountain Holiday back wall panel r4');
  addWall(cabin, variant ? templates.window : templates.wall, 0.5, -1.0, Math.PI, 'Mountain Holiday back detail panel r4');

  for (const z of [-0.5, 0.5]) {
    addWall(cabin, templates.wall, -1.0, z, -Math.PI / 2, 'Mountain Holiday left wall panel r4');
    addWall(cabin, variant ? templates.window : templates.wall, 1.0, z, Math.PI / 2, 'Mountain Holiday right wall panel r4');
  }

  const roofA = localGroundedClone(templates.roof);
  roofA.position.set(0.45, 0.98, 0);
  roofA.name = 'Mountain Holiday snow roof half r4';
  cabin.add(roofA);
  const roofB = localGroundedClone(templates.roof);
  roofB.position.set(-0.45, 0.98, 0);
  roofB.scale.x = -1;
  roofB.name = 'Mountain Holiday mirrored snow roof half r4';
  cabin.add(roofB);

  cabin.add(makeGable(1.01), makeGable(-1.01));

  // A dark plinth makes the log walls read as one building when snow banks
  // partially cover the bottom of the imported modules.
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(2.14, 0.16, 2.14),
    material(GRANITE_DARK, 1)
  );
  plinth.position.y = 0.02;
  plinth.name = 'Mountain Holiday cabin stone plinth r4';
  cabin.add(plinth);

  cabin.userData.turnKenneyGridAssembly = Object.freeze({
    unit: 1,
    footprint: '2x2',
    wallPanels: 8,
    gablesClosed: true,
    roofMirror: true,
    revision: 'r4'
  });
  return cabin;
}

function addWarmLanternGlow(world, lantern, suffix) {
  lantern.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(lantern, true);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const y = bounds.max.y - size.y * 0.20;
  const radius = THREE.MathUtils.clamp(size.y * 0.075, 0.34, 0.88);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 10, 7),
    new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.98, depthWrite: false })
  );
  core.position.set(centre.x, y, centre.z);
  core.name = `Mountain warm lantern core r4 ${suffix}`;
  core.renderOrder = 6;
  world.add(core);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 2.2, 10, 7),
    new THREE.MeshBasicMaterial({
      color: 0xffc94f,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  halo.position.copy(core.position);
  halo.name = `Mountain warm lantern halo r4 ${suffix}`;
  halo.renderOrder = 5;
  world.add(halo);
}

function nearestTrackSample(samples, x, z) {
  let nearest = samples[0];
  let distanceSq = Infinity;
  for (const sample of samples) {
    const dx = sample.point.x - x;
    const dz = sample.point.z - z;
    const candidate = dx * dx + dz * dz;
    if (candidate < distanceSq) {
      distanceSq = candidate;
      nearest = sample;
    }
  }
  return nearest;
}

function waterfallQuad(topCenter, bottomCenter, across, halfWidth, materialRef, name) {
  const topLeft = topCenter.clone().addScaledVector(across, -halfWidth);
  const topRight = topCenter.clone().addScaledVector(across, halfWidth);
  const bottomLeft = bottomCenter.clone().addScaledVector(across, -halfWidth);
  const bottomRight = bottomCenter.clone().addScaledVector(across, halfWidth);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    ...topLeft.toArray(), ...topRight.toArray(), ...bottomLeft.toArray(),
    ...topRight.toArray(), ...bottomRight.toArray(), ...bottomLeft.toArray()
  ], 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, materialRef);
  mesh.name = name;
  mesh.renderOrder = 7;
  return mesh;
}

function openAndEmphasiseWaterfall(world, samples) {
  // The central procedural granite chunk sat directly in front of the r3
  // waterfall when approaching from the village. Keep rock shoulders on both
  // sides, but open the centre so the water becomes the landmark.
  removeNamed(world, (object) => (
    object.name === 'Mountain structural waterfall granite r3'
    && Math.abs(object.position.x - WATERFALL.x) < 10
  ));

  const road = nearestTrackSample(samples, WATERFALL.x, WATERFALL.z);
  const towardRoad = new THREE.Vector3(
    road.point.x - WATERFALL.x,
    0,
    road.point.z - WATERFALL.z
  ).normalize();
  const across = new THREE.Vector3(-towardRoad.z, 0, towardRoad.x).normalize();
  const topCenter = new THREE.Vector3(
    WATERFALL.x,
    WATERFALL.top - 0.7,
    WATERFALL.z - 8.5
  ).addScaledVector(towardRoad, 2.4);
  const bottomCenter = new THREE.Vector3(
    LAKE.x,
    LAKE.level + 0.42,
    LAKE.z + LAKE.rz * 0.82
  ).addScaledVector(towardRoad, 1.5);

  const blue = new THREE.MeshStandardMaterial({
    color: WATER_LIGHT,
    roughness: 0.18,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
    emissive: 0x0b5872,
    emissiveIntensity: 0.24,
    depthWrite: false
  });
  const white = new THREE.MeshBasicMaterial({
    color: 0xe9fcff,
    transparent: true,
    opacity: 0.70,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  world.add(
    waterfallQuad(topCenter, bottomCenter, across, 11.2, blue, 'Mountain track-visible waterfall curtain r4'),
    waterfallQuad(
      topCenter.clone().addScaledVector(across, 0.8),
      bottomCenter.clone().addScaledVector(across, -0.4),
      across,
      3.1,
      white,
      'Mountain track-visible waterfall whitewater r4'
    )
  );

  world.userData.turnMountainTrackVisibleWaterfall = true;
}

function makeLayeredDistantMountains(world) {
  const peaks = [
    [-620, 430, 138, 168, -0.12],
    [-465, 515, 112, 146, 0.18],
    [-190, 570, 126, 172, -0.04],
    [188, 575, 120, 160, 0.09],
    [470, 505, 116, 150, -0.17],
    [625, 405, 146, 176, 0.12],
    [-610, -315, 126, 138, 0.08],
    [615, -340, 134, 148, -0.10]
  ];

  peaks.forEach(([x, z, radius, height, rotation], index) => {
    const geometry = new THREE.ConeGeometry(radius, height, 7 + (index % 3), 4);
    const position = geometry.getAttribute('position');
    const colors = [];
    const rock = new THREE.Color(index % 2 ? 0x77838a : 0x66737b);
    const snow = new THREE.Color(SNOW);
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const px = position.getX(vertex);
      const py = position.getY(vertex);
      const pz = position.getZ(vertex);
      const normalized = (py + height / 2) / height;
      const angle = Math.atan2(pz, px);
      const snowLine = 0.66 + Math.sin(angle * 4 + index * 0.7) * 0.045;
      const color = normalized >= snowLine ? snow : rock;
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const peak = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })
    );
    peak.position.set(x, height / 2 - 9, z);
    peak.rotation.y = rotation;
    peak.receiveShadow = true;
    peak.name = `Mountain distant layered ridge r4 ${index + 1}`;
    world.add(peak);
  });
}

async function loadVillageTemplates() {
  const loader = new GLTFLoader();
  const [wall, doorway, windowLarge, roof, bench, lantern, sled, snowTree, stallGreen, stallRed, cart, fence] = await Promise.all([
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-wall.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-doorway.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-window-large.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-roof-snow.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/bench.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/lantern.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/sled.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/tree-snow-a.glb`),
    loader.loadAsync(`${FANTASY_ROOT}/stall-green.glb`),
    loader.loadAsync(`${FANTASY_ROOT}/stall-red.glb`),
    loader.loadAsync(`${FANTASY_ROOT}/cart.glb`),
    loader.loadAsync(`${FANTASY_ROOT}/fence.glb`)
  ]);
  return {
    wall: prepareAsset(wall.scene),
    doorway: prepareAsset(doorway.scene),
    window: prepareAsset(windowLarge.scene),
    roof: prepareAsset(roof.scene),
    bench: prepareAsset(bench.scene),
    lantern: prepareAsset(lantern.scene),
    sled: prepareAsset(sled.scene),
    snowTree: prepareAsset(snowTree.scene),
    stallGreen: prepareAsset(stallGreen.scene),
    stallRed: prepareAsset(stallRed.scene),
    cart: prepareAsset(cart.scene),
    fence: prepareAsset(fence.scene)
  };
}

function trackYaw(sample, faceRoad) {
  return Math.atan2(sample.tangent.x, sample.tangent.z) + (faceRoad ? Math.PI : 0);
}

function placeCabins(world, samples, trackWidth, terrainHeightAt, templates) {
  const sites = [
    [4, 1, 6.4, 0],
    [18, 1, 6.0, 1],
    [34, -1, 5.8, 0],
    [52, 1, 6.5, 1],
    [70, -1, 5.7, 0],
    [1008, 1, 5.8, 1],
    [1025, -1, 6.2, 0],
    [1042, -1, 5.7, 1],
    [1058, 1, 6.5, 0],
    [1073, -1, 6.0, 1]
  ];
  let placed = 0;
  sites.forEach(([index, side, scale, variant], siteIndex) => {
    const point = safeTracksidePosition(samples, index, side, trackWidth, 7.8, 27, 56, 3.2);
    if (!point) return;
    const sample = samples[index % samples.length];
    const cabin = groundImportedAsset(makeAssembledHolidayCabin(templates, variant), {
      x: point.x,
      z: point.z,
      yaw: trackYaw(sample, side > 0) + (siteIndex % 2 ? 0.10 : -0.08),
      scale,
      terrainHeightAt,
      world,
      sink: 0.10,
      name: `Mountain Kenney Holiday cabin prefab r3 assembled r4 ${siteIndex + 1}`
    });
    if (cabin) placed += 1;
  });
  return placed;
}

function placeLitStreetlights(world, samples, trackWidth, terrainHeightAt, templates) {
  const sites = [
    [3, -1], [12, 1], [24, -1], [37, 1], [51, -1], [65, 1],
    [1015, 1], [1028, -1], [1043, 1], [1057, -1], [1070, 1]
  ];
  let placed = 0;
  sites.forEach(([index, side], cursor) => {
    const point = safeTracksidePosition(samples, index, side, trackWidth, 1.9, 20.5, 34, 1.7);
    if (!point) return;
    const lantern = groundImportedAsset(clonePrepared(templates.lantern), {
      x: point.x,
      z: point.z,
      yaw: trackYaw(samples[index], false),
      scale: 7.0,
      terrainHeightAt,
      world,
      sink: 0.05,
      name: `Mountain Kenney Holiday lit streetlight r4 ${cursor + 1}`
    });
    if (!lantern) return;
    addWarmLanternGlow(world, lantern, cursor + 1);
    placed += 1;
  });
  return placed;
}

function placeWinterMarket(world, samples, trackWidth, terrainHeightAt, templates) {
  const anchorIndex = 16;
  const side = -1;
  const anchor = safeTracksidePosition(samples, anchorIndex, side, trackWidth, 6.5, 26, 46, 3.2);
  if (!anchor) return 0;
  const sample = samples[anchorIndex];
  const tangent = sample.tangent.clone().setY(0).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const yaw = trackYaw(sample, false);
  const items = [
    { template: templates.snowTree, along: 0, across: 0, scale: 7.8, yaw: 0, name: 'Mountain winter market tree r4' },
    { template: templates.stallGreen, along: -11, across: 5, scale: 5.5, yaw: yaw + 0.16, name: 'Mountain winter market green stall r4' },
    { template: templates.stallRed, along: 11, across: 5, scale: 5.5, yaw: yaw - 0.14, name: 'Mountain winter market red stall r4' },
    { template: templates.cart, along: 13, across: -5, scale: 5.0, yaw: yaw + 0.5, name: 'Mountain winter market cart r4' },
    { template: templates.bench, along: -9, across: -6, scale: 5.5, yaw: yaw - 0.2, name: 'Mountain winter market bench r4' },
    { template: templates.sled, along: 3, across: -8, scale: 4.8, yaw: yaw + 0.65, name: 'Mountain winter market sled r4' }
  ];
  let placed = 0;
  items.forEach((item) => {
    const position = anchor.clone()
      .addScaledVector(tangent, item.along)
      .addScaledVector(normal, item.across);
    const result = groundImportedAsset(clonePrepared(item.template), {
      x: position.x,
      z: position.z,
      yaw: item.yaw,
      scale: item.scale,
      terrainHeightAt,
      world,
      sink: 0.06,
      name: item.name
    });
    if (result) placed += 1;
  });
  return placed;
}

function placeVillageSetDressing(world, samples, trackWidth, terrainHeightAt, templates) {
  const items = [
    [8, 1, templates.bench, 5.1, 2.8, 'Mountain village bench r4'],
    [44, -1, templates.sled, 4.6, 2.6, 'Mountain village sled r4'],
    [62, 1, templates.cart, 4.7, 3.4, 'Mountain village delivery cart r4'],
    [1019, -1, templates.bench, 5.4, 2.8, 'Mountain village overlook bench r4'],
    [1048, 1, templates.fence, 6.2, 4.5, 'Mountain village snow fence r4'],
    [1066, -1, templates.fence, 6.5, 4.5, 'Mountain village approach fence r4']
  ];
  let placed = 0;
  items.forEach(([index, side, template, scale, radius, name], cursor) => {
    const point = safeTracksidePosition(samples, index, side, trackWidth, radius, 22, 40, 2.2);
    if (!point) return;
    const result = groundImportedAsset(clonePrepared(template), {
      x: point.x,
      z: point.z,
      yaw: trackYaw(samples[index], false) + (cursor % 2 ? 0.22 : -0.18),
      scale,
      terrainHeightAt,
      world,
      sink: 0.07,
      name
    });
    if (result) placed += 1;
  });

  const treeSites = [
    [11, -1, 5.1], [27, 1, 5.7], [41, -1, 4.8], [58, 1, 5.4],
    [1012, 1, 5.0], [1033, -1, 5.6], [1052, 1, 4.9], [1069, -1, 5.3]
  ];
  treeSites.forEach(([index, side, scale], cursor) => {
    const point = safeTracksidePosition(samples, index, side, trackWidth, 3.4, 29, 48, 2.4);
    if (!point) return;
    const result = groundImportedAsset(clonePrepared(templates.snowTree), {
      x: point.x,
      z: point.z,
      yaw: cursor * 0.63,
      scale,
      terrainHeightAt,
      world,
      sink: 0.05,
      name: `Mountain village decorative Holiday spruce r4 ${cursor + 1}`
    });
    if (result) placed += 1;
  });
  return placed;
}

export async function installMountainR4VisualPolish(world, samples, trackWidth, terrainContext) {
  if (!world || !Array.isArray(samples) || !terrainContext?.terrainHeightAt) return world;
  const { terrainHeightAt } = terrainContext;

  makeLayeredDistantMountains(world);
  openAndEmphasiseWaterfall(world, samples);

  try {
    const templates = await loadVillageTemplates();

    // Replace only the weak r3 village pieces. Terrain, road, trees, rocks,
    // river and handling remain untouched.
    removeNamed(world, (object) => object.name?.includes('Mountain Kenney Holiday cabin prefab r3'));
    removeNamed(world, (object) => object.name === 'Mountain Kenney Fantasy fountain r3');
    removeNamed(world, (object) => object.name === 'Mountain Kenney Holiday lantern r3');

    const cabins = placeCabins(world, samples, trackWidth, terrainHeightAt, templates);
    const streetlights = placeLitStreetlights(world, samples, trackWidth, terrainHeightAt, templates);
    const market = placeWinterMarket(world, samples, trackWidth, terrainHeightAt, templates);
    const dressing = placeVillageSetDressing(world, samples, trackWidth, terrainHeightAt, templates);

    world.userData.turnMountainR4VisualPolish = Object.freeze({
      cabins,
      streetlights,
      marketAssets: market,
      decorativeAssets: dressing,
      fountainRemoved: true,
      waterfallOpenedToTrack: true,
      additionalDistantPeaks: 8
    });
    world.userData.turnMountainR4AssetErrors = [];
  } catch (error) {
    world.userData.turnMountainR4AssetErrors = [String(error?.message || error)];
  }

  return world;
}
