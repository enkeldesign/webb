import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  MOUNTAIN_R2,
  material,
  seededRandom,
  mountainFacingSign,
  offsetPoint,
  nearestTrackDistanceXZ,
  nearestNonLocalTrackDistanceXZ,
  safeTracksidePosition
} from './mountain-world-r2-terrain.js';

const {
  GRANITE_DARK,
  SPRUCE_DARK,
  SPRUCE_LIGHT,
  SNOW,
  WATER,
  WATER_LIGHT,
  GUARDRAIL,
  EDGE_WHITE_WIDTH,
  EDGE_BLACK_WIDTH,
  SHOULDER_WIDTH,
  LAKE_LEVEL,
  WATERFALL,
  HOLIDAY_ROOT,
  NATURE_ROOT
} = MOUNTAIN_R2;

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

  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.34, 1.5, 0.34),
    material(GUARDRAIL, 0.62, 0.25),
    entries.length
  );
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
    const point = safeTracksidePosition(
      samples,
      index,
      side,
      trackWidth,
      3.8,
      19.8 + random() * 2.2,
      34,
      1.6
    );
    if (!point) continue;
    point.y = sample.point.y - 0.8;
    placements.push({ point, scale: 0.62 + random() * 0.75, yaw: random() * Math.PI * 2 });
  }

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.3, 0.42, 4.6, 6),
    material(0x60472f, 1),
    placements.length
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(3.0, 9.4, 7),
    material(SPRUCE_DARK, 1),
    placements.length
  );
  const lowers = new THREE.InstancedMesh(
    new THREE.ConeGeometry(3.7, 7.2, 7),
    material(SPRUCE_LIGHT, 1),
    placements.length
  );
  const snowCaps = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.45, 5.4, 7),
    material(SNOW, 1),
    placements.length
  );
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
    const point = safeTracksidePosition(
      samples,
      index,
      side,
      trackWidth,
      3.8,
      20.2 + random() * 2.8,
      34,
      1.8
    );
    if (!point) continue;
    const scale = 1.5 + random() * 3.1;
    point.y = sample.point.y - 1.1 + scale * 0.42;
    placements.push({ point, scale, yaw: random() * Math.PI * 2, snow: random() > 0.45 });
  }

  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(geometry, material(GRANITE_DARK, 1), placements.length);
  const caps = new THREE.InstancedMesh(
    geometry,
    material(SNOW, 1),
    placements.filter((entry) => entry.snow).length
  );
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
      marker.position.y += entry.scale * 0.52;
      marker.scale.set(entry.scale, entry.scale * 0.24, entry.scale * 0.78);
      marker.updateMatrix();
      caps.setMatrixAt(capCursor, marker.matrix);
      capCursor += 1;
    }
  });
  rocks.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  caps.castShadow = true;
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
  for (let index = 16; index < samples.length; index += 23) {
    const sample = samples[index];
    const sides = random() > 0.64 ? [-1, 1] : [random() > 0.5 ? -1 : 1];
    for (const side of sides) {
      const base = safeTracksidePosition(
        samples,
        index,
        side,
        trackWidth,
        2.2,
        19.4 + random() * 2.6,
        34,
        1.5
      );
      if (!base) continue;
      const blobCount = 1 + Math.floor(random() * 3);
      for (let blob = 0; blob < blobCount; blob += 1) {
        const scale = 0.9 + random() * 1.5;
        const mound = new THREE.Mesh(geometries[(index + blob) % geometries.length], snowMaterial);
        mound.position.copy(base);
        mound.position.x += (random() - 0.5) * 4.4;
        mound.position.z += (random() - 0.5) * 4.4;
        mound.position.y = sample.point.y - 0.28 + scale * (0.2 + random() * 0.08);
        mound.rotation.set(
          (random() - 0.5) * 0.2,
          random() * Math.PI,
          (random() - 0.5) * 0.16
        );
        mound.scale.set(
          scale * (1.1 + random() * 1.0),
          scale * (0.25 + random() * 0.22),
          scale * (0.8 + random() * 0.85)
        );
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
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: WATER,
    roughness: 0.32,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide
  });

  const lake = new THREE.Mesh(new THREE.CircleGeometry(86, 56), waterMaterial);
  lake.rotation.x = -Math.PI / 2;
  lake.scale.set(1.2, 0.72, 1);
  lake.position.set(250, LAKE_LEVEL, -205);
  lake.name = 'Mountain waterfall lake r2';
  world.add(lake);

  const riverPoints = [
    [225, 45, 215],
    [246, 43.5, 180],
    [263, 41, 132],
    [271, 37.5, 78],
    [270, 34, 20],
    [263, 30.5, -38],
    [254, 27.5, -90],
    [246, WATERFALL.top, -126]
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
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
    color: WATER_LIGHT,
    roughness: 0.22,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    emissive: 0x0b4b66,
    emissiveIntensity: 0.12
  });
  const fallHeight = WATERFALL.top - WATERFALL.bottom;
  for (const offset of [-5.4, 0, 5.4]) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(6.2, fallHeight), waterfallMaterial);
    sheet.position.set(WATERFALL.x + offset, WATERFALL.bottom + fallHeight / 2, WATERFALL.z);
    sheet.rotation.y = -0.06;
    sheet.name = 'Mountain cliff waterfall sheet r2';
    world.add(sheet);
  }

  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(23, 28),
    new THREE.MeshBasicMaterial({
      color: 0xeafcff,
      transparent: true,
      opacity: 0.76,
      side: THREE.DoubleSide
    })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.scale.set(1.4, 0.64, 1);
  foam.position.set(249, LAKE_LEVEL + 0.08, -149);
  foam.name = 'Mountain waterfall lake foam';
  world.add(foam);

  const mistMaterial = new THREE.MeshBasicMaterial({
    color: 0xe9fbff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false
  });
  for (let index = 0; index < 8; index += 1) {
    const mist = new THREE.Mesh(
      new THREE.IcosahedronGeometry(4.5 + (index % 3) * 1.8, 1),
      mistMaterial
    );
    mist.position.set(
      232 + (index % 5) * 7.2,
      LAKE_LEVEL + 3.5 + Math.floor(index / 5) * 4,
      -145 + (index % 2) * 4.5
    );
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
    const a = current.point.clone().addScaledVector(current.normal, halfWidth);
    const b = current.point.clone().addScaledVector(current.normal, -halfWidth);
    const c = next.point.clone().addScaledVector(next.normal, halfWidth);
    const d = next.point.clone().addScaledVector(next.normal, -halfWidth);
    a.y += yOffset;
    b.y += yOffset;
    c.y += yOffset;
    d.y += yOffset;
    positions.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z,
      b.x, b.y, b.z,
      d.x, d.y, d.z,
      c.x, c.y, c.z
    );
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

