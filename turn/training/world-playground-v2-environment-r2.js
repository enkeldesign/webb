import * as THREE from 'three';
import {
  WORLD_PLAYGROUND_V2_BOUNDS,
  WORLD_PLAYGROUND_V2_BOUNDARY,
  WORLD_PLAYGROUND_V2_DISTRICTS,
  WORLD_PLAYGROUND_V2_RIVER,
  WORLD_PLAYGROUND_V2_ROAD_WIDTH,
  WORLD_PLAYGROUND_V2_ROUTE,
  WORLD_PLAYGROUND_V2_SAMPLE_COUNT,
  WORLD_PLAYGROUND_V2_SEA_LEVEL,
  WORLD_PLAYGROUND_V2_TRACK_ID,
  worldPlaygroundV2BaseHeight,
  worldPlaygroundV2CoastX
} from './world-playground-v2-map.js?revision=r1-environment';

const ROAD_HEIGHT = 0.18;
const CURB_HEIGHT = 0.23;
const SHOULDER_WIDTH = 4.25;
const TERRAIN_GRID_X = 236;
const TERRAIN_GRID_Z = 180;
const TERRAIN_CORRIDOR = 210;
const ASPHALT_DARK = new THREE.Color(0x34383d);
const ASPHALT_LIGHT = new THREE.Color(0x4a5056);
const EDGE = 0xf3efe1;
const OCEAN = 0x2d91b2;
const WATER = 0x3ea6c6;
const FOAM = 0xd6f2f2;

const PALETTE = Object.freeze({
  grass: new THREE.Color(0x718f61),
  grassDark: new THREE.Color(0x5f805a),
  dryGrass: new THREE.Color(0xa7a36b),
  rock: new THREE.Color(0x756b60),
  rockDark: new THREE.Color(0x625a53),
  alpine: new THREE.Color(0x63755d),
  snow: new THREE.Color(0xe5e8e5),
  country: new THREE.Color(0x84a85f),
  countryGold: new THREE.Color(0xb8aa66),
  airport: new THREE.Color(0x82946d),
  city: new THREE.Color(0x6b7667),
  harbor: new THREE.Color(0x85826d),
  seaFloor: new THREE.Color(0x315f67)
});

