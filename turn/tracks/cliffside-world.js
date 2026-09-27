import * as THREE from 'three';
import { trackPitch } from './elevation.js';

// CLIFFSIDE world, consolidated from the former cliffside-world.js and its -r76 wrapper.
// Each layer keeps its original code inside its own function scope, in the original
// wrapping order, so constants stay isolated exactly as when each was its own module.

// ==== Layer 1 (formerly cliffside-world.js) ====
const installCliffsideWorldLayer1 = (() => {
const INK = 0x08090a;
const CREAM = 0xfff8e8;
const ASPHALT_DARK = 0x34383d;
const ASPHALT_LIGHT = 0x4a4f55;
const CURB_RED = 0xff5f67;
const ROCK_DARK = 0x65594f;
const ROCK_LIGHT = 0xa98c70;
const DRY_GRASS = 0xb9b66f;
const PINE_DARK = 0x234f3b;
const PINE_LIGHT = 0x3f7d51;
const OCEAN = 0x3e9fca;
const GUARDRAIL = 0xe7edf1;
const ROAD_HEIGHT = 0.12;
const CURB_HEIGHT = 0.17;
const SHOULDER_WIDTH = 4.45;
const SEA_LEVEL = -16.5;

function installCliffsideWorld({ scene, samples, trackWidth = 27 }) {
  const world = new THREE.Group();
  world.name = 'TURN Cliffside r72';
  scene.add(world);

  makeOcean(world);
  makeTerrainRibbon(world, samples, trackWidth);
  makeRoad(world, samples, trackWidth);
  makeShoulders(world, samples, trackWidth);
  makeGuardrail(world, samples, trackWidth);
  makePineForest(world, samples, trackWidth);
  makeCliffRocks(world, samples, trackWidth);
  makeStoneGate(world, samples, trackWidth);
  makeStartArch(world, samples, trackWidth);
  makeDistantIslands(world);

  world.userData.turnCliffsideArtDirection = Object.freeze({
    version: 'r72',
    elevatedRoad: true,
    oceanCliffs: true,
    linkedCurveRhythm: true,
    instancedScenery: true,
    verticalRoadOverlap: false
  });

  return world;
}

function makeOcean(world) {
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 900),
    material(OCEAN, 0.72, 0.02)
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-45, SEA_LEVEL, 30);
  world.add(ocean);

  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(1250, 420),
    new THREE.MeshBasicMaterial({ color: 0x77cfe9, side: THREE.DoubleSide })
  );
  horizon.position.set(0, 72, -430);
  world.add(horizon);
}

function makeTerrainRibbon(world, samples, trackWidth) {
  const half = trackWidth / 2;
  const positions = [];
  const colors = [];
  const indices = [];
  const crossSectionCount = 4;
  const colorSet = [ROCK_DARK, ROCK_LIGHT, DRY_GRASS, 0x65794c].map((hex) => new THREE.Color(hex));

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const ridgeLift = 7 + Math.sin(index * 0.083) * 2.4 + Math.sin(index * 0.027 + 1.2) * 1.8;
    const profiles = [
      { offset: -(half + 18), y: Math.max(SEA_LEVEL + 0.8, sample.point.y - 9.5) },
      { offset: -(half + 6.3), y: sample.point.y - 0.34 },
      { offset: half + 6.3, y: sample.point.y - 0.38 },
      { offset: half + 20, y: sample.point.y + ridgeLift }
    ];

    for (let profile = 0; profile < profiles.length; profile += 1) {
      const entry = profiles[profile];
      const point = sample.point.clone().addScaledVector(sample.normal, entry.offset);
      positions.push(point.x, entry.y, point.z);
      const color = colorSet[profile];
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    const row = index * crossSectionCount;
    const next = (index + 1) * crossSectionCount;
    for (let profile = 0; profile < crossSectionCount - 1; profile += 1) {
      const a = row + profile;
      const b = row + profile + 1;
      const c = next + profile;
      const d = next + profile + 1;
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
  world.add(terrain);

  const skirtPositions = [];
  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index];
    const next = samples[(index + 1) % samples.length];
    const currentTop = current.point.clone().addScaledVector(current.normal, -(half + 17.5));
    const nextTop = next.point.clone().addScaledVector(next.normal, -(half + 17.5));
    currentTop.y = Math.max(SEA_LEVEL + 0.7, current.point.y - 9.3);
    nextTop.y = Math.max(SEA_LEVEL + 0.7, next.point.y - 9.3);
    skirtPositions.push(
      currentTop.x, currentTop.y, currentTop.z,
      nextTop.x, nextTop.y, nextTop.z,
      currentTop.x, SEA_LEVEL - 0.15, currentTop.z,
      nextTop.x, nextTop.y, nextTop.z,
      nextTop.x, SEA_LEVEL - 0.15, nextTop.z,
      currentTop.x, SEA_LEVEL - 0.15, currentTop.z
    );
  }
  const skirtGeometry = new THREE.BufferGeometry();
  skirtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(skirtPositions, 3));
  skirtGeometry.computeVertexNormals();
  const skirt = new THREE.Mesh(skirtGeometry, material(0x554c46, 1));
  world.add(skirt);
}

