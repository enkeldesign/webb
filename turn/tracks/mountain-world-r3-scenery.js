import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  MOUNTAIN_R3,
  material,
  seededRandom,
  mountainFacingSign,
  offsetPoint,
  nearestTrackDistanceXZ,
  nearestNonLocalTrackDistanceXZ,
  safeTracksidePosition
} from './mountain-world-r3-terrain.js';

const {
  GRANITE_DARK,
  GRANITE_LIGHT,
  SPRUCE_DARK,
  SPRUCE_LIGHT,
  SNOW,
  WATER,
  WATER_LIGHT,
  GUARDRAIL,
  EDGE_WHITE_WIDTH,
  EDGE_BLACK_WIDTH,
  LAKE,
  WATERFALL,
  HOLIDAY_ROOT,
  FANTASY_ROOT,
  NATURE_ROOT
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
  sink = 0.04,
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

function makeSafeGuardrails(world, samples, trackWidth, terrainHeightAt) {
  const entries = [];
  const step = 7;
  for (let index = 0; index < samples.length; index += step) {
    const progress = index / samples.length;
    if (progress < 0.355 || progress > 0.91) continue;
    const sample = samples[index];
    const valleySide = -mountainFacingSign(sample);
    const offset = valleySide * (trackWidth / 2 + EDGE_WHITE_WIDTH + EDGE_BLACK_WIDTH + 2.45);
    const point = offsetPoint(sample, offset);
    if (nearestNonLocalTrackDistanceXZ(point, samples, index, 36) < trackWidth + 6) continue;
    point.y = terrainHeightAt(point.x, point.z) + 0.76;
    entries.push({ index, point });
  }

  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.34, 1.5, 0.34),
    material(GUARDRAIL, 0.62, 0.25),
    Math.max(1, entries.length)
  );
  const marker = new THREE.Object3D();
  entries.forEach((entry, cursor) => {
    marker.position.copy(entry.point);
    marker.scale.set(1, 1, 1);
    marker.rotation.set(0, 0, 0);
    marker.updateMatrix();
    posts.setMatrixAt(cursor, marker.matrix);
  });
  posts.count = entries.length;
  posts.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  posts.name = 'Mountain terrain-grounded guardrail posts r3';
  world.add(posts);

  const railMaterial = material(GUARDRAIL, 0.62, 0.25);
  for (let cursor = 0; cursor < entries.length - 1; cursor += 1) {
    const current = entries[cursor];
    const next = entries[cursor + 1];
    if ((next.index - current.index) > step * 1.5) continue;
    const length = current.point.distanceTo(next.point);
    if (length > 22) continue;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.32, length), railMaterial);
    rail.position.copy(current.point).lerp(next.point, 0.5);
    rail.position.y += 0.24;
    rail.rotation.y = Math.atan2(next.point.x - current.point.x, next.point.z - current.point.z);
    rail.castShadow = true;
    rail.name = 'Mountain terrain-grounded guardrail rail r3';
    world.add(rail);
  }
}

function makeSnowForest(world, samples, trackWidth, terrainHeightAt) {
  const random = seededRandom(0x54524545);
  const placements = [];
  for (let index = 22; index < samples.length - 20; index += 8) {
    const progress = index / samples.length;
    if (progress < 0.055 || progress > 0.945) continue;
    const sample = samples[index];
    const inward = mountainFacingSign(sample);
    const side = random() > 0.17 ? inward : -inward;
    const point = safeTracksidePosition(samples, index, side, trackWidth, 3.6, 20, 36, 1.8);
    if (!point) continue;
    point.y = terrainHeightAt(point.x, point.z);
    placements.push({ point, scale: 0.58 + random() * 0.72, yaw: random() * Math.PI * 2 });
  }

  const capacity = Math.max(1, placements.length);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.42, 4.6, 6), material(0x60472f, 1), capacity);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(3.0, 9.4, 7), material(SPRUCE_DARK, 1), capacity);
  const lowers = new THREE.InstancedMesh(new THREE.ConeGeometry(3.7, 7.2, 7), material(SPRUCE_LIGHT, 1), capacity);
  const snowCaps = new THREE.InstancedMesh(new THREE.ConeGeometry(2.45, 5.4, 7), material(SNOW, 1), capacity);
  const marker = new THREE.Object3D();

  placements.forEach((entry, cursor) => {
    marker.rotation.set(0, entry.yaw, 0);
    marker.scale.setScalar(entry.scale);
    marker.position.copy(entry.point);
    marker.position.y += 2.3 * entry.scale;
    marker.updateMatrix();
    trunks.setMatrixAt(cursor, marker.matrix);
    marker.position.copy(entry.point);
    marker.position.y += 7.4 * entry.scale;
    marker.updateMatrix();
    crowns.setMatrixAt(cursor, marker.matrix);
    marker.position.copy(entry.point);
    marker.position.y += 5.1 * entry.scale;
    marker.rotation.y = entry.yaw + 0.18;
    marker.updateMatrix();
    lowers.setMatrixAt(cursor, marker.matrix);
    marker.position.copy(entry.point);
    marker.position.y += 8.6 * entry.scale;
    marker.rotation.y = entry.yaw - 0.1;
    marker.updateMatrix();
    snowCaps.setMatrixAt(cursor, marker.matrix);
  });

  [trunks, crowns, lowers, snowCaps].forEach((mesh) => {
    mesh.count = placements.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.turnOutlined = true;
    world.add(mesh);
  });
  crowns.name = 'Mountain terrain-grounded spruce crowns r3';
  snowCaps.name = 'Mountain terrain-grounded spruce snow caps r3';
}