export function buildWorldPlaygroundV2Environment(trackWidth = WORLD_PLAYGROUND_V2_ROAD_WIDTH) {
  const samples = sampleRoute();
  const terrainHeight = createTerrainSampler(samples);
  const world = new THREE.Group();
  world.name = 'TURN World Playground V2 environment r2';
  Object.assign(world.userData, {
    turnWorldPlayground: 'v2-environment-r2',
    environmentOnly: true,
    assetsInstalled: false,
    signsInstalled: false,
    singleContinuousLoop: true,
    noLapVoid: true,
    roadGrounded: true,
    terrainResolution: `${TERRAIN_GRID_X}x${TERRAIN_GRID_Z}`,
    mapScale: '5.8-km-loop'
  });

  world.add(makeSky());
  world.add(makeSea());
  world.add(makeTerrain(terrainHeight));
  world.add(makeCoast(terrainHeight));
  world.add(makeRoadEarthworks(samples, terrainHeight, trackWidth));
  world.add(makeRoad(samples, trackWidth));
  world.add(makeShoulders(samples, trackWidth));
  world.add(makeCurbs(samples, trackWidth));
  world.add(makeMarkings(samples, trackWidth));
  world.add(makeCliffsideGuardrail(samples, trackWidth));
  world.add(makeMountainWater(terrainHeight));

  return Object.freeze({
    trackId: WORLD_PLAYGROUND_V2_TRACK_ID,
    samples,
    world,
    boundary: WORLD_PLAYGROUND_V2_BOUNDARY,
    startIndex: findStartIndex(samples),
    trackWidth,
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
  const samples = [];
  let distance = 0;

  for (let index = 0; index < WORLD_PLAYGROUND_V2_SAMPLE_COUNT; index += 1) {
    const progress = index / WORLD_PLAYGROUND_V2_SAMPLE_COUNT;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).normalize();
    const flatLength = Math.hypot(tangent.x, tangent.z) || 1;
    const normal = new THREE.Vector3(-tangent.z / flatLength, 0, tangent.x / flatLength);
    if (index) distance += point.distanceTo(samples[index - 1].point);
    samples.push({
      point,
      tangent,
      normal,
      progress,
      distance,
      pitch: Math.atan2(tangent.y, flatLength),
      district: nearestDistrict(point.x, point.z)
    });
  }
  const total = distance + samples[0].point.distanceTo(samples.at(-1).point);
  return samples.map((sample) => Object.freeze({ ...sample, lapLength: total }));
}

function createTerrainSampler(samples) {
  const guide = samples.filter((_, index) => index % 3 === 0);
  return (x, z) => {
    const base = worldPlaygroundV2BaseHeight(x, z);
    let nearestDistance2 = Infinity;
    let roadY = base;

    for (const sample of guide) {
      const dx = x - sample.point.x;
      const dz = z - sample.point.z;
      const distance2 = dx * dx + dz * dz;
      if (distance2 >= nearestDistance2) continue;
      nearestDistance2 = distance2;
      roadY = sample.point.y;
    }

    const distance = Math.sqrt(nearestDistance2);
    if (distance >= TERRAIN_CORRIDOR) return base;

    // A broad cut/fill corridor gives the road a believable landform before the
    // road mesh is drawn. Within roughly two road widths the land follows the
    // carriageway; the following ~150 m eases back into the authored geography.
    const transition = smoothStep(32, TERRAIN_CORRIDOR, distance);
    const target = roadY - 0.72 - transition * 7.5;
    const influence = 1 - smoothStep(54, TERRAIN_CORRIDOR, distance);
    return THREE.MathUtils.lerp(base, target, influence);
  };
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
  terrain.name = 'World Playground V2 continuous sculpted terrain r2';
  terrain.receiveShadow = true;
  return terrain;
}

function makeRoadEarthworks(samples, heightAt, trackWidth) {
  const half = trackWidth / 2;
  const profiles = [
    -(half + 118), -(half + 72), -(half + 38), -(half + 17), -(half + 4.3),
    half + 4.3, half + 17, half + 38, half + 72, half + 118
  ];
  const positions = [];
  const colors = [];
  const indices = [];
  const width = profiles.length;

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    for (const offset of profiles) {
      const point = sample.point.clone().addScaledVector(sample.normal, offset);
      const abs = Math.abs(offset);
      const transition = smoothStep(half + 13, half + 118, abs);
      const terrainY = heightAt(point.x, point.z);
      const roadShelf = sample.point.y - 0.42 - transition * 6.3;
      const blend = 1 - smoothStep(half + 18, half + 118, abs);
      point.y = THREE.MathUtils.lerp(terrainY + 0.055, roadShelf, blend);
      positions.push(point.x, point.y, point.z);
      const color = terrainColor(point.x, point.y, point.z)
        .lerp(new THREE.Color(0x8e8978), (1 - transition) * 0.08);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    const row = index * width;
    const next = (index + 1) * width;
    for (let profile = 0; profile < width - 1; profile += 1) {
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
  const earthworks = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })
  );
  earthworks.name = 'World Playground V2 road-integrated terrain earthworks r2';
  earthworks.receiveShadow = true;
  return earthworks;
}

function makeRoad(samples, trackWidth) {
  const positions = [];
  const colors = [];
  const indices = [];

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2);
    left.y = sample.point.y + ROAD_HEIGHT;
    right.y = sample.point.y + ROAD_HEIGHT;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    const variation = THREE.MathUtils.clamp(
      0.42 + Math.sin(index * 0.071) * 0.1 + Math.sin(index * 0.313 + 1.7) * 0.045,
      0.16,
      0.7
    );
    const color = ASPHALT_DARK.clone().lerp(ASPHALT_LIGHT, variation);
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
  const road = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, side: THREE.DoubleSide })
  );
  road.name = 'World Playground V2 grounded continuous road r2';
  road.receiveShadow = true;
  return road;
}

function makeShoulders(samples, trackWidth) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 integrated shoulders r2';
  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];
    const inner = side * (trackWidth / 2 + 0.55);
    const outer = side * (trackWidth / 2 + SHOULDER_WIDTH);
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const a = offsetPoint(current, inner, ROAD_HEIGHT + 0.005);
      const b = offsetPoint(current, outer, ROAD_HEIGHT - 0.09);
      const c = offsetPoint(next, inner, ROAD_HEIGHT + 0.005);
      const d = offsetPoint(next, outer, ROAD_HEIGHT - 0.09);
      positions.push(...xyz(a), ...xyz(c), ...xyz(b), ...xyz(b), ...xyz(c), ...xyz(d));
      const inside = shoulderColor(current.district, true);
      const outside = shoulderColor(current.district, false);
      for (const color of [inside, inside, outside, outside, inside, outside]) colors.push(color.r, color.g, color.b);
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
    group.add(shoulder);
  }
  return group;
}

