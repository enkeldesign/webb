import * as THREE from 'three';
import { trackPitch } from './elevation.js';

export const MOUNTAIN_R2 = Object.freeze({
  INK: 0x08090a, CREAM: 0xfff8e8, ASPHALT_DARK: 0x34383d, ASPHALT_LIGHT: 0x4b5157,
  GRANITE_DARK: 0x565d63, GRANITE_LIGHT: 0x858e94, SPRUCE_DARK: 0x153f31, SPRUCE_LIGHT: 0x2f6846,
  SNOW: 0xf4f7f8, SNOW_SHADOW: 0xdde7eb, WATER: 0x1598c4, WATER_LIGHT: 0x62d7ef, GUARDRAIL: 0xe5ebef,
  ROAD_HEIGHT: 0.14, EDGE_WHITE_WIDTH: 0.82, EDGE_BLACK_WIDTH: 0.48, SHOULDER_WIDTH: 5.2,
  MOUNTAIN_CORE: Object.freeze({ x: -18, z: 112 }), LAKE_LEVEL: -0.72,
  WATERFALL: Object.freeze({ x: 246, z: -129, top: 25.5, bottom: 0.43 }),
  HOLIDAY_ROOT: '/turn/assets/scenery/mountain/holiday', NATURE_ROOT: '/turn/assets/scenery/mountain/nature'
});
const { INK, CREAM, ASPHALT_DARK, ASPHALT_LIGHT, GRANITE_DARK, GRANITE_LIGHT, SNOW, SNOW_SHADOW, ROAD_HEIGHT, EDGE_WHITE_WIDTH, EDGE_BLACK_WIDTH, SHOULDER_WIDTH, MOUNTAIN_CORE } = MOUNTAIN_R2;

function material(color, roughness = 0.96, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeSnowField(world) {
  const texture = makeSnowTexture();
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(1120, 960),
    new THREE.MeshStandardMaterial({ color: SNOW, map: texture, roughness: 1, metalness: 0 })
  );
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, -1.08, -15);
  field.receiveShadow = true;
  field.name = 'Mountain continuous snowfield';
  world.add(field);

  const patches = [
    [-176, -43, 68, 34, 0.22], [-116, 130, 92, 38, -0.18], [76, 114, 78, 30, 0.36],
    [154, -30, 72, 28, -0.32], [-218, 198, 86, 34, 0.12], [104, -176, 64, 28, 0.08]
  ];
  const patchMaterial = material(GRANITE_LIGHT, 1);
  for (const [x, z, sx, sz, rotation] of patches) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1, 13), patchMaterial);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = rotation;
    patch.scale.set(sx, sz, 1);
    patch.position.set(x, -0.98, z);
    patch.receiveShadow = true;
    patch.name = 'Mountain exposed rock patch';
    world.add(patch);
  }
}

function makeSnowTexture() {
  if (!globalThis.document?.createElement) return null;
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const random = seededRandom(0x534e4f57);
  context.fillStyle = '#f3f7f8';
  context.fillRect(0, 0, size, size);
  for (let index = 0; index < 360; index += 1) {
    const grey = 220 + Math.floor(random() * 22);
    context.fillStyle = `rgb(${grey}, ${grey + 3}, ${Math.min(255, grey + 6)})`;
    context.globalAlpha = 0.08 + random() * 0.15;
    context.fillRect(random() * size, random() * size, 1 + random() * 5, 0.8 + random() * 2.4);
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(30, 26);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
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
    const positions = geometry.getAttribute('position');
    const colors = [];
    const rock = new THREE.Color(index % 2 ? 0x7d878d : 0x69747b);
    const snow = new THREE.Color(SNOW);
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const x = positions.getX(vertex);
      const y = positions.getY(vertex);
      const z = positions.getZ(vertex);
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
    mountain.castShadow = peak.major;
    mountain.name = peak.major ? 'Mountain integrated snowy peak backdrop' : 'Mountain integrated snowy ridge';
    world.add(mountain);
  });

  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(1550, 540),
    new THREE.MeshBasicMaterial({ color: 0xb8d9e6, side: THREE.DoubleSide })
  );
  horizon.position.set(0, 96, 515);
  horizon.name = 'Mountain alpine horizon';
  world.add(horizon);
}

function mountainFacingSign(sample) {
  const toCoreX = MOUNTAIN_CORE.x - sample.point.x;
  const toCoreZ = MOUNTAIN_CORE.z - sample.point.z;
  return toCoreX * sample.normal.x + toCoreZ * sample.normal.z >= 0 ? 1 : -1;
}

function offsetPoint(sample, offset, yOffset = 0) {
  const point = sample.point.clone().addScaledVector(sample.normal, offset);
  point.y += yOffset;
  return point;
}