function tintAssetClone(root, color) {
  const clone = root.clone(true);
  clone.traverse((node) => {
    if (!node?.isMesh) return;
    if (Array.isArray(node.material)) {
      node.material = node.material.map((source) => {
        const next = source.clone();
        next.color?.setHex(color);
        next.metalness = 0;
        next.roughness = 1;
        return next;
      });
    } else if (node.material) {
      node.material = node.material.clone();
      node.material.color?.setHex(color);
      node.material.metalness = 0;
      node.material.roughness = 1;
    }
  });
  return clone;
}

function loadNatureWaterfallCliff(world) {
  const loader = new GLTFLoader();
  Promise.all([
    loader.loadAsync(`${NATURE_ROOT}/cliff-waterfall-top-rock.glb`),
    loader.loadAsync(`${NATURE_ROOT}/cliff-waterfall-rock.glb`)
  ]).then(([top, fall]) => {
    const topTemplate = prepareAsset(top.scene);
    const fallTemplate = prepareAsset(fall.scene);
    recolorNatureCliff(topTemplate);
    recolorNatureCliff(fallTemplate);

    const cliffSites = [
      { x: -27, y: -0.7, z: 8.5, scale: 0.9, yaw: 0.12 },
      { x: 0, y: -0.4, z: 7.5, scale: 1.08, yaw: -0.04 },
      { x: 28, y: -0.9, z: 9.0, scale: 0.94, yaw: -0.14 }
    ];

    cliffSites.forEach((site, index) => {
      const cliff = fallTemplate.clone(true);
      cliff.position.set(WATERFALL.x + site.x, site.y, WATERFALL.z + site.z);
      cliff.rotation.y = Math.PI + site.yaw;
      cliff.scale.set(27 * site.scale, 26 * site.scale, 18 * site.scale);
      cliff.name = `Mountain Kenney Nature waterfall cliff ${index + 1}`;
      world.add(cliff);

      const cap = topTemplate.clone(true);
      cap.position.set(WATERFALL.x + site.x, 22.5 * site.scale, WATERFALL.z + site.z - 0.4);
      cap.rotation.y = Math.PI + site.yaw;
      cap.scale.set(27 * site.scale, 5.5 * site.scale, 18 * site.scale);
      cap.name = `Mountain Kenney Nature snowy cliff cap ${index + 1}`;
      world.add(cap);
    });
  }).catch((error) => console.warn('TURN: Mountain Nature waterfall cliff failed to load', error));
}

