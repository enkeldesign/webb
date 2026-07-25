import * as THREE from 'three';
import { installCliffsideWorld as installBaseCliffsideWorld } from './cliffside-world.js?base=20260725-r72';

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

export function installCliffsideWorld(options) {
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
  highlands.castShadow = true;
  highlands.receiveShadow = true;
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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
  rocks.castShadow = true;
  rocks.receiveShadow = true;
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
