import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { trackPitch } from './elevation.js';

const INK = 0x08090a;
const CREAM = 0xfff8e8;
const ASPHALT_DARK = 0x34383d;
const ASPHALT_LIGHT = 0x52585f;
const ALPINE_BLUE = 0x4dabf7;
const ALPINE_BLUE_DARK = 0x1971c2;
const GRANITE_DARK = 0x5f6468;
const GRANITE_LIGHT = 0x9aa0a4;
const MEADOW_DARK = 0x476b3c;
const MEADOW_LIGHT = 0x789c59;
const SPRUCE_DARK = 0x1f4b38;
const SPRUCE_LIGHT = 0x3e7351;
const SNOW = 0xf4f7f8;
const SNOW_SHADOW = 0xdce8ed;
const WATER = 0x1598c4;
const WATER_LIGHT = 0x55cde7;
const WOOD = 0x6f4b2f;
const WARM_WINDOW = 0xffc857;
const GUARDRAIL = 0xe5ebef;
const ROAD_HEIGHT = 0.14;
const CURB_HEIGHT = 0.19;
const CURB_WIDTH = 1.55;
const SHOULDER_WIDTH = 4.8;
const SNOW_LINE = 37;
const LAKE_LEVEL = -3.4;
const MOUNTAIN_CORE = Object.freeze({ x: -18, z: 112 });
const VILLAGE_CENTER = Object.freeze({ x: 5, z: -245 });
const WATERFALL = Object.freeze({ x: 188, z: -126, top: 27, bottom: LAKE_LEVEL + 1.2 });

export function installMountainWorld({ scene, samples, trackWidth = 27, runtime } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 3) {
    throw new Error('TURN: Mountain requires a scene and sampled route.');
  }

  const world = new THREE.Group();
  world.name = 'TURN Mountain r1';
  scene.add(world);

  makeValleyFloor(world);
  makeBackdrop(world);
  makeTerrainRibbon(world, samples, trackWidth);
  makeRoad(world, samples, trackWidth);
  makeSnowBanks(world, samples, trackWidth);
  makeExposedGuardrails(world, samples, trackWidth);
  makeSpruceForest(world, samples, trackWidth);
  makeRockFields(world, samples, trackWidth);
  makeLakeRiverAndWaterfall(world);
  makeVillage(world, samples, trackWidth);
  loadKenneyVillageLandmarks(world);

  world.userData.turnMountainArtDirection = Object.freeze({
    version: 'r1',
    routeNarrative: 'village-climb-backside-snow-river-slalom-waterfall-village',
    maximumRoadElevation: 49,
    snowLine: SNOW_LINE,
    riverLandmark: true,
    waterfallLandmark: true,
    cozyVillage: true,
    kenneyFantasyTown: true,
    proceduralGroundTextures: true,
    instancedForestAndRocks: true,
    noIceGripModifier: true
  });

  if (runtime) runtime.mountainWorld = world;
  return world;
}

function material(color, roughness = 0.95, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeValleyFloor(world) {
  const meadowTexture = makeGroundTexture([
    '#4d7043', '#567b47', '#62864d', '#6f9155', '#47663d'
  ], 8, 28);
  const meadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1050, 900),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: meadowTexture,
      roughness: 1,
      metalness: 0
    })
  );
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.set(0, -0.62, -15);
  meadow.receiveShadow = true;
  meadow.name = 'Mountain textured valley meadow';
  world.add(meadow);

  const villageSnow = new THREE.Mesh(
    new THREE.CircleGeometry(122, 48),
    new THREE.MeshStandardMaterial({
      color: 0xf7f8f5,
      roughness: 1,
      transparent: true,
      opacity: 0.96
    })
  );
  villageSnow.rotation.x = -Math.PI / 2;
  villageSnow.scale.set(1.45, 0.72, 1);
  villageSnow.position.set(10, -0.5, -250);
  villageSnow.receiveShadow = true;
  villageSnow.name = 'Mountain village snowfield';
  world.add(villageSnow);
}

