import * as THREE from 'three';
import {
  WORLD_PLAYGROUND_V2_BOUNDS,
  WORLD_PLAYGROUND_V2_BOUNDARY,
  WORLD_PLAYGROUND_V2_DISTRICTS,
  WORLD_PLAYGROUND_V2_RIVER,
  WORLD_PLAYGROUND_V2_ROUTE,
  WORLD_PLAYGROUND_V2_SAMPLE_COUNT,
  WORLD_PLAYGROUND_V2_SEA_LEVEL,
  WORLD_PLAYGROUND_V2_TRACK_ID,
  worldPlaygroundV2BaseHeight,
  worldPlaygroundV2CoastX
} from './world-playground-v2-map.js?revision=r1-environment';

const ROAD_HEIGHT = 0.16;
const CURB_HEIGHT = 0.19;
const SHOULDER_WIDTH = 3.8;
const TERRAIN_GRID_X = 248;
const TERRAIN_GRID_Z = 190;
const TERRAIN_CORRIDOR = 220;
const OCEAN = 0x2b91b2;
const FOAM = 0xd7f2f2;
const RIVER = 0x43a9c5;
const INK_ROAD = new THREE.Color(0x34383d);
const ROAD_LIFT = new THREE.Color(0x4b5056);
const ROAD_MARKING = 0xf2efe4;

const DISTRICT_ROAD_WIDTH = Object.freeze({
  harbor: 26,
  cliffside: 23.5,
  mountain: 22,
  airport: 28,
  countryside: 20.5,
  'midnight-city': 30
});

const PALETTE = Object.freeze({
  grass: new THREE.Color(0x718e61),
  deepGrass: new THREE.Color(0x5d7f59),
  dryGrass: new THREE.Color(0xaaa46d),
  cliffRock: new THREE.Color(0x74695f),
  mountainRock: new THREE.Color(0x625d58),
  alpine: new THREE.Color(0x65765d),
  snow: new THREE.Color(0xe4e7e5),
  country: new THREE.Color(0x82a55e),
  countryGold: new THREE.Color(0xb7a65e),
  airport: new THREE.Color(0x7f936b),
  city: new THREE.Color(0x687264),
  harbor: new THREE.Color(0x85816c),
  seaFloor: new THREE.Color(0x315e68),
  concrete: new THREE.Color(0x9d9d92),
  concreteLight: new THREE.Color(0xb8b5a8),
  fieldGreen: new THREE.Color(0x8baa60),
  fieldGold: new THREE.Color(0xbda75d),
  fieldDark: new THREE.Color(0x769353),
  park: new THREE.Color(0x5f8c5d)
});

export function buildWorldPlaygroundV2Environment() {
  const samples = sampleRoute();
  const terrainHeight = createTerrainSampler(samples);
  const world = new THREE.Group();
  world.name = 'TURN World Playground V2 environment r3';
  Object.assign(world.userData, {
    turnWorldPlayground: 'v2-environment-r3',
    environmentOnly: true,
    assetsInstalled: false,
    signsInstalled: false,
    singleContinuousLoop: true,
    noLapVoid: true,
    roadGrounded: true,
    singleTerrainOwner: true,
    variableRoadScale: true,
    terrainResolution: `${TERRAIN_GRID_X}x${TERRAIN_GRID_Z}`,
    mapScale: '5.8-km-loop'
  });

  world.add(makeSky());
  world.add(makeSea());
  world.add(makeTerrain(terrainHeight));
  world.add(makeCoastFoam());
  world.add(makeDistrictGroundwork(terrainHeight));
  world.add(makeRoad(samples));
  world.add(makeShoulders(samples));
  world.add(makeCurbs(samples));
  world.add(makeRoadMarkings(samples));
  world.add(makeCliffsideGuardrail(samples));
  world.add(makeMountainWater(terrainHeight));

  return Object.freeze({
    trackId: WORLD_PLAYGROUND_V2_TRACK_ID,
    samples,
    world,
    boundary: WORLD_PLAYGROUND_V2_BOUNDARY,
    startIndex: findStartIndex(samples),
    trackWidth: 26,
    approximateLength: samples.at(-1)?.lapLength || 0,
    terrainHeight
  });
}