function makeRoad(world, samples, trackWidth) {
  const count = samples.length;
  const positions = [];
  const colors = [];
  const indices = [];
  const asphaltDark = new THREE.Color(ASPHALT_DARK);
  const asphaltLight = new THREE.Color(ASPHALT_LIGHT);

  for (let index = 0; index <= count; index += 1) {
    const sample = samples[index % count];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2);
    left.y = sample.point.y + ROAD_HEIGHT;
    right.y = sample.point.y + ROAD_HEIGHT;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    const variation = THREE.MathUtils.clamp(
      0.44 + Math.sin(index * 0.16) * 0.1 + Math.sin(index * 0.57 + 0.9) * 0.05,
      0,
      1
    );
    const color = asphaltDark.clone().lerp(asphaltLight, variation);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  for (let index = 0; index < count; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  roadGeometry.setIndex(indices);
  roadGeometry.computeVertexNormals();

  const road = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.98,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
  world.add(road);

  makeCurbs(world, samples, trackWidth);
  makeCentreLine(world, samples);
  makeStartLine(world, samples, trackWidth);
}

function makeCurbs(world, samples, trackWidth) {
  const curbWidth = 1.65;
  const curbSegmentLength = 11;
  const curbColors = [new THREE.Color(CURB_RED), new THREE.Color(CREAM)];

  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const innerOffset = side * (trackWidth / 2 - 0.08);
      const outerOffset = side * (trackWidth / 2 + curbWidth);
      const a = elevatedOffset(current, innerOffset, CURB_HEIGHT);
      const b = elevatedOffset(current, outerOffset, CURB_HEIGHT);
      const c = elevatedOffset(next, innerOffset, CURB_HEIGHT);
      const d = elevatedOffset(next, outerOffset, CURB_HEIGHT);
      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
      );
      const color = curbColors[Math.floor(index / curbSegmentLength) % 2];
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
    world.add(curb);
  }
}

function makeShoulders(world, samples, trackWidth) {
  const curbOuter = trackWidth / 2 + 1.65;
  const shoulderOuter = curbOuter + SHOULDER_WIDTH;

  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];
    const innerColor = new THREE.Color(side < 0 ? 0xd9c99d : 0xc6b77d);
    const outerColor = new THREE.Color(side < 0 ? 0xb79f75 : 0xa8a36a);

    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const a = elevatedOffset(current, side * curbOuter, ROAD_HEIGHT + 0.015);
      const b = elevatedOffset(current, side * shoulderOuter, ROAD_HEIGHT - 0.015);
      const c = elevatedOffset(next, side * curbOuter, ROAD_HEIGHT + 0.015);
      const d = elevatedOffset(next, side * shoulderOuter, ROAD_HEIGHT - 0.015);
      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
      );
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
    world.add(shoulder);
  }
}

