import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CITY_BUILDER_COMMIT = '4535092b740b378b700efd9df9e27a631815b84a';

const CITY_BASE = `https://cdn.jsdelivr.net/gh/KenneyNL/Starter-Kit-City-Builder@${CITY_BUILDER_COMMIT}/models/`;

const ASSETS = {
  trees: `${CITY_BASE}grass-trees.glb`,
  tallTrees: `${CITY_BASE}grass-trees-tall.glb`,
  garage: `${CITY_BASE}building-garage.glb`,
  buildingA: `${CITY_BASE}building-small-a.glb`,
  buildingB: `${CITY_BASE}building-small-b.glb`,
  buildingC: `${CITY_BASE}building-small-c.glb`,
  buildingD: `${CITY_BASE}building-small-d.glb`,
  fountain: `${CITY_BASE}pavement-fountain.glb`,
  flag: `${CITY_BASE}flag.glb`
};

const loader = new GLTFLoader();
const modelCache = new Map();
const blackOutlineMaterial = new THREE.MeshBasicMaterial({
  color: 0x08090a,
  side: THREE.BackSide
});

function seeded01(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

async function loadModel(key) {
  if (!modelCache.has(key)) {
    modelCache.set(
      key,
      loader.loadAsync(ASSETS[key]).then((gltf) => gltf.scene)
    );
  }
  return modelCache.get(key);
}

function addOutline(root, scale = 1.025) {
  const meshes = [];
  root.traverse((node) => {
    if (node.isMesh) meshes.push(node);
  });

  for (const mesh of meshes) {
    const outline = new THREE.Mesh(mesh.geometry, blackOutlineMaterial);
    outline.scale.setScalar(scale);
    outline.castShadow = false;
    outline.receiveShadow = false;
    mesh.add(outline);
  }
}

function prepareModel(source, {
  targetHeight = null,
  targetSize = null,
  outline = false,
  castShadow = true,
  tint = null,
  tintAmount = 0.75
} = {}) {
  const model = source.clone(true);
  const tintColor = tint == null ? null : new THREE.Color(tint);

  model.traverse((node) => {
    if (!node.isMesh) return;

    if (tintColor && node.material) {
      const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
      const tintedMaterials = sourceMaterials.map((material) => {
        const clone = material.clone();
        clone.color?.lerp(tintColor, tintAmount);
        clone.roughness = Math.max(clone.roughness ?? 0.8, 0.82);
        return clone;
      });
      node.material = Array.isArray(node.material) ? tintedMaterials : tintedMaterials[0];
    }

    node.castShadow = castShadow;
    node.receiveShadow = true;
  });

  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const reference = targetHeight != null
    ? Math.max(size.y, 0.001)
    : Math.max(size.x, size.y, size.z, 0.001);
  const desired = targetHeight ?? targetSize ?? reference;
  model.scale.multiplyScalar(desired / reference);

  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;

  if (outline) addOutline(model);
  return model;
}

function trackPosition(samples, index, side, trackWidth, distance) {
  const sample = samples[((index % samples.length) + samples.length) % samples.length];
  return {
    sample,
    position: sample.point
      .clone()
      .addScaledVector(sample.normal, side * (trackWidth / 2 + distance))
  };
}

function placeAlongTrack({
  world,
  samples,
  trackWidth,
  source,
  index,
  side,
  distance,
  targetHeight,
  targetSize,
  outline = false,
  castShadow = true,
  faceTrack = false,
  rotationOffset = 0,
  stretch = null,
  tint = null,
  tintAmount = 0.75
}) {
  const { sample, position } = trackPosition(samples, index, side, trackWidth, distance);
  const model = prepareModel(source, {
    targetHeight,
    targetSize,
    outline,
    castShadow,
    tint,
    tintAmount
  });
  model.position.add(position);

  if (stretch) model.scale.multiply(stretch);

  if (faceTrack) {
    model.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z)
      + (side < 0 ? Math.PI : 0)
      + rotationOffset;
  } else {
    model.rotation.y = rotationOffset;
  }

  world.add(model);
  return model;
}