function makeRoadShelf(world, samples, trackWidth) {
  const half = trackWidth / 2;
  for (const side of [-1, 1]) {
    makeRibbon(world, samples, [
      { offset: side * (half + EDGE_WHITE_WIDTH + EDGE_BLACK_WIDTH), y: -0.02 },
      { offset: side * (half + EDGE_WHITE_WIDTH + EDGE_BLACK_WIDTH + SHOULDER_WIDTH), y: -0.32 }
    ], side > 0 ? 'Mountain left snow shoulder' : 'Mountain right snow shoulder', [SNOW_SHADOW, SNOW]);
  }

  const rockMaterial = material(GRANITE_DARK, 1);
  for (let index = 0; index < samples.length; index += 7) {
    const sample = samples[index];
    if (sample.point.y < 8) continue;
    const inward = mountainFacingSign(sample);
    const localOffset = inward * (half + EDGE_WHITE_WIDTH + EDGE_BLACK_WIDTH + SHOULDER_WIDTH + 0.4);
    const point = offsetPoint(sample, localOffset, -0.35);
    if (nearestNonLocalTrackDistanceXZ(point, samples, index, 34) < trackWidth + 8) continue;
    const next = samples[(index + 7) % samples.length];
    const nextPoint = offsetPoint(next, localOffset, -0.35);
    if (nearestNonLocalTrackDistanceXZ(nextPoint, samples, (index + 7) % samples.length, 34) < trackWidth + 8) continue;
    const height = Math.min(16, 4 + sample.point.y * 0.22);
    const segment = makeVerticalRockFace(point, nextPoint, height, rockMaterial);
    segment.name = 'Mountain grounded rock retaining face';
    world.add(segment);
  }
}

function makeVerticalRockFace(a, b, height, rockMaterial) {
  const geometry = new THREE.BufferGeometry();
  const positions = [
    a.x, a.y, a.z, b.x, b.y, b.z, a.x, a.y - height, a.z,
    b.x, b.y, b.z, b.x, b.y - height, b.z, a.x, a.y - height, a.z
  ];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const face = new THREE.Mesh(geometry, rockMaterial);
  face.receiveShadow = true;
  face.castShadow = true;
  return face;
}

function makeRibbon(world, samples, profiles, name, palette) {
  const positions = [];
  const colors = [];
  const indices = [];
  const count = profiles.length;
  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    profiles.forEach((profile, profileIndex) => {
      const point = offsetPoint(sample, profile.offset, profile.y);
      positions.push(point.x, point.y, point.z);
      const color = new THREE.Color(palette[Math.min(profileIndex, palette.length - 1)]);
      colors.push(color.r, color.g, color.b);
    });
  }
  for (let index = 0; index < samples.length; index += 1) {
    const row = index * count;
    const next = (index + 1) * count;
    for (let profile = 0; profile < count - 1; profile += 1) {
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
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })
  );
  mesh.receiveShadow = true;
  mesh.name = name;
  world.add(mesh);
  return mesh;
}

function makeRoad(world, samples, trackWidth) {
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
    const variation = THREE.MathUtils.clamp(0.35 + Math.sin(index * 0.17) * 0.08 + Math.sin(index * 0.047) * 0.05, 0, 1);
    const color = dark.clone().lerp(light, variation);
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
  road.name = 'Mountain asphalt road r2';
  world.add(road);

  makeRoadEdgeBands(world, samples, trackWidth);
  makeCentreLine(world, samples);
  makeStartLine(world, samples, trackWidth);
}

function makeRoadEdgeBands(world, samples, trackWidth) {
  const half = trackWidth / 2;
  for (const side of [-1, 1]) {
    makeSolidBand(
      world,
      samples,
      side * (half - 0.08),
      side * (half + EDGE_WHITE_WIDTH),
      CREAM,
      'Mountain solid white road edge'
    );
    makeSolidBand(
      world,
      samples,
      side * (half + EDGE_WHITE_WIDTH),
      side * (half + EDGE_WHITE_WIDTH + EDGE_BLACK_WIDTH),
      INK,
      'Mountain black outer road contour'
    );
  }
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
    positions.push(a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z, b.x,b.y,b.z, d.x,d.y,d.z, c.x,c.y,c.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material(color, 0.9));
  mesh.receiveShadow = true;
  mesh.name = name;
  world.add(mesh);
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
  dashes.name = 'Mountain white centre line';
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

function nearestTrackDistanceXZ(point, samples, stride = 2) {
  let nearest = Infinity;
  for (let index = 0; index < samples.length; index += stride) {
    const sample = samples[index].point;
    nearest = Math.min(nearest, Math.hypot(point.x - sample.x, point.z - sample.z));
  }
  return nearest;
}

function nearestNonLocalTrackDistanceXZ(point, samples, ownIndex, exclusion = 28) {
  let nearest = Infinity;
  for (let index = 0; index < samples.length; index += 3) {
    const raw = Math.abs(index - ownIndex);
    const wrapped = Math.min(raw, samples.length - raw);
    if (wrapped <= exclusion) continue;
    const sample = samples[index].point;
    nearest = Math.min(nearest, Math.hypot(point.x - sample.x, point.z - sample.z));
  }
  return nearest;
}

function safeTracksidePosition(samples, index, side, trackWidth, radius, baseOffset = 28, maxOffset = 76, safetyMargin = 5) {
  const sample = samples[(index + samples.length) % samples.length];
  for (let offset = baseOffset; offset <= maxOffset; offset += 5) {
    const point = offsetPoint(sample, side * offset, -0.12);
    if (nearestTrackDistanceXZ(point, samples, 2) >= trackWidth / 2 + radius + safetyMargin) return point;
  }
  return null;
}

export { material, seededRandom, mountainFacingSign, offsetPoint, nearestTrackDistanceXZ, nearestNonLocalTrackDistanceXZ, safeTracksidePosition };

export function installMountainTerrain(world, samples, trackWidth) {
  makeSnowField(world);
  makeIntegratedSnowMountains(world);
  makeRoadShelf(world, samples, trackWidth);
  makeRoad(world, samples, trackWidth);
}