export function disposeWorldPlaygroundV2Environment(world) {
  if (!world) return;
  world.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((material) => material?.dispose?.());
    else node.material?.dispose?.();
  });
  world.removeFromParent();
}

function sampleRoute() {
  const controls = WORLD_PLAYGROUND_V2_ROUTE.map(({ x, y, z }) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(controls, true, 'centripetal', 0.5);
  const raw = [];
  let distance = 0;

  for (let index = 0; index < WORLD_PLAYGROUND_V2_SAMPLE_COUNT; index += 1) {
    const progress = index / WORLD_PLAYGROUND_V2_SAMPLE_COUNT;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).normalize();
    const flatLength = Math.hypot(tangent.x, tangent.z) || 1;
    const normal = new THREE.Vector3(-tangent.z / flatLength, 0, tangent.x / flatLength);
    if (index) distance += point.distanceTo(raw[index - 1].point);
    const district = nearestDistrict(point.x, point.z);
    raw.push({
      point,
      tangent,
      normal,
      progress,
      distance,
      pitch: Math.atan2(tangent.y, flatLength),
      district,
      rawRoadWidth: DISTRICT_ROAD_WIDTH[district] || 25
    });
  }

  const total = distance + raw[0].point.distanceTo(raw.at(-1).point);
  return raw.map((sample, index) => {
    let weightedWidth = 0;
    let weightTotal = 0;
    for (let offset = -24; offset <= 24; offset += 1) {
      const neighbor = raw[(index + offset + raw.length) % raw.length];
      const weight = 1 - Math.abs(offset) / 25;
      weightedWidth += neighbor.rawRoadWidth * weight;
      weightTotal += weight;
    }
    return Object.freeze({
      ...sample,
      roadWidth: weightedWidth / weightTotal,
      lapLength: total
    });
  });
}

function createTerrainSampler(samples) {
  const guide = samples.filter((_, index) => index % 3 === 0);
  return (x, z) => {
    let base = authoredBaseHeight(x, z);
    const coast = worldPlaygroundV2CoastX(z);

    // Never push the cut/fill corridor out over the ocean. Cliffside's road is
    // supported from inland, like the production CLIFFSIDE terrain ribbon.
    if (x < coast + 16 && z < 170) return base;

    let nearestDistance2 = Infinity;
    let nearest = null;
    for (const sample of guide) {
      const dx = x - sample.point.x;
      const dz = z - sample.point.z;
      const distance2 = dx * dx + dz * dz;
      if (distance2 >= nearestDistance2) continue;
      nearestDistance2 = distance2;
      nearest = sample;
    }
    if (!nearest) return base;

    const distance = Math.sqrt(nearestDistance2);
    if (distance >= TERRAIN_CORRIDOR) return base;

    const inner = nearest.roadWidth / 2 + SHOULDER_WIDTH + 7;
    const transition = smoothStep(inner, TERRAIN_CORRIDOR, distance);
    const target = nearest.point.y - 0.3 - transition * 7.2;
    const influence = 1 - smoothStep(inner + 12, TERRAIN_CORRIDOR, distance);
    base = THREE.MathUtils.lerp(base, target, influence);
    return base;
  };
}

function authoredBaseHeight(x, z) {
  const coast = worldPlaygroundV2CoastX(z);
  const shoreDistance = x - coast;
  const source = worldPlaygroundV2BaseHeight(x, z);

  if (z < 150) {
    if (shoreDistance < -28) return WORLD_PLAYGROUND_V2_SEA_LEVEL - 12;
    if (shoreDistance < 34) {
      const inland = worldPlaygroundV2BaseHeight(coast + 52, z);
      const cliffTop = Math.max(inland, 16 + smoothStep(-700, 80, z) * 26);
      return THREE.MathUtils.lerp(
        WORLD_PLAYGROUND_V2_SEA_LEVEL - 4,
        cliffTop,
        smoothStep(-24, 28, shoreDistance)
      );
    }
  }
  return source;
}