function placeTreeBelt({ world, samples, trackWidth, trees, tallTrees }) {
  const sources = [trees, tallTrees];

  for (let i = 0; i < 58; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const random = seeded01(i + 11);
    const secondRandom = seeded01(i * 3 + 7);
    const source = sources[i % sources.length];

    placeAlongTrack({
      world,
      samples,
      trackWidth,
      source,
      index: 17 + i * 37,
      side,
      distance: 17 + random * 42,
      targetHeight: 7.5 + secondRandom * 7,
      castShadow: i % 3 === 0,
      rotationOffset: random * Math.PI * 2
    });
  }
}

function placeTracksideTown({ world, samples, trackWidth, buildings, garage, fountain }) {
  for (let i = 0; i < 14; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const source = buildings[i % buildings.length];
    const random = seeded01(200 + i);

    placeAlongTrack({
      world,
      samples,
      trackWidth,
      source,
      index: 48 + i * 49,
      side,
      distance: 42 + random * 30,
      targetHeight: 10 + seeded01(400 + i) * 7,
      outline: true,
      faceTrack: true,
      rotationOffset: (random - 0.5) * 0.35
    });
  }

  for (const [index, side] of [[36, 1], [376, -1]]) {
    placeAlongTrack({
      world,
      samples,
      trackWidth,
      source: garage,
      index,
      side,
      distance: 31,
      targetHeight: 11.5,
      outline: true,
      faceTrack: true
    });
  }

  for (const [index, side] of [[120, -1], [286, 1], [516, -1]]) {
    placeAlongTrack({
      world,
      samples,
      trackWidth,
      source: fountain,
      index,
      side,
      distance: 34,
      targetHeight: 4.2,
      outline: true,
      faceTrack: true
    });
  }
}

function placeStartArea({ world, samples, trackWidth, flag, garage }) {
  const startIndex = 0;

  for (const side of [-1, 1]) {
    placeAlongTrack({
      world,
      samples,
      trackWidth,
      source: flag,
      index: startIndex,
      side,
      distance: 3.2,
      targetHeight: 10.5,
      outline: true,
      faceTrack: true,
      rotationOffset: side > 0 ? 0.15 : -0.15
    });
  }

  placeAlongTrack({
    world,
    samples,
    trackWidth,
    source: garage,
    index: 12,
    side: 1,
    distance: 24,
    targetHeight: 13,
    outline: true,
    faceTrack: true
  });
}

export async function installKenneyWorld({ world, samples, trackWidth }) {
  const results = await Promise.allSettled([
    loadModel('trees'),
    loadModel('tallTrees'),
    loadModel('garage'),
    loadModel('buildingA'),
    loadModel('buildingB'),
    loadModel('buildingC'),
    loadModel('buildingD'),
    loadModel('fountain'),
    loadModel('flag')
  ]);

  const [
    trees,
    tallTrees,
    garage,
    buildingA,
    buildingB,
    buildingC,
    buildingD,
    fountain,
    flag
  ] = results.map((result) => result.status === 'fulfilled' ? result.value : null);

  if (trees && tallTrees) {
    placeTreeBelt({ world, samples, trackWidth, trees, tallTrees });
  }

  const buildings = [buildingA, buildingB, buildingC, buildingD].filter(Boolean);
  if (buildings.length && garage && fountain) {
    placeTracksideTown({ world, samples, trackWidth, buildings, garage, fountain });
  }

  // Distant mountains now belong exclusively to world-art-pass.js. The removed legacy
  // horizon path was both obsolete and broken, and could abort the remaining asset setup.

  if (flag && garage) {
    placeStartArea({ world, samples, trackWidth, flag, garage });
  }

  const failed = results.filter((result) => result.status === 'rejected').length;
  if (failed) {
    console.warn(`TURN: ${failed} world asset(s) failed to load.`);
  } else {
    console.info('TURN: Kenney world assets loaded.');
  }
}