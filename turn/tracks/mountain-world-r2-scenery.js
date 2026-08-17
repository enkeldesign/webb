import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MOUNTAIN_R2, material, seededRandom, mountainFacingSign, offsetPoint, nearestTrackDistanceXZ, nearestNonLocalTrackDistanceXZ, safeTracksidePosition } from './mountain-world-r2-terrain.js';

const { GRANITE_DARK, SPRUCE_DARK, SPRUCE_LIGHT, SNOW, WATER, WATER_LIGHT, GUARDRAIL, EDGE_WHITE_WIDTH, EDGE_BLACK_WIDTH, SHOULDER_WIDTH, LAKE_LEVEL, WATERFALL, HOLIDAY_ROOT, NATURE_ROOT } = MOUNTAIN_R2;

function makeSafeGuardrails(world, samples, trackWidth) {
  const entries = [];
  const step = 7;
  for (let index = 0; index < samples.length; index += step) {
    const progress = index / samples.length;
    if (progress < 0.355 || progress > 0.91) continue;
    const sample = samples[index];
    const valleySide = -mountainFacingSign(sample);
    const offset = valleySide * (trackWidth / 2 + EDGE_WHITE_WIDTH + EDGE_BLACK_WIDTH + SHOULDER_WIDTH + 0.75);
    const point = offsetPoint(sample, offset, 0.74);
    if (nearestNonLocalTrackDistanceXZ(point, samples, index, 36) < trackWidth + 6) continue;
    entries.push({ index, point, offset });
  }

  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 1.5, 0.34), material(GUARDRAIL, 0.62, 0.25), entries.length);
  const marker = new THREE.Object3D();
  entries.forEach((entry, cursor) => {
    marker.position.copy(entry.point);
    marker.scale.set(1, 1, 1);
    marker.rotation.set(0, 0, 0);
    marker.updateMatrix();
    posts.setMatrixAt(cursor, marker.matrix);
  });
  posts.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  posts.name = 'Mountain clearance-safe guardrail posts';
  world.add(posts);

  const railMaterial = material(GUARDRAIL, 0.62, 0.25);
  for (let cursor = 0; cursor < entries.length - 1; cursor += 1) {
    const current = entries[cursor];
    const next = entries[cursor + 1];
    if ((next.index - current.index) > step * 1.5) continue;
    const midpoint = current.point.clone().lerp(next.point, 0.5);
    const length = current.point.distanceTo(next.point);
    if (length > 22) continue;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.32, length), railMaterial);
    rail.position.copy(midpoint);
    rail.position.y += 0.22;
    rail.rotation.y = Math.atan2(next.point.x - current.point.x, next.point.z - current.point.z);
    rail.castShadow = true;
    rail.name = 'Mountain clearance-safe guardrail rail';
    world.add(rail);
  }
}

function makeSafeSnowForest(world, samples, trackWidth) {
  const random = seededRandom(0x54524545);
  const placements = [];
  for (let index = 22; index < samples.length - 20; index += 8) {
    const sample = samples[index];
    const progress = index / samples.length;
    if (progress < 0.06 || progress > 0.94) continue;
    const inward = mountainFacingSign(sample);
    const side = random() > 0.18 ? inward : -inward;
    const point = safeTracksidePosition(samples, index, side, trackWidth, 3.8, 19.8 + random() * 2.2, 34, 1.6);
    if (!point) continue;
    point.y = sample.point.y - 0.8;
    placements.push({ point, scale: 0.62 + random() * 0.75, yaw: random() * Math.PI * 2 });
  }

  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.42, 4.6, 6), material(0x60472f, 1), placements.length);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(3.0, 9.4, 7), material(SPRUCE_DARK, 1), placements.length);
  const lowers = new THREE.InstancedMesh(new THREE.ConeGeometry(3.7, 7.2, 7), material(SPRUCE_LIGHT, 1), placements.length);
  const snowCaps = new THREE.InstancedMesh(new THREE.ConeGeometry(2.45, 5.4, 7), material(SNOW, 1), placements.length);
  const marker = new THREE.Object3D();
  placements.forEach((entry, cursor) => {
    marker.rotation.set(0, entry.yaw, 0);
    marker.scale.setScalar(entry.scale);
    marker.position.copy(entry.point); marker.position.y += 2.3 * entry.scale; marker.updateMatrix(); trunks.setMatrixAt(cursor, marker.matrix);
    marker.position.copy(entry.point); marker.position.y += 7.4 * entry.scale; marker.updateMatrix(); crowns.setMatrixAt(cursor, marker.matrix);
    marker.position.copy(entry.point); marker.position.y += 5.1 * entry.scale; marker.rotation.y = entry.yaw + 0.18; marker.updateMatrix(); lowers.setMatrixAt(cursor, marker.matrix);
    marker.position.copy(entry.point); marker.position.y += 8.6 * entry.scale; marker.rotation.y = entry.yaw - 0.1; marker.updateMatrix(); snowCaps.setMatrixAt(cursor, marker.matrix);
  });
  [trunks, crowns, lowers, snowCaps].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.turnOutlined = true;
    world.add(mesh);
  });
  crowns.name = 'Mountain route-clearance protected spruce crowns';
  snowCaps.name = 'Mountain snow-covered spruce caps';
}