function makeCentreLine(world, samples) {
  const step = 10;
  const geometry = new THREE.BoxGeometry(0.34, 0.055, 5.2);
  const dashes = new THREE.InstancedMesh(geometry, material(CREAM, 0.9), Math.ceil(samples.length / step));
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    marker.position.copy(sample.point);
    marker.position.y += 0.235;
    marker.rotation.set(trackPitch(sample), Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    dashes.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }
  dashes.count = cursor;
  dashes.instanceMatrix.needsUpdate = true;
  world.add(dashes);
}

function makeStartLine(world, samples, trackWidth) {
  const start = samples[0];
  const tileCount = 12;
  const tileWidth = trackWidth / tileCount;
  const tileGeometry = new THREE.BoxGeometry(tileWidth + 0.04, 0.07, 2.2);
  const white = material(CREAM, 0.85);
  const black = material(INK, 0.85);
  const yaw = Math.atan2(start.tangent.x, start.tangent.z);

  for (let tile = 0; tile < tileCount; tile += 1) {
    const marker = new THREE.Mesh(tileGeometry, tile % 2 ? black : white);
    marker.position.copy(start.point).addScaledVector(start.normal, (tile - (tileCount - 1) / 2) * tileWidth);
    marker.position.y += 0.25;
    marker.rotation.set(trackPitch(start), yaw, 0);
    world.add(marker);
  }
}

function makeGuardrail(world, samples, trackWidth) {
  const step = 8;
  const count = Math.ceil(samples.length / step);
  const postGeometry = new THREE.BoxGeometry(0.36, 2.4, 0.36);
  const railGeometry = new THREE.BoxGeometry(0.28, 0.34, 1);
  const postMaterial = material(GUARDRAIL, 0.62, 0.28);
  const posts = new THREE.InstancedMesh(postGeometry, postMaterial, count);
  const rails = new THREE.InstancedMesh(railGeometry, postMaterial, count);
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    const next = samples[(index + step) % samples.length];
    const outside = sample.point.clone().addScaledVector(sample.normal, -(trackWidth / 2 + 8.7));
    outside.y = sample.point.y + 1.25;
    marker.position.copy(outside);
    marker.rotation.set(0, 0, 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    posts.setMatrixAt(cursor, marker.matrix);

    const nextOutside = next.point.clone().addScaledVector(next.normal, -(trackWidth / 2 + 2.2));
    nextOutside.y = next.point.y + 1.25;
    const midpoint = outside.clone().lerp(nextOutside, 0.5);
    const length = outside.distanceTo(nextOutside);
    marker.position.copy(midpoint);
    marker.rotation.set(trackPitch(sample), Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.scale.set(1, 1, length);
    marker.updateMatrix();
    rails.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }

  posts.count = cursor;
  rails.count = cursor;
  posts.instanceMatrix.needsUpdate = true;
  rails.instanceMatrix.needsUpdate = true;
  world.add(posts, rails);
}

function makePineForest(world, samples, trackWidth) {
  const step = 12;
  const count = Math.ceil(samples.length / step);
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.48, 0.72, 6.2, 7),
    material(0x65462f, 1),
    count
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(3.4, 9.5, 8),
    material(PINE_DARK, 0.98),
    count
  );
  const crownTips = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.4, 6.8, 8),
    material(PINE_LIGHT, 0.98),
    count
  );
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    const jitter = pseudo(index * 13.7);
    const offset = trackWidth / 2 + 18 + jitter * 24;
    const scale = 0.8 + pseudo(index * 5.3 + 2.1) * 0.65;
    const base = sample.point.clone().addScaledVector(sample.normal, offset);
    base.y = sample.point.y + 1.8 + Math.sin(index * 0.08) * 1.2;

    marker.position.copy(base);
    marker.scale.set(scale, scale, scale);
    marker.rotation.set(0, pseudo(index * 3.1) * Math.PI * 2, 0);
    marker.updateMatrix();
    trunks.setMatrixAt(cursor, marker.matrix);

    marker.position.y = base.y + 6.4 * scale;
    marker.updateMatrix();
    crowns.setMatrixAt(cursor, marker.matrix);

    marker.position.y = base.y + 10.0 * scale;
    marker.scale.set(scale * 0.83, scale * 0.83, scale * 0.83);
    marker.updateMatrix();
    crownTips.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }

  for (const mesh of [trunks, crowns, crownTips]) {
    mesh.count = cursor;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }
}