function makeGraniteFields(world, samples, trackWidth, terrainHeightAt) {
  const random = seededRandom(0x524f434b);
  const placements = [];
  for (let index = 40; index < samples.length - 30; index += 17) {
    const sample = samples[index];
    if (sample.point.y < 4) continue;
    const side = mountainFacingSign(sample);
    const point = safeTracksidePosition(samples, index, side, trackWidth, 3.8, 21, 37, 2.0);
    if (!point) continue;
    const scale = 1.45 + random() * 2.9;
    point.y = terrainHeightAt(point.x, point.z) + scale * 0.38;
    placements.push({ point, scale, yaw: random() * Math.PI * 2, snow: random() > 0.5 });
  }

  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(geometry, material(GRANITE_DARK, 1), Math.max(1, placements.length));
  const snowEntries = placements.filter((entry) => entry.snow);
  const caps = new THREE.InstancedMesh(geometry, material(SNOW, 1), Math.max(1, snowEntries.length));
  const marker = new THREE.Object3D();
  let capCursor = 0;
  placements.forEach((entry, cursor) => {
    marker.position.copy(entry.point);
    marker.rotation.set(0.13, entry.yaw, 0.08);
    marker.scale.set(entry.scale * 1.25, entry.scale * 0.82, entry.scale);
    marker.updateMatrix();
    rocks.setMatrixAt(cursor, marker.matrix);
    if (entry.snow) {
      marker.position.copy(entry.point);
      marker.position.y += entry.scale * 0.54;
      marker.scale.set(entry.scale, entry.scale * 0.24, entry.scale * 0.78);
      marker.updateMatrix();
      caps.setMatrixAt(capCursor++, marker.matrix);
    }
  });
  rocks.count = placements.length;
  caps.count = snowEntries.length;
  rocks.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  rocks.name = 'Mountain terrain-grounded granite field r3';
  caps.name = 'Mountain terrain-grounded granite snow caps r3';
  world.add(rocks, caps);
}

function makeOpenRibbon(world, samples, halfWidth, meshMaterial, yOffset, name) {
  const positions = [];
  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = samples[index];
    const next = samples[index + 1];
    const a = current.point.clone().addScaledVector(current.normal, halfWidth);
    const b = current.point.clone().addScaledVector(current.normal, -halfWidth);
    const c = next.point.clone().addScaledVector(next.normal, halfWidth);
    const d = next.point.clone().addScaledVector(next.normal, -halfWidth);
    for (const point of [a, b, c, d]) point.y += yOffset;
    positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,b.x,b.y,b.z,d.x,d.y,d.z,c.x,c.y,c.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.receiveShadow = true;
  mesh.name = name;
  world.add(mesh);
  return mesh;
}