function makeGroundedRockFields(world, samples, trackWidth) {
  const random = seededRandom(0x524f434b);
  const placements = [];
  for (let index = 40; index < samples.length - 30; index += 17) {
    const sample = samples[index];
    if (sample.point.y < 5) continue;
    const side = mountainFacingSign(sample);
    const point = safeTracksidePosition(samples, index, side, trackWidth, 3.8, 20.2 + random() * 2.8, 34, 1.8);
    if (!point) continue;
    const scale = 1.5 + random() * 3.1;
    point.y = sample.point.y - 1.1 + scale * 0.42;
    placements.push({ point, scale, yaw: random() * Math.PI * 2, snow: random() > 0.45 });
  }
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(geometry, material(GRANITE_DARK, 1), placements.length);
  const caps = new THREE.InstancedMesh(geometry, material(SNOW, 1), placements.filter((entry) => entry.snow).length);
  const marker = new THREE.Object3D();
  let capCursor = 0;
  placements.forEach((entry, cursor) => {
    marker.position.copy(entry.point);
    marker.rotation.set(0.13, entry.yaw, 0.08);
    marker.scale.set(entry.scale * 1.25, entry.scale * 0.82, entry.scale);
    marker.updateMatrix();
    rocks.setMatrixAt(cursor, marker.matrix);
    if (entry.snow) {
      marker.position.copy(entry.point); marker.position.y += entry.scale * 0.52;
      marker.scale.set(entry.scale, entry.scale * 0.24, entry.scale * 0.78);
      marker.updateMatrix(); caps.setMatrixAt(capCursor, marker.matrix); capCursor += 1;
    }
  });
  rocks.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  rocks.castShadow = true; rocks.receiveShadow = true; caps.castShadow = true;
  rocks.name = 'Mountain grounded clearance-safe granite';
  caps.name = 'Mountain grounded granite snow caps';
  world.add(rocks, caps);
}

function makeRandomSnowDrifts(world, samples, trackWidth) {
  const random = seededRandom(0x44524946);
  const geometries = [
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.SphereGeometry(1, 6, 3)
  ];
  const snowMaterial = material(SNOW, 1);
  for (let index = 16; index < samples.length; index += 19) {
    const sample = samples[index];
    const sides = random() > 0.55 ? [-1, 1] : [random() > 0.5 ? -1 : 1];
    for (const side of sides) {
      const base = safeTracksidePosition(samples, index, side, trackWidth, 2.6, 19.2 + random() * 2.8, 34, 1.6);
      if (!base) continue;
      const blobCount = 2 + Math.floor(random() * 3);
      for (let blob = 0; blob < blobCount; blob += 1) {
        const scale = 1.5 + random() * 2.8;
        const mound = new THREE.Mesh(geometries[(index + blob) % geometries.length], snowMaterial);
        mound.position.copy(base);
        mound.position.x += (random() - 0.5) * 5.8;
        mound.position.z += (random() - 0.5) * 5.8;
        mound.position.y = sample.point.y - 0.35 + scale * (0.28 + random() * 0.08);
        mound.rotation.set((random() - 0.5) * 0.24, random() * Math.PI, (random() - 0.5) * 0.18);
        mound.scale.set(scale * (1.4 + random() * 1.25), scale * (0.28 + random() * 0.28), scale * (0.9 + random() * 1.05));
        if (nearestTrackDistanceXZ(mound.position, samples, 2) < trackWidth / 2 + 4.5) continue;
        mound.castShadow = true;
        mound.receiveShadow = true;
        mound.name = 'Mountain irregular overlapping snow drift';
        world.add(mound);
      }
    }
  }
}