function makeTerrain(heightAt) {
  const { minX, maxX, minZ, maxZ } = WORLD_PLAYGROUND_V2_BOUNDS;
  const columns = TERRAIN_GRID_X + 1;
  const positions = [];
  const colors = [];
  const indices = [];

  for (let iz = 0; iz <= TERRAIN_GRID_Z; iz += 1) {
    const z = THREE.MathUtils.lerp(minZ, maxZ, iz / TERRAIN_GRID_Z);
    for (let ix = 0; ix <= TERRAIN_GRID_X; ix += 1) {
      const x = THREE.MathUtils.lerp(minX, maxX, ix / TERRAIN_GRID_X);
      const y = heightAt(x, z);
      positions.push(x, y, z);
      const color = terrainColor(x, y, z);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let iz = 0; iz < TERRAIN_GRID_Z; iz += 1) {
    for (let ix = 0; ix < TERRAIN_GRID_X; ix += 1) {
      const a = iz * columns + ix;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      if ((ix + iz) % 2) indices.push(a, c, b, b, c, d);
      else indices.push(a, c, d, a, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })
  );
  terrain.name = 'World Playground V2 one-piece sculpted terrain r3';
  terrain.receiveShadow = true;
  return terrain;
}

function makeDistrictGroundwork(heightAt) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 map groundwork r3';

  // HARBOR: only the industrial landform/quay for now. Cargo, cranes and ships
  // stay out until the landmark pass.
  group.add(makeConformingRect(heightAt, {
    name: 'HARBOR quay groundwork', center: [-625, 455], width: 310, depth: 150,
    rotation: -0.08, color: 0x9b9a91, gridX: 12, gridZ: 7, lift: 0.12
  }));
  group.add(makeConformingRect(heightAt, {
    name: 'HARBOR inner apron', center: [-500, 525], width: 170, depth: 92,
    rotation: -0.08, color: 0x85867f, gridX: 7, gridZ: 5, lift: 0.13
  }));

  // AIRPORT: runway/apron are part of the environment, not landmark assets.
  group.add(makeConformingRect(heightAt, {
    name: 'AIRPORT runway', center: [1040, -70], width: 64, depth: 485,
    rotation: 0.06, color: 0x3f4448, gridX: 4, gridZ: 22, lift: 0.16
  }));
  group.add(makeConformingRect(heightAt, {
    name: 'AIRPORT apron', center: [875, 42], width: 245, depth: 185,
    rotation: 0.03, color: 0x92979a, gridX: 10, gridZ: 8, lift: 0.14
  }));
  group.add(makeRunwayMarkings(heightAt));

  // COUNTRYSIDE: large conforming field blocks establish the model-world scale
  // before farms, windmill and trees arrive.
  const fields = [
    [490, 225, 165, 120, -0.12, 0x8eac61],
    [690, 190, 185, 125, 0.08, 0xb7a65e],
    [815, 345, 160, 118, -0.04, 0x799954],
    [530, 420, 190, 110, 0.13, 0xbba861],
    [315, 360, 145, 105, -0.08, 0x88a95d]
  ];
  fields.forEach(([x, z, width, depth, rotation, color], index) => {
    group.add(makeConformingRect(heightAt, {
      name: `COUNTRYSIDE field ${index + 1}`, center: [x, z], width, depth,
      rotation, color, gridX: 7, gridZ: 5, lift: 0.1
    }));
  });

  // MIDNIGHT CITY: a calm urban floor and two parks. No towers, street furniture,
  // signs or neon yet; this is just the basin the city will occupy.
  group.add(makeConformingRect(heightAt, {
    name: 'MIDNIGHT CITY urban ground', center: [-100, 520], width: 390, depth: 230,
    rotation: 0.03, color: 0x747876, gridX: 15, gridZ: 9, lift: 0.1
  }));
  group.add(makeConformingRect(heightAt, {
    name: 'MIDNIGHT CITY west park', center: [-190, 505], width: 82, depth: 62,
    rotation: 0.08, color: 0x5a8859, gridX: 5, gridZ: 4, lift: 0.14
  }));
  group.add(makeConformingRect(heightAt, {
    name: 'MIDNIGHT CITY east park', center: [15, 550], width: 95, depth: 67,
    rotation: -0.05, color: 0x608e5d, gridX: 5, gridZ: 4, lift: 0.14
  }));

  // MOUNTAIN: village terrace only. The actual model village is a later asset pass.
  group.add(makeConformingRect(heightAt, {
    name: 'MOUNTAIN village terrace', center: [-265, -770], width: 220, depth: 125,
    rotation: -0.04, color: 0x8c866f, gridX: 10, gridZ: 6, lift: 0.12
  }));

  return group;
}