function makeCliffRocks(world, samples, trackWidth) {
  const step = 15;
  const count = Math.ceil(samples.length / step);
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(3.6, 0),
    material(0x81705f, 1),
    count
  );
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    const outside = sample.point.clone().addScaledVector(sample.normal, -(trackWidth / 2 + 10 + pseudo(index) * 9));
    outside.y = sample.point.y - 3.2 - pseudo(index * 2.2) * 2;
    const scale = 0.65 + pseudo(index * 7.9) * 1.2;
    marker.position.copy(outside);
    marker.rotation.set(pseudo(index + 1) * 1.2, pseudo(index + 2) * Math.PI, pseudo(index + 3) * 0.8);
    marker.scale.set(scale * 1.25, scale, scale * 1.1);
    marker.updateMatrix();
    rocks.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }
  rocks.count = cursor;
  rocks.instanceMatrix.needsUpdate = true;
  world.add(rocks);
}

function makeStoneGate(world, samples, trackWidth) {
  const sample = samples[Math.floor(samples.length * 0.69)];
  const gate = new THREE.Group();
  gate.name = 'Cliffside Stone Gate';
  const rockMaterial = material(ROCK_LIGHT, 1);
  const columnGeometry = new THREE.DodecahedronGeometry(4.6, 0);

  for (const side of [-1, 1]) {
    const column = new THREE.Mesh(columnGeometry, rockMaterial);
    column.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 + 3.9));
    column.position.y = sample.point.y + 4.3;
    column.scale.set(1.15, 1.75, 1.1);
    column.rotation.set(0.2 * side, 0.5 * side, 0.12 * side);
    gate.add(column);
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(trackWidth + 10, 3.6, 5.2), rockMaterial);
  lintel.position.copy(sample.point);
  lintel.position.y = sample.point.y + 10.5;
  lintel.rotation.set(trackPitch(sample), Math.atan2(sample.tangent.x, sample.tangent.z), 0.03);
  gate.add(lintel);
  world.add(gate);
}

function makeStartArch(world, samples, trackWidth) {
  const start = samples[0];
  const yaw = Math.atan2(start.tangent.x, start.tangent.z);
  const arch = new THREE.Group();
  arch.name = 'Cliffside Start Arch';
  for (const side of [-1, 1]) {
    const post = boxGroup(1.4, 10, 1.4, material(CREAM, 0.82));
    post.position.copy(start.point).addScaledVector(start.normal, side * (trackWidth / 2 - 2.2));
    post.position.y = start.point.y + 5;
    post.rotation.y = yaw;
    arch.add(post);
  }
  const banner = boxGroup(trackWidth - 2, 2.7, 1.7, material(0xff6b6b, 0.82));
  banner.position.copy(start.point);
  banner.position.y = start.point.y + 10;
  banner.rotation.y = yaw;
  arch.add(banner);
  world.add(arch);
}

function makeDistantIslands(world) {
  const rockMaterial = material(0x687465, 1);
  const positions = [
    [-390, -5, -270, 38],
    [330, -7, -330, 48],
    [405, -8, 150, 34],
    [-430, -9, 210, 42]
  ];
  for (const [x, y, z, scale] of positions) {
    const island = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), rockMaterial);
    island.position.set(x, y, z);
    island.scale.set(scale * 1.5, scale * 0.58, scale);
    island.rotation.set(0.2, x * 0.001, 0.08);
    world.add(island);
  }
}

function boxGroup(width, height, depth, material) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material));
  return group;
}

function elevatedOffset(sample, offset, height) {
  const point = sample.point.clone().addScaledVector(sample.normal, offset);
  point.y = sample.point.y + height;
  return point;
}

function material(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

return installCliffsideWorld;
})();