function makeRiverCliffWaterfallAndLake(world, samples, trackWidth) {
  const waterMaterial = new THREE.MeshStandardMaterial({ color: WATER, roughness: 0.32, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(86, 56), waterMaterial);
  lake.rotation.x = -Math.PI / 2;
  lake.scale.set(1.2, 0.72, 1);
  lake.position.set(250, LAKE_LEVEL, -205);
  lake.name = 'Mountain waterfall lake r2';
  world.add(lake);

  const riverPoints = [
    [225, 45, 215], [246, 43.5, 180], [263, 41, 132], [271, 37.5, 78],
    [270, 34, 20], [263, 30.5, -38], [254, 27.5, -84], [246, WATERFALL.top, -112]
  ].map(([x,y,z]) => new THREE.Vector3(x,y,z));
  const curve = new THREE.CatmullRomCurve3(riverPoints, false, 'centripetal');
  const riverSamples = Array.from({ length: 88 }, (_, index) => {
    const t = index / 87;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    return { point, normal, t };
  });

  makeOpenRibbon(world, riverSamples, 15, material(GRANITE_DARK, 1), -0.42, 'Mountain grounded river rock bed');
  makeOpenRibbon(world, riverSamples, 8.2, waterMaterial, 0, 'Mountain summit river clear of road');

  loadNatureWaterfallCliff(world);

  const waterfallMaterial = new THREE.MeshStandardMaterial({
    color: WATER_LIGHT, roughness: 0.22, transparent: true, opacity: 0.88, side: THREE.DoubleSide,
    emissive: 0x0b4b66, emissiveIntensity: 0.12
  });
  const fallHeight = WATERFALL.top - WATERFALL.bottom;
  for (const offset of [-5.4, 0, 5.4]) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(6.2, fallHeight), waterfallMaterial);
    sheet.position.set(WATERFALL.x + offset, WATERFALL.bottom + fallHeight / 2, WATERFALL.z);
    sheet.rotation.y = -0.06;
    sheet.name = 'Mountain cliff waterfall sheet r2';
    world.add(sheet);
  }
  const foam = new THREE.Mesh(new THREE.CircleGeometry(23, 28), new THREE.MeshBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 0.76, side: THREE.DoubleSide }));
  foam.rotation.x = -Math.PI / 2;
  foam.scale.set(1.4, 0.64, 1);
  foam.position.set(249, LAKE_LEVEL + 0.08, -149);
  foam.name = 'Mountain waterfall lake foam';
  world.add(foam);

  const mistMaterial = new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0.18, depthWrite: false });
  for (let index = 0; index < 8; index += 1) {
    const mist = new THREE.Mesh(new THREE.IcosahedronGeometry(4.5 + (index % 3) * 1.8, 1), mistMaterial);
    mist.position.set(232 + (index % 5) * 7.2, LAKE_LEVEL + 3.5 + Math.floor(index / 5) * 4, -145 + (index % 2) * 4.5);
    mist.scale.y = 0.6;
    mist.name = 'Mountain waterfall mist r2';
    world.add(mist);
  }

  world.userData.turnRiverMinimumRoadClearance = riverSamples.reduce(
    (minimum, entry) => Math.min(minimum, nearestTrackDistanceXZ(entry.point, samples, 2)),
    Infinity
  ) - 15;
  world.userData.turnRiverSafeForTrackWidth = trackWidth;
}