function makeConformingRect(heightAt, {
  name, center, width, depth, rotation = 0, color, gridX = 6, gridZ = 6, lift = 0.1
}) {
  const positions = [];
  const indices = [];
  const columns = gridX + 1;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let iz = 0; iz <= gridZ; iz += 1) {
    const localZ = THREE.MathUtils.lerp(-depth / 2, depth / 2, iz / gridZ);
    for (let ix = 0; ix <= gridX; ix += 1) {
      const localX = THREE.MathUtils.lerp(-width / 2, width / 2, ix / gridX);
      const x = center[0] + localX * cos - localZ * sin;
      const z = center[1] + localX * sin + localZ * cos;
      positions.push(x, heightAt(x, z) + lift, z);
    }
  }
  for (let iz = 0; iz < gridZ; iz += 1) {
    for (let ix = 0; ix < gridX; ix += 1) {
      const a = iz * columns + ix;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.98, metalness: 0, side: THREE.DoubleSide })
  );
  mesh.name = name;
  mesh.receiveShadow = true;
  return mesh;
}

function makeRunwayMarkings(heightAt) {
  const group = new THREE.Group();
  group.name = 'AIRPORT runway markings';
  const material = new THREE.MeshStandardMaterial({ color: 0xf3f0e5, roughness: 0.82 });
  for (let index = -8; index <= 8; index += 1) {
    if (Math.abs(index) < 2) continue;
    const z = -70 + index * 24;
    const x = 1040 - (z + 70) * Math.tan(0.06);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 10.5), material);
    mark.position.set(x, heightAt(x, z) + 0.24, z);
    mark.rotation.y = 0.06;
    mark.receiveShadow = true;
    group.add(mark);
  }
  return group;
}

function makeRoad(samples) {
  const positions = [];
  const colors = [];
  const indices = [];

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const half = sample.roadWidth / 2;
    const left = sample.point.clone().addScaledVector(sample.normal, half);
    const center = sample.point.clone();
    const right = sample.point.clone().addScaledVector(sample.normal, -half);
    left.y = sample.point.y + ROAD_HEIGHT;
    center.y = sample.point.y + ROAD_HEIGHT + 0.07;
    right.y = sample.point.y + ROAD_HEIGHT;
    positions.push(...xyz(left), ...xyz(center), ...xyz(right));
    const variation = THREE.MathUtils.clamp(
      0.42 + Math.sin(index * 0.071) * 0.1 + Math.sin(index * 0.313 + 1.7) * 0.045,
      0.16,
      0.7
    );
    const color = INK_ROAD.clone().lerp(ROAD_LIFT, variation);
    for (let vertex = 0; vertex < 3; vertex += 1) colors.push(color.r, color.g, color.b);
  }

  for (let index = 0; index < samples.length; index += 1) {
    const a = index * 3;
    const next = a + 3;
    indices.push(
      a, next, a + 1,
      a + 1, next, next + 1,
      a + 1, next + 1, a + 2,
      a + 2, next + 1, next + 2
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, side: THREE.DoubleSide })
  );
  road.name = 'World Playground V2 grounded crowned road r3';
  road.receiveShadow = true;
  return road;
}

