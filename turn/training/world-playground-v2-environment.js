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

const ASPHALT_DARK = 0x34383d;
const ASPHALT_LIGHT = 0x4b5157;
const ROAD_EDGE = 0xf5f0df;
const CONCRETE = 0xc8c2ae;
const CONCRETE_DARK = 0x8f8b80;
const OCEAN = 0x2d91b2;
const FOAM = 0xcfeef2;
const WATER = 0x3ea6c6;
const ROAD_HEIGHT = 0.18;
const CURB_HEIGHT = 0.23;
const SHOULDER_WIDTH = 4.2;
const TERRAIN_CORRIDOR = 54;
const TERRAIN_GRID_X = 124;
const TERRAIN_GRID_Z = 96;

const COLOR = Object.freeze({
  lowGrass: new THREE.Color(0x718f61),
  lushGrass: new THREE.Color(0x5f8b5d),
  countryGreen: new THREE.Color(0x83a85e),
  countryGold: new THREE.Color(0xb7a65a),
  cityGround: new THREE.Color(0x667563),
  airportGround: new THREE.Color(0x7e9367),
  harborGround: new THREE.Color(0x8e8c68),
  dryGrass: new THREE.Color(0xaaa56b),
  cliffRock: new THREE.Color(0x756b60),
  mountainRock: new THREE.Color(0x68645f),
  alpineGrass: new THREE.Color(0x60765d),
  snow: new THREE.Color(0xe4e7e4),
  seaFloor: new THREE.Color(0x315f67)
});

export function buildWorldPlaygroundV2Environment(trackWidth = WORLD_PLAYGROUND_V2_ROAD_WIDTH) {
  const samples = sampleRoute();
  const routeGuide = samples.filter((_, index) => index % 4 === 0);
  const terrainHeight = (x, z) => gradedTerrainHeight(x, z, routeGuide);
  const world = new THREE.Group();
  world.name = 'TURN World Playground V2 environment';
  world.userData.turnWorldPlayground = 'v2-environment-r1';
  world.userData.environmentOnly = true;
  world.userData.assetsInstalled = false;
  world.userData.signsInstalled = false;
  world.userData.singleContinuousLoop = true;
  world.userData.noLapVoid = true;
  world.userData.roadGrounded = true;
  world.userData.mapScale = '5.8-km-loop';

  world.add(makeSkyDome());
  world.add(makeSea());
  world.add(makeShoreFoam());
  world.add(makeTerrain(terrainHeight));
  world.add(makeRoadBed(samples, terrainHeight, trackWidth));
  world.add(makeRoad(samples, trackWidth));
  world.add(makeShoulders(samples, trackWidth));
  world.add(makeCurbs(samples, trackWidth));
  world.add(makeRoadMarkings(samples, trackWidth));
  world.add(makeCliffsideGuardrail(samples, trackWidth));
  world.add(makeMountainRiver());

  return Object.freeze({
    trackId: WORLD_PLAYGROUND_V2_TRACK_ID,
    samples,
    world,
    boundary: WORLD_PLAYGROUND_V2_BOUNDARY,
    startIndex: findStartIndex(samples),
    trackWidth,
    approximateLength: samples.at(-1)?.distance || 0,
    terrainHeight
  });
}

export function disposeWorldPlaygroundV2Environment(world) {
  if (!world) return;
  world.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((entry) => entry?.dispose?.());
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
    samples.push(Object.freeze({
      point,
      tangent,
      normal,
      distance,
      progress,
      pitch: Math.atan2(tangent.y, flatLength),
      district: nearestDistrict(point.x, point.z)
    }));
  }

  const seam = samples[0].point.distanceTo(samples.at(-1).point);
  const total = distance + seam;
  return samples.map((sample) => Object.freeze({ ...sample, lapLength: total }));
}

