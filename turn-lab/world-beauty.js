import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CITY_BUILDER_COMMIT = '4535092b740b378b700efd9df9e27a631815b84a';
const PLATFORMER_COMMIT = '3fa8a04b1c01ab23db43123d4ce814a34c3fc7f0';
const CITY_BASE = `https://cdn.jsdelivr.net/gh/KenneyNL/Starter-Kit-City-Builder@${CITY_BUILDER_COMMIT}/models/`;
const PLATFORMER_BASE = `https://cdn.jsdelivr.net/gh/KenneyNL/Starter-Kit-3D-Platformer@${PLATFORMER_COMMIT}/models/`;

const ASSETS = {
  trees: `${CITY_BASE}grass-trees.glb`,
  tallTrees: `${CITY_BASE}grass-trees-tall.glb`,
  flag: `${PLATFORMER_BASE}flag.glb`,
  cloud: `${PLATFORMER_BASE}cloud.glb`
};

const loader = new GLTFLoader();
const cache = new Map();
const TAU = Math.PI * 2;

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

function loadAsset(key) {
  if (!cache.has(key)) {
    cache.set(key, loader.loadAsync(ASSETS[key]).then((gltf) => gltf.scene));
  }
  return cache.get(key);
}

function prepareModel(source, targetHeight, { castShadow = true, opacity = 1 } = {}) {
  const model = source.clone(true);

  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = castShadow;
    node.receiveShadow = true;

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

function addGroundPatch(world, sample, side, distance, width, depth, color, rotation = 0) {
  const geometry = new THREE.CircleGeometry(1, 28);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  const patch = new THREE.Mesh(geometry, material);
  patch.rotation.x = -Math.PI / 2;
  patch.rotation.z = rotation;
  patch.scale.set(width, depth, 1);
  patch.position.copy(sample.point).addScaledVector(sample.normal, side * distance);
  patch.position.y = 0.004;
  patch.receiveShadow = true;
  world.add(patch);
  return patch;
}

function addZoneGround(world, samples, trackWidth) {
  // Forest floor: darker, cooler patches close enough to make the section feel enclosed.
  for (let i = 0; i < 16; i += 1) {
    const index = 145 + i * 11;
    const sample = sampleAt(samples, index);
    const side = i % 2 === 0 ? 1 : -1;
    addGroundPatch(
      world,
      sample,
      side,
      trackWidth / 2 + 24 + seeded01(12000 + i) * 22,
      18 + seeded01(12100 + i) * 18,
      12 + seeded01(12200 + i) * 15,
      i % 3 === 0 ? 0x629b68 : 0x6eaa70,
      seeded01(12300 + i) * Math.PI
    );
  }

  // Meadow: broad yellow-green islands that read at racing speed.
  for (let i = 0; i < 10; i += 1) {
    const index = 340 + i * 15;
    const sample = sampleAt(samples, index);
    const side = i % 2 === 0 ? 1 : -1;
    addGroundPatch(
      world,
      sample,
      side,
      trackWidth / 2 + 28 + seeded01(12400 + i) * 34,
      20 + seeded01(12500 + i) * 24,
      13 + seeded01(12600 + i) * 20,
      i % 2 === 0 ? 0xa8db79 : 0x9bd678,
      seeded01(12700 + i) * Math.PI
    );
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

function addPaddock(world, samples, trackWidth) {
  const sample = sampleAt(samples, 18);
  const yaw = yawFor(sample);
  const side = 1;
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(58, 0.12, 34),
    new THREE.MeshStandardMaterial({ color: 0x70777e, roughness: 0.98, metalness: 0 })
  );
  pad.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 + 32));
  pad.position.y = 0.035;
  pad.rotation.y = yaw;
  pad.receiveShadow = true;
  world.add(pad);

  const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.9 });
  for (let i = -3; i <= 3; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 23), stripeMaterial);
    stripe.position.copy(pad.position);
    stripe.position.y = 0.115;
    stripe.addScaledVector(sample.normal, i * 6.5);
    stripe.rotation.y = yaw;
    world.add(stripe);
  }

  const barrierColors = [0xffd43b, 0xff4fa3, 0x38d9ff];
  for (let i = 0; i < 9; i += 1) {
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 1.35, 1.3),
      new THREE.MeshStandardMaterial({ color: barrierColors[i % barrierColors.length], roughness: 0.8 })
    );
    barrier.position.copy(sample.point)
      .addScaledVector(sample.normal, trackWidth / 2 + 10)
      .addScaledVector(sample.tangent, -20 + i * 5.2);
    barrier.position.y = 0.7;
    barrier.rotation.y = yaw;
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    world.add(barrier);
  }
}

function addTownPads(world, samples, trackWidth) {
  const padMaterial = new THREE.MeshStandardMaterial({ color: 0x9ca3aa, roughness: 1 });
  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.95 });

  for (let i = 0; i < 5; i += 1) {
    const sample = sampleAt(samples, 510 + i * 35);
    const side = i % 2 === 0 ? 1 : -1;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(32, 0.09, 22), padMaterial);
    pad.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 + 30));
    pad.position.y = 0.025;
    pad.rotation.y = yawFor(sample) + (side < 0 ? Math.PI : 0);
    pad.receiveShadow = true;
    world.add(pad);

    for (let stripeIndex = -2; stripeIndex <= 2; stripeIndex += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 14), curbMaterial);
      stripe.position.copy(pad.position);
      stripe.position.y = 0.082;
      stripe.addScaledVector(sample.normal, stripeIndex * 5);
      stripe.rotation.y = pad.rotation.y;
      world.add(stripe);
    }
  }
}

