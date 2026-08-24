import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CITY_BUILDER_COMMIT = '4535092b740b378b700efd9df9e27a631815b84a';
const PLATFORMER_COMMIT = '3fa8a04b1c01ab23db43123d4ce814a34c3fc7f0';
const CITY_BASE = `https://cdn.jsdelivr.net/gh/KenneyNL/Starter-Kit-City-Builder@${CITY_BUILDER_COMMIT}/models/`;
const PLATFORMER_BASE = `https://cdn.jsdelivr.net/gh/KenneyNL/Starter-Kit-3D-Platformer@${PLATFORMER_COMMIT}/models/`;

const ASSETS = {
  trees: `${CITY_BASE}grass-trees.glb`,
  tallTrees: `${CITY_BASE}grass-trees-tall.glb`,
  cloud: `${PLATFORMER_BASE}cloud.glb`
};

const loader = new GLTFLoader();
const cache = new Map();
const TAU = Math.PI * 2;
const TREE_BASE_HEIGHT_RATIO = 0.09;
const TREE_BASE_WIDTH_RATIO = 0.78;

function seeded01(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function sampleAt(samples, index) {
  return samples[((Math.round(index) % samples.length) + samples.length) % samples.length];
}

function yawFor(sample) {
  return Math.atan2(sample.tangent.x, sample.tangent.z);
}

function stripTreeClusterGroundBase(root) {
  let removedTriangles = 0;

  root.traverse((node) => {
    const geometry = node?.geometry;
    const position = geometry?.getAttribute?.('position');
    const index = geometry?.getIndex?.();
    if (!node?.isMesh || !position || !index || index.count < 3) return;

    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const depth = bounds.max.z - bounds.min.z;
    const baseMaxY = bounds.min.y + height * TREE_BASE_HEIGHT_RATIO;
    const wideTriangleThreshold = Math.max(width, depth) * TREE_BASE_WIDTH_RATIO;
    const keptIndices = [];
    let removedFromMesh = 0;

    for (let offset = 0; offset < index.count; offset += 3) {
      const a = index.getX(offset);
      const b = index.getX(offset + 1);
      const c = index.getX(offset + 2);
      const maxY = Math.max(position.getY(a), position.getY(b), position.getY(c));
      const spanX = Math.max(position.getX(a), position.getX(b), position.getX(c))
        - Math.min(position.getX(a), position.getX(b), position.getX(c));
      const spanZ = Math.max(position.getZ(a), position.getZ(b), position.getZ(c))
        - Math.min(position.getZ(a), position.getZ(b), position.getZ(c));

      // Kenney's grass-tree assets contain a broad, shallow tile in the same mesh as
      // the trees. Repeated copies of that tile sit almost flush with TURN's terrain
      // and z-fight in the overview camera. Keep every narrow trunk/branch triangle,
      // but omit the wide triangles that make up only the low ground tile.
      if (maxY <= baseMaxY && Math.max(spanX, spanZ) >= wideTriangleThreshold) {
        removedFromMesh += 1;
        continue;
      }

      keptIndices.push(a, b, c);
    }

    if (!removedFromMesh) return;
    const strippedGeometry = geometry.clone();
    strippedGeometry.setIndex(keptIndices);
    if (strippedGeometry.groups.length) {
      strippedGeometry.clearGroups();
      strippedGeometry.addGroup(0, keptIndices.length, 0);
    }
    strippedGeometry.computeBoundingSphere();
    node.geometry = strippedGeometry;
    node.userData.turnGroundBaseRemoved = true;
    removedTriangles += removedFromMesh;
  });

  root.userData.turnGroundBaseTrianglesRemoved = removedTriangles;
  return removedTriangles;
}

function loadAsset(key) {
  if (!cache.has(key)) {
    cache.set(key, loader.loadAsync(ASSETS[key]).then((gltf) => {
      if (key === 'trees' || key === 'tallTrees') stripTreeClusterGroundBase(gltf.scene);
      return gltf.scene;
    }));
  }
  return cache.get(key);
}

function prepareModel(source, targetHeight, { castShadow = true, opacity = 1 } = {}) {
  const model = source.clone(true);

  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = castShadow;
    node.receiveShadow = true;
    node.userData.turnPaletteLocked = true;

    if (opacity < 1 && node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const clones = materials.map((material) => {
        const clone = material.clone();
        clone.transparent = true;
        clone.opacity = opacity;
        clone.depthWrite = opacity > 0.75;
        return clone;
      });
      node.material = Array.isArray(node.material) ? clones : clones[0];
    }
  });

  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(targetHeight / Math.max(size.y, 0.001));

  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
  return model;
}

function makeGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#8fdf8d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const palette = ['#72c77b', '#a5e69a', '#83d483', '#b9df83', '#67b978'];
  for (let i = 0; i < 90; i += 1) {
    const random = seeded01(2000 + i);
    const random2 = seeded01(3000 + i);
    const random3 = seeded01(4000 + i);
    ctx.globalAlpha = 0.08 + random3 * 0.14;
    ctx.fillStyle = palette[i % palette.length];
    ctx.beginPath();
    ctx.ellipse(
      random * canvas.width,
      random2 * canvas.height,
      24 + seeded01(5000 + i) * 86,
      18 + seeded01(6000 + i) * 64,
      seeded01(7000 + i) * Math.PI,
      0,
      TAU
    );
    ctx.fill();
  }

  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#3f8f61';
  for (let i = 0; i < 230; i += 1) {
    const x = seeded01(8000 + i) * canvas.width;
    const y = seeded01(9000 + i) * canvas.height;
    const radius = 1.5 + seeded01(10000 + i) * 4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.5, 4.5);
  texture.anisotropy = 4;
  return texture;
}

function addTexturedGround(world) {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(520, 128),
    new THREE.MeshStandardMaterial({
      map: makeGrassTexture(),
      color: 0xffffff,
      roughness: 1,
      metalness: 0
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  ground.receiveShadow = true;
  world.add(ground);
}

function addShoulders(world, samples, trackWidth) {
  const gravel = new THREE.Color(0xc6a56e);
  const wornGrass = new THREE.Color(0x79b875);

  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];
    const indices = [];

    for (let i = 0; i <= samples.length; i += 1) {
      const sample = samples[i % samples.length];
      const random = seeded01(11000 + i * 7 + side * 13);
      const innerOffset = trackWidth / 2 + 1.68;
      const outerOffset = trackWidth / 2 + 6.6 + random * 1.4;
      const inner = sample.point.clone().addScaledVector(sample.normal, side * innerOffset);
      const outer = sample.point.clone().addScaledVector(sample.normal, side * outerOffset);
      inner.y = 0.072;
      outer.y = 0.025;
      positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);

      const innerColor = gravel.clone().offsetHSL(0, 0, (random - 0.5) * 0.07);
      const outerColor = wornGrass.clone().offsetHSL(0, 0, (random - 0.5) * 0.08);
      colors.push(
        innerColor.r, innerColor.g, innerColor.b,
        outerColor.r, outerColor.g, outerColor.b
      );
    }

    for (let i = 0; i < samples.length; i += 1) {
      const a = i * 2;
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

    const shoulder = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide
      })
    );
    shoulder.receiveShadow = true;
    world.add(shoulder);
  }
}

function addStartFinish(world, samples, trackWidth) {
  const start = sampleAt(samples, 0);
  const yaw = yawFor(start);
  const squareSize = trackWidth / 12;
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0xfaf8ee, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.9 })
  ];

  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(squareSize + 0.02, 0.055, 1.35),
        materials[(row + column) % 2]
      );
      const across = -trackWidth / 2 + squareSize / 2 + column * squareSize;
      tile.position.copy(start.point)
        .addScaledVector(start.normal, across)
        .addScaledVector(start.tangent, (row - 0.5) * 1.35);
      tile.position.y = 0.215;
      tile.rotation.y = yaw;
      tile.receiveShadow = true;
      world.add(tile);
    }
  }

  const gridMaterial = new THREE.MeshStandardMaterial({ color: 0xfaf8ee, roughness: 0.9 });
  for (let row = 0; row < 4; row += 1) {
    const gridSample = sampleAt(samples, samples.length - 18 - row * 17);
    const gridYaw = yawFor(gridSample);
    for (const side of [-1, 1]) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.045, 0.32), gridMaterial);
      marker.position.copy(gridSample.point).addScaledVector(gridSample.normal, side * 4.2);
      marker.position.y = 0.205;
      marker.rotation.y = gridYaw;
      world.add(marker);
    }
  }
}