function makeTerrain(heightAt) {
  const { minX, maxX, minZ, maxZ } = WORLD_PLAYGROUND_V2_BOUNDS;
  const positions = [];
  const colors = [];
  const indices = [];
  const columns = TERRAIN_GRID_X + 1;

  for (let iz = 0; iz <= TERRAIN_GRID_Z; iz += 1) {
    const tz = iz / TERRAIN_GRID_Z;
    const z = THREE.MathUtils.lerp(minZ, maxZ, tz);
    for (let ix = 0; ix <= TERRAIN_GRID_X; ix += 1) {
      const tx = ix / TERRAIN_GRID_X;
      const x = THREE.MathUtils.lerp(minX, maxX, tx);
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
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
  terrain.name = 'World Playground V2 continuous sculpted terrain';
  terrain.receiveShadow = true;
  return terrain;
}

function makeRoadBed(samples, heightAt, trackWidth) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 road-integrated terrain bed';
  const half = trackWidth / 2;
  const offsets = [-(half + 34), -(half + 19), -(half + 8.5), -(half + 4.2), half + 4.2, half + 8.5, half + 19, half + 34];
  const positions = [];
  const colors = [];
  const indices = [];
  const rowWidth = offsets.length;

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    offsets.forEach((offset, profileIndex) => {
      const point = sample.point.clone().addScaledVector(sample.normal, offset);
      const terrainY = heightAt(point.x, point.z);
      const abs = Math.abs(offset);
      const roadTarget = sample.point.y - (abs <= half + 4.2 ? 0.34 : 0.8);
      const blend = 1 - smoothStep(half + 8, half + 34, abs);
      point.y = THREE.MathUtils.lerp(terrainY + 0.04, roadTarget, blend);
      positions.push(point.x, point.y, point.z);
      const base = terrainColor(point.x, point.y, point.z);
      const shoulderTint = new THREE.Color(CONCRETE_DARK);
      const tint = smoothStep(half + 7, half + 1.5, abs) * 0.14;
      const color = base.clone().lerp(shoulderTint, tint);
      colors.push(color.r, color.g, color.b);
    });
  }

  for (let index = 0; index < samples.length; index += 1) {
    const row = index * rowWidth;
    const next = (index + 1) * rowWidth;
    for (let profile = 0; profile < rowWidth - 1; profile += 1) {
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
  const bed = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })
  );
  bed.receiveShadow = true;
  group.add(bed);
  return group;
}

function makeRoad(samples, trackWidth) {
  const positions = [];
  const colors = [];
  const indices = [];
  const dark = new THREE.Color(ASPHALT_DARK);
  const light = new THREE.Color(ASPHALT_LIGHT);

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2);
    left.y = sample.point.y + ROAD_HEIGHT;
    right.y = sample.point.y + ROAD_HEIGHT;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    const noise = THREE.MathUtils.clamp(
      0.43 + Math.sin(index * 0.071) * 0.11 + Math.sin(index * 0.313 + 1.7) * 0.045,
      0.18,
      0.72
    );
    const color = dark.clone().lerp(light, noise);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  for (let index = 0; index < samples.length; index += 1) {
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
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 })
  );
  road.name = 'World Playground V2 grounded continuous road';
  road.receiveShadow = true;
  return road;
}