function makeGroundTexture(palette, seed = 1, repeat = 18) {
  if (!globalThis.document?.createElement) return null;
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;

  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  context.fillStyle = palette[0];
  context.fillRect(0, 0, size, size);
  for (let index = 0; index < 620; index += 1) {
    const color = palette[Math.floor(random() * palette.length)];
    const radius = 1 + random() * 4.5;
    context.globalAlpha = 0.18 + random() * 0.34;
    context.fillStyle = color;
    context.beginPath();
    context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function makeBackdrop(world) {
  const backRock = material(0x71808a, 1);
  const farRock = material(0x86949d, 1);
  const snowMaterial = material(SNOW, 1);

  const peaks = [
    { x: 0, z: 372, radius: 142, height: 235, rotation: 0.08, major: true },
    { x: -275, z: 315, radius: 118, height: 165, rotation: -0.12 },
    { x: 270, z: 320, radius: 125, height: 175, rotation: 0.18 },
    { x: -430, z: 135, radius: 150, height: 190, rotation: 0.04 },
    { x: 450, z: 105, radius: 155, height: 182, rotation: -0.08 },
    { x: -370, z: -210, radius: 130, height: 132, rotation: 0.16 },
    { x: 415, z: -250, radius: 145, height: 146, rotation: -0.16 }
  ];

  for (const peak of peaks) {
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(peak.radius, peak.height, peak.major ? 11 : 8, 1),
      peak.major ? backRock : farRock
    );
    mountain.position.set(peak.x, peak.height / 2 - 6, peak.z);
    mountain.rotation.y = peak.rotation;
    mountain.receiveShadow = true;
    mountain.castShadow = peak.major;
    mountain.name = peak.major ? 'Mountain snow peak backdrop' : 'Mountain distant ridge';
    world.add(mountain);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(peak.radius * 0.43, peak.height * 0.34, peak.major ? 11 : 8, 1),
      snowMaterial
    );
    cap.position.set(peak.x, peak.height * 0.83 - 6, peak.z);
    cap.rotation.y = peak.rotation;
    cap.receiveShadow = true;
    cap.name = 'Mountain distant snow cap';
    world.add(cap);
  }

  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 520),
    new THREE.MeshBasicMaterial({ color: 0xb9d8e5, side: THREE.DoubleSide })
  );
  horizon.position.set(0, 96, 500);
  horizon.name = 'Mountain alpine horizon';
  world.add(horizon);
}

function mountainFacingSign(sample) {
  const toCoreX = MOUNTAIN_CORE.x - sample.point.x;
  const toCoreZ = MOUNTAIN_CORE.z - sample.point.z;
  const dot = toCoreX * sample.normal.x + toCoreZ * sample.normal.z;
  return dot >= 0 ? 1 : -1;
}

function terrainColor(height, profile) {
  if (height >= SNOW_LINE - 1.5) {
    return new THREE.Color(profile === 'inner' ? SNOW_SHADOW : SNOW);
  }
  if (height >= 20) {
    return new THREE.Color(profile === 'inner' ? GRANITE_DARK : GRANITE_LIGHT);
  }
  return new THREE.Color(profile === 'outer' ? MEADOW_LIGHT : MEADOW_DARK);
}

function makeTerrainRibbon(world, samples, trackWidth) {
  const half = trackWidth / 2;
  const positions = [];
  const colors = [];
  const indices = [];
  const crossSectionCount = 5;

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const inward = mountainFacingSign(sample);
    const outward = -inward;
    const altitude = Math.max(0, sample.point.y);
    const ridgeLift = 6.5 + altitude * 0.19 + Math.sin(index * 0.09) * 1.7;
    const valleyDrop = 2.3 + altitude * 0.18;
    const profiles = [
      { offset: outward * (half + 31), y: Math.max(-0.35, sample.point.y - valleyDrop - 5.5), kind: 'outer' },
      { offset: outward * (half + 6.2), y: sample.point.y - 0.32, kind: 'outer' },
      { offset: 0, y: sample.point.y - 0.42, kind: 'road' },
      { offset: inward * (half + 6.2), y: sample.point.y - 0.34, kind: 'inner' },
      { offset: inward * (half + 35), y: sample.point.y + ridgeLift, kind: 'inner' }
    ];

    for (const entry of profiles) {
      const point = sample.point.clone().addScaledVector(sample.normal, entry.offset);
      positions.push(point.x, entry.y, point.z);
      const color = terrainColor(Math.max(entry.y, altitude), entry.kind);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    const row = index * crossSectionCount;
    const next = (index + 1) * crossSectionCount;
    for (let profile = 0; profile < crossSectionCount - 1; profile += 1) {
      const a = row + profile;
      const b = a + 1;
      const c = next + profile;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      flatShading: true
    })
  );
  terrain.receiveShadow = true;
  terrain.name = 'Mountain road-following textured terrain';
  world.add(terrain);
}