// ==== Layer 2 (formerly cliffside-world-r76.js) ====
const installCliffsideWorldLayer2 = (() => {
const installBaseCliffsideWorld = installCliffsideWorldLayer1;

const INK = 0x08090a;
const ROCK_DARK = 0x65594f;
const ROCK_LIGHT = 0xa98c70;
const PINE_DARK = 0x234f3b;
const PINE_LIGHT = 0x3f7d51;
const TRUNK = 0x65462f;
const INNER_EDGE_EXTRA = 18.5;
const HIGHLAND_SAMPLE_STEP = 6;
const TREE_SAMPLE_STEP = 12;
const UPPER_TREE_SAMPLE_STEP = 24;
const TRUNK_HALF_HEIGHT = 3.1;
const RING_BLENDS = Object.freeze([0, 0.28, 0.54, 0.75, 0.9]);
const RING_COLORS = Object.freeze([0x65794c, 0x5f7848, 0x73804d, 0x8f8264, 0x8f7963]);
const LEGACY_PINE_COLORS = new Set([TRUNK, PINE_DARK, PINE_LIGHT]);

function installCliffsideWorld(options) {
  const { samples, trackWidth = 27 } = options;
  const world = installBaseCliffsideWorld(options);
  const centre = trackCentre(samples);
  const peakCentre = new THREE.Vector3(centre.x + 12, 0, centre.z - 10);

  hideLegacyInnerForest(world);
  makeInnerHighlands(world, samples, trackWidth, peakCentre);
  makeGroundedPineForest(world, samples, trackWidth, peakCentre);
  makeHighlandOutcrops(world, samples, trackWidth, peakCentre);

  world.name = 'TURN Cliffside r76';
  world.userData.turnCliffsideArtDirection = Object.freeze({
    ...(world.userData.turnCliffsideArtDirection || {}),
    version: 'r76',
    filledInnerHighlands: true,
    groundedInnerForest: true,
    gameplayGeometryUnchanged: true
  });
  return world;
}

function makeInnerHighlands(world, samples, trackWidth, peakCentre) {
  const sampleIndices = sampledIndices(samples.length, HIGHLAND_SAMPLE_STEP);
  const segmentCount = sampleIndices.length;
  const positions = [];
  const colors = [];
  const indices = [];

  for (let ring = 0; ring < RING_BLENDS.length; ring += 1) {
    const blend = RING_BLENDS[ring];
    const color = new THREE.Color(RING_COLORS[ring]);
    for (const sampleIndex of sampleIndices) {
      const sample = samples[sampleIndex];
      const point = highlandPoint(sample, trackWidth, peakCentre, blend);
      point.y = highlandHeight(sample, sampleIndex, peakCentre, blend);
      positions.push(point.x, point.y, point.z);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let ring = 0; ring < RING_BLENDS.length - 1; ring += 1) {
    const row = ring * segmentCount;
    const nextRow = (ring + 1) * segmentCount;
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const next = (segment + 1) % segmentCount;
      const a = row + segment;
      const b = row + next;
      const c = nextRow + segment;
      const d = nextRow + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  const peakIndex = positions.length / 3;
  const peakColor = new THREE.Color(ROCK_LIGHT);
  positions.push(peakCentre.x, 39.5, peakCentre.z);
  colors.push(peakColor.r, peakColor.g, peakColor.b);
  const innerRow = (RING_BLENDS.length - 1) * segmentCount;
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const next = (segment + 1) % segmentCount;
    indices.push(innerRow + segment, peakIndex, innerRow + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const highlands = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      flatShading: true
    })
  );
  highlands.name = 'Cliffside Inner Highlands';
  world.add(highlands);
}

function makeGroundedPineForest(world, samples, trackWidth, peakCentre) {
  const placements = [];

  for (let index = 0; index < samples.length; index += TREE_SAMPLE_STEP) {
    const blend = 0.035 + pseudo(index * 2.7) * 0.17;
    placements.push(makeTreePlacement(samples[index], index, trackWidth, peakCentre, blend, 0.76, 1.28));
  }

  for (let index = Math.floor(UPPER_TREE_SAMPLE_STEP / 2); index < samples.length; index += UPPER_TREE_SAMPLE_STEP) {
    const blend = 0.3 + pseudo(index * 4.1 + 1.2) * 0.19;
    placements.push(makeTreePlacement(samples[index], index, trackWidth, peakCentre, blend, 0.68, 1.12));
  }

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.48, 0.72, 6.2, 7),
    material(TRUNK, 1),
    placements.length
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(3.4, 9.5, 8),
    material(PINE_DARK, 0.98),
    placements.length
  );
  const crownTips = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.4, 6.8, 8),
    material(PINE_LIGHT, 0.98),
    placements.length
  );
  trunks.name = 'Cliffside Grounded Pine Trunks';
  crowns.name = 'Cliffside Grounded Pine Crowns';
  crownTips.name = 'Cliffside Grounded Pine Tips';

  const marker = new THREE.Object3D();
  placements.forEach((placement, cursor) => {
    const { point, groundY, scale, rotation } = placement;
    marker.position.set(point.x, groundY + TRUNK_HALF_HEIGHT * scale, point.z);
    marker.scale.setScalar(scale);
    marker.rotation.set(0, rotation, 0);
    marker.updateMatrix();
    trunks.setMatrixAt(cursor, marker.matrix);

    marker.position.y = groundY + 9.5 * scale;
    marker.updateMatrix();
    crowns.setMatrixAt(cursor, marker.matrix);

    marker.position.y = groundY + 13.1 * scale;
    marker.scale.setScalar(scale * 0.83);
    marker.updateMatrix();
    crownTips.setMatrixAt(cursor, marker.matrix);
  });

  for (const mesh of [trunks, crowns, crownTips]) {
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }
}