function recolorNatureCliff(root) {
  root.traverse((node) => {
    if (!node?.isMesh) return;
    const recolor = (source) => {
      if (!source) return source;
      const next = source.clone();
      const name = String(next.name || '').toLowerCase();
      if (name.includes('grass')) next.color?.setHex(SNOW);
      else next.color?.setHex(GRANITE_DARK);
      next.metalness = 0;
      next.roughness = 1;
      return next;
    };
    node.material = Array.isArray(node.material)
      ? node.material.map(recolor)
      : recolor(node.material);
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
      [7, 1, 1.00],
      [24, 1, 0.88],
      [44, 1, 1.05],
      [1060, -1, 0.94],
      [1040, -1, 1.03],
      [1018, -1, 0.90]
    ];

    cabinSites.forEach(([index, side, scale], cabinIndex) => {
      const point = safeTracksidePosition(
        samples,
        index,
        side,
        trackWidth,
        10.5 * scale,
        31,
        70
      );
      if (!point) return;
      const sample = samples[index % samples.length];
      const cabin = makeHolidayCabin(wallTemplate, roofTemplate, scale);
      cabin.position.copy(point);
      cabin.position.y = sample.point.y - 0.92;
      cabin.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z)
        + (side > 0 ? Math.PI : 0)
        + (cabinIndex % 2 ? 0.12 : -0.08);
      cabin.name = `Mountain Kenney Holiday assembled cabin ${cabinIndex + 1}`;
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
  const wallScale = 7.2 * scale;
  const wallRowHeight = wallScale * 0.4;
  const roofScale = 6.2 * scale;
  const roofY = wallRowHeight * 2 - 0.15 * scale;

  for (const rowY of [0, wallRowHeight]) {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const wall = wallTemplate.clone(true);
      wall.position.set(0, rowY, 0);
      wall.rotation.y = yaw;
      wall.scale.setScalar(wallScale);
      wall.name = 'Mountain Kenney Holiday cabin wall module';
      cabin.add(wall);
    }
  }

  for (const yaw of [0, Math.PI]) {
    const roof = roofTemplate.clone(true);
    roof.position.set(0, roofY, 0);
    roof.rotation.y = yaw;
    roof.scale.setScalar(roofScale);
    roof.name = 'Mountain Kenney Holiday cabin roof half';
    cabin.add(roof);

    const snow = tintAssetClone(roofTemplate, SNOW);
    snow.position.set(0, roofY + 0.26 * scale, 0);
    snow.rotation.y = yaw;
    snow.scale.setScalar(roofScale * 0.965);
    snow.name = 'Mountain Kenney Holiday cabin roof snow layer';
    cabin.add(snow);
  }

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x21190f,
    emissive: 0xffc857,
    emissiveIntensity: 1.15,
    roughness: 0.7
  });
  const doorMaterial = material(0x5d3926, 0.92);
  const frontZ = -4.72 * scale;

  for (const x of [-1.75, 1.75]) {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(1.25 * scale, 1.45 * scale, 0.2 * scale),
      windowMaterial
    );
    window.position.set(x * scale, 3.3 * scale, frontZ);
    window.name = 'Mountain warm cabin window';
    cabin.add(window);
  }

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.5 * scale, 2.7 * scale, 0.24 * scale),
    doorMaterial
  );
  door.position.set(0, 1.35 * scale, frontZ - 0.03);
  door.name = 'Mountain cabin front door';
  cabin.add(door);

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