function makeStructuralWaterfallCliff(world) {
  const rockMaterial = material(GRANITE_DARK, 1);
  const snowMaterial = material(SNOW, 1);
  const chunks = [
    [-22, 10.5, -7, 18, 13, 12],
    [21, 10.0, -8, 17, 12.5, 12],
    [-30, 4.8, -21, 16, 7.5, 13],
    [30, 4.5, -20, 17, 7, 13],
    [0, 5.2, -24, 15, 7.5, 10]
  ];
  for (const [dx, y, dz, sx, sy, sz] of chunks) {
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockMaterial);
    chunk.position.set(WATERFALL.x + dx, y, WATERFALL.z + dz);
    chunk.scale.set(sx, sy, sz);
    chunk.rotation.set(0.08, (dx + dz) * 0.011, 0.04);
    chunk.castShadow = true;
    chunk.receiveShadow = true;
    chunk.name = 'Mountain structural waterfall granite r3';
    world.add(chunk);
    if (y > 8) {
      const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), snowMaterial);
      cap.position.set(chunk.position.x, y + sy * 0.78, chunk.position.z - 1.5);
      cap.scale.set(sx * 0.82, sy * 0.16, sz * 0.76);
      cap.name = 'Mountain structural waterfall snow cap r3';
      world.add(cap);
    }
  }
}

function makeWaterfallSheet(world, xOffset, waterfallMaterial) {
  const topZ = WATERFALL.z + 2.5;
  const bottomZ = LAKE.z + LAKE.rz * 0.86;
  const half = 3.15;
  const topY = WATERFALL.top - 0.12;
  const bottomY = LAKE.level + 0.28;
  const positions = [
    WATERFALL.x + xOffset - half, topY, topZ,
    WATERFALL.x + xOffset + half, topY, topZ,
    WATERFALL.x + xOffset - half, bottomY, bottomZ,
    WATERFALL.x + xOffset + half, topY, topZ,
    WATERFALL.x + xOffset + half, bottomY, bottomZ,
    WATERFALL.x + xOffset - half, bottomY, bottomZ
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const sheet = new THREE.Mesh(geometry, waterfallMaterial);
  sheet.name = 'Mountain river-to-lake waterfall sheet r3';
  world.add(sheet);
}

function makeRiverWaterfallAndLake(world, samples, trackWidth, terrainContext) {
  const { riverSamples } = terrainContext;
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: WATER,
    roughness: 0.30,
    transparent: true,
    opacity: 0.93,
    side: THREE.DoubleSide
  });
  const bedMaterial = material(GRANITE_LIGHT, 1, 0, { side: THREE.DoubleSide });
  makeOpenRibbon(world, riverSamples, 10.6, bedMaterial, -1.34, 'Mountain river channel bed r3');
  makeOpenRibbon(world, riverSamples, 7.6, waterMaterial, 0.03, 'Mountain summit river water r3');

  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 56), waterMaterial);
  lake.rotation.x = -Math.PI / 2;
  lake.scale.set(LAKE.rx, LAKE.rz, 1);
  lake.position.set(LAKE.x, LAKE.level, LAKE.z);
  lake.name = 'Mountain terrain-bounded waterfall lake r3';
  world.add(lake);

  makeStructuralWaterfallCliff(world);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(20, 1.6, 6), material(GRANITE_DARK, 1));
  lip.position.set(WATERFALL.x, WATERFALL.top - 1.05, WATERFALL.z + 0.8);
  lip.rotation.y = -0.04;
  lip.name = 'Mountain river waterfall cliff lip r3';
  world.add(lip);

  const waterfallMaterial = new THREE.MeshStandardMaterial({
    color: WATER_LIGHT,
    roughness: 0.22,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    emissive: 0x0b4b66,
    emissiveIntensity: 0.12
  });
  for (const offset of [-5.3, 0, 5.3]) makeWaterfallSheet(world, offset, waterfallMaterial);

  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(23, 28),
    new THREE.MeshBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 0.76, side: THREE.DoubleSide })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.scale.set(1.4, 0.64, 1);
  foam.position.set(WATERFALL.x + 3, LAKE.level + 0.08, LAKE.z + LAKE.rz * 0.74);
  foam.name = 'Mountain waterfall lake foam r3';
  world.add(foam);

  const mistMaterial = new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0.17, depthWrite: false });
  for (let index = 0; index < 8; index += 1) {
    const mist = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2 + (index % 3) * 1.6, 1), mistMaterial);
    mist.position.set(
      WATERFALL.x - 18 + (index % 5) * 8,
      LAKE.level + 3.2 + Math.floor(index / 5) * 4,
      LAKE.z + LAKE.rz * 0.72 + (index % 2) * 4.5
    );
    mist.scale.y = 0.58;
    mist.name = 'Mountain waterfall mist r3';
    world.add(mist);
  }

  world.userData.turnRiverMinimumRoadClearance = riverSamples.reduce(
    (minimum, entry) => Math.min(minimum, nearestTrackDistanceXZ(entry.point, samples, 2)),
    Infinity
  ) - 10.6;
  world.userData.turnRiverSafeForTrackWidth = trackWidth;
}