function makeRoad(world, samples, trackWidth) {
  const count = samples.length;
  const positions = [];
  const colors = [];
  const indices = [];
  const dark = new THREE.Color(ASPHALT_DARK);
  const light = new THREE.Color(ASPHALT_LIGHT);

  for (let index = 0; index <= count; index += 1) {
    const sample = samples[index % count];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2);
    left.y += ROAD_HEIGHT;
    right.y += ROAD_HEIGHT;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    const variation = THREE.MathUtils.clamp(
      0.42 + Math.sin(index * 0.17) * 0.09 + Math.sin(index * 0.047 + 0.8) * 0.07,
      0,
      1
    );
    const color = dark.clone().lerp(light, variation);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  for (let index = 0; index < count; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, metalness: 0, side: THREE.DoubleSide })
  );
  road.receiveShadow = true;
  road.name = 'Mountain asphalt road';
  world.add(road);

  makeCurbs(world, samples, trackWidth);
  makeShoulders(world, samples, trackWidth);
  makeCentreLine(world, samples);
  makeStartLine(world, samples, trackWidth);
}

function elevatedOffset(sample, offset, height) {
  const point = sample.point.clone().addScaledVector(sample.normal, offset);
  point.y += height;
  return point;
}

function makeCurbs(world, samples, trackWidth) {
  const curbColors = [new THREE.Color(ALPINE_BLUE), new THREE.Color(CREAM)];
  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const inner = side * (trackWidth / 2 - 0.08);
      const outer = side * (trackWidth / 2 + CURB_WIDTH);
      const a = elevatedOffset(current, inner, CURB_HEIGHT);
      const b = elevatedOffset(current, outer, CURB_HEIGHT);
      const c = elevatedOffset(next, inner, CURB_HEIGHT);
      const d = elevatedOffset(next, outer, CURB_HEIGHT);
      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
      );
      const color = curbColors[Math.floor(index / 12) % 2];
      for (let vertex = 0; vertex < 6; vertex += 1) colors.push(color.r, color.g, color.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const curb = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })
    );
    curb.receiveShadow = true;
    curb.name = 'Mountain alpine blue road edge';
    world.add(curb);
  }
}

function makeShoulders(world, samples, trackWidth) {
  const inner = trackWidth / 2 + CURB_WIDTH;
  const outer = inner + SHOULDER_WIDTH;
  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const a = elevatedOffset(current, side * inner, ROAD_HEIGHT + 0.01);
      const b = elevatedOffset(current, side * outer, ROAD_HEIGHT - 0.03);
      const c = elevatedOffset(next, side * inner, ROAD_HEIGHT + 0.01);
      const d = elevatedOffset(next, side * outer, ROAD_HEIGHT - 0.03);
      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
      );
      const snow = current.point.y >= SNOW_LINE - 2;
      const innerColor = new THREE.Color(snow ? SNOW_SHADOW : 0x9a9585);
      const outerColor = new THREE.Color(snow ? SNOW : 0x777362);
      for (const color of [innerColor, outerColor, innerColor, outerColor, outerColor, innerColor]) {
        colors.push(color.r, color.g, color.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const shoulder = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })
    );
    shoulder.receiveShadow = true;
    shoulder.name = 'Mountain gravel and snow shoulder';
    world.add(shoulder);
  }
}

function makeCentreLine(world, samples) {
  const step = 11;
  const geometry = new THREE.BoxGeometry(0.34, 0.055, 5.2);
  const dashes = new THREE.InstancedMesh(geometry, material(CREAM, 0.9), Math.ceil(samples.length / step));
  const marker = new THREE.Object3D();
  let cursor = 0;
  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    marker.position.copy(sample.point);
    marker.position.y += 0.24;
    marker.rotation.set(trackPitch(sample), Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    dashes.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }
  dashes.count = cursor;
  dashes.instanceMatrix.needsUpdate = true;
  dashes.receiveShadow = true;
  dashes.name = 'Mountain centre line';
  world.add(dashes);
}

function makeStartLine(world, samples, trackWidth) {
  const start = samples[0];
  const tileCount = 12;
  const tileWidth = trackWidth / tileCount;
  const geometry = new THREE.BoxGeometry(tileWidth + 0.04, 0.07, 2.3);
  const white = material(CREAM, 0.85);
  const black = material(INK, 0.85);
  const yaw = Math.atan2(start.tangent.x, start.tangent.z);
  for (let tile = 0; tile < tileCount; tile += 1) {
    const marker = new THREE.Mesh(geometry, tile % 2 ? black : white);
    marker.position.copy(start.point).addScaledVector(start.normal, (tile - (tileCount - 1) / 2) * tileWidth);
    marker.position.y += 0.26;
    marker.rotation.set(trackPitch(start), yaw, 0);
    marker.receiveShadow = true;
    marker.name = 'Mountain village start finish';
    world.add(marker);
  }
}