function makeOpenRibbon(world, samples, halfWidth, meshMaterial, yOffset, name) {
  const positions = [];
  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = samples[index];
    const next = samples[index + 1];
    const a = current.point.clone().addScaledVector(current.normal, halfWidth); a.y += yOffset;
    const b = current.point.clone().addScaledVector(current.normal, -halfWidth); b.y += yOffset;
    const c = next.point.clone().addScaledVector(next.normal, halfWidth); c.y += yOffset;
    const d = next.point.clone().addScaledVector(next.normal, -halfWidth); d.y += yOffset;
    positions.push(a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z, b.x,b.y,b.z, d.x,d.y,d.z, c.x,c.y,c.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.receiveShadow = true;
  mesh.name = name;
  world.add(mesh);
}

function prepareAsset(root) {
  root.traverse((node) => {
    if (!node?.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.turnOutlined = true;
  });
  return root;
}

function loadNatureWaterfallCliff(world) {
  const loader = new GLTFLoader();
  Promise.all([
    loader.loadAsync(`${NATURE_ROOT}/cliff-waterfall-top-rock.glb`),
    loader.loadAsync(`${NATURE_ROOT}/cliff-waterfall-rock.glb`)
  ]).then(([top, fall]) => {
    const topRoot = prepareAsset(top.scene);
    const fallRoot = prepareAsset(fall.scene);
    recolorNatureCliff(topRoot);
    recolorNatureCliff(fallRoot);
    topRoot.position.set(WATERFALL.x, 0, WATERFALL.z + 8);
    topRoot.rotation.y = Math.PI;
    topRoot.scale.set(62, 26, 42);
    topRoot.name = 'Mountain Kenney Nature waterfall top cliff';
    world.add(topRoot);
    fallRoot.position.set(WATERFALL.x, -0.25, WATERFALL.z + 7);
    fallRoot.rotation.y = Math.PI;
    fallRoot.scale.set(62, 25.7, 42);
    fallRoot.name = 'Mountain Kenney Nature waterfall cliff';
    world.add(fallRoot);
  }).catch((error) => console.warn('TURN: Mountain Nature waterfall cliff failed to load', error));
}

function recolorNatureCliff(root) {
  root.traverse((node) => {
    if (!node?.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((source) => {
      if (!source) return;
      const name = String(source.name || '').toLowerCase();
      if (name.includes('grass')) source.color?.setHex(SNOW);
      if (name.includes('dirt')) source.color?.setHex(GRANITE_DARK);
      source.roughness = 1;
    });
  });
}

function loadAssetVillage(world, samples, trackWidth) {
  const loader = new GLTFLoader();
  Promise.all([
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-wall.glb`),
    loader.loadAsync(`${HOLIDAY_ROOT}/cabin-roof-snow-dormer.glb`),
    loader.loadAsync('/turn/assets/scenery/fantasy-town/windmill.glb'),
    loader.loadAsync('/turn/assets/scenery/fantasy-town/fountainCenter.glb')
  ]).then(([wall, roof, windmill, fountain]) => {
    const wallTemplate = prepareAsset(wall.scene);
    const roofTemplate = prepareAsset(roof.scene);
    const cabinSites = [
      [7, 1, 1.02], [24, 1, 0.88], [44, 1, 1.08], [1060, -1, 0.95], [1040, -1, 1.06], [1018, -1, 0.9]
    ];
    cabinSites.forEach(([index, side, scale], cabinIndex) => {
      const point = safeTracksidePosition(samples, index, side, trackWidth, 11 * scale, 34, 82);
      if (!point) return;
      const sample = samples[index % samples.length];
      const cabin = makeHolidayCabin(wallTemplate, roofTemplate, scale);
      cabin.position.copy(point);
      cabin.position.y = sample.point.y - 0.92;
      cabin.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + (side > 0 ? Math.PI : 0) + (cabinIndex % 2 ? 0.12 : -0.08);
      cabin.name = `Mountain Kenney Holiday cabin ${cabinIndex + 1}`;
      world.add(cabin);
    });

    const windmillPoint = safeTracksidePosition(samples, 1032, 1, trackWidth, 13, 48, 90);
    if (windmillPoint) {
      const root = prepareAsset(windmill.scene);
      root.position.copy(windmillPoint);
      root.position.y = samples[1032 % samples.length].point.y - 0.9;
      root.rotation.y = 0.72;
      root.scale.setScalar(8.6);
      root.name = 'Mountain Kenney Fantasy Town windmill r2';
      world.add(root);
    }

    const fountainPoint = safeTracksidePosition(samples, 4, -1, trackWidth, 7, 31, 70);
    if (fountainPoint) {
      const root = prepareAsset(fountain.scene);
      root.position.copy(fountainPoint);
      root.position.y = samples[4].point.y - 0.45;
      root.rotation.y = Math.PI / 4;
      root.scale.setScalar(10.5);
      root.name = 'Mountain Kenney Fantasy Town fountain r2';
      world.add(root);
    }
  }).catch((error) => console.warn('TURN: Mountain Holiday/Fantasy Town village failed to load', error));
}

function makeHolidayCabin(wallTemplate, roofTemplate, scale) {
  const cabin = new THREE.Group();
  const wallScale = 10.2 * scale;
  const half = 5.0 * scale;
  const wallY = 0;
  const walls = [
    { x: 0, z: half, yaw: Math.PI }, { x: 0, z: -half, yaw: 0 },
    { x: half, z: 0, yaw: Math.PI / 2 }, { x: -half, z: 0, yaw: -Math.PI / 2 }
  ];
  walls.forEach(({ x, z, yaw }) => {
    const wall = wallTemplate.clone(true);
    wall.position.set(x, wallY, z);
    wall.rotation.y = yaw;
    wall.scale.setScalar(wallScale);
    cabin.add(wall);
  });
  const roof = roofTemplate.clone(true);
  roof.position.set(0, 8.55 * scale, 0);
  roof.rotation.y = 0;
  roof.scale.setScalar(8.6 * scale);
  cabin.add(roof);

  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x21190f, emissive: 0xffc857, emissiveIntensity: 1.15, roughness: 0.7 });
  for (const x of [-2.4, 2.4]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(1.45 * scale, 1.75 * scale, 0.22 * scale), windowMaterial);
    window.position.set(x * scale, 4.4 * scale, -5.2 * scale);
    cabin.add(window);
  }
  return cabin;
}

export function installMountainScenery(world, samples, trackWidth) {
  makeSafeGuardrails(world, samples, trackWidth);
  makeSafeSnowForest(world, samples, trackWidth);
  makeGroundedRockFields(world, samples, trackWidth);
  makeRandomSnowDrifts(world, samples, trackWidth);
  makeRiverCliffWaterfallAndLake(world, samples, trackWidth);
  loadAssetVillage(world, samples, trackWidth);
}