function recolorNatureCliff(root) {
  root.traverse((node) => {
    if (!node?.isMesh) return;
    const recolor = (source) => {
      if (!source) return source;
      const next = source.clone();
      const name = String(next.name || '').toLowerCase();
      if (name.includes('water')) next.color?.setHex(WATER);
      else if (name.includes('grass')) next.color?.setHex(SNOW);
      else if (name.includes('dirt')) next.color?.setHex(GRANITE_LIGHT);
      else next.color?.setHex(GRANITE_DARK);
      next.metalness = 0;
      next.roughness = name.includes('water') ? 0.35 : 1;
      return next;
    };
    node.material = Array.isArray(node.material) ? node.material.map(recolor) : recolor(node.material);
  });
}

async function loadNatureCliffAccents(world) {
  const loader = new GLTFLoader();
  const [top, fall] = await Promise.all([
    loader.loadAsync(`${NATURE_ROOT}/cliff-waterfall-top-rock.glb`),
    loader.loadAsync(`${NATURE_ROOT}/cliff-waterfall-rock.glb`)
  ]);
  const topTemplate = prepareAsset(top.scene);
  const fallTemplate = prepareAsset(fall.scene);
  recolorNatureCliff(topTemplate);
  recolorNatureCliff(fallTemplate);
  const sites = [
    [-24, 1.8, -9], [-12, 9.5, -10], [-24, 17.0, -7],
    [22, 1.4, -10], [12, 9.2, -11], [23, 16.7, -8]
  ];
  sites.forEach(([dx, y, dz], index) => {
    const cliff = clonePrepared(index % 3 === 2 ? topTemplate : fallTemplate);
    cliff.position.set(WATERFALL.x + dx, y, WATERFALL.z + dz);
    cliff.rotation.y = Math.PI + (index % 2 ? 0.14 : -0.10);
    cliff.scale.setScalar(8.2 + (index % 3) * 0.6);
    cliff.name = `Mountain Kenney Nature cliff module r3 ${index + 1}`;
    world.add(cliff);
  });
}

function makeHolidayCabin(templates, variant = 0) {
  const cabin = new THREE.Group();
  const front = [templates.doorway, templates.window];
  front.forEach((template, index) => {
    const module = clonePrepared(template);
    module.position.set(index - 0.5, 0, 0);
    module.name = 'Mountain Kenney Holiday front wall module r3';
    cabin.add(module);
  });
  for (const x of [-0.5, 0.5]) {
    const back = clonePrepared(templates.wall);
    back.position.set(x, 0, 0);
    back.rotation.y = Math.PI;
    back.name = 'Mountain Kenney Holiday back wall module r3';
    cabin.add(back);
  }
  for (const side of [-1, 1]) {
    const wall = clonePrepared(templates.wall);
    wall.position.set(side, 0, 0);
    wall.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.name = 'Mountain Kenney Holiday side wall module r3';
    cabin.add(wall);
  }

  const roofA = clonePrepared(templates.roof);
  roofA.position.set(0.45, 1.0, 0);
  roofA.name = 'Mountain Kenney Holiday roof half r3';
  cabin.add(roofA);
  const roofB = clonePrepared(templates.roof);
  roofB.position.set(-0.45, 1.0, 0);
  roofB.scale.x = -1;
  roofB.name = 'Mountain Kenney Holiday mirrored roof half r3';
  cabin.add(roofB);

  if (variant === 1) {
    const sideWindow = clonePrepared(templates.window);
    sideWindow.position.set(0, 0, -0.1);
    sideWindow.rotation.y = Math.PI;
    sideWindow.name = 'Mountain Kenney Holiday lodge rear window r3';
    cabin.add(sideWindow);
  }
  cabin.userData.turnKenneyGridAssembly = Object.freeze({ unit: 1, roofMirror: true, wallRows: 1 });
  return cabin;
}