function makeSignTexture(label, background) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#08090a';
  ctx.lineWidth = 26;
  ctx.strokeRect(13, 13, canvas.width - 26, canvas.height - 26);
  ctx.fillStyle = '#08090a';
  ctx.font = '900 92px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addSign(world, sample, side, distance, label, background) {
  const group = new THREE.Group();
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(8.8, 4.4),
    new THREE.MeshBasicMaterial({ map: makeSignTexture(label, background), side: THREE.DoubleSide })
  );
  panel.position.y = 6.1;
  group.add(panel);

  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x70401f, roughness: 1 });
  for (const x of [-2.7, 2.7]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.2, 0.45), postMaterial);
    post.position.set(x, 2.6, -0.18);
    post.castShadow = true;
    group.add(post);
  }

  group.position.copy(sample.point).addScaledVector(sample.normal, side * distance);
  const inward = sample.normal.clone().multiplyScalar(-side);
  group.rotation.y = Math.atan2(inward.x, inward.z);
  world.add(group);
}

function addSigns(world, samples, trackWidth) {
  const signs = [
    [74, 1, 'TURN', '#ffd43b'],
    [190, -1, 'FOREST', '#8ce99a'],
    [365, 1, 'FLY', '#38d9ff'],
    [470, -1, 'BRAKE?', '#ff4fa3'],
    [565, 1, 'TOWN', '#9775fa'],
    [680, -1, 'GO!', '#ffd43b']
  ];

  for (const [index, side, label, background] of signs) {
    addSign(
      world,
      sampleAt(samples, index),
      side,
      trackWidth / 2 + 15,
      label,
      background
    );
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

function addFlowerFields(world, samples, trackWidth) {
  const palette = [0xff4fa3, 0xffd43b, 0x9775fa, 0xffffff];
  const geometry = new THREE.DodecahedronGeometry(0.32, 0);
  const meshes = palette.map((color) => {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({ color }),
      45
    );
    mesh.frustumCulled = false;
    world.add(mesh);
    return mesh;
  });
  const counts = new Array(meshes.length).fill(0);
  const marker = new THREE.Object3D();

  for (let i = 0; i < 180; i += 1) {
    const sample = sampleAt(samples, 340 + Math.floor(seeded01(14000 + i) * 145));
    const side = seeded01(14100 + i) > 0.5 ? 1 : -1;
    const distance = trackWidth / 2 + 18 + seeded01(14200 + i) * 48;
    marker.position.copy(sample.point)
      .addScaledVector(sample.normal, side * distance)
      .addScaledVector(sample.tangent, (seeded01(14300 + i) - 0.5) * 22);
    marker.position.y = 0.22 + seeded01(14400 + i) * 0.28;
    marker.scale.setScalar(0.6 + seeded01(14500 + i) * 1.2);
    marker.rotation.set(0, seeded01(14600 + i) * TAU, 0);
    marker.updateMatrix();

    const colorIndex = i % meshes.length;
    const instanceIndex = counts[colorIndex];
    if (instanceIndex < meshes[colorIndex].count) {
      meshes[colorIndex].setMatrixAt(instanceIndex, marker.matrix);
      counts[colorIndex] += 1;
    }
  }

  meshes.forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
  });
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
    loadAsset('flag'),
    loadAsset('cloud')
  ]);
  const [trees, tallTrees, flag, cloud] = results.map((result) =>
    result.status === 'fulfilled' ? result.value : null
  );

  // Forest: deliberately dense and close for speed parallax.
  if (trees && tallTrees) {
    const sources = [trees, tallTrees];
    for (let i = 0; i < 38; i += 1) {
      const sample = sampleAt(samples, 135 + Math.floor(seeded01(15000 + i) * 190));
      const side = i % 2 === 0 ? 1 : -1;
      const source = sources[i % sources.length];
      const model = prepareModel(source, 8 + seeded01(15100 + i) * 8, {
        castShadow: i % 4 === 0
      });
      model.position.add(sample.point)
        .addScaledVector(sample.normal, side * (trackWidth / 2 + 11 + seeded01(15200 + i) * 29))
        .addScaledVector(sample.tangent, (seeded01(15300 + i) - 0.5) * 16);
      model.rotation.y = seeded01(15400 + i) * TAU;
      world.add(model);
    }
  }

  // Paddock flags.
  if (flag) {
    for (const [index, side] of [[0, -1], [0, 1], [24, 1], [696, -1]]) {
      const sample = sampleAt(samples, index);
      const model = prepareModel(flag, 9.5, { castShadow: true });
      model.position.add(sample.point)
        .addScaledVector(sample.normal, side * (trackWidth / 2 + 7));
      model.rotation.y = yawFor(sample) + (side < 0 ? Math.PI : 0);
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
  addZoneGround(world, samples, trackWidth);
  addStartFinish(world, samples, trackWidth);
  addPaddock(world, samples, trackWidth);
  addTownPads(world, samples, trackWidth);
  addSigns(world, samples, trackWidth);
  addRoadWear(world, samples);
  addFlowerFields(world, samples, trackWidth);
  addSun(world);

  await addAssetDressing(world, samples, trackWidth);
  console.info('TURN: world beauty pass loaded.');
}