function makeCurbs(samples, trackWidth) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 restrained curbs r2';
  const material = new THREE.MeshStandardMaterial({ color: 0xc9c4b5, roughness: 0.94, side: THREE.DoubleSide });
  const width = 0.7;
  for (const side of [-1, 1]) {
    const positions = [];
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const a = offsetPoint(current, side * (trackWidth / 2 - 0.04), CURB_HEIGHT);
      const b = offsetPoint(current, side * (trackWidth / 2 + width), CURB_HEIGHT);
      const c = offsetPoint(next, side * (trackWidth / 2 - 0.04), CURB_HEIGHT);
      const d = offsetPoint(next, side * (trackWidth / 2 + width), CURB_HEIGHT);
      positions.push(...xyz(a), ...xyz(c), ...xyz(b), ...xyz(b), ...xyz(c), ...xyz(d));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const curb = new THREE.Mesh(geometry, material);
    curb.receiveShadow = true;
    group.add(curb);
  }
  return group;
}

function makeMarkings(samples, trackWidth) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 road markings r2';
  const material = new THREE.MeshStandardMaterial({ color: EDGE, roughness: 0.86 });
  const edgeStep = 5;
  const dashStep = 13;
  const edgeMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.17, 0.028, 5.8),
    material,
    Math.ceil(samples.length / edgeStep) * 2
  );
  const dashMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.24, 0.034, 5.4),
    material,
    Math.ceil(samples.length / dashStep)
  );
  const marker = new THREE.Object3D();
  let edgeCursor = 0;
  let dashCursor = 0;

  for (let index = 0; index < samples.length; index += edgeStep) {
    const sample = samples[index];
    for (const side of [-1, 1]) {
      marker.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 - 1.05));
      marker.position.y += ROAD_HEIGHT + 0.045;
      marker.rotation.set(sample.pitch, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
      marker.scale.set(1, 1, 1);
      marker.updateMatrix();
      edgeMesh.setMatrixAt(edgeCursor++, marker.matrix);
    }
  }
  for (let index = 0; index < samples.length; index += dashStep) {
    const sample = samples[index];
    marker.position.copy(sample.point);
    marker.position.y += ROAD_HEIGHT + 0.05;
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

function makeCliffsideGuardrail(samples, trackWidth) {
  const cliffSamples = samples.filter((sample, index) => sample.district === 'cliffside' && index % 5 === 0);
  const group = new THREE.Group();
  group.name = 'World Playground V2 Cliffside coastal guardrail r2';
  if (!cliffSamples.length) return group;
  const material = new THREE.MeshStandardMaterial({ color: 0xdde2e4, roughness: 0.58, metalness: 0.34 });
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1.75, 0.28), material, cliffSamples.length);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.32, 1), material, cliffSamples.length);
  const marker = new THREE.Object3D();

  cliffSamples.forEach((sample, cursor) => {
    const side = coastalSide(sample, trackWidth / 2 + SHOULDER_WIDTH + 1.6);
    const position = sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + SHOULDER_WIDTH + 1.45));
    position.y += 0.9;
    marker.position.copy(position);
    marker.rotation.set(0, 0, 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    posts.setMatrixAt(cursor, marker.matrix);

    marker.position.y += 0.48;
    marker.rotation.set(sample.pitch, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.scale.set(1, 1, 17.5);
    marker.updateMatrix();
    rails.setMatrixAt(cursor, marker.matrix);
  });
  posts.instanceMatrix.needsUpdate = true;
  rails.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  rails.castShadow = true;
  group.add(posts, rails);
  return group;
}

function makeSea() {
  const { minX, maxX, minZ, maxZ } = WORLD_PLAYGROUND_V2_BOUNDS;
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry((maxX - minX) * 1.75, (maxZ - minZ) * 1.75),
    new THREE.MeshStandardMaterial({ color: OCEAN, roughness: 0.34, metalness: 0.03 })
  );
  sea.name = 'World Playground V2 western sea r2';
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((minX + maxX) / 2 - 390, WORLD_PLAYGROUND_V2_SEA_LEVEL, (minZ + maxZ) / 2 + 130);
  sea.receiveShadow = true;
  return sea;
}