function makeHighlandOutcrops(world, samples, trackWidth, peakCentre) {
  const rockCount = 7;
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(4.2, 0),
    material(ROCK_DARK, 1),
    rockCount
  );
  rocks.name = 'Cliffside Highland Outcrops';
  const marker = new THREE.Object3D();

  for (let cursor = 0; cursor < rockCount; cursor += 1) {
    const sampleIndex = Math.floor((cursor + 0.5) * samples.length / rockCount) % samples.length;
    const sample = samples[sampleIndex];
    const blend = 0.72 + pseudo(cursor * 7.1) * 0.17;
    const point = highlandPoint(sample, trackWidth, peakCentre, blend);
    const scale = 0.78 + pseudo(cursor * 5.3 + 0.4) * 0.78;
    point.y = highlandHeight(sample, sampleIndex, peakCentre, blend) + 1.9 * scale;
    marker.position.copy(point);
    marker.rotation.set(
      pseudo(cursor + 0.2) * 0.7,
      pseudo(cursor + 1.7) * Math.PI,
      pseudo(cursor + 2.9) * 0.55
    );
    marker.scale.set(scale * 1.35, scale, scale * 1.1);
    marker.updateMatrix();
    rocks.setMatrixAt(cursor, marker.matrix);
  }

  rocks.instanceMatrix.needsUpdate = true;
  world.add(rocks);
}

function makeTreePlacement(sample, index, trackWidth, peakCentre, blend, minimumScale, maximumScale) {
  const point = highlandPoint(sample, trackWidth, peakCentre, blend);
  const groundY = highlandHeight(sample, index, peakCentre, blend);
  const scale = minimumScale + pseudo(index * 5.3 + blend * 17) * (maximumScale - minimumScale);
  return {
    point,
    groundY,
    scale,
    rotation: pseudo(index * 3.1 + blend * 11) * Math.PI * 2
  };
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

function hideLegacyInnerForest(world) {
  world.traverse((node) => {
    if (!node?.isInstancedMesh || !node.material?.color) return;
    if (LEGACY_PINE_COLORS.has(node.material.color.getHex())) node.visible = false;
  });
}

function trackCentre(samples) {
  const centre = new THREE.Vector3();
  for (const sample of samples) centre.add(sample.point);
  centre.multiplyScalar(1 / Math.max(1, samples.length));
  centre.y = 0;
  return centre;
}

function sampledIndices(length, step) {
  const indices = [];
  for (let index = 0; index < length; index += step) indices.push(index);
  return indices;
}

function ridgeLift(index) {
  return 7 + Math.sin(index * 0.083) * 2.4 + Math.sin(index * 0.027 + 1.2) * 1.8;
}

function material(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

return installCliffsideWorld;
})();

export { installCliffsideWorldLayer2 as installCliffsideWorld };
