import * as THREE from 'three';
import { trackPitch } from './elevation.js';

export const MOUNTAIN_R3 = Object.freeze({
  INK: 0x08090a,
  CREAM: 0xfff8e8,
  ASPHALT_DARK: 0x34383d,
  ASPHALT_LIGHT: 0x4b5157,
  GRANITE_DARK: 0x565d63,
  GRANITE_LIGHT: 0x858e94,
  SPRUCE_DARK: 0x153f31,
  SPRUCE_LIGHT: 0x2f6846,
  SNOW: 0xf4f7f8,
  SNOW_SHADOW: 0xdde7eb,
  WATER: 0x1598c4,
  WATER_LIGHT: 0x62d7ef,
  GUARDRAIL: 0xe5ebef,
  ROAD_HEIGHT: 0.14,
  ROADBED_DEPTH: 0.58,
  EDGE_WHITE_WIDTH: 0.82,
  EDGE_BLACK_WIDTH: 0.48,
  TERRAIN_ROAD_GAP: 0.36,
  MOUNTAIN_CORE: Object.freeze({ x: -18, z: 112 }),
  LAKE: Object.freeze({ x: 250, z: -205, rx: 96, rz: 58, level: -0.72 }),
  WATERFALL: Object.freeze({ x: 246, z: -129, top: 25.5, bottom: 0.43 }),
  HOLIDAY_ROOT: '/turn/assets/scenery/mountain/holiday',
  FANTASY_ROOT: '/turn/assets/scenery/mountain/fantasy',
  NATURE_ROOT: '/turn/assets/scenery/mountain/nature'
});

export const MOUNTAIN_RIVER_CONTROL_POINTS = Object.freeze([
  Object.freeze([225, 45, 215]),
  Object.freeze([246, 43.5, 180]),
  Object.freeze([263, 41, 132]),
  Object.freeze([271, 37.5, 78]),
  Object.freeze([270, 34, 20]),
  Object.freeze([263, 30.5, -38]),
  Object.freeze([254, 27.5, -90]),
  Object.freeze([246, MOUNTAIN_R3.WATERFALL.top, -126])
]);

const {
  INK, CREAM, ASPHALT_DARK, ASPHALT_LIGHT, GRANITE_DARK, GRANITE_LIGHT,
  SNOW, SNOW_SHADOW, ROAD_HEIGHT, ROADBED_DEPTH, EDGE_WHITE_WIDTH,
  EDGE_BLACK_WIDTH, TERRAIN_ROAD_GAP, MOUNTAIN_CORE, LAKE
} = MOUNTAIN_R3;

export function material(color, roughness = 0.96, metalness = 0, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options });
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / Math.max(1e-9, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) { return a + (b - a) * t; }

export function mountainFacingSign(sample) {
  const dx = MOUNTAIN_CORE.x - sample.point.x;
  const dz = MOUNTAIN_CORE.z - sample.point.z;
  return dx * sample.normal.x + dz * sample.normal.z >= 0 ? 1 : -1;
}

export function offsetPoint(sample, offset, yOffset = 0) {
  const point = sample.point.clone().addScaledVector(sample.normal, offset);
  point.y += yOffset;
  return point;
}

export function createMountainRiverSamples(count = 92) {
  const curve = new THREE.CatmullRomCurve3(
    MOUNTAIN_RIVER_CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal'
  );
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    return {
      point,
      tangent,
      normal: new THREE.Vector3(-tangent.z, 0, tangent.x).normalize(),
      t
    };
  });
}

export function nearestTrackDistanceXZ(point, samples, stride = 2) {
  let nearest = Infinity;
  for (let index = 0; index < samples.length; index += stride) {
    const p = samples[index].point;
    nearest = Math.min(nearest, Math.hypot(point.x - p.x, point.z - p.z));
  }
  return nearest;
}

export function nearestNonLocalTrackDistanceXZ(point, samples, ownIndex, exclusion = 28) {
  let nearest = Infinity;
  for (let index = 0; index < samples.length; index += 3) {
    const raw = Math.abs(index - ownIndex);
    if (Math.min(raw, samples.length - raw) <= exclusion) continue;
    const p = samples[index].point;
    nearest = Math.min(nearest, Math.hypot(point.x - p.x, point.z - p.z));
  }
  return nearest;
}

export function safeTracksidePosition(
  samples, index, side, trackWidth, radius, baseOffset = 28, maxOffset = 76, safetyMargin = 5
) {
  const sample = samples[(index + samples.length) % samples.length];
  for (let offset = baseOffset; offset <= maxOffset; offset += 5) {
    const point = offsetPoint(sample, side * offset);
    if (nearestTrackDistanceXZ(point, samples) >= trackWidth / 2 + radius + safetyMargin) return point;
  }
  return null;
}

