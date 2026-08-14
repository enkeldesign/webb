import * as THREE from 'three';
import { loadToyCarSupportSource } from './toybox-toy-kit-support.js';

const INK = 0x08090a;
const ROAD = 0x313a62;
const ROAD_LIGHT = 0x46517d;
const RAIL_COLORS = [0xff4fa3, 0xffd43b, 0x38d9ff];
const SUPPORT_COLORS = [0xffd43b, 0xff922b, 0xff4fa3, 0x38d9ff];

function sampleIndex(samples, index) {
  return ((index % samples.length) + samples.length) % samples.length;
}

function yawFor(sample) {
  return Math.atan2(sample.tangent.x, sample.tangent.z);
}

function addToyFloor(world) {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(540, 96),
    new THREE.MeshStandardMaterial({ color: 0xa8df8f, roughness: 1, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.34;
  floor.receiveShadow = true;
  floor.userData.turnOutlined = true;
  world.add(floor);

  const tileColors = [0x8ed8ff, 0xffd9e8, 0xffe99b, 0xc9b8ff, 0xb7efc5];
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2 + 0.18;
    const radius = 255 + (index % 3) * 58;
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(54, 0.16, 54),
      new THREE.MeshStandardMaterial({ color: tileColors[index % tileColors.length], roughness: 1 })
    );
    tile.position.set(Math.cos(angle) * radius, -0.24, Math.sin(angle) * radius);
    tile.rotation.y = angle * 0.63;
    tile.receiveShadow = true;
    tile.userData.turnOutlined = true;
    world.add(tile);
  }
}

function addRoad(world, samples, trackWidth) {
  const positions = [];
  const colors = [];
  const indices = [];
  const dark = new THREE.Color(ROAD);
  const light = new THREE.Color(ROAD_LIGHT);

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2);
    left.y += 0.16;
    right.y += 0.16;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    const wave = 0.5 + Math.sin(index * 0.095) * 0.18;
    const color = dark.clone().lerp(light, THREE.MathUtils.clamp(wave, 0.1, 0.9));
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
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
  road.receiveShadow = true;
  road.userData.turnOutlined = true;
  world.add(road);
}

function addRoadSides(world, samples, trackWidth) {
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0x242947,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide
  });

  for (const side of [-1, 1]) {
    const positions = [];
    const indices = [];
    for (let index = 0; index <= samples.length; index += 1) {
      const sample = samples[index % samples.length];
      const edge = sample.point.clone().addScaledVector(sample.normal, side * trackWidth / 2);
      const top = edge.clone().setY(edge.y + 0.15);
      const lower = edge.clone().setY(Math.max(0.05, edge.y - 1.6));
      positions.push(top.x, top.y, top.z, lower.x, lower.y, lower.z);
    }
    for (let index = 0; index < samples.length; index += 1) {
      const a = index * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const skirt = new THREE.Mesh(geometry, sideMaterial);
    skirt.receiveShadow = true;
    skirt.userData.turnOutlined = true;
    world.add(skirt);
  }
}

function addToyEdgeBlocks(world, samples, trackWidth) {
  const step = 8;
  const blockLength = 5.7;
  const geometry = new THREE.BoxGeometry(1.05, 0.52, blockLength);
  const materials = RAIL_COLORS.map((color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0
  }));

  for (const side of [-1, 1]) {
    for (let index = 0; index < samples.length; index += step) {
      const sample = samples[index];
      const block = new THREE.Mesh(geometry, materials[Math.floor(index / step) % materials.length]);
      block.position.copy(sample.point)
        .addScaledVector(sample.normal, side * (trackWidth / 2 + 0.25));
      block.position.y += 0.5;
      block.rotation.y = yawFor(sample);
      block.rotation.x = Math.atan2(
        samples[sampleIndex(samples, index + 3)].point.y - samples[sampleIndex(samples, index - 3)].point.y,
        samples[sampleIndex(samples, index + 3)].point.distanceTo(samples[sampleIndex(samples, index - 3)].point)
      );
      block.castShadow = false;
      block.receiveShadow = true;
      block.userData.turnOutlined = true;
      world.add(block);
    }
  }
}