function makeShoulders(samples) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 shoulders r3';
  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const innerA = side * (current.roadWidth / 2 + 0.5);
      const outerA = side * (current.roadWidth / 2 + SHOULDER_WIDTH);
      const innerB = side * (next.roadWidth / 2 + 0.5);
      const outerB = side * (next.roadWidth / 2 + SHOULDER_WIDTH);
      const a = offsetPoint(current, innerA, ROAD_HEIGHT - 0.01);
      const b = offsetPoint(current, outerA, ROAD_HEIGHT - 0.12);
      const c = offsetPoint(next, innerB, ROAD_HEIGHT - 0.01);
      const d = offsetPoint(next, outerB, ROAD_HEIGHT - 0.12);
      positions.push(...xyz(a), ...xyz(c), ...xyz(b), ...xyz(b), ...xyz(c), ...xyz(d));
      const innerColor = shoulderColor(current.district, true);
      const outerColor = shoulderColor(current.district, false);
      for (const color of [innerColor, innerColor, outerColor, outerColor, innerColor, outerColor]) {
        colors.push(color.r, color.g, color.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function makeCurbs(samples) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 low curbs r3';
  const material = new THREE.MeshStandardMaterial({ color: 0xc6c1b3, roughness: 0.94, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const positions = [];
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const a = offsetPoint(current, side * (current.roadWidth / 2 - 0.03), CURB_HEIGHT);
      const b = offsetPoint(current, side * (current.roadWidth / 2 + 0.64), CURB_HEIGHT);
      const c = offsetPoint(next, side * (next.roadWidth / 2 - 0.03), CURB_HEIGHT);
      const d = offsetPoint(next, side * (next.roadWidth / 2 + 0.64), CURB_HEIGHT);
      positions.push(...xyz(a), ...xyz(c), ...xyz(b), ...xyz(b), ...xyz(c), ...xyz(d));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function makeRoadMarkings(samples) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 road markings r3';
  const material = new THREE.MeshStandardMaterial({ color: ROAD_MARKING, roughness: 0.84 });
  const edgeStep = 5;
  const dashStep = 13;
  const edgeMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.025, 5.5), material, Math.ceil(samples.length / edgeStep) * 2
  );
  const dashMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.23, 0.03, 5.1), material, Math.ceil(samples.length / dashStep)
  );
  const marker = new THREE.Object3D();
  let edgeCursor = 0;
  let dashCursor = 0;

  for (let index = 0; index < samples.length; index += edgeStep) {
    const sample = samples[index];
    for (const side of [-1, 1]) {
      marker.position.copy(sample.point).addScaledVector(sample.normal, side * (sample.roadWidth / 2 - 0.96));
      marker.position.y += ROAD_HEIGHT + 0.05;
      marker.rotation.set(sample.pitch, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
      marker.scale.set(1, 1, 1);
      marker.updateMatrix();
      edgeMesh.setMatrixAt(edgeCursor++, marker.matrix);
    }
  }
  for (let index = 0; index < samples.length; index += dashStep) {
    const sample = samples[index];
    marker.position.copy(sample.point);
    marker.position.y += ROAD_HEIGHT + 0.115;
    marker.rotation.set(sample.pitch, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    dashMesh.setMatrixAt(dashCursor++, marker.matrix);
  }
  edgeMesh.count = edgeCursor;
  dashMesh.count = dashCursor;
  edgeMesh.instanceMatrix.needsUpdate = true;
  dashMesh.instanceMatrix.needsUpdate = true;
  group.add(edgeMesh, dashMesh);
  return group;
}

function makeCliffsideGuardrail(samples) {
  const cliffSamples = samples.filter((sample, index) => sample.district === 'cliffside' && index % 4 === 0);
  const group = new THREE.Group();
  group.name = 'World Playground V2 CLIFFSIDE coastal guardrail r3';
  if (!cliffSamples.length) return group;
  const material = new THREE.MeshStandardMaterial({ color: 0xdfe5e7, roughness: 0.54, metalness: 0.36 });
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1.75, 0.3), material, cliffSamples.length);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.3, 1), material, cliffSamples.length * 2);
  const marker = new THREE.Object3D();
  let railCursor = 0;

  cliffSamples.forEach((sample, cursor) => {
    const side = coastalSide(sample, sample.roadWidth / 2 + SHOULDER_WIDTH + 1.4);
    const position = sample.point.clone().addScaledVector(sample.normal, side * (sample.roadWidth / 2 + SHOULDER_WIDTH + 1.3));
    position.y += 0.88;
    marker.position.copy(position);
    marker.rotation.set(0, 0, 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    posts.setMatrixAt(cursor, marker.matrix);

    for (const railHeight of [0.25, 0.82]) {
      marker.position.copy(position);
      marker.position.y += railHeight;
      marker.rotation.set(sample.pitch, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
      marker.scale.set(1, 1, 13.5);
      marker.updateMatrix();
      rails.setMatrixAt(railCursor++, marker.matrix);
    }
  });
  posts.instanceMatrix.needsUpdate = true;
  rails.count = railCursor;
  rails.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  rails.castShadow = true;
  group.add(posts, rails);
  return group;
}

function makeSea() {
  const { minX, maxX, minZ, maxZ } = WORLD_PLAYGROUND_V2_BOUNDS;
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry((maxX - minX) * 1.78, (maxZ - minZ) * 1.76),
    new THREE.MeshStandardMaterial({ color: OCEAN, roughness: 0.32, metalness: 0.04 })
  );
  sea.name = 'World Playground V2 western sea r3';
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((minX + maxX) / 2 - 410, WORLD_PLAYGROUND_V2_SEA_LEVEL, (minZ + maxZ) / 2 + 145);
  sea.receiveShadow = true;
  return sea;
}