function nearestInfo(x, z, samples, stride = 1) {
  let nearest = samples[0];
  let distanceSq = Infinity;
  for (let index = 0; index < samples.length; index += stride) {
    const sample = samples[index];
    const dx = x - sample.point.x;
    const dz = z - sample.point.z;
    const candidate = dx * dx + dz * dz;
    if (candidate < distanceSq) {
      distanceSq = candidate;
      nearest = sample;
    }
  }
  return { sample: nearest, distance: Math.sqrt(distanceSq) };
}

function broadMountainHeight(x, z) {
  const dx = (x - MOUNTAIN_CORE.x) / 330;
  const dz = (z - MOUNTAIN_CORE.z) / 285;
  const radial = Math.hypot(dx, dz);
  return -1.05 + 56 * Math.pow(Math.max(0, 1 - radial), 1.35);
}

function riverChannelTarget(waterY, distance) {
  if (distance <= 7.7) return waterY - 1.45 + 0.52 * Math.pow(distance / 7.7, 2);
  if (distance <= 18) return lerp(waterY - 0.93, waterY + 3.9, (distance - 7.7) / 10.3);
  return lerp(waterY + 3.9, waterY + 1.2, THREE.MathUtils.clamp((distance - 18) / 16, 0, 1));
}

function lakeBasinTarget(x, z) {
  const q = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
  if (q >= 1.16) return null;
  if (q <= 0.80) return { height: LAKE.level - 1.85, influence: 1 };
  const ring = (q - 0.80) / 0.36;
  return {
    height: lerp(LAKE.level - 1.85, LAKE.level + 2.25, ring),
    influence: 1 - smoothstep(0.86, 1.16, q)
  };
}

export function createMountainTerrainSampler(samples, trackWidth, riverSamples = createMountainRiverSamples()) {
  const routeSamples = samples.filter((_, index) => index % 3 === 0);
  const roadShoulder = trackWidth / 2 + EDGE_WHITE_WIDTH + EDGE_BLACK_WIDTH + 2.2;

  function terrainHeightAt(x, z) {
    const route = nearestInfo(x, z, routeSamples);
    const sample = route.sample;
    const distance = route.distance;
    const signedSide = (x - sample.point.x) * sample.normal.x + (z - sample.point.z) * sample.normal.z;
    const mountainSide = signedSide * mountainFacingSign(sample) >= 0;
    const roadBase = sample.point.y - TERRAIN_ROAD_GAP;
    const away = Math.max(0, distance - roadShoulder);
    const floor = -1.05;

    let height = distance <= roadShoulder
      ? roadBase
      : mountainSide
        ? roadBase + Math.min(18, away * 0.30)
        : Math.max(floor, roadBase - away * 0.44);

    if (distance > roadShoulder + 4) height = Math.max(height, broadMountainHeight(x, z));
    if (distance > 55) {
      height = lerp(height, Math.max(floor, broadMountainHeight(x, z)), smoothstep(55, 90, distance));
    }

    const river = nearestInfo(x, z, riverSamples, 2);
    if (river.distance < 34 && distance > trackWidth / 2 + 7) {
      height = lerp(
        height,
        riverChannelTarget(river.sample.point.y, river.distance),
        1 - smoothstep(22, 34, river.distance)
      );
    }

    const basin = lakeBasinTarget(x, z);
    if (basin) height = lerp(height, basin.height, basin.influence);

    if (distance > roadShoulder + 5 && river.distance > 22 && !basin) {
      height += Math.sin(x * 0.041 + z * 0.017) * 0.22 + Math.sin(z * 0.053 - x * 0.013) * 0.16;
    }
    return height;
  }

  return Object.freeze({ terrainHeightAt, routeSamples, riverSamples });
}