function makeSnowBanks(world, samples, trackWidth) {
  const snowMaterial = material(SNOW, 1);
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const candidates = [];
  for (let index = 0; index < samples.length; index += 7) {
    const sample = samples[index];
    if (sample.point.y < SNOW_LINE) continue;
    for (const side of [-1, 1]) candidates.push({ sample, side, index });
  }
  const banks = new THREE.InstancedMesh(geometry, snowMaterial, candidates.length);
  const marker = new THREE.Object3D();
  candidates.forEach((entry, cursor) => {
    marker.position.copy(entry.sample.point).addScaledVector(
      entry.sample.normal,
      entry.side * (trackWidth / 2 + CURB_WIDTH + SHOULDER_WIDTH + 1.2)
    );
    marker.position.y += 0.1;
    marker.rotation.set(0, entry.index * 0.37, 0);
    marker.scale.set(4.2 + (entry.index % 5) * 0.45, 1.35, 2.4 + (entry.index % 3) * 0.4);
    marker.updateMatrix();
    banks.setMatrixAt(cursor, marker.matrix);
  });
  banks.instanceMatrix.needsUpdate = true;
  banks.receiveShadow = true;
  banks.castShadow = true;
  banks.name = 'Mountain summit snowbanks';
  world.add(banks);
}

function makeExposedGuardrails(world, samples, trackWidth) {
  const step = 7;
  const startProgress = 0.355;
  const endProgress = 0.91;
  const entries = [];
  for (let index = 0; index < samples.length; index += step) {
    const progress = index / samples.length;
    if (progress < startProgress || progress > endProgress) continue;
    const sample = samples[index];
    const inward = mountainFacingSign(sample);
    const valleySide = -inward;
    entries.push({ index, sample, valleySide });
  }

  const postGeometry = new THREE.BoxGeometry(0.34, 1.55, 0.34);
  const railGeometry = new THREE.BoxGeometry(0.26, 0.32, 1);
  const metal = material(GUARDRAIL, 0.6, 0.3);
  const posts = new THREE.InstancedMesh(postGeometry, metal, entries.length);
  const rails = new THREE.InstancedMesh(railGeometry, metal, entries.length);
  const marker = new THREE.Object3D();

  entries.forEach((entry, cursor) => {
    const next = samples[(entry.index + step) % samples.length];
    const offset = entry.valleySide * (trackWidth / 2 + CURB_WIDTH + SHOULDER_WIDTH + 1.7);
    const point = entry.sample.point.clone().addScaledVector(entry.sample.normal, offset);
    point.y += 0.86;
    marker.position.copy(point);
    marker.rotation.set(0, 0, 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    posts.setMatrixAt(cursor, marker.matrix);

    const nextPoint = next.point.clone().addScaledVector(next.normal, offset);
    const midpoint = point.clone().lerp(nextPoint, 0.5);
    midpoint.y += 0.22;
    const distance = Math.max(0.5, point.distanceTo(nextPoint));
    marker.position.copy(midpoint);
    marker.rotation.set(0, Math.atan2(nextPoint.x - point.x, nextPoint.z - point.z), 0);
    marker.scale.set(1, 1, distance);
    marker.updateMatrix();
    rails.setMatrixAt(cursor, marker.matrix);
  });

  posts.instanceMatrix.needsUpdate = true;
  rails.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  rails.castShadow = true;
  posts.name = 'Mountain exposed descent guardrail posts';
  rails.name = 'Mountain exposed descent guardrails';
  world.add(posts, rails);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 0x100000000;
  };
}