function makeShoulders(samples, trackWidth) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 shoulders';
  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];
    const innerOffset = side * (trackWidth / 2 + 0.55);
    const outerOffset = side * (trackWidth / 2 + SHOULDER_WIDTH);

    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const points = [
        offsetPoint(current, innerOffset, ROAD_HEIGHT + 0.005),
        offsetPoint(current, outerOffset, ROAD_HEIGHT - 0.11),
        offsetPoint(next, innerOffset, ROAD_HEIGHT + 0.005),
        offsetPoint(next, outerOffset, ROAD_HEIGHT - 0.11)
      ];
      positions.push(
        ...xyz(points[0]), ...xyz(points[2]), ...xyz(points[1]),
        ...xyz(points[1]), ...xyz(points[2]), ...xyz(points[3])
      );
      const inner = shoulderColor(current.district, true);
      const outer = shoulderColor(current.district, false);
      for (const color of [inner, inner, outer, outer, inner, outer]) colors.push(color.r, color.g, color.b);
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
  group.name = 'World Playground V2 low concrete curbs';
  const width = 0.72;
  const material = standardMaterial(CONCRETE, 0.92);

  for (const side of [-1, 1]) {
    const positions = [];
    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const inner = side * (trackWidth / 2 - 0.05);
      const outer = side * (trackWidth / 2 + width);
      const a = offsetPoint(current, inner, CURB_HEIGHT);
      const b = offsetPoint(current, outer, CURB_HEIGHT);
      const c = offsetPoint(next, inner, CURB_HEIGHT);
      const d = offsetPoint(next, outer, CURB_HEIGHT);
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

function makeRoadMarkings(samples, trackWidth) {
  const group = new THREE.Group();
  group.name = 'World Playground V2 restrained road markings';
  const lineMaterial = standardMaterial(ROAD_EDGE, 0.82);
  const edgeGeometry = new THREE.BoxGeometry(0.18, 0.035, 5.8);
  const dashGeometry = new THREE.BoxGeometry(0.28, 0.045, 5.6);
  const edgeStep = 5;
  const dashStep = 12;
  const edgeCount = Math.ceil(samples.length / edgeStep) * 2;
  const dashCount = Math.ceil(samples.length / dashStep);
  const edges = new THREE.InstancedMesh(edgeGeometry, lineMaterial, edgeCount);
  const dashes = new THREE.InstancedMesh(dashGeometry, lineMaterial, dashCount);
  const marker = new THREE.Object3D();
  let edgeCursor = 0;
  let dashCursor = 0;

  for (let index = 0; index < samples.length; index += edgeStep) {
    const sample = samples[index];
    for (const side of [-1, 1]) {
      marker.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 - 1.05));
      marker.position.y += ROAD_HEIGHT + 0.055;
      marker.rotation.set(sample.pitch, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
      marker.updateMatrix();
      edges.setMatrixAt(edgeCursor, marker.matrix);
      edgeCursor += 1;
    }
  }

  for (let index = 0; index < samples.length; index += dashStep) {
    const sample = samples[index];
    marker.position.copy(sample.point);
    marker.position.y += ROAD_HEIGHT + 0.065;
    marker.rotation.set(sample.pitch, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    dashes.setMatrixAt(dashCursor, marker.matrix);
    dashCursor += 1;
  }
  edges.count = edgeCursor;
  dashes.count = dashCursor;
  edges.instanceMatrix.needsUpdate = true;
  dashes.instanceMatrix.needsUpdate = true;
  edges.receiveShadow = true;
  dashes.receiveShadow = true;
  group.add(edges, dashes);
  return group;
}

function makeCliffsideGuardrail(samples, trackWidth) {
  const cliffSamples = samples.filter((sample, index) => sample.district === 'cliffside' && index % 5 === 0);
  const group = new THREE.Group();
  group.name = 'World Playground V2 Cliffside coastal guardrail';
  if (!cliffSamples.length) return group;

  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.58, metalness: 0.34 });
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1.75, 0.28), metal, cliffSamples.length);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.32, 1), metal, cliffSamples.length);
  const marker = new THREE.Object3D();

  cliffSamples.forEach((sample, cursor) => {
    const side = coastalSide(sample, trackWidth / 2 + SHOULDER_WIDTH + 1.6);
    const offset = side * (trackWidth / 2 + SHOULDER_WIDTH + 1.45);
    const position = sample.point.clone().addScaledVector(sample.normal, offset);
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
    new THREE.PlaneGeometry((maxX - minX) * 1.7, (maxZ - minZ) * 1.65, 1, 1),
    new THREE.MeshStandardMaterial({ color: OCEAN, roughness: 0.36, metalness: 0.04 })
  );
  sea.name = 'World Playground V2 western and southern sea';
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((minX + maxX) / 2 - 350, WORLD_PLAYGROUND_V2_SEA_LEVEL, (minZ + maxZ) / 2 + 140);
  sea.receiveShadow = true;
  return sea;
}