function makeCoastFoam() {
  const positions = [];
  const zMin = -820;
  const zMax = 760;
  const steps = 240;
  for (let index = 0; index < steps; index += 1) {
    const z0 = THREE.MathUtils.lerp(zMin, zMax, index / steps);
    const z1 = THREE.MathUtils.lerp(zMin, zMax, (index + 1) / steps);
    const x0 = worldPlaygroundV2CoastX(z0);
    const x1 = worldPlaygroundV2CoastX(z1);
    const width = z0 < 150 ? 4.2 : 7.5;
    positions.push(
      x0, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.08, z0,
      x1, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.08, z1,
      x0 - width, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.09, z0,
      x0 - width, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.09, z0,
      x1, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.08, z1,
      x1 - width, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.09, z1
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const foam = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: FOAM, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide })
  );
  foam.name = 'World Playground V2 coastal foam line r3';
  return foam;
}

function makeMountainWater(heightAt) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 MOUNTAIN river and waterfall r3';
  const controls = WORLD_PLAYGROUND_V2_RIVER.map(([x, _y, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.78, z));
  const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal', 0.5);
  const count = 150;
  const width = 7.2;
  const points = [];
  const positions = [];

  for (let index = 0; index <= count; index += 1) {
    const point = curve.getPointAt(index / count);
    point.y = heightAt(point.x, point.z) + 0.78;
    points.push(point);
  }
  for (let index = 0; index < count; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const ta = index ? a.clone().sub(points[index - 1]).normalize() : b.clone().sub(a).normalize();
    const tb = index + 2 < points.length ? points[index + 2].clone().sub(b).normalize() : b.clone().sub(a).normalize();
    const na = new THREE.Vector3(-ta.z, 0, ta.x).normalize();
    const nb = new THREE.Vector3(-tb.z, 0, tb.x).normalize();
    const al = a.clone().addScaledVector(na, width / 2);
    const ar = a.clone().addScaledVector(na, -width / 2);
    const bl = b.clone().addScaledVector(nb, width / 2);
    const br = b.clone().addScaledVector(nb, -width / 2);
    positions.push(...xyz(al), ...xyz(bl), ...xyz(ar), ...xyz(ar), ...xyz(bl), ...xyz(br));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const river = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: RIVER, roughness: 0.25, metalness: 0.03, side: THREE.DoubleSide })
  );
  river.receiveShadow = true;
  group.add(river);

  let fallIndex = 1;
  let fallDrop = 0;
  for (let index = 1; index < points.length; index += 1) {
    const drop = points[index - 1].y - points[index].y;
    if (drop > fallDrop) {
      fallDrop = drop;
      fallIndex = index;
    }
  }
  const top = points[Math.max(0, fallIndex - 1)];
  const bottom = points[fallIndex];
  const height = Math.max(7, top.y - bottom.y + 4.5);
  const waterfall = new THREE.Mesh(
    new THREE.PlaneGeometry(12.5, height),
    new THREE.MeshStandardMaterial({ color: 0x79d1df, roughness: 0.18, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
  );
  waterfall.name = 'World Playground V2 terrain-anchored waterfall r3';
  waterfall.position.set((top.x + bottom.x) / 2, bottom.y + height / 2, (top.z + bottom.z) / 2);
  waterfall.rotation.y = Math.atan2(bottom.x - top.x, bottom.z - top.z);
  group.add(waterfall);
  return group;
}

function makeSky() {
  const geometry = new THREE.SphereGeometry(3500, 32, 18);
  const positions = geometry.getAttribute('position');
  const colors = [];
  const horizon = new THREE.Color(0xb8d9df);
  const zenith = new THREE.Color(0x6ea7c4);
  const lower = new THREE.Color(0xd9d2bd);
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index) / 3500;
    const color = y >= 0
      ? horizon.clone().lerp(zenith, smoothStep(0, 0.78, y))
      : horizon.clone().lerp(lower, smoothStep(0, 0.35, -y));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.name = 'World Playground V2 procedural daylight sky r3';
  sky.frustumCulled = false;
  return sky;
}