function addRoadWear(world, samples) {
  const patchMaterial = new THREE.MeshStandardMaterial({
    color: 0x292d31,
    roughness: 1,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });
  const skidMaterial = new THREE.MeshBasicMaterial({
    color: 0x121416,
    transparent: true,
    opacity: 0.22,
    depthWrite: false
  });

  for (let i = 0; i < 16; i += 1) {
    const sample = sampleAt(samples, 38 + i * 41);
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(3.5 + seeded01(13000 + i) * 6, 0.018, 5 + seeded01(13100 + i) * 10),
      patchMaterial
    );
    patch.position.copy(sample.point).addScaledVector(sample.normal, (seeded01(13200 + i) - 0.5) * 10);
    patch.position.y = 0.174;
    patch.rotation.y = yawFor(sample) + (seeded01(13300 + i) - 0.5) * 0.16;
    world.add(patch);
  }

  for (const index of [116, 128, 292, 304, 454, 466, 612, 624]) {
    const sample = sampleAt(samples, index);
    const yaw = yawFor(sample);
    for (const side of [-1, 1]) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.014, 9), skidMaterial);
      mark.position.copy(sample.point).addScaledVector(sample.normal, side * 2.7);
      mark.position.y = 0.191;
      mark.rotation.y = yaw;
      world.add(mark);
    }
  }
}

function addSun(world) {
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(31, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0xffef9a })
  );
  sun.position.set(-390, 225, -470);
  world.add(sun);
}

async function addAssetDressing(world, samples, trackWidth) {
  const results = await Promise.allSettled([
    loadAsset('trees'),
    loadAsset('tallTrees'),
    loadAsset('cloud')
  ]);
  const [trees, tallTrees, cloud] = results.map((result) =>
    result.status === 'fulfilled' ? result.value : null
  );

  // Forest: deliberately dense and close for speed parallax.
  if (trees && tallTrees) {
    const sources = [trees, tallTrees];
    for (let i = 0; i < 38; i += 1) {
      const sample = sampleAt(samples, 135 + Math.floor(seeded01(15000 + i) * 190));
      const side = i % 2 === 0 ? 1 : -1;
      const source = sources[i % sources.length];
      const model = prepareModel(source, 12 + seeded01(15100 + i) * 9, {
        castShadow: i % 4 === 0
      });
      model.position.add(sample.point)
        .addScaledVector(sample.normal, side * (trackWidth / 2 + 11 + seeded01(15200 + i) * 29))
        .addScaledVector(sample.tangent, (seeded01(15300 + i) - 0.5) * 16);
      model.rotation.y = seeded01(15400 + i) * TAU;
      world.add(model);
    }
  }

  // Soft distant cloud layer. These are deliberately sparse and large.
  if (cloud) {
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * TAU + seeded01(15500 + i) * 0.28;
      const distance = 260 + seeded01(15600 + i) * 250;
      const model = prepareModel(cloud, 18 + seeded01(15700 + i) * 28, {
        castShadow: false,
        opacity: 0.9
      });
      model.position.set(
        Math.cos(angle) * distance,
        62 + seeded01(15800 + i) * 85,
        Math.sin(angle) * distance
      );
      model.scale.x *= 1.5 + seeded01(15900 + i) * 1.2;
      model.rotation.y = angle;
      world.add(model);
    }
  }
}

export async function installWorldBeauty({ world, scene, samples, trackWidth, sun, hemi }) {
  // Atmosphere and palette.
  const sky = new THREE.Color(0x53d3f2);
  scene.background = sky;
  if (scene.fog) {
    scene.fog.color.copy(sky);
    scene.fog.near = 190;
    scene.fog.far = 720;
  }
  if (hemi) {
    hemi.color.set(0xfffdf4);
    hemi.groundColor.set(0x6b8b62);
    hemi.intensity = 2.45;
  }
  if (sun) {
    sun.color.set(0xfff0bd);
    sun.intensity = 4.6;
    sun.position.set(-120, 175, 95);
  }

  addTexturedGround(world);
  addShoulders(world, samples, trackWidth);
  addStartFinish(world, samples, trackWidth);
  addRoadWear(world, samples);
  addSun(world);

  await addAssetDressing(world, samples, trackWidth);
  console.info('TURN: world beauty pass loaded.');
}