function makeShoreFoam() {
  const group = new THREE.Group();
  group.name = 'World Playground V2 coastal waterline';
  const positions = [];
  const zMin = -820;
  const zMax = 760;
  const steps = 180;
  for (let index = 0; index < steps; index += 1) {
    const z0 = THREE.MathUtils.lerp(zMin, zMax, index / steps);
    const z1 = THREE.MathUtils.lerp(zMin, zMax, (index + 1) / steps);
    const x0 = worldPlaygroundV2CoastX(z0);
    const x1 = worldPlaygroundV2CoastX(z1);
    const width = z0 < 120 ? 4.5 : 7;
    positions.push(
      x0, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.12, z0,
      x1, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.12, z1,
      x0 - width, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.13, z0,
      x0 - width, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.13, z0,
      x1, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.12, z1,
      x1 - width, WORLD_PLAYGROUND_V2_SEA_LEVEL + 0.13, z1
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const foam = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: FOAM, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide })
  );
  group.add(foam);
  return group;
}

function makeMountainRiver() {
  const group = new THREE.Group();
  group.name = 'World Playground V2 mountain river and waterfall';
  const points = WORLD_PLAYGROUND_V2_RIVER.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const samples = 110;
  const positions = [];
  const width = 7.5;

  for (let index = 0; index < samples; index += 1) {
    const t0 = index / samples;
    const t1 = (index + 1) / samples;
    const a = curve.getPointAt(t0);
    const b = curve.getPointAt(t1);
    const ta = curve.getTangentAt(t0).normalize();
    const tb = curve.getTangentAt(t1).normalize();
    const na = new THREE.Vector3(-ta.z, 0, ta.x).normalize();
    const nb = new THREE.Vector3(-tb.z, 0, tb.x).normalize();
    const al = a.clone().addScaledVector(na, width / 2);
    const ar = a.clone().addScaledVector(na, -width / 2);
    const bl = b.clone().addScaledVector(nb, width / 2);
    const br = b.clone().addScaledVector(nb, -width / 2);
    al.y += 0.32; ar.y += 0.32; bl.y += 0.32; br.y += 0.32;
    positions.push(...xyz(al), ...xyz(bl), ...xyz(ar), ...xyz(ar), ...xyz(bl), ...xyz(br));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const river = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: WATER, roughness: 0.28, metalness: 0.03, side: THREE.DoubleSide })
  );
  river.receiveShadow = true;
  group.add(river);

  const waterfall = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 34),
    new THREE.MeshStandardMaterial({ color: 0x79d0df, roughness: 0.2, transparent: true, opacity: 0.86, side: THREE.DoubleSide })
  );
  waterfall.name = 'World Playground V2 waterfall sheet';
  waterfall.position.set(85, 74, -500);
  waterfall.rotation.y = -0.58;
  waterfall.rotation.x = -0.03;
  group.add(waterfall);
  return group;
}

function makeSkyDome() {
  const geometry = new THREE.SphereGeometry(3200, 28, 16);
  const position = geometry.getAttribute('position');
  const colors = [];
  const horizon = new THREE.Color(0xb9d9df);
  const zenith = new THREE.Color(0x6fa8c5);
  const lower = new THREE.Color(0xd9d0ba);
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index) / 3200;
    const color = y >= 0
      ? horizon.clone().lerp(zenith, smoothStep(0, 0.75, y))
      : horizon.clone().lerp(lower, smoothStep(0, 0.35, -y));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.name = 'World Playground V2 procedural sky';
  sky.frustumCulled = false;
  return sky;
}