function makeSpruceForest(world, samples, trackWidth) {
  const random = seededRandom(0x4d4f554e);
  const placements = [];
  const step = Math.max(4, Math.floor(samples.length / 230));

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    if (sample.point.y > 39) continue;
    const progress = index / samples.length;
    const villageQuietZone = progress < 0.035 || progress > 0.965;
    if (villageQuietZone) continue;
    const inward = mountainFacingSign(sample);
    const side = progress < 0.48 ? (random() > 0.26 ? inward : -inward) : inward;
    const offset = side * (trackWidth / 2 + 12 + random() * 31);
    const point = sample.point.clone().addScaledVector(sample.normal, offset);
    point.y = Math.max(0, sample.point.y + (side === inward ? random() * 3.4 : -Math.min(sample.point.y, 2.5)));
    placements.push({ point, scale: 0.72 + random() * 1.05, yaw: random() * Math.PI * 2 });
  }

  const trunkGeometry = new THREE.CylinderGeometry(0.34, 0.48, 5.3, 6);
  const crownGeometry = new THREE.ConeGeometry(3.25, 10.6, 7);
  const lowerGeometry = new THREE.ConeGeometry(4.1, 8.4, 7);
  const trunks = new THREE.InstancedMesh(trunkGeometry, material(0x5b432d, 1), placements.length);
  const crowns = new THREE.InstancedMesh(crownGeometry, material(SPRUCE_DARK, 1), placements.length);
  const lowers = new THREE.InstancedMesh(lowerGeometry, material(SPRUCE_LIGHT, 1), placements.length);
  const marker = new THREE.Object3D();

  placements.forEach((entry, cursor) => {
    marker.position.copy(entry.point);
    marker.position.y += 2.65 * entry.scale;
    marker.rotation.set(0, entry.yaw, 0);
    marker.scale.set(entry.scale, entry.scale, entry.scale);
    marker.updateMatrix();
    trunks.setMatrixAt(cursor, marker.matrix);

    marker.position.copy(entry.point);
    marker.position.y += 8.3 * entry.scale;
    marker.rotation.set(0, entry.yaw, 0);
    marker.scale.set(entry.scale, entry.scale, entry.scale);
    marker.updateMatrix();
    crowns.setMatrixAt(cursor, marker.matrix);

    marker.position.copy(entry.point);
    marker.position.y += 5.8 * entry.scale;
    marker.rotation.set(0, entry.yaw + 0.18, 0);
    marker.scale.set(entry.scale, entry.scale, entry.scale);
    marker.updateMatrix();
    lowers.setMatrixAt(cursor, marker.matrix);
  });

  for (const mesh of [trunks, crowns, lowers]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.turnOutlined = true;
  }
  trunks.name = 'Mountain spruce trunks';
  crowns.name = 'Mountain spruce crowns';
  lowers.name = 'Mountain spruce lower boughs';
  world.add(trunks, crowns, lowers);
}

function makeRockFields(world, samples, trackWidth) {
  const random = seededRandom(0x524f434b);
  const placements = [];
  for (let index = 0; index < samples.length; index += 8) {
    const sample = samples[index];
    if (sample.point.y < 7) continue;
    const inward = mountainFacingSign(sample);
    const repeats = sample.point.y > 28 ? 2 : 1;
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const offset = inward * (trackWidth / 2 + 12 + random() * 28);
      const point = sample.point.clone().addScaledVector(sample.normal, offset);
      point.y = sample.point.y + 0.5 + random() * (2 + sample.point.y * 0.08);
      placements.push({
        point,
        scale: 1.5 + random() * 3.9,
        yaw: random() * Math.PI * 2,
        snow: sample.point.y >= SNOW_LINE - 3 && random() > 0.35
      });
    }
  }

  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeometry, material(GRANITE_DARK, 1), placements.length);
  const snowCaps = new THREE.InstancedMesh(rockGeometry, material(SNOW, 1), placements.filter((entry) => entry.snow).length);
  const marker = new THREE.Object3D();
  let snowCursor = 0;

  placements.forEach((entry, cursor) => {
    marker.position.copy(entry.point);
    marker.rotation.set(0.16 + (cursor % 4) * 0.13, entry.yaw, 0.08);
    marker.scale.set(entry.scale * 1.3, entry.scale * 0.82, entry.scale);
    marker.updateMatrix();
    rocks.setMatrixAt(cursor, marker.matrix);

    if (entry.snow) {
      marker.position.copy(entry.point);
      marker.position.y += entry.scale * 0.58;
      marker.rotation.set(0.12, entry.yaw, 0.05);
      marker.scale.set(entry.scale * 1.05, entry.scale * 0.34, entry.scale * 0.83);
      marker.updateMatrix();
      snowCaps.setMatrixAt(snowCursor, marker.matrix);
      snowCursor += 1;
    }
  });
  rocks.instanceMatrix.needsUpdate = true;
  snowCaps.instanceMatrix.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  snowCaps.castShadow = true;
  rocks.name = 'Mountain Cliffside-style granite rock fields';
  snowCaps.name = 'Mountain snow-capped rocks';
  world.add(rocks, snowCaps);
}