function makeFallbackSupport(trackWidth, height, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0 });
  const postGeometry = new THREE.BoxGeometry(1.5, 1, 2.2);
  const beamGeometry = new THREE.BoxGeometry(trackWidth + 7, 1.3, 2.4);
  const footGeometry = new THREE.BoxGeometry(5.2, 0.55, 5.2);

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, material);
    post.scale.y = Math.max(1, height - 0.9);
    post.position.set(side * (trackWidth / 2 + 1.7), (height - 0.9) / 2, 0);
    post.castShadow = false;
    post.receiveShadow = true;
    post.userData.turnOutlined = true;
    group.add(post);

    const foot = new THREE.Mesh(footGeometry, material);
    foot.position.set(side * (trackWidth / 2 + 1.7), 0.28, 0);
    foot.castShadow = false;
    foot.receiveShadow = true;
    foot.userData.turnOutlined = true;
    group.add(foot);
  }

  const beam = new THREE.Mesh(beamGeometry, material);
  beam.position.y = Math.max(1.1, height - 0.5);
  beam.castShadow = false;
  beam.receiveShadow = true;
  beam.userData.turnOutlined = true;
  group.add(beam);
  return group;
}

function prepareKenneySupport(source, trackWidth, height, color) {
  const support = source.clone(true);
  const materialColor = new THREE.Color(color);
  support.traverse((node) => {
    if (!node.isMesh) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const materials = sourceMaterials.map((entry) => {
      const material = entry.clone();
      material.color?.copy(materialColor);
      if ('roughness' in material) material.roughness = 0.78;
      if ('metalness' in material) material.metalness = 0;
      return material;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0];
    node.castShadow = false;
    node.receiveShadow = true;
    node.userData.turnOutlined = true;
  });

  // Kenney supports-wide.glb is 2 units across, 1 unit tall and 1 unit deep.
  // Stretching only those axes preserves the recognisable toy-kit silhouette.
  support.scale.set((trackWidth + 7) / 2, Math.max(1, height), 4.2);
  return support;
}

async function addSupports(world, samples, trackWidth) {
  let kenneySource = null;
  try {
    kenneySource = await loadToyCarSupportSource();
  } catch (error) {
    console.info('TURN: Toybox Kenney support asset unavailable; using lightweight beta fallback.', error);
  }

  const step = 42;
  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    if (sample.point.y < 6.5) continue;
    const supportHeight = Math.max(2.5, sample.point.y - 0.15);
    const color = SUPPORT_COLORS[Math.floor(index / step) % SUPPORT_COLORS.length];
    const support = kenneySource
      ? prepareKenneySupport(kenneySource, trackWidth, supportHeight, color)
      : makeFallbackSupport(trackWidth, supportHeight, color);
    support.position.set(sample.point.x, 0, sample.point.z);
    support.rotation.y = yawFor(sample);
    support.name = 'Toybox Kenney-style support';
    world.add(support);
  }
}

function addStartGate(world, samples, trackWidth) {
  const sample = samples[0];
  const yaw = yawFor(sample);
  const group = new THREE.Group();
  const pink = new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.8 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.8 });

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.8, 8.5, 1.8), pink);
    post.position.set(side * (trackWidth / 2 + 2.2), 4.25, 0);
    post.userData.turnOutlined = true;
    group.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(trackWidth + 7, 1.8, 2), yellow);
  beam.position.y = 8.3;
  beam.userData.turnOutlined = true;
  group.add(beam);

  group.position.copy(sample.point);
  group.position.y += 0.18;
  group.rotation.y = yaw;
  group.name = 'Toybox start gate';
  world.add(group);
}

function addToyBlocks(world) {
  const colors = [0xff4fa3, 0xffd43b, 0x38d9ff, 0x7ee787, 0x9775fa];
  const placements = [
    [-285, 6, -105, 18],
    [285, 8, -15, 22],
    [260, 5, 185, 15],
    [-260, 7, 190, 19],
    [-300, 5, 55, 14]
  ];
  placements.forEach(([x, y, z, size], index) => {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.86 })
    );
    block.position.set(x, y + size / 2 - 4, z);
    block.rotation.set(0.08 * (index % 2), index * 0.39, -0.06 * ((index + 1) % 2));
    block.castShadow = index % 2 === 0;
    block.receiveShadow = true;
    block.userData.turnOutlined = true;
    world.add(block);
  });
}

export function installToyboxWorld({ scene, samples, trackWidth }) {
  const world = new THREE.Group();
  world.name = 'TURN Toybox beta world';
  world.userData.turnTrackId = 'toybox';
  world.userData.turnToyboxBeta = true;
  world.userData.turnToyCarKit = 'Kenney Toy Car Kit CC0';

  scene.background = new THREE.Color(0x63d8ff);
  scene.fog = new THREE.Fog(0x91e5ff, 260, 820);

  addToyFloor(world);
  addRoad(world, samples, trackWidth);
  addRoadSides(world, samples, trackWidth);
  addToyEdgeBlocks(world, samples, trackWidth);
  addStartGate(world, samples, trackWidth);
  addToyBlocks(world);
  void addSupports(world, samples, trackWidth);

  scene.add(world);
  return world;
}