function makeContinuousMountainBody(world, terrainHeightAt) {
  const width = 840;
  const depth = 650;
  const segmentsX = 104;
  const segmentsZ = 82;
  const minX = -420;
  const minZ = -325;
  const positions = [];
  const indices = [];

  for (let zi = 0; zi <= segmentsZ; zi += 1) {
    const z = minZ + (zi / segmentsZ) * depth;
    for (let xi = 0; xi <= segmentsX; xi += 1) {
      const x = minX + (xi / segmentsX) * width;
      positions.push(x, terrainHeightAt(x, z), z);
    }
  }

  const row = segmentsX + 1;
  for (let zi = 0; zi < segmentsZ; zi += 1) {
    for (let xi = 0; xi < segmentsX; xi += 1) {
      const a = zi * row + xi;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  const pos = geometry.getAttribute('position');
  const colors = [];
  const snow = new THREE.Color(SNOW);
  const snowShadow = new THREE.Color(SNOW_SHADOW);
  const graniteDark = new THREE.Color(GRANITE_DARK);
  const graniteLight = new THREE.Color(GRANITE_LIGHT);

  for (let index = 0; index < pos.count; index += 1) {
    const x = pos.getX(index);
    const y = pos.getY(index);
    const z = pos.getZ(index);
    const up = normals.getY(index);
    const patch = Math.sin(x * 0.036 + z * 0.021) + Math.sin(z * 0.057 - x * 0.014);
    const color = up < 0.48 || (up < 0.72 && patch > 1.12)
      ? graniteDark.clone().lerp(graniteLight, THREE.MathUtils.clamp((up + 0.2) * 0.55, 0, 1))
      : snow.clone().lerp(snowShadow, THREE.MathUtils.clamp((55 - y) / 100 + (1 - up) * 0.22, 0, 0.36));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mountain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  );
  mountain.receiveShadow = true;
  mountain.name = 'Mountain continuous terrain body r3';
  mountain.userData.turnTerrainGrid = Object.freeze({ width, depth, segmentsX, segmentsZ });
  world.add(mountain);

  const catchField = new THREE.Mesh(
    new THREE.PlaneGeometry(1550, 1250),
    material(SNOW_SHADOW, 1)
  );
  catchField.rotation.x = -Math.PI / 2;
  catchField.position.set(0, -3.2, -20);
  catchField.receiveShadow = true;
  catchField.name = 'Mountain distant snow catch plane r3';
  world.add(catchField);
}

function makeIntegratedSnowMountains(world) {
  const peaks = [
    { x: 0, z: 382, radius: 142, height: 235, rotation: 0.08, major: true },
    { x: -282, z: 316, radius: 118, height: 168, rotation: -0.12 },
    { x: 284, z: 328, radius: 126, height: 178, rotation: 0.18 },
    { x: -438, z: 132, radius: 154, height: 194, rotation: 0.04 },
    { x: 462, z: 104, radius: 158, height: 186, rotation: -0.08 },
    { x: -392, z: -228, radius: 132, height: 136, rotation: 0.16 },
    { x: 432, z: -266, radius: 148, height: 151, rotation: -0.16 }
  ];
  peaks.forEach((peak, index) => {
    const geometry = new THREE.ConeGeometry(peak.radius, peak.height, peak.major ? 11 : 9, 5);
    const pos = geometry.getAttribute('position');
    const colors = [];
    const rock = new THREE.Color(index % 2 ? 0x7d878d : 0x69747b);
    const snow = new THREE.Color(SNOW);
    for (let vertex = 0; vertex < pos.count; vertex += 1) {
      const x = pos.getX(vertex);
      const y = pos.getY(vertex);
      const z = pos.getZ(vertex);
      const normalizedHeight = (y + peak.height / 2) / peak.height;
      const angle = Math.atan2(z, x);
      const raggedSnowLine = 0.64 + Math.sin(angle * 3 + index * 0.9) * 0.045 + Math.sin(angle * 7) * 0.018;
      const color = normalizedHeight >= raggedSnowLine ? snow : rock;
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mountain = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })
    );
    mountain.position.set(peak.x, peak.height / 2 - 7, peak.z);
    mountain.rotation.y = peak.rotation;
    mountain.receiveShadow = true;
    mountain.name = peak.major ? 'Mountain integrated snowy peak backdrop r3' : 'Mountain integrated snowy ridge r3';
    world.add(mountain);
  });
}

function makeRoadSurface(world, samples, trackWidth) {
  const positions = [];
  const colors = [];
  const indices = [];
  const dark = new THREE.Color(ASPHALT_DARK);
  const light = new THREE.Color(ASPHALT_LIGHT);
  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const left = offsetPoint(sample, trackWidth / 2, ROAD_HEIGHT);
    const right = offsetPoint(sample, -trackWidth / 2, ROAD_HEIGHT);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    const color = dark.clone().lerp(light, 0.35 + Math.sin(index * 0.17) * 0.08);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }
  for (let index = 0; index < samples.length; index += 1) {
    const a = index * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, side: THREE.DoubleSide }));
  road.receiveShadow = true;
  road.name = 'Mountain asphalt road r3';
  world.add(road);
}