function makeLakeRiverAndWaterfall(world) {
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: WATER,
    roughness: 0.34,
    metalness: 0.04,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });

  const lake = new THREE.Mesh(new THREE.CircleGeometry(118, 56), waterMaterial);
  lake.rotation.x = -Math.PI / 2;
  lake.scale.set(1.28, 0.82, 1);
  lake.position.set(210, LAKE_LEVEL, -230);
  lake.name = 'Mountain waterfall lake';
  world.add(lake);

  const riverPoints = [
    [-130, 43, 216],
    [-55, 44, 210],
    [30, 46, 201],
    [105, 47, 185],
    [165, 47, 158],
    [205, 44, 118],
    [222, 40, 62],
    [224, 36, 5],
    [216, 32, -48],
    [204, 29, -88],
    [WATERFALL.x, WATERFALL.top, WATERFALL.z]
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const riverCurve = new THREE.CatmullRomCurve3(riverPoints, false, 'centripetal');
  const riverSamples = Array.from({ length: 90 }, (_, index) => {
    const t = index / 89;
    const point = riverCurve.getPointAt(t);
    const tangent = riverCurve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    return { point, normal, t };
  });

  const positions = [];
  for (let index = 0; index < riverSamples.length - 1; index += 1) {
    const current = riverSamples[index];
    const next = riverSamples[index + 1];
    const widthA = 7 + current.t * 4.8;
    const widthB = 7 + next.t * 4.8;
    const a = current.point.clone().addScaledVector(current.normal, widthA);
    const b = current.point.clone().addScaledVector(current.normal, -widthA);
    const c = next.point.clone().addScaledVector(next.normal, widthB);
    const d = next.point.clone().addScaledVector(next.normal, -widthB);
    positions.push(
      a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
      b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
    );
  }
  const riverGeometry = new THREE.BufferGeometry();
  riverGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  riverGeometry.computeVertexNormals();
  const river = new THREE.Mesh(riverGeometry, waterMaterial);
  river.name = 'Mountain summit river';
  world.add(river);

  const waterfallMaterial = new THREE.MeshStandardMaterial({
    color: WATER_LIGHT,
    roughness: 0.24,
    metalness: 0,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    emissive: 0x0b4b66,
    emissiveIntensity: 0.14
  });
  const fallHeight = WATERFALL.top - WATERFALL.bottom;
  for (const offset of [-5.5, 0, 5.5]) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(6.4, fallHeight), waterfallMaterial);
    sheet.position.set(WATERFALL.x + offset, WATERFALL.bottom + fallHeight / 2, WATERFALL.z);
    sheet.rotation.y = -0.13 + offset * 0.006;
    sheet.name = 'Mountain waterfall sheet';
    world.add(sheet);
  }

  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0.78, side: THREE.DoubleSide })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.scale.set(1.35, 0.65, 1);
  foam.position.set(WATERFALL.x + 5, LAKE_LEVEL + 0.08, WATERFALL.z - 10);
  foam.name = 'Mountain waterfall foam';
  world.add(foam);

  const mistMaterial = new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0.22, depthWrite: false });
  for (let index = 0; index < 9; index += 1) {
    const mist = new THREE.Mesh(new THREE.SphereGeometry(5 + (index % 3) * 2, 8, 6), mistMaterial);
    mist.position.set(
      WATERFALL.x - 14 + (index % 5) * 7,
      LAKE_LEVEL + 4 + Math.floor(index / 5) * 4,
      WATERFALL.z - 8 + (index % 2) * 5
    );
    mist.scale.y = 0.65;
    mist.name = 'Mountain waterfall mist';
    world.add(mist);
  }
}