function makeCoast(heightAt) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 coast and Cliffside rock face r2';
  const cliffPositions = [];
  const cliffColors = [];
  const foamPositions = [];
  const zMin = -820;
  const zMax = 760;
  const steps = 240;
  const dark = new THREE.Color(0x625950);
  const light = new THREE.Color(0x927f6b);

  for (let index = 0; index < steps; index += 1) {
    const z0 = THREE.MathUtils.lerp(zMin, zMax, index / steps);
    const z1 = THREE.MathUtils.lerp(zMin, zMax, (index + 1) / steps);
    const x0 = worldPlaygroundV2CoastX(z0);
    const x1 = worldPlaygroundV2CoastX(z1);
    const top0 = Math.max(WORLD_PLAYGROUND_V2_SEA_LEVEL + 2.5, heightAt(x0 + 28, z0) - 0.8);
    const top1 = Math.max(WORLD_PLAYGROUND_V2_SEA_LEVEL + 2.5, heightAt(x1 + 28, z1) - 0.8);
    const rocky = z0 < 145;
    const inset = rocky ? 5 : 2;
    const bottom = WORLD_PLAYGROUND_V2_SEA_LEVEL - 0.25;
    cliffPositions.push(
      x0 + inset, top0, z0,
      x1 + inset, top1, z1,
      x0 - 2.5, bottom, z0,
      x0 - 2.5, bottom, z0,
      x1 + inset, top1, z1,
      x1 - 2.5, bottom, z1
    );
    const color = dark.clone().lerp(light, rocky ? 0.34 + Math.sin(index * 0.27) * 0.08 : 0.55);
    for (let vertex = 0; vertex < 6; vertex += 1) cliffColors.push(color.r, color.g, color.b);

    const foamWidth = rocky ? 4 : 7.5;
    foamPositions.push(
      x0, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.1, z0,
      x1, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.1, z1,
      x0 - foamWidth, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.11, z0,
      x0 - foamWidth, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.11, z0,
      x1, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.1, z1,
      x1 - foamWidth, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.11, z1
    );
  }

  const cliffGeometry = new THREE.BufferGeometry();
  cliffGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cliffPositions, 3));
  cliffGeometry.setAttribute('color', new THREE.Float32BufferAttribute(cliffColors, 3));
  cliffGeometry.computeVertexNormals();
  const cliff = new THREE.Mesh(
    cliffGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })
  );
  cliff.receiveShadow = true;

  const foamGeometry = new THREE.BufferGeometry();
  foamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(foamPositions, 3));
  const foam = new THREE.Mesh(
    foamGeometry,
    new THREE.MeshBasicMaterial({ color: FOAM, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide })
  );
  group.add(cliff, foam);
  return group;
}

function makeMountainWater(heightAt) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 mountain river and waterfall r2';
  const controls = WORLD_PLAYGROUND_V2_RIVER.map(([x, _y, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.72, z));
  const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal', 0.5);
  const count = 140;
  const width = 7.5;
  const positions = [];
  const points = [];

  for (let index = 0; index <= count; index += 1) {
    const t = index / count;
    const point = curve.getPointAt(t);
    point.y = heightAt(point.x, point.z) + 0.72;
    points.push(point);
  }

  for (let index = 0; index < count; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const tangentA = index ? a.clone().sub(points[index - 1]).normalize() : b.clone().sub(a).normalize();
    const tangentB = index + 2 < points.length ? points[index + 2].clone().sub(b).normalize() : b.clone().sub(a).normalize();
    const normalA = new THREE.Vector3(-tangentA.z, 0, tangentA.x).normalize();
    const normalB = new THREE.Vector3(-tangentB.z, 0, tangentB.x).normalize();
    const al = a.clone().addScaledVector(normalA, width / 2);
    const ar = a.clone().addScaledVector(normalA, -width / 2);
    const bl = b.clone().addScaledVector(normalB, width / 2);
    const br = b.clone().addScaledVector(normalB, -width / 2);
    positions.push(...xyz(al), ...xyz(bl), ...xyz(ar), ...xyz(ar), ...xyz(bl), ...xyz(br));
  }
  const riverGeometry = new THREE.BufferGeometry();
  riverGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  riverGeometry.computeVertexNormals();
  const waterMaterial = new THREE.MeshStandardMaterial({ color: WATER, roughness: 0.26, metalness: 0.03, side: THREE.DoubleSide });
  const river = new THREE.Mesh(riverGeometry, waterMaterial);
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
  const height = Math.max(7, top.y - bottom.y + 5);
  const waterfall = new THREE.Mesh(
    new THREE.PlaneGeometry(13, height),
    new THREE.MeshStandardMaterial({ color: 0x78d0df, roughness: 0.18, transparent: true, opacity: 0.84, side: THREE.DoubleSide })
  );
  waterfall.name = 'World Playground V2 terrain-anchored waterfall r2';
  waterfall.position.set((top.x + bottom.x) / 2, bottom.y + height / 2, (top.z + bottom.z) / 2);
  waterfall.rotation.y = Math.atan2(bottom.x - top.x, bottom.z - top.z);
  group.add(waterfall);
  return group;
}