function makeRoadBed(world, samples, trackWidth) {
  const half = trackWidth / 2;
  for (const side of [-1, 1]) {
    const positions = [];
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const topA = offsetPoint(current, side * half, ROAD_HEIGHT - 0.015);
      const topB = offsetPoint(next, side * half, ROAD_HEIGHT - 0.015);
      const bottomA = offsetPoint(current, side * half, -ROADBED_DEPTH);
      const bottomB = offsetPoint(next, side * half, -ROADBED_DEPTH);
      positions.push(
        topA.x, topA.y, topA.z, topB.x, topB.y, topB.z, bottomA.x, bottomA.y, bottomA.z,
        topB.x, topB.y, topB.z, bottomB.x, bottomB.y, bottomB.z, bottomA.x, bottomA.y, bottomA.z
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const wall = new THREE.Mesh(geometry, material(0x4b5157, 1, 0, { side: THREE.DoubleSide }));
    wall.name = 'Mountain opaque roadbed side wall r3';
    world.add(wall);
  }

  const positions = [];
  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index];
    const next = samples[(index + 1) % samples.length];
    const a = offsetPoint(current, half, -ROADBED_DEPTH);
    const b = offsetPoint(current, -half, -ROADBED_DEPTH);
    const c = offsetPoint(next, half, -ROADBED_DEPTH);
    const d = offsetPoint(next, -half, -ROADBED_DEPTH);
    positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,b.x,b.y,b.z,d.x,d.y,d.z,c.x,c.y,c.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const bottom = new THREE.Mesh(geometry, material(GRANITE_DARK, 1, 0, { side: THREE.DoubleSide }));
  bottom.name = 'Mountain closed roadbed underside r3';
  world.add(bottom);
}

function makeSolidBand(world, samples, offsetA, offsetB, color, name) {
  const positions = [];
  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index];
    const next = samples[(index + 1) % samples.length];
    const a = offsetPoint(current, offsetA, ROAD_HEIGHT + 0.045);
    const b = offsetPoint(current, offsetB, ROAD_HEIGHT + 0.045);
    const c = offsetPoint(next, offsetA, ROAD_HEIGHT + 0.045);
    const d = offsetPoint(next, offsetB, ROAD_HEIGHT + 0.045);
    positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,b.x,b.y,b.z,d.x,d.y,d.z,c.x,c.y,c.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material(color, 0.9, 0, { side: THREE.DoubleSide }));
  mesh.name = name;
  world.add(mesh);
}

function makeRoadMarkings(world, samples, trackWidth) {
  const half = trackWidth / 2;
  for (const side of [-1, 1]) {
    makeSolidBand(world, samples, side * (half - 0.08), side * (half + EDGE_WHITE_WIDTH), CREAM, 'Mountain solid white road edge r3');
    makeSolidBand(world, samples, side * (half + EDGE_WHITE_WIDTH), side * (half + EDGE_WHITE_WIDTH + EDGE_BLACK_WIDTH), INK, 'Mountain black outer road contour r3');
  }

  const step = 11;
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.055, 5.2), material(CREAM, 0.9), Math.ceil(samples.length / step));
  const marker = new THREE.Object3D();
  let cursor = 0;
  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    marker.position.copy(sample.point);
    marker.position.y += 0.24;
    marker.rotation.set(trackPitch(sample), Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    dashes.setMatrixAt(cursor++, marker.matrix);
  }
  dashes.count = cursor;
  dashes.instanceMatrix.needsUpdate = true;
  dashes.name = 'Mountain white centre line r3';
  world.add(dashes);

  const start = samples[0];
  const tiles = 12;
  const tileWidth = trackWidth / tiles;
  const geometry = new THREE.BoxGeometry(tileWidth + 0.04, 0.07, 2.3);
  const yaw = Math.atan2(start.tangent.x, start.tangent.z);
  for (let tile = 0; tile < tiles; tile += 1) {
    const line = new THREE.Mesh(geometry, material(tile % 2 ? INK : CREAM, 0.85));
    line.position.copy(start.point).addScaledVector(start.normal, (tile - (tiles - 1) / 2) * tileWidth);
    line.position.y += 0.26;
    line.rotation.set(trackPitch(start), yaw, 0);
    line.name = 'Mountain village start finish r3';
    world.add(line);
  }
}

export function installMountainTerrain(world, samples, trackWidth) {
  const riverSamples = createMountainRiverSamples();
  const sampler = createMountainTerrainSampler(samples, trackWidth, riverSamples);
  makeContinuousMountainBody(world, sampler.terrainHeightAt);
  makeIntegratedSnowMountains(world);
  makeRoadBed(world, samples, trackWidth);
  makeRoadSurface(world, samples, trackWidth);
  makeRoadMarkings(world, samples, trackWidth);
  return Object.freeze({
    terrainHeightAt: sampler.terrainHeightAt,
    riverSamples,
    routeSamples: sampler.routeSamples
  });
}