function makeVillage(world, samples, trackWidth) {
  const plazaTexture = makeGroundTexture(['#8b8c86', '#9b9a92', '#747770', '#aaa69c'], 21, 6);
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(38, 36),
    new THREE.MeshStandardMaterial({ map: plazaTexture, color: 0xffffff, roughness: 1 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(VILLAGE_CENTER.x + 16, -0.36, VILLAGE_CENTER.z - 4);
  plaza.scale.set(1.25, 0.82, 1);
  plaza.receiveShadow = true;
  plaza.name = 'Mountain village textured stone plaza';
  world.add(plaza);

  const houses = [
    [-76, -244, 0.18, 1.05, 0xefe1c4, 0x7f2f2f],
    [-50, -267, -0.08, 0.9, 0xe8d6b1, 0x3d5366],
    [-21, -276, 0.04, 1.12, 0xf1e7d0, 0x8f3b32],
    [20, -280, -0.02, 0.95, 0xe9d7b7, 0x334e5a],
    [58, -270, -0.17, 1.08, 0xf1dfbd, 0x7b3535],
    [82, -246, -0.28, 0.92, 0xe7d5b7, 0x435d63],
    [76, -211, Math.PI - 0.18, 1.03, 0xf0dfc4, 0x773737],
    [52, -196, Math.PI + 0.08, 0.88, 0xe5d0aa, 0x3e5964],
    [-55, -204, Math.PI + 0.2, 0.9, 0xf3e6cb, 0x82352f]
  ];
  houses.forEach(([x, z, yaw, scale, wall, roof], index) => {
    const chalet = makeChalet({ wall, roof, scale, index });
    chalet.position.set(x, 0, z);
    chalet.rotation.y = yaw;
    chalet.name = `Mountain cozy chalet ${index + 1}`;
    world.add(chalet);
  });

  const inn = makeChalet({ wall: 0xf1dfbd, roof: 0x773737, scale: 1.38, index: 20, windows: 4 });
  inn.position.set(6, 0, -263);
  inn.rotation.y = 0.04;
  inn.name = 'Mountain village inn';
  world.add(inn);

  const church = makeVillageChurch();
  church.position.set(-92, 0, -218);
  church.rotation.y = 0.26;
  world.add(church);

  makeVillageFences(world);
  makeVillageLamps(world);
  makeVillageSign(world, samples[0], trackWidth);
}

function makeChalet({ wall, roof, scale = 1, index = 0, windows = 2 }) {
  const group = new THREE.Group();
  const width = 17 * scale;
  const depth = 13 * scale;
  const height = 8.2 * scale;

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(wall, 1));
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roofMesh = new THREE.Mesh(makeGabledRoofGeometry(width + 3.6 * scale, depth + 3 * scale, 5.3 * scale), material(roof, 0.92));
  roofMesh.position.y = height;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  const snowRoof = new THREE.Mesh(
    makeGabledRoofGeometry(width + 4 * scale, depth + 3.4 * scale, 5.45 * scale),
    new THREE.MeshStandardMaterial({ color: SNOW, roughness: 1, transparent: true, opacity: 0.9 })
  );
  snowRoof.position.y = height + 0.16 * scale;
  snowRoof.scale.set(1.01, 1.01, 1.01);
  group.add(snowRoof);

  const beamMaterial = material(WOOD, 1);
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7 * scale, height * 0.88, 0.5 * scale), beamMaterial);
    beam.position.set(side * width * 0.31, height * 0.48, depth / 2 + 0.26 * scale);
    beam.castShadow = true;
    group.add(beam);
  }
  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.65 * scale, 0.5 * scale), beamMaterial);
  crossBeam.position.set(0, height * 0.62, depth / 2 + 0.27 * scale);
  group.add(crossBeam);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x241d12,
    emissive: WARM_WINDOW,
    emissiveIntensity: 1.15,
    roughness: 0.72
  });
  for (let windowIndex = 0; windowIndex < windows; windowIndex += 1) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 2.5 * scale, 0.28 * scale), windowMaterial);
    const spread = windows === 1 ? 0 : (windowIndex / (windows - 1) - 0.5) * width * 0.62;
    window.position.set(spread, height * 0.48, depth / 2 + 0.32 * scale);
    group.add(window);
  }

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.5 * scale, 5.2 * scale, 1.5 * scale), material(0x80746a, 1));
  chimney.position.set(width * (index % 2 ? -0.22 : 0.22), height + 3.1 * scale, -depth * 0.12);
  chimney.castShadow = true;
  group.add(chimney);
  return group;
}

function makeGabledRoofGeometry(width, depth, height) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const positions = new Float32Array([
    -halfW, 0, -halfD, halfW, 0, -halfD, 0, height, -halfD,
    -halfW, 0, halfD, 0, height, halfD, halfW, 0, halfD,
    -halfW, 0, -halfD, 0, height, -halfD, -halfW, 0, halfD,
    -halfW, 0, halfD, 0, height, -halfD, 0, height, halfD,
    halfW, 0, -halfD, halfW, 0, halfD, 0, height, -halfD,
    halfW, 0, halfD, 0, height, halfD, 0, height, -halfD,
    -halfW, 0, -halfD, -halfW, 0, halfD, halfW, 0, -halfD,
    halfW, 0, -halfD, -halfW, 0, halfD, halfW, 0, halfD
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeVillageChurch() {
  const group = new THREE.Group();
  const walls = material(0xece1c9, 1);
  const roof = material(0x53636b, 0.94);
  const nave = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 22), walls);
  nave.position.y = 5;
  nave.castShadow = true;
  group.add(nave);
  const naveRoof = new THREE.Mesh(makeGabledRoofGeometry(18, 25, 6), roof);
  naveRoof.position.y = 10;
  naveRoof.castShadow = true;
  group.add(naveRoof);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 21, 8), walls);
  tower.position.set(0, 10.5, -8);
  tower.castShadow = true;
  group.add(tower);
  const steeple = new THREE.Mesh(new THREE.ConeGeometry(6.2, 12, 4), roof);
  steeple.position.set(0, 27, -8);
  steeple.rotation.y = Math.PI / 4;
  steeple.castShadow = true;
  group.add(steeple);
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 4.4, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x221b10, emissive: WARM_WINDOW, emissiveIntensity: 1.2 })
  );
  glow.position.set(0, 13, 4.1);
  group.add(glow);
  group.name = 'Mountain village chapel';
  return group;
}