function makeSky() {
  const geometry = new THREE.SphereGeometry(3400, 32, 18);
  const positions = geometry.getAttribute('position');
  const colors = [];
  const horizon = new THREE.Color(0xb9d9df);
  const zenith = new THREE.Color(0x6fa8c5);
  const lower = new THREE.Color(0xd8d2bf);
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index) / 3400;
    const color = y >= 0
      ? horizon.clone().lerp(zenith, smoothStep(0, 0.76, y))
      : horizon.clone().lerp(lower, smoothStep(0, 0.34, -y));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.name = 'World Playground V2 procedural daylight sky r2';
  sky.frustumCulled = false;
  return sky;
}

function terrainColor(x, y, z) {
  if (y < WORLD_PLAYGROUND_V2_SEA_LEVEL + 1) return PALETTE.seaFloor.clone();
  const variation = 0.5 + 0.5 * Math.sin(x * 0.017 + z * 0.012 + Math.sin(z * 0.004));
  let color = PALETTE.grass.clone().lerp(PALETTE.grassDark, variation * 0.24);

  if (x < -650 && z < 150) {
    const rock = smoothStep(22, 115, y) * 0.78;
    color = PALETTE.dryGrass.clone().lerp(PALETTE.rock, rock);
  }

  const airport = ellipseInfluence(x, z, 930, -55, 390, 320);
  color.lerp(PALETTE.airport, airport * 0.56);
  const city = ellipseInfluence(x, z, -90, 500, 455, 320);
  color.lerp(PALETTE.city, city * 0.54);
  const harbor = ellipseInfluence(x, z, -650, 405, 315, 255);
  color.lerp(PALETTE.harbor, harbor * 0.48);

  const country = ellipseInfluence(x, z, 590, 300, 560, 430);
  if (country > 0.04) {
    const patch = 0.5 + 0.5 * Math.sin(x * 0.0105 + Math.sin(z * 0.006) * 1.7);
    const countryColor = PALETTE.country.clone().lerp(PALETTE.countryGold, patch * 0.22);
    color.lerp(countryColor, country * 0.5);
  }

  const alpine = smoothStep(88, 168, y);
  color.lerp(PALETTE.alpine.clone().lerp(PALETTE.rockDark, 0.44), alpine * 0.84);
  const snow = smoothStep(184, 246, y);
  color.lerp(PALETTE.snow, snow * 0.94);
  return color;
}

function shoulderColor(district, inner) {
  if (district === 'midnight-city' || district === 'airport' || district === 'harbor') {
    return new THREE.Color(inner ? 0xaaa79e : 0x929188);
  }
  if (district === 'cliffside' || district === 'mountain') {
    return new THREE.Color(inner ? 0xa79d88 : 0x8f8874);
  }
  return new THREE.Color(inner ? 0xb1aa8f : 0x9d987c);
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
  let score = Infinity;
  for (const [id, district] of Object.entries(WORLD_PLAYGROUND_V2_DISTRICTS)) {
    const [cx, cz] = district.center;
    const next = Math.hypot(x - cx, z - cz) / district.radius;
    if (next < score) {
      score = next;
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
  const nx = (x - cx) / rx;
  const nz = (z - cz) / rz;
  return 1 - smoothStep(0.55, 1.08, Math.hypot(nx, nz));
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