function terrainColor(x, y, z) {
  if (y < WORLD_PLAYGROUND_V2_SEA_LEVEL + 1) return PALETTE.seaFloor.clone();
  const variation = 0.5 + 0.5 * Math.sin(x * 0.017 + z * 0.012 + Math.sin(z * 0.004));
  let color = PALETTE.grass.clone().lerp(PALETTE.deepGrass, variation * 0.24);

  if (x < -650 && z < 150) {
    const rock = smoothStep(20, 116, y) * 0.82;
    color = PALETTE.dryGrass.clone().lerp(PALETTE.cliffRock, rock);
  }

  color.lerp(PALETTE.airport, ellipseInfluence(x, z, 930, -55, 410, 330) * 0.42);
  color.lerp(PALETTE.city, ellipseInfluence(x, z, -90, 500, 475, 340) * 0.4);
  color.lerp(PALETTE.harbor, ellipseInfluence(x, z, -650, 405, 335, 275) * 0.36);

  const country = ellipseInfluence(x, z, 590, 300, 575, 445);
  if (country > 0.04) {
    const patch = 0.5 + 0.5 * Math.sin(x * 0.0105 + Math.sin(z * 0.006) * 1.7);
    const countryColor = PALETTE.country.clone().lerp(PALETTE.countryGold, patch * 0.18);
    color.lerp(countryColor, country * 0.38);
  }

  const alpine = smoothStep(88, 170, y);
  color.lerp(PALETTE.alpine.clone().lerp(PALETTE.mountainRock, 0.44), alpine * 0.84);
  color.lerp(PALETTE.snow, smoothStep(186, 248, y) * 0.94);
  return color;
}

function shoulderColor(district, inner) {
  if (district === 'midnight-city' || district === 'airport' || district === 'harbor') {
    return new THREE.Color(inner ? 0xa9a69d : 0x919088);
  }
  if (district === 'cliffside' || district === 'mountain') {
    return new THREE.Color(inner ? 0xa59b86 : 0x8d8671);
  }
  return new THREE.Color(inner ? 0xafa88d : 0x9b967a);
}

function coastalSide(sample, testOffset) {
  const positive = sample.point.clone().addScaledVector(sample.normal, testOffset);
  const negative = sample.point.clone().addScaledVector(sample.normal, -testOffset);
  const positiveDistance = positive.x - worldPlaygroundV2CoastX(positive.z);
  const negativeDistance = negative.x - worldPlaygroundV2CoastX(negative.z);
  return positiveDistance < negativeDistance ? 1 : -1;
}

function nearestDistrict(x, z) {
  let best = 'harbor';
  let bestScore = Infinity;
  for (const [id, district] of Object.entries(WORLD_PLAYGROUND_V2_DISTRICTS)) {
    const [cx, cz] = district.center;
    const score = Math.hypot(x - cx, z - cz) / district.radius;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

function findStartIndex(samples) {
  let best = 0;
  let distance = Infinity;
  const target = new THREE.Vector2(-505, 555);
  samples.forEach((sample, index) => {
    const next = Math.hypot(sample.point.x - target.x, sample.point.z - target.y);
    if (next < distance) {
      distance = next;
      best = index;
    }
  });
  return best;
}

function ellipseInfluence(x, z, cx, cz, rx, rz) {
  return 1 - smoothStep(0.55, 1.08, Math.hypot((x - cx) / rx, (z - cz) / rz));
}

function offsetPoint(sample, offset, lift) {
  const point = sample.point.clone().addScaledVector(sample.normal, offset);
  point.y = sample.point.y + lift;
  return point;
}

function smoothStep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function xyz(point) {
  return [point.x, point.y, point.z];
}