function gradedTerrainHeight(x, z, guide) {
  let base = worldPlaygroundV2BaseHeight(x, z);
  let bestDistance2 = Infinity;
  let roadY = base;
  for (const sample of guide) {
    const dx = x - sample.point.x;
    const dz = z - sample.point.z;
    const distance2 = dx * dx + dz * dz;
    if (distance2 >= bestDistance2) continue;
    bestDistance2 = distance2;
    roadY = sample.point.y;
  }
  const distance = Math.sqrt(bestDistance2);
  if (distance < TERRAIN_CORRIDOR) {
    const influence = 1 - smoothStep(20, TERRAIN_CORRIDOR, distance);
    const target = roadY - 0.62 - smoothStep(20, TERRAIN_CORRIDOR, distance) * 1.2;
    base = THREE.MathUtils.lerp(base, target, influence);
  }
  return base;
}

function terrainColor(x, y, z) {
  if (y < WORLD_PLAYGROUND_V2_SEA_LEVEL + 1) return COLOR.seaFloor.clone();
  if (y > 176) return COLOR.snow.clone().lerp(COLOR.mountainRock, smoothStep(230, 180, y) * 0.28);
  if (y > 112) return COLOR.mountainRock.clone().lerp(COLOR.alpineGrass, smoothStep(112, 165, y) * 0.32);

  const cliff = x < -650 && z < 140;
  if (cliff) {
    const rockMix = smoothStep(18, 82, y);
    return COLOR.dryGrass.clone().lerp(COLOR.cliffRock, rockMix);
  }

  const airport = ellipseInfluence(x, z, 930, -55, 390, 320);
  if (airport > 0.18) return COLOR.lowGrass.clone().lerp(COLOR.airportGround, airport * 0.7);

  const city = ellipseInfluence(x, z, -90, 500, 455, 320);
  if (city > 0.15) return COLOR.lowGrass.clone().lerp(COLOR.cityGround, city * 0.72);

  const harbor = ellipseInfluence(x, z, -650, 405, 315, 255);
  if (harbor > 0.16) return COLOR.lowGrass.clone().lerp(COLOR.harborGround, harbor * 0.64);

  const country = ellipseInfluence(x, z, 590, 300, 560, 430);
  if (country > 0.12) {
    const patch = 0.5 + 0.5 * Math.sin(Math.floor(x / 95) * 1.7 + Math.floor(z / 80) * 2.3);
    return COLOR.countryGreen.clone().lerp(COLOR.countryGold, patch * 0.3 * country);
  }

  const variation = 0.5 + 0.5 * Math.sin(x * 0.019 + z * 0.013);
  return COLOR.lowGrass.clone().lerp(COLOR.lushGrass, variation * 0.34);
}

function shoulderColor(district, inner) {
  if (district === 'midnight-city' || district === 'airport' || district === 'harbor') {
    return new THREE.Color(inner ? 0xaaa79e : 0x8f9088);
  }
  if (district === 'cliffside' || district === 'mountain') {
    return new THREE.Color(inner ? 0xa79d88 : 0x8e876f);
  }
  return new THREE.Color(inner ? 0xb6ae91 : 0x9f9a78);
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
    const value = Math.hypot(sample.point.x - target.x, sample.point.z - target.y);
    if (value < distance) {
      distance = value;
      best = index;
    }
  });
  return best;
}

function offsetPoint(sample, offset, lift) {
  const point = sample.point.clone().addScaledVector(sample.normal, offset);
  point.y = sample.point.y + lift;
  return point;
}

function standardMaterial(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide });
}

function ellipseInfluence(x, z, cx, cz, rx, rz) {
  const nx = (x - cx) / rx;
  const nz = (z - cz) / rz;
  const d = Math.sqrt(nx * nx + nz * nz);
  return 1 - smoothStep(0.55, 1.08, d);
}

function smoothStep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function xyz(point) {
  return [point.x, point.y, point.z];
}