async function loadVillageAndRoadsideAssets(
  world,
  samples,
  trackWidth,
  terrainHeightAt,
  { skipRetiredHolidayCabins = false } = {}
) {
  const loader = new GLTFLoader();
  const [retiredCabinSources, bench, lantern, sled, snowPile, snowFlat, snowTree,
    stallGreen, stallRed, cart, fountain, fence] = await Promise.all([
    skipRetiredHolidayCabins
      ? Promise.resolve(null)
      : Promise.all([
        loader.loadAsync(`${HOLIDAY_ROOT}/cabin-wall.glb`),
        loader.loadAsync(`${HOLIDAY_ROOT}/cabin-doorway.glb`),
        loader.loadAsync(`${HOLIDAY_ROOT}/cabin-window-large.glb`),
        loader.loadAsync(`${HOLIDAY_ROOT}/cabin-roof-snow.glb`)
      ]),
    loader.loadAsync(`${HOLIDAY_ROOT}/bench.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/lantern.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/sled.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/snow-pile.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/snow-flat-large.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/tree-snow-a.glb`),
    loader.loadAsync(`${FANTASY_ROOT}/stall-green.glb`),
    loader.loadAsync(`${FANTASY_ROOT}/stall-red.glb`),
    loader.loadAsync(`${FANTASY_ROOT}/cart.glb`),
    loader.loadAsync(`${FANTASY_ROOT}/fountain-round-detail.glb`),
    loader.loadAsync(`${FANTASY_ROOT}/fence.glb`)
  ]);
  const templates = {
    bench: prepareAsset(bench.scene), lantern: prepareAsset(lantern.scene),
    sled: prepareAsset(sled.scene), snowPile: prepareAsset(snowPile.scene), snowFlat: prepareAsset(snowFlat.scene),
    snowTree: prepareAsset(snowTree.scene), stallGreen: prepareAsset(stallGreen.scene), stallRed: prepareAsset(stallRed.scene),
    cart: prepareAsset(cart.scene), fountain: prepareAsset(fountain.scene), fence: prepareAsset(fence.scene)
  };
  if (retiredCabinSources) {
    const [wall, doorway, windowLarge, roof] = retiredCabinSources;
    Object.assign(templates, {
      wall: prepareAsset(wall.scene),
      doorway: prepareAsset(doorway.scene),
      window: prepareAsset(windowLarge.scene),
      roof: prepareAsset(roof.scene)
    });
  }
  world.userData.turnMountainRetiredR3CabinsSkipped = retiredCabinSources === null;

  if (retiredCabinSources) {
    const cabinSites = [
      [5, 1, 7.2, 0], [23, 1, 6.3, 1], [45, 1, 6.6, 0],
      [1038, -1, 6.2, 1], [1060, -1, 6.8, 0]
    ];
    cabinSites.forEach(([index, side, scale, variant], cabinIndex) => {
      const point = safeTracksidePosition(samples, index, side, trackWidth, 7.4, 24, 48, 2.8);
      if (!point) return;
      const sample = samples[index % samples.length];
      groundImportedAsset(makeHolidayCabin(templates, variant), {
        x: point.x, z: point.z,
        yaw: Math.atan2(sample.tangent.x, sample.tangent.z) + (side > 0 ? Math.PI : 0) + (cabinIndex % 2 ? 0.12 : -0.08),
        scale, terrainHeightAt, world, sink: 0.08,
        name: `Mountain Kenney Holiday cabin prefab r3 ${cabinIndex + 1}`
      });
    });
  }

  const landmarkSites = [
    { template: templates.fountain, index: 10, side: -1, radius: 5.5, offset: 23, scale: 8.0, name: 'Mountain Kenney Fantasy fountain r3' },
    { template: templates.stallGreen, index: 30, side: 1, radius: 4.0, offset: 21, scale: 6.1, name: 'Mountain Kenney Fantasy market stall green r3' },
    { template: templates.stallRed, index: 39, side: 1, radius: 4.0, offset: 21, scale: 5.8, name: 'Mountain Kenney Fantasy market stall red r3' },
    { template: templates.cart, index: 51, side: 1, radius: 3.5, offset: 22, scale: 6.0, name: 'Mountain Kenney Fantasy village cart r3' },
    { template: templates.bench, index: 1050, side: -1, radius: 2.8, offset: 20, scale: 6.2, name: 'Mountain Kenney Holiday village bench r3' },
    { template: templates.sled, index: 18, side: -1, radius: 2.8, offset: 21, scale: 5.8, name: 'Mountain Kenney Holiday village sled r3' }
  ];
  landmarkSites.forEach((site, index) => {
    const point = safeTracksidePosition(samples, site.index, site.side, trackWidth, site.radius, site.offset, site.offset + 20, 2.0);
    if (!point) return;
    const sample = samples[site.index % samples.length];
    groundImportedAsset(clonePrepared(site.template), {
      x: point.x, z: point.z,
      yaw: Math.atan2(sample.tangent.x, sample.tangent.z) + (index % 2 ? 0.25 : -0.18),
      scale: site.scale, terrainHeightAt, world, sink: 0.06, name: site.name
    });
  });

  for (const [index, side] of [[12,1],[34,-1],[56,1],[1044,-1],[1066,1]]) {
    const point = safeTracksidePosition(samples, index, side, trackWidth, 1.8, 19.5, 31, 1.5);
    if (!point) continue;
    groundImportedAsset(clonePrepared(templates.lantern), {
      x: point.x, z: point.z,
      yaw: 0, scale: 7.0, terrainHeightAt, world, sink: 0.04,
      name: 'Mountain Kenney Holiday lantern r3'
    });
  }

  for (const [index, side] of [[70,1],[1015,-1]]) {
    const point = safeTracksidePosition(samples, index, side, trackWidth, 4.5, 23, 36, 1.8);
    if (!point) continue;
    groundImportedAsset(clonePrepared(templates.fence), {
      x: point.x, z: point.z,
      yaw: Math.atan2(samples[index].tangent.x, samples[index].tangent.z),
      scale: 7.0, terrainHeightAt, world, sink: 0.08,
      name: 'Mountain Kenney Fantasy village fence r3'
    });
  }

  const random = seededRandom(0x534e4f57);
  for (let index = 12; index < samples.length; index += 29) {
    const sides = random() > 0.7 ? [-1, 1] : [random() > 0.5 ? -1 : 1];
    for (const side of sides) {
      const template = random() > 0.48 ? templates.snowPile : templates.snowFlat;
      const point = safeTracksidePosition(samples, index, side, trackWidth, 2.0, 18.8 + random() * 2.4, 32, 1.4);
      if (!point) continue;
      groundImportedAsset(clonePrepared(template), {
        x: point.x + (random() - 0.5) * 3.2,
        z: point.z + (random() - 0.5) * 3.2,
        yaw: random() * Math.PI * 2,
        scale: 4.0 + random() * 4.8,
        terrainHeightAt, world, sink: 0.18 + random() * 0.16,
        name: 'Mountain Kenney irregular roadside snow r3'
      });
      if (random() > 0.70) {
        groundImportedAsset(clonePrepared(template), {
          x: point.x + (random() - 0.5) * 5.5,
          z: point.z + (random() - 0.5) * 5.5,
          yaw: random() * Math.PI * 2,
          scale: 2.8 + random() * 3.4,
          terrainHeightAt, world, sink: 0.22,
          name: 'Mountain Kenney overlapping roadside snow r3'
        });
      }
    }
  }

  for (const [index, side, scale] of [[2,1,6.2],[27,-1,5.0],[53,1,5.5],[1025,-1,5.2]]) {
    const point = safeTracksidePosition(samples, index, side, trackWidth, 3.2, 23, 36, 1.6);
    if (!point) continue;
    groundImportedAsset(clonePrepared(templates.snowTree), {
      x: point.x, z: point.z, yaw: index * 0.13, scale, terrainHeightAt, world, sink: 0.04,
      name: 'Mountain Kenney Holiday authored snow spruce r3'
    });
  }
}

export function installMountainScenery(world, samples, trackWidth, terrainContext, options = {}) {
  const { terrainHeightAt } = terrainContext;
  makeSafeGuardrails(world, samples, trackWidth, terrainHeightAt);
  makeSnowForest(world, samples, trackWidth, terrainHeightAt);
  makeGraniteFields(world, samples, trackWidth, terrainHeightAt);
  makeRiverWaterfallAndLake(world, samples, trackWidth, terrainContext);

  const loaders = [
    loadNatureCliffAccents(world),
    loadVillageAndRoadsideAssets(world, samples, trackWidth, terrainHeightAt, options)
  ];
  return Promise.allSettled(loaders).then((results) => {
    const rejected = results.filter((result) => result.status === 'rejected');
    world.userData.turnMountainAssetErrors = rejected.map((result) => String(result.reason?.message || result.reason));
    world.userData.turnMountainAssetsReady = true;
    return world;
  });
}