function makeVillageFences(world) {
  const wood = material(0x7b593c, 1);
  const postGeometry = new THREE.BoxGeometry(0.5, 1.6, 0.5);
  const railGeometry = new THREE.BoxGeometry(4.8, 0.35, 0.35);
  const segments = [
    [-72, -226, 0], [-63, -226, 0], [-44, -246, Math.PI / 2], [-44, -255, Math.PI / 2],
    [44, -248, Math.PI / 2], [44, -257, Math.PI / 2], [65, -226, 0], [74, -226, 0],
    [-18, -243, 0], [27, -243, 0]
  ];
  for (const [x, z, yaw] of segments) {
    const group = new THREE.Group();
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeometry, wood);
      post.position.set(side * 2.3, 0.8, 0);
      post.castShadow = true;
      group.add(post);
    }
    for (const y of [0.65, 1.22]) {
      const rail = new THREE.Mesh(railGeometry, wood);
      rail.position.y = y;
      rail.castShadow = true;
      group.add(rail);
    }
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    group.name = 'Mountain village wooden fence';
    world.add(group);
  }
}

function makeVillageLamps(world) {
  const poleMaterial = material(0x2f3539, 0.72, 0.22);
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe6a1,
    emissive: WARM_WINDOW,
    emissiveIntensity: 1.8,
    roughness: 0.5
  });
  const positions = [
    [-32, -235], [2, -240], [35, -235], [62, -225], [-65, -220], [28, -266]
  ];
  for (const [x, z] of positions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 5.5, 7), poleMaterial);
    pole.position.set(x, 2.75, z);
    pole.castShadow = true;
    pole.name = 'Mountain village lantern post';
    world.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.78, 8, 6), glowMaterial);
    lamp.position.set(x, 5.35, z);
    lamp.name = 'Mountain village warm lantern';
    world.add(lamp);
  }
}

function makeVillageSign(world, start, trackWidth) {
  const postMaterial = material(WOOD, 1);
  const signMaterial = material(0x8a633f, 1);
  const group = new THREE.Group();
  for (const x of [-2.7, 2.7]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.8, 0.6), postMaterial);
    post.position.set(x, 2.9, 0);
    post.castShadow = true;
    group.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(7.4, 2.2, 0.55), signMaterial);
  board.position.y = 5.2;
  board.castShadow = true;
  group.add(board);
  group.position.copy(start.point).addScaledVector(start.normal, trackWidth / 2 + 8.8);
  group.position.y = 0;
  group.rotation.y = Math.atan2(start.tangent.x, start.tangent.z);
  group.name = 'Mountain village start sign';
  world.add(group);
}

function loadKenneyVillageLandmarks(world) {
  const loader = new GLTFLoader();
  const load = (url, configure) => {
    loader.loadAsync(url)
      .then((gltf) => {
        const root = gltf.scene;
        root.traverse((node) => {
          if (!node?.isMesh) return;
          node.castShadow = true;
          node.receiveShadow = true;
          node.userData.turnOutlined = true;
        });
        configure(root);
        world.add(root);
      })
      .catch((error) => {
        console.warn(`TURN: Mountain Kenney landmark failed to load: ${url}`, error);
      });
  };

  load('/turn/assets/scenery/fantasy-town/windmill.glb', (root) => {
    root.name = 'Mountain Kenney Fantasy Town windmill';
    root.position.set(-128, 0, -258);
    root.rotation.y = 0.72;
    root.scale.setScalar(9.5);
  });

  load('/turn/assets/scenery/fantasy-town/fountainCenter.glb', (root) => {
    root.name = 'Mountain Kenney Fantasy Town fountain';
    root.position.set(VILLAGE_CENTER.x + 17, 0.12, VILLAGE_CENTER.z - 4);
    root.rotation.y = Math.PI / 4;
    root.scale.setScalar(12);
  });
}
