import * as THREE from 'three';
import { graphicsProfile } from '/turn/graphics-profile.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r157-hidden-achievements';
import { installNightPlayerSpotlight } from './night-player-spotlight-r560.js?revision=r175-reconcile';
import { installSharedNightSky } from '/turn/tracks/shared-night-sky.js';

// MIDNIGHT CITY world, consolidated from the former midnight-city-world.js and its
// -r2 … -r7 and -r11 revision files. Each layer keeps its original code inside its
// own function scope, in the original wrapping order, so constants and module
// state stay isolated exactly as they were when every layer was its own module.

// ==== Layer r1 (formerly midnight-city-world.js) ====
const installMidnightCityLayerR1 = (() => {
const INK = 0x070811;
const ROAD = 0x20242d;
const ROAD_EDGE = 0x343a45;
const SIDEWALK = 0x777c86;
const SIDEWALK_EDGE = 0xb8bdc7;
const WARM_LIGHT = 0xffd27a;
const WINDOW_CYAN = 0x5de4ff;
const WINDOW_MAGENTA = 0xff4fa3;
const WINDOW_GOLD = 0xffc857;
const BUILDING_DARK = 0x171a25;
const BUILDING_BLUE = 0x20283a;
const BUILDING_PURPLE = 0x2b2138;
const GROUND = 0x080d16;
const TRACK_Y = 0.16;

const CITY_BLOCKS = Object.freeze([
  [-360, -265, 250, 120], [-80, -265, 250, 120], [210, -265, 270, 120],
  [-280, -88, 215, 92], [0, -88, 245, 92], [285, -88, 215, 92],
  [-330, 72, 220, 86], [-55, 72, 235, 86], [225, 72, 245, 86],
  [-350, 250, 245, 120], [-70, 250, 245, 120], [220, 250, 260, 120]
].map((block) => Object.freeze(block)));

const NEON_SIGNS = Object.freeze([
  ['TURN FM', -305, 18, -205, 0, 0xff4fa3],
  ['NITE', 105, 15, -205, 0, 0x5de4ff],
  ['24H', 345, 13, -105, Math.PI, 0xffc857],
  ['BOOST', -215, 18, 105, 0, 0x9d7cff],
  ['MOTEL', 280, 22, 105, Math.PI, 0xff6b8a],
  ['DOWNTOWN', -95, 26, 310, Math.PI, 0x5de4ff]
].map((sign) => Object.freeze(sign)));

function installMidnightCityWorld({ scene, samples, trackWidth = 27 }) {
  const world = new THREE.Group();
  world.name = 'TURN Midnight City r1';
  scene.add(world);

  makeNightLighting(world);
  makeGround(world);
  makeRaceRoad(world, samples, trackWidth);
  makeStreetLights(world, samples, trackWidth);
  makeCityBlocks(world);
  makeDistantSkyline(world);
  makeNeonSigns(world);
  makeStartFinishDistrict(world, samples, trackWidth);

  world.userData.turnMidnightCityArtDirection = Object.freeze({
    version: 'r1',
    longStreetCircuit: true,
    proceduralMobileCity: true,
    streetLightsFollowRoad: true,
    distantSkyscraperSkyline: true,
    neonOpenWorldNightMood: true,
    externalAssetFiles: false,
    noIndependentAnimationLoop: true
  });

  return world;
}

function material(color, roughness = 0.86, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeNightLighting(world) {
  const skyFill = new THREE.HemisphereLight(0x31548c, 0x10121b, 1.15);
  skyFill.position.set(0, 260, 0);
  world.add(skyFill);

  const moon = new THREE.DirectionalLight(0xaec8ff, 1.05);
  moon.position.set(-240, 420, -180);
  world.add(moon);
}

function makeGround(world) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1200),
    material(GROUND, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  world.add(ground);
}

function makeRaceRoad(world, samples, trackWidth) {
  const road = makeRibbonMesh({
    samples,
    innerOffset: -trackWidth / 2,
    outerOffset: trackWidth / 2,
    height: TRACK_Y,
    name: 'Midnight City race road',
    meshMaterial: material(ROAD, 0.98)
  });
  world.add(road);

  for (const side of [-1, 1]) {
    const edge = makeRibbonMesh({
      samples,
      innerOffset: side * (trackWidth / 2 + 0.2),
      outerOffset: side * (trackWidth / 2 + 1.8),
      height: TRACK_Y + 0.035,
      name: `Midnight City road edge ${side}`,
      meshMaterial: material(ROAD_EDGE, 0.94)
    });
    world.add(edge);

    const sidewalk = makeRibbonMesh({
      samples,
      innerOffset: side * (trackWidth / 2 + 2),
      outerOffset: side * (trackWidth / 2 + 6.2),
      height: TRACK_Y + 0.11,
      name: `Midnight City sidewalk ${side}`,
      meshMaterial: material(SIDEWALK, 0.92)
    });
    world.add(sidewalk);
  }

  makeLaneDashes(world, samples);
  makeCurbMarkers(world, samples, trackWidth);
}

function makeRibbonMesh({ samples, innerOffset, outerOffset, height, name, meshMaterial }) {
  const positions = [];
  const indices = [];
  const count = samples.length;

  for (let index = 0; index <= count; index += 1) {
    const sample = samples[index % count];
    const inner = sample.point.clone().addScaledVector(sample.normal, innerOffset).setY(sample.point.y + height);
    const outer = sample.point.clone().addScaledVector(sample.normal, outerOffset).setY(sample.point.y + height);
    positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
  }

  for (let index = 0; index < count; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.name = name;
  return mesh;
}

function makeLaneDashes(world, samples) {
  const step = 5;
  const count = Math.ceil(samples.length / step);
  const geometry = new THREE.BoxGeometry(0.36, 0.045, 5.5);
  const dashes = new THREE.InstancedMesh(geometry, material(0xe9ecf2, 0.88), count);
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    marker.position.copy(sample.point).setY(sample.point.y + TRACK_Y + 0.08);
    marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    dashes.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }

  dashes.count = cursor;
  dashes.instanceMatrix.needsUpdate = true;
  world.add(dashes);
}

function makeCurbMarkers(world, samples, trackWidth) {
  const step = 12;
  const perSide = Math.ceil(samples.length / step);
  const geometry = new THREE.BoxGeometry(2.2, 0.12, 3.8);
  const markers = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: SIDEWALK_EDGE,
      roughness: 0.9,
      emissive: 0x11151d,
      emissiveIntensity: 0.35
    }),
    perSide * 2
  );
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (const side of [-1, 1]) {
    for (let index = 0; index < samples.length; index += step) {
      const sample = samples[index];
      marker.position.copy(sample.point)
        .addScaledVector(sample.normal, side * (trackWidth / 2 + 2.1))
        .setY(sample.point.y + TRACK_Y + 0.15);
      marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
      marker.updateMatrix();
      markers.setMatrixAt(cursor, marker.matrix);
      cursor += 1;
    }
  }

  markers.count = cursor;
  markers.instanceMatrix.needsUpdate = true;
  world.add(markers);
}

function makeStreetLights(world, samples, trackWidth) {
  const step = 10;
  const perSide = Math.ceil(samples.length / step);
  const total = perSide * 2;
  const poleGeometry = new THREE.BoxGeometry(0.34, 7.8, 0.34);
  const armGeometry = new THREE.BoxGeometry(2.5, 0.22, 0.22);
  const lampGeometry = new THREE.BoxGeometry(0.9, 0.25, 0.55);
  const poleMaterial = material(0x252b35, 0.7, 0.35);
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe8b4,
    emissive: WARM_LIGHT,
    emissiveIntensity: 2.7,
    roughness: 0.38
  });
  const poles = new THREE.InstancedMesh(poleGeometry, poleMaterial, total);
  const arms = new THREE.InstancedMesh(armGeometry, poleMaterial, total);
  const lamps = new THREE.InstancedMesh(lampGeometry, lampMaterial, total);
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (const side of [-1, 1]) {
    for (let index = 0; index < samples.length; index += step) {
      const sample = samples[index];
      const heading = Math.atan2(sample.tangent.x, sample.tangent.z);
      const base = sample.point.clone().addScaledVector(sample.normal, side * (trackWidth / 2 + 6.8));

      marker.position.copy(base).setY(sample.point.y + 3.9);
      marker.rotation.set(0, heading, 0);
      marker.updateMatrix();
      poles.setMatrixAt(cursor, marker.matrix);

      marker.position.copy(base)
        .addScaledVector(sample.normal, -side * 1.05)
        .setY(sample.point.y + 7.55);
      marker.rotation.set(0, heading, 0);
      marker.updateMatrix();
      arms.setMatrixAt(cursor, marker.matrix);

      marker.position.copy(base)
        .addScaledVector(sample.normal, -side * 2.12)
        .setY(sample.point.y + 7.35);
      marker.rotation.set(0, heading, 0);
      marker.updateMatrix();
      lamps.setMatrixAt(cursor, marker.matrix);

      cursor += 1;
    }
  }

  for (const mesh of [poles, arms, lamps]) {
    mesh.count = cursor;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }

  if (graphicsProfile.pointLights) {
    for (let index = 0; index < samples.length; index += 90) {
      const sample = samples[index];
      const light = new THREE.PointLight(WARM_LIGHT, 7.5, 74, 1.65);
      light.position.copy(sample.point).setY(sample.point.y + 8.4);
      world.add(light);
    }
  }
}

function makeCityBlocks(world) {
  const buildings = [];
  for (let blockIndex = 0; blockIndex < CITY_BLOCKS.length; blockIndex += 1) {
    const [centerX, centerZ, width, depth] = CITY_BLOCKS[blockIndex];
    const columns = width > 240 ? 3 : 2;
    const rows = depth > 100 ? 2 : 1;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const seed = blockIndex * 17 + row * 5 + column * 11;
        const cellWidth = width / columns;
        const cellDepth = depth / rows;
        const buildingWidth = cellWidth * (0.52 + pseudo(seed) * 0.2);
        const buildingDepth = cellDepth * (0.48 + pseudo(seed + 3) * 0.22);
        const height = 20 + pseudo(seed + 7) * 58;
        const x = centerX - width / 2 + cellWidth * (column + 0.5) + (pseudo(seed + 9) - 0.5) * 12;
        const z = centerZ - depth / 2 + cellDepth * (row + 0.5) + (pseudo(seed + 13) - 0.5) * 10;
        buildings.push({
          x,
          z,
          width: buildingWidth,
          depth: buildingDepth,
          height,
          palette: seed % 3,
          rotation: seed % 2 ? 0 : Math.PI / 2
        });
      }
    }
  }

  installBuildingInstances(world, buildings, false);
}

function makeDistantSkyline(world) {
  const skyline = [];
  for (let index = 0; index < 44; index += 1) {
    const angle = (index / 44) * Math.PI * 2;
    const radiusX = 710 + pseudo(index * 7) * 90;
    const radiusZ = 510 + pseudo(index * 11 + 2) * 80;
    skyline.push({
      x: Math.cos(angle) * radiusX,
      z: Math.sin(angle) * radiusZ,
      width: 28 + pseudo(index * 13) * 42,
      depth: 28 + pseudo(index * 17) * 40,
      height: 70 + pseudo(index * 19) * 150,
      palette: index % 3,
      rotation: angle + Math.PI / 2
    });
  }

  installBuildingInstances(world, skyline, true);
}

function installBuildingInstances(world, buildings, skyline) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = [
    material(BUILDING_DARK, 0.82, 0.08),
    material(BUILDING_BLUE, 0.78, 0.12),
    material(BUILDING_PURPLE, 0.8, 0.08)
  ];
  const bodies = materials.map((entry) => new THREE.InstancedMesh(geometry, entry, buildings.length));
  const bodyCounts = [0, 0, 0];
  const marker = new THREE.Object3D();

  const windowGeometry = new THREE.BoxGeometry(1, 1, 0.08);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: skyline ? WINDOW_CYAN : WINDOW_GOLD,
    emissiveIntensity: skyline ? 1.8 : 1.25,
    roughness: 0.5,
    transparent: true,
    opacity: skyline ? 0.82 : 0.7
  });
  const windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, buildings.length * 5);
  let windowCount = 0;

  for (const building of buildings) {
    const palette = building.palette % bodies.length;
    marker.position.set(building.x, building.height / 2, building.z);
    marker.rotation.set(0, building.rotation, 0);
    marker.scale.set(building.width, building.height, building.depth);
    marker.updateMatrix();
    bodies[palette].setMatrixAt(bodyCounts[palette], marker.matrix);
    bodyCounts[palette] += 1;

    const bands = skyline ? 5 : 3;
    for (let band = 0; band < bands; band += 1) {
      const y = building.height * (0.24 + band * (0.58 / Math.max(1, bands - 1)));
      marker.position.set(
        building.x + Math.sin(building.rotation) * (building.depth / 2 + 0.08),
        y,
        building.z + Math.cos(building.rotation) * (building.depth / 2 + 0.08)
      );
      marker.rotation.set(0, building.rotation, 0);
      marker.scale.set(building.width * 0.72, Math.max(0.8, building.height * 0.035), 1);
      marker.updateMatrix();
      windows.setMatrixAt(windowCount, marker.matrix);
      windowCount += 1;
    }
  }

  for (let index = 0; index < bodies.length; index += 1) {
    bodies[index].count = bodyCounts[index];
    bodies[index].instanceMatrix.needsUpdate = true;
    world.add(bodies[index]);
  }

  windows.count = windowCount;
  windows.instanceMatrix.needsUpdate = true;
  world.add(windows);
}

function makeNeonSigns(world) {
  for (const [label, x, y, z, rotation, color] of NEON_SIGNS) {
    const texture = makeSignTexture(label, color);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(label.length * 3.1 + 8, 8.5),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    sign.position.set(x, y, z);
    sign.rotation.y = rotation;
    world.add(sign);
  }
}

function makeSignTexture(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  const cssColor = `#${color.toString(16).padStart(6, '0')}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(5, 7, 15, 0.86)';
  context.fillRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.strokeStyle = cssColor;
  context.lineWidth = 10;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.shadowColor = cssColor;
  context.shadowBlur = 24;
  context.fillStyle = cssColor;
  context.font = '900 74px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStartFinishDistrict(world, samples, trackWidth) {
  const start = samples[0];
  const heading = Math.atan2(start.tangent.x, start.tangent.z);
  const line = new THREE.Group();
  line.name = 'Midnight City start finish';
  line.position.copy(start.point).setY(start.point.y + TRACK_Y + 0.08);
  line.rotation.y = heading;

  const stripeCount = 14;
  for (let stripe = 0; stripe < stripeCount; stripe += 1) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(trackWidth / stripeCount + 0.04, 0.04, 1.8),
      material(stripe % 2 ? 0xf7f1e8 : INK, 0.9)
    );
    tile.position.x = -trackWidth / 2 + (stripe + 0.5) * trackWidth / stripeCount;
    line.add(tile);
  }
  world.add(line);

  const gate = new THREE.Group();
  gate.name = 'Midnight City neon start gate';
  gate.position.copy(start.point).addScaledVector(start.tangent, 14).setY(start.point.y);
  gate.rotation.y = heading;

  const postGeometry = new THREE.BoxGeometry(0.9, 10.5, 0.9);
  const postMaterial = material(0x272b37, 0.62, 0.32);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(side * (trackWidth / 2 + 3.5), 5.25, 0);
    gate.add(post);
  }

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(trackWidth + 8, 1.2, 1.1),
    new THREE.MeshStandardMaterial({
      color: 0x171a24,
      emissive: WINDOW_MAGENTA,
      emissiveIntensity: 1.15,
      roughness: 0.55
    })
  );
  beam.position.y = 9.7;
  gate.add(beam);

  const signTexture = makeSignTexture('MIDNIGHT CITY', WINDOW_CYAN);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(trackWidth + 5, 4.2),
    new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, side: THREE.DoubleSide })
  );
  sign.position.set(0, 9.7, 0.62);
  gate.add(sign);
  world.add(gate);
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

return installMidnightCityWorld;
})();

// ==== Layer r2 (formerly midnight-city-world-r2.js) ====
const installMidnightCityLayerR2 = (() => {
const installMidnightCityWorldR1 = installMidnightCityLayerR1;

const WARM_LIGHT = 0xffd27a;
const PLAYER_FILL = 0xffe3b3;
const PLAYER_LIGHT_RIG_NAME = 'TURN Midnight City player light rig';
const STREET_POOL_NAME = 'Midnight City street-light road pools';

function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR1(options);
  const playerLightRig = installPlayerLightRig(options.runtime?.playerCar);
  const streetLightCount = strengthenStreetLights(world);
  const streetPools = makeStreetLightPools(world, options.samples || []);

  world.name = 'TURN Midnight City r2';
  world.userData.turnPlayerLightRig = playerLightRig;
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r2',
    playerVisibilityLight: 'dual invisible local fill',
    streetLightReach: 'stronger point lights and instanced road pools',
    strengthenedStreetLightCount: streetLightCount,
    streetLightPoolCount: streetPools?.count || 0,
    noIndependentAnimationLoop: true
  });

  return world;
}

function installPlayerLightRig(playerCar) {
  if (!playerCar) return null;

  const existing = playerCar.getObjectByName?.(PLAYER_LIGHT_RIG_NAME);
  if (existing) return existing;

  const rig = new THREE.Group();
  rig.name = PLAYER_LIGHT_RIG_NAME;

  if (graphicsProfile.pointLights) {
    for (const side of [-1, 1]) {
      const light = new THREE.PointLight(PLAYER_FILL, 6.2, 58, 1.72);
      light.name = `Midnight City player fill ${side < 0 ? 'left' : 'right'}`;
      light.position.set(side * 1.55, 2.85, 2.4);
      rig.add(light);
    }
  }

  playerCar.add(rig);
  rig.visible = true;
  rig.userData.turnTrackVisibility = 'midnight-city';

  window.addEventListener('turn:track-changed', (event) => {
    rig.visible = event.detail?.trackId === 'midnight-city';
  });

  return rig;
}

function strengthenStreetLights(world) {
  if (!graphicsProfile.pointLights) return 0;

  let count = 0;
  world.traverse((node) => {
    if (!node.isPointLight || node.color?.getHex() !== WARM_LIGHT) return;
    node.intensity = Math.max(node.intensity, 11.5);
    node.distance = Math.max(node.distance, 96);
    node.decay = 1.5;
    count += 1;
  });
  return count;
}

function makeStreetLightPools(world, samples) {
  if (!samples.length) return null;

  const step = 45;
  const count = Math.ceil(samples.length / step);
  const geometry = new THREE.CircleGeometry(11.5, 24);
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: WARM_LIGHT,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const pools = new THREE.InstancedMesh(geometry, poolMaterial, count);
  pools.name = STREET_POOL_NAME;
  pools.frustumCulled = false;

  const marker = new THREE.Object3D();
  let cursor = 0;
  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    marker.position.copy(sample.point).setY(sample.point.y + 0.205);
    marker.rotation.set(-Math.PI / 2, 0, 0);
    marker.scale.set(1, 1, 1);
    marker.updateMatrix();
    pools.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }

  pools.count = cursor;
  pools.instanceMatrix.needsUpdate = true;
  world.add(pools);
  return pools;
}

return installMidnightCityWorld;
})();

// ==== Layer r3 (formerly midnight-city-world-r3.js) ====
const installMidnightCityLayerR3 = (() => {
const installMidnightCityWorldR2 = installMidnightCityLayerR2;

const WARM_LIGHT = 0xffd27a;
const PLAYER_FILL = 0xffe3b3;
const LEFT_EDGE = 0x74e8ff;
const RIGHT_EDGE = 0xffd27a;
const PLAYER_LIGHT_RIG_NAME = 'TURN Midnight City player light rig';
const STREET_POOL_NAME = 'Midnight City street-light road pools';
const HEADLIGHT_PROJECTION_NAME = 'Midnight City projected headlights';
const EDGE_GUIDANCE_NAME = 'Midnight City reflective track borders';
const TRACK_Y = 0.16;

function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR2(options);
  const samples = options.samples || [];
  const trackWidth = options.trackWidth || 27;

  const removedPoolCount = removeUnanchoredStreetPools(world);
  const playerLighting = replacePlayerLighting(options.runtime?.playerCar);
  const streetLighting = alignSparseStreetLights(world, samples, trackWidth);
  const edgeGuidance = makeTrackBorderGuidance(world, samples, trackWidth);

  world.name = 'TURN Midnight City r3';
  world.userData.turnPlayerLightRig = playerLighting;
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r3',
    playerVisibilityLight: 'one short-range fill plus projected unlit headlights',
    streetLightReach: 'six sparse real lights anchored to visible lamp posts',
    randomRoadPoolsRemoved: removedPoolCount > 0,
    activeStreetLightCount: streetLighting.active,
    disabledStreetLightCount: streetLighting.disabled,
    trackBorderGuidance: 'continuous cyan-left amber-right reflective ribbons and studs',
    edgeGuidanceMeshes: edgeGuidance,
    noIndependentAnimationLoop: true
  });

  return world;
}

function removeUnanchoredStreetPools(world) {
  const pools = world.getObjectByName(STREET_POOL_NAME);
  if (!pools) return 0;

  pools.parent?.remove(pools);
  pools.geometry?.dispose?.();
  if (Array.isArray(pools.material)) {
    for (const entry of pools.material) entry.dispose?.();
  } else {
    pools.material?.dispose?.();
  }
  return pools.count || 1;
}

function replacePlayerLighting(playerCar) {
  if (!playerCar) return null;

  const rig = playerCar.getObjectByName?.(PLAYER_LIGHT_RIG_NAME);
  if (!rig) return null;

  for (const child of [...rig.children]) rig.remove(child);

  if (graphicsProfile.pointLights) {
    const fill = new THREE.PointLight(PLAYER_FILL, 3.1, 17, 2);
    fill.name = 'Midnight City player visibility fill';
    fill.position.set(0, 2.55, 0.45);
    rig.add(fill);
  }

  const headlights = new THREE.Group();
  headlights.name = HEADLIGHT_PROJECTION_NAME;
  headlights.add(
    makeHeadlightWedge({
      nearWidth: 3.8,
      farWidth: 17,
      nearZ: -1.7,
      farZ: -38,
      opacity: 0.075
    }),
    makeHeadlightWedge({
      nearWidth: 2.5,
      farWidth: 9.5,
      nearZ: -1.4,
      farZ: -28,
      opacity: 0.14
    })
  );
  rig.add(headlights);

  return rig;
}

function makeHeadlightWedge({ nearWidth, farWidth, nearZ, farZ, opacity }) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -nearWidth / 2, 0.24, nearZ,
    nearWidth / 2, 0.24, nearZ,
    -farWidth / 2, 0.24, farZ,
    farWidth / 2, 0.24, farZ
  ], 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.computeVertexNormals();

  const beam = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: PLAYER_FILL,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    })
  );
  beam.renderOrder = 5;
  return beam;
}

function alignSparseStreetLights(world, samples, trackWidth) {
  if (!samples.length) return { active: 0, disabled: 0 };

  const lights = [];
  world.traverse((node) => {
    if (node.isPointLight && node.color?.getHex() === WARM_LIGHT) lights.push(node);
  });

  if (!graphicsProfile.pointLights) {
    for (const light of lights) {
      light.visible = false;
      light.intensity = 0;
      light.userData.turnLowGraphicsDisabledLight = true;
    }
    return { active: 0, disabled: lights.length };
  }

  let active = 0;
  let disabled = 0;
  for (let index = 0; index < lights.length; index += 1) {
    const light = lights[index];
    if (index % 2 === 1) {
      light.visible = false;
      disabled += 1;
      continue;
    }

    const sampleIndex = (index * 90) % samples.length;
    const sample = samples[sampleIndex];
    const side = active % 2 === 0 ? 1 : -1;
    const bulbOffset = side * (trackWidth / 2 + 4.68);

    light.visible = true;
    light.position.copy(sample.point)
      .addScaledVector(sample.normal, bulbOffset)
      .setY(sample.point.y + 7.35);
    light.intensity = 7.2;
    light.distance = 62;
    light.decay = 1.9;
    light.name = `Midnight City anchored street light ${active + 1}`;
    active += 1;
  }

  return { active, disabled };
}

function makeTrackBorderGuidance(world, samples, trackWidth) {
  if (!samples.length) return 0;

  const guidance = new THREE.Group();
  guidance.name = EDGE_GUIDANCE_NAME;

  for (const side of [1, -1]) {
    const color = side > 0 ? LEFT_EDGE : RIGHT_EDGE;
    const ribbon = makeEdgeRibbon(samples, side, trackWidth, color);
    const studs = makeEdgeStuds(samples, side, trackWidth, color);
    guidance.add(ribbon, studs);
  }

  world.add(guidance);
  return guidance.children.length;
}

function makeEdgeRibbon(samples, side, trackWidth, color) {
  const halfWidth = trackWidth / 2;
  const ribbonWidth = 0.46;
  const centreOffset = side * (halfWidth - 0.18);
  const innerOffset = centreOffset - ribbonWidth / 2;
  const outerOffset = centreOffset + ribbonWidth / 2;
  const positions = [];
  const indices = [];

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const inner = sample.point.clone()
      .addScaledVector(sample.normal, innerOffset)
      .setY(sample.point.y + TRACK_Y + 0.085);
    const outer = sample.point.clone()
      .addScaledVector(sample.normal, outerOffset)
      .setY(sample.point.y + TRACK_Y + 0.085);
    positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
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
  geometry.setIndex(indices);

  const ribbon = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  ribbon.name = `Midnight City ${side > 0 ? 'left' : 'right'} reflective edge ribbon`;
  ribbon.renderOrder = 4;
  return ribbon;
}

function makeEdgeStuds(samples, side, trackWidth, color) {
  const step = 9;
  const count = Math.ceil(samples.length / step);
  const geometry = new THREE.BoxGeometry(0.48, 0.055, 1.35);
  const studs = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    count
  );
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    marker.position.copy(sample.point)
      .addScaledVector(sample.normal, side * (trackWidth / 2 - 0.72))
      .setY(sample.point.y + TRACK_Y + 0.125);
    marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    studs.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }

  studs.count = cursor;
  studs.instanceMatrix.needsUpdate = true;
  studs.name = `Midnight City ${side > 0 ? 'left' : 'right'} reflective edge studs`;
  studs.frustumCulled = false;
  return studs;
}

return installMidnightCityWorld;
})();

// ==== Layer r4 (formerly midnight-city-world-r4.js) ====
const installMidnightCityLayerR4 = (() => {
const installMidnightCityWorldR3 = installMidnightCityLayerR3;

const TRACK_Y = 0.16;
const WARM_LIGHT = 0xffd27a;
const WINDOW_GOLD = 0xffc857;
const WINDOW_CYAN = 0x5de4ff;
const WINDOW_MAGENTA = 0xff4fa3;
const BUILDING_COLORS = Object.freeze([0x171a25, 0x20283a, 0x2b2138]);
const OLD_WINDOW_COLORS = Object.freeze([WINDOW_GOLD, WINDOW_CYAN]);
const DISTRICT_WINDOW_COLORS = Object.freeze([WINDOW_MAGENTA, WINDOW_CYAN, WINDOW_GOLD, 0x9d7cff]);
const REMOVED_BORDER_PREFIXES = Object.freeze([
  'Midnight City road edge',
  'Midnight City sidewalk'
]);

const DISTRICTS = Object.freeze([
  Object.freeze({
    id: 'neon-quarter',
    label: 'NEON QUARTER',
    centerX: -360,
    centerZ: 35,
    width: 310,
    depth: 250,
    columns: 4,
    rows: 3,
    minHeight: 22,
    maxHeight: 66,
    windowColor: WINDOW_MAGENTA,
    bodyPalette: 2
  }),
  Object.freeze({
    id: 'downtown-core',
    label: 'DOWNTOWN',
    centerX: 315,
    centerZ: 70,
    width: 330,
    depth: 310,
    columns: 4,
    rows: 4,
    minHeight: 46,
    maxHeight: 132,
    windowColor: WINDOW_CYAN,
    bodyPalette: 1
  }),
  Object.freeze({
    id: 'uptown',
    label: 'UPTOWN',
    centerX: -120,
    centerZ: 260,
    width: 430,
    depth: 155,
    columns: 6,
    rows: 2,
    minHeight: 30,
    maxHeight: 86,
    windowColor: WINDOW_GOLD,
    bodyPalette: 0
  }),
  Object.freeze({
    id: 'motor-mile',
    label: 'MOTOR MILE',
    centerX: 180,
    centerZ: -285,
    width: 500,
    depth: 150,
    columns: 7,
    rows: 2,
    minHeight: 15,
    maxHeight: 44,
    windowColor: 0x9d7cff,
    bodyPalette: 1
  })
]);

function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR3(options);
  const samples = options.samples || [];
  const trackWidth = options.trackWidth || 27;

  const removedBorders = removeThickStreetBorders(world);
  const removedLegacyBuildings = removeLegacyBuildingInstances(world);
  const districtResult = installDistrictBuildings(world, samples, trackWidth);
  const lampPoolCount = installLampPostPools(world, samples, trackWidth);
  const detailCount = installDistrictDetails(world);

  world.name = 'TURN Midnight City r4';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r4',
    thickStreetBordersRemoved: removedBorders,
    legacyBuildingMeshesRemoved: removedLegacyBuildings,
    districtCount: DISTRICTS.length,
    districtBuildings: districtResult.buildingCount,
    districtBuildingsRejectedFromRoad: districtResult.rejectedCount,
    everyBuildingHasLitWindowBands: true,
    windowLightingTechnique: 'unlit emissive color bands on all four facades',
    lampPoolTechnique: 'one instanced radial-gradient quad beneath every visual lamp post',
    lampPoolCount,
    districtDetailCount: detailCount,
    externalAssetFiles: false,
    noIndependentAnimationLoop: true
  });

  return world;
}

function removeThickStreetBorders(world) {
  const removals = [];
  world.traverse((node) => {
    if (REMOVED_BORDER_PREFIXES.some((prefix) => node.name?.startsWith(prefix))) {
      removals.push(node);
    }
  });

  for (const node of removals) disposeAndRemove(node);
  return removals.length;
}

function removeLegacyBuildingInstances(world) {
  const removals = [];
  world.traverse((node) => {
    if (!node.isInstancedMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const isLegacyBuilding = materials.some((entry) => {
      const color = entry?.color?.getHex?.();
      const emissive = entry?.emissive?.getHex?.();
      return BUILDING_COLORS.includes(color) || OLD_WINDOW_COLORS.includes(emissive);
    });
    if (isLegacyBuilding) removals.push(node);
  });

  for (const node of removals) disposeAndRemove(node);
  return removals.length;
}

function disposeAndRemove(node) {
  node.parent?.remove(node);
  node.geometry?.dispose?.();
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  for (const entry of materials) {
    entry?.map?.dispose?.();
    entry?.dispose?.();
  }
}

function installDistrictBuildings(world, samples, trackWidth) {
  const buildings = [];
  let rejectedCount = 0;

  for (let districtIndex = 0; districtIndex < DISTRICTS.length; districtIndex += 1) {
    const district = DISTRICTS[districtIndex];
    const cellWidth = district.width / district.columns;
    const cellDepth = district.depth / district.rows;

    for (let row = 0; row < district.rows; row += 1) {
      for (let column = 0; column < district.columns; column += 1) {
        const seed = districtIndex * 101 + row * 19 + column * 31;
        const width = cellWidth * (0.48 + pseudo(seed + 1) * 0.22);
        const depth = cellDepth * (0.46 + pseudo(seed + 2) * 0.23);
        const height = district.minHeight
          + pseudo(seed + 3) * (district.maxHeight - district.minHeight);
        const x = district.centerX - district.width / 2
          + cellWidth * (column + 0.5)
          + (pseudo(seed + 4) - 0.5) * Math.min(14, cellWidth * 0.16);
        const z = district.centerZ - district.depth / 2
          + cellDepth * (row + 0.5)
          + (pseudo(seed + 5) - 0.5) * Math.min(12, cellDepth * 0.16);
        const footprintRadius = Math.hypot(width, depth) / 2;

        if (!isBuildingClearOfTrack(x, z, footprintRadius, samples, trackWidth)) {
          rejectedCount += 1;
          continue;
        }

        buildings.push({
          district,
          x,
          z,
          width,
          depth,
          height,
          palette: (district.bodyPalette + column + row) % BUILDING_COLORS.length,
          windowColor: district.windowColor,
          seed
        });
      }
    }
  }

  installBuildingBodies(world, buildings);
  installWindowBands(world, buildings);
  installRoofDetails(world, buildings);
  installDistantDistrictSkyline(world, samples, trackWidth);

  return { buildingCount: buildings.length, rejectedCount };
}

function isBuildingClearOfTrack(x, z, footprintRadius, samples, trackWidth) {
  const requiredDistance = trackWidth / 2 + footprintRadius + 6;
  const requiredDistanceSquared = requiredDistance * requiredDistance;
  for (let index = 0; index < samples.length; index += 3) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    if (dx * dx + dz * dz < requiredDistanceSquared) return false;
  }
  return true;
}

function installBuildingBodies(world, buildings) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = BUILDING_COLORS.map((color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.08
  }));
  const meshes = materials.map((entry, index) => {
    const mesh = new THREE.InstancedMesh(geometry, entry, buildings.length);
    mesh.name = `Midnight City district building bodies ${index + 1}`;
    return mesh;
  });
  const counts = materials.map(() => 0);
  const marker = new THREE.Object3D();

  for (const building of buildings) {
    marker.position.set(building.x, building.height / 2, building.z);
    marker.rotation.set(0, 0, 0);
    marker.scale.set(building.width, building.height, building.depth);
    marker.updateMatrix();
    meshes[building.palette].setMatrixAt(counts[building.palette], marker.matrix);
    counts[building.palette] += 1;
  }

  for (let index = 0; index < meshes.length; index += 1) {
    const mesh = meshes[index];
    mesh.count = counts[index];
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }
}

function installWindowBands(world, buildings) {
  const geometry = new THREE.BoxGeometry(1, 1, 0.08);
  const byColor = new Map(DISTRICT_WINDOW_COLORS.map((color) => [color, []]));

  for (const building of buildings) {
    const bands = Math.max(2, Math.min(8, Math.floor(building.height / 12)));
    for (let band = 0; band < bands; band += 1) {
      const y = building.height * (0.2 + band * (0.64 / Math.max(1, bands - 1)));
      const bandHeight = Math.max(0.72, Math.min(1.7, building.height * 0.024));
      const entries = byColor.get(building.windowColor);
      entries.push(
        facadeTransform(building.x, y, building.z + building.depth / 2 + 0.07, 0, building.width * 0.72, bandHeight),
        facadeTransform(building.x, y, building.z - building.depth / 2 - 0.07, Math.PI, building.width * 0.72, bandHeight),
        facadeTransform(building.x + building.width / 2 + 0.07, y, building.z, Math.PI / 2, building.depth * 0.72, bandHeight),
        facadeTransform(building.x - building.width / 2 - 0.07, y, building.z, -Math.PI / 2, building.depth * 0.72, bandHeight)
      );
    }
  }

  for (const [color, transforms] of byColor) {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      Math.max(1, transforms.length)
    );
    mesh.name = `Midnight City lit windows ${color.toString(16)}`;
    const marker = new THREE.Object3D();
    for (let index = 0; index < transforms.length; index += 1) {
      const transform = transforms[index];
      marker.position.set(transform.x, transform.y, transform.z);
      marker.rotation.set(0, transform.rotation, 0);
      marker.scale.set(transform.width, transform.height, 1);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }
}

function facadeTransform(x, y, z, rotation, width, height) {
  return { x, y, z, rotation, width, height };
}

function installRoofDetails(world, buildings) {
  const crownGeometry = new THREE.BoxGeometry(1, 1, 1);
  const crownTransforms = [];
  const antennaTransforms = [];

  for (const building of buildings) {
    if (building.height > 60) {
      crownTransforms.push({
        x: building.x,
        y: building.height + 1.2,
        z: building.z,
        width: building.width * 0.55,
        height: 2.4,
        depth: building.depth * 0.55,
        color: building.windowColor
      });
    }
    if (building.height > 92 && pseudo(building.seed + 17) > 0.42) {
      antennaTransforms.push({
        x: building.x,
        y: building.height + 7,
        z: building.z,
        height: 14,
        color: building.windowColor
      });
    }
  }

  const crownsByColor = groupByColor(crownTransforms);
  for (const [color, transforms] of crownsByColor) {
    const mesh = new THREE.InstancedMesh(
      crownGeometry,
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      Math.max(1, transforms.length)
    );
    mesh.name = `Midnight City rooftop crowns ${color.toString(16)}`;
    const marker = new THREE.Object3D();
    for (let index = 0; index < transforms.length; index += 1) {
      const entry = transforms[index];
      marker.position.set(entry.x, entry.y, entry.z);
      marker.scale.set(entry.width, entry.height, entry.depth);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }

  const antennaGeometry = new THREE.BoxGeometry(0.28, 1, 0.28);
  const antennasByColor = groupByColor(antennaTransforms);
  for (const [color, transforms] of antennasByColor) {
    const mesh = new THREE.InstancedMesh(
      antennaGeometry,
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      Math.max(1, transforms.length)
    );
    mesh.name = `Midnight City rooftop antennas ${color.toString(16)}`;
    const marker = new THREE.Object3D();
    for (let index = 0; index < transforms.length; index += 1) {
      const entry = transforms[index];
      marker.position.set(entry.x, entry.y, entry.z);
      marker.scale.set(1, entry.height, 1);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }
}

function groupByColor(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.color)) groups.set(entry.color, []);
    groups.get(entry.color).push(entry);
  }
  return groups;
}

function installDistantDistrictSkyline(world, samples, trackWidth) {
  const buildings = [];
  for (let index = 0; index < 40; index += 1) {
    const angle = (index / 40) * Math.PI * 2;
    const radiusX = 690 + pseudo(index * 9) * 110;
    const radiusZ = 505 + pseudo(index * 13 + 2) * 85;
    const width = 24 + pseudo(index * 17) * 42;
    const depth = 24 + pseudo(index * 19) * 40;
    const height = 82 + pseudo(index * 23) * 150;
    const x = Math.cos(angle) * radiusX;
    const z = Math.sin(angle) * radiusZ;
    if (!isBuildingClearOfTrack(x, z, Math.hypot(width, depth) / 2, samples, trackWidth)) continue;
    buildings.push({
      district: DISTRICTS[index % DISTRICTS.length],
      x,
      z,
      width,
      depth,
      height,
      palette: index % BUILDING_COLORS.length,
      windowColor: DISTRICT_WINDOW_COLORS[index % DISTRICT_WINDOW_COLORS.length],
      seed: index * 41
    });
  }
  installBuildingBodies(world, buildings);
  installWindowBands(world, buildings);
  installRoofDetails(world, buildings);
}

function installLampPostPools(world, samples, trackWidth) {
  if (!samples.length) return 0;

  const step = 10;
  const perSide = Math.ceil(samples.length / step);
  const total = perSide * 2;
  const texture = makeRadialLightTexture();
  const geometry = new THREE.PlaneGeometry(17, 17);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: WARM_LIGHT,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const pools = new THREE.InstancedMesh(geometry, material, total);
  pools.name = 'Midnight City lamp-post gradient pools';
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (const side of [-1, 1]) {
    for (let index = 0; index < samples.length; index += step) {
      const sample = samples[index];
      const bulbOffset = side * (trackWidth / 2 + 4.68);
      marker.position.copy(sample.point)
        .addScaledVector(sample.normal, bulbOffset)
        .setY(sample.point.y + TRACK_Y + 0.07);
      marker.rotation.set(-Math.PI / 2, 0, 0);
      marker.scale.set(1, 1, 1);
      marker.updateMatrix();
      pools.setMatrixAt(cursor, marker.matrix);
      cursor += 1;
    }
  }

  pools.count = cursor;
  pools.instanceMatrix.needsUpdate = true;
  pools.computeBoundingSphere?.();
  pools.renderOrder = 3;
  world.add(pools);
  return cursor;
}

function makeRadialLightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 230, 150, 0.72)');
  gradient.addColorStop(0.34, 'rgba(255, 202, 92, 0.33)');
  gradient.addColorStop(1, 'rgba(255, 196, 70, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function installDistrictDetails(world) {
  let count = 0;
  for (const [index, district] of DISTRICTS.entries()) {
    const sign = makeDistrictSign(district.label, district.windowColor);
    const position = districtSignPosition(index);
    sign.position.set(position.x, position.y, position.z);
    sign.rotation.y = position.rotation;
    world.add(sign);
    count += 1;
  }

  const downtownSpireMaterial = new THREE.MeshBasicMaterial({ color: WINDOW_CYAN, toneMapped: false });
  for (const [x, z, height] of [[270, 205, 72], [350, 210, 58]]) {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.2, height, 5), downtownSpireMaterial);
    spire.position.set(x, height / 2, z);
    world.add(spire);
    count += 1;
  }

  const canopyMaterial = new THREE.MeshBasicMaterial({ color: 0x9d7cff, toneMapped: false });
  for (const x of [-10, 70, 150, 230, 310]) {
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(34, 0.55, 9), canopyMaterial);
    canopy.position.set(x, 7.5, -325);
    world.add(canopy);
    count += 1;
  }

  return count;
}

function districtSignPosition(index) {
  return [
    { x: -470, y: 22, z: 35, rotation: Math.PI / 2 },
    { x: 455, y: 28, z: 70, rotation: -Math.PI / 2 },
    { x: -120, y: 22, z: 325, rotation: Math.PI },
    { x: 180, y: 16, z: -345, rotation: 0 }
  ][index];
}

function makeDistrictSign(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const cssColor = `#${color.toString(16).padStart(6, '0')}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(5, 7, 15, 0.9)';
  context.fillRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.strokeStyle = cssColor;
  context.lineWidth = 9;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = cssColor;
  context.font = '900 62px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(28, label.length * 3.1), 7.5),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false
    })
  );
  sign.name = `Midnight City district sign ${label}`;
  return sign;
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

return installMidnightCityWorld;
})();

// ==== Layer r5 (formerly midnight-city-world-r5.js) ====
const installMidnightCityLayerR5 = (() => {
const installMidnightCityWorldR4 = installMidnightCityLayerR4;

const TRACK_Y = 0.16;
const CITY_BUILDER_COMMIT = '4535092b740b378b700efd9df9e27a631815b84a';
const CITY_MODEL_BASE = `https://cdn.jsdelivr.net/gh/KenneyNL/Starter-Kit-City-Builder@${CITY_BUILDER_COMMIT}/models/`;
const FOUNTAIN_ASSET = `${CITY_MODEL_BASE}pavement-fountain.glb`;

const COLORS = Object.freeze({
  ink: 0x070a14,
  park: 0x10251f,
  parkPath: 0x29323b,
  pond: 0x16465e,
  water: 0x79eeff,
  lamp: 0xffffd8,
  purple: 0x9d7cff,
  cyan: 0x5de4ff,
  yellow: 0xffdc68,
  pink: 0xff4fa3,
  orange: 0xff8f3d,
  airport: 0xffd43b,
  cliffside: 0x26c7c3
});

const DISTRICTS = Object.freeze([
  Object.freeze({
    id: 'neon-quarter',
    label: 'NEON QUARTER',
    color: COLORS.pink,
    centerX: -360,
    centerZ: 35,
    width: 310,
    depth: 250
  }),
  Object.freeze({
    id: 'downtown-core',
    label: 'DOWNTOWN',
    color: COLORS.cyan,
    centerX: 315,
    centerZ: 70,
    width: 330,
    depth: 310
  }),
  Object.freeze({
    id: 'uptown',
    label: 'UPTOWN',
    color: COLORS.yellow,
    centerX: -120,
    centerZ: 260,
    width: 430,
    depth: 155
  }),
  Object.freeze({
    id: 'motor-mile',
    label: 'MOTOR MILE',
    color: COLORS.purple,
    centerX: 180,
    centerZ: -285,
    width: 500,
    depth: 150
  })
]);

const PARKS = Object.freeze([
  Object.freeze({
    id: 'turn-commons',
    label: 'TURN COMMONS',
    x: 0,
    z: 72,
    radius: 49,
    color: COLORS.cyan,
    pond: true,
    fountain: true
  }),
  Object.freeze({
    id: 'violet-gardens',
    label: 'VIOLET GARDENS',
    x: -418,
    z: -286,
    radius: 42,
    color: COLORS.purple,
    pond: false,
    fountain: false
  }),
  Object.freeze({
    id: 'sunrise-park',
    label: 'SUNRISE PARK',
    x: 405,
    z: 292,
    radius: 44,
    color: COLORS.yellow,
    pond: true,
    fountain: false
  })
]);

const LORE_ROADS = Object.freeze([
  Object.freeze({ label: 'BOOST STREET', color: 0xff6b6b, sampleRatio: 0.05, side: -1 }),
  Object.freeze({ label: 'TURN AVENUE', color: COLORS.cyan, sampleRatio: 0.24, side: 1 }),
  Object.freeze({ label: 'DRIFT LANE', color: 0x55c9ed, sampleRatio: 0.43, side: -1 }),
  Object.freeze({ label: 'AIRPORT', color: COLORS.airport, sampleRatio: 0.61, side: 1 }),
  Object.freeze({ label: 'HARBOR', color: COLORS.orange, sampleRatio: 0.79, side: -1 }),
  Object.freeze({ label: 'CLIFFSIDE', color: COLORS.cliffside, sampleRatio: 0.91, side: 1 })
]);

const loader = new GLTFLoader();
let fountainSourcePromise = null;

function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR4(options);
  const samples = options.samples || [];
  const trackWidth = options.trackWidth || 27;

  const lampPoolUpdated = brightenLampPools(world);
  const parkResult = installParks(world, samples, trackWidth);
  const districtResult = installDistrictColorLanguage(world, samples, trackWidth);
  const loreResult = installLoreRoads(world, samples, trackWidth);
  const skylineResult = installSkylineBillboards(world);
  installKenneyFountain(world, parkResult.fountainAnchor);

  world.name = 'TURN Midnight City r5';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r5',
    lampPoolColor: 'lighter warm yellow with a pale centre',
    lampPoolUpdated,
    parkCount: parkResult.count,
    parkTreeCount: parkResult.treeCount,
    pondCount: parkResult.pondCount,
    fountainTechnique: 'static neon water plus one asynchronously loaded pinned Kenney CC0 fountain model',
    districtIdentity: 'pink, cyan, yellow and purple entrance stripes plus matching edge pylons',
    districtEntranceCount: districtResult.entrances,
    districtPylonCount: districtResult.pylons,
    loreRoadCount: loreResult.roads,
    loreSignCount: loreResult.signs,
    loreRoadsAreOutsideRaceBoundary: true,
    skylineTechnique: 'six low-detail generated skyline texture billboards',
    skylinePanelCount: skylineResult.panels,
    externalAssetFiles: true,
    externalAssetSource: 'Kenney Starter Kit City Builder, pinned commit, CC0',
    noIndependentAnimationLoop: true
  });

  return world;
}

function brightenLampPools(world) {
  const pools = world.getObjectByName('Midnight City lamp-post gradient pools');
  if (!pools?.material) return false;

  const material = pools.material;
  material.map?.dispose?.();
  material.map = makeRadialLightTexture();
  material.color.setHex(COLORS.lamp);
  material.opacity = 0.72;
  material.needsUpdate = true;
  return true;
}

function makeRadialLightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 234, 0.98)');
  gradient.addColorStop(0.2, 'rgba(255, 247, 181, 0.76)');
  gradient.addColorStop(0.5, 'rgba(255, 222, 105, 0.34)');
  gradient.addColorStop(1, 'rgba(255, 218, 92, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function installParks(world, samples, trackWidth) {
  const accepted = PARKS.filter((park) => isAreaClearOfTrack(
    park.x,
    park.z,
    park.radius + 8,
    samples,
    trackWidth
  ));

  const treeTrunks = [];
  const treeCrowns = [];
  let pondCount = 0;
  let fountainAnchor = null;

  for (const park of accepted) {
    const group = new THREE.Group();
    group.name = `Midnight City park ${park.label}`;
    group.position.set(park.x, 0, park.z);

    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(park.radius, 48),
      new THREE.MeshStandardMaterial({
        color: COLORS.park,
        roughness: 0.95,
        metalness: 0
      })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = TRACK_Y + 0.015;
    group.add(lawn);

    const path = new THREE.Mesh(
      new THREE.RingGeometry(park.radius * 0.54, park.radius * 0.67, 48),
      new THREE.MeshBasicMaterial({
        color: COLORS.parkPath,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.y = TRACK_Y + 0.035;
    group.add(path);

    const outline = new THREE.Mesh(
      new THREE.RingGeometry(park.radius * 0.96, park.radius, 48),
      new THREE.MeshBasicMaterial({
        color: park.color,
        transparent: true,
        opacity: 0.76,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = TRACK_Y + 0.055;
    group.add(outline);

    if (park.pond) {
      const pond = new THREE.Mesh(
        new THREE.CircleGeometry(park.radius * 0.29, 40),
        new THREE.MeshBasicMaterial({
          color: COLORS.pond,
          transparent: true,
          opacity: 0.94,
          side: THREE.DoubleSide,
          toneMapped: false
        })
      );
      pond.scale.set(1.4, 0.72, 1);
      pond.rotation.x = -Math.PI / 2;
      pond.rotation.z = park.id === 'sunrise-park' ? 0.7 : -0.35;
      pond.position.set(park.radius * 0.14, TRACK_Y + 0.06, -park.radius * 0.08);
      group.add(pond);

      const pondGlow = new THREE.Mesh(
        new THREE.RingGeometry(park.radius * 0.27, park.radius * 0.31, 40),
        new THREE.MeshBasicMaterial({
          color: COLORS.water,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
          toneMapped: false
        })
      );
      pondGlow.scale.copy(pond.scale);
      pondGlow.rotation.copy(pond.rotation);
      pondGlow.position.copy(pond.position);
      pondGlow.position.y += 0.01;
      group.add(pondGlow);
      pondCount += 1;
    }

    addParkLabel(group, park);
    addParkBenches(group, park);

    for (let index = 0; index < 15; index += 1) {
      const angle = (index / 15) * Math.PI * 2 + pseudo(index + park.x) * 0.22;
      const radius = park.radius * (0.72 + pseudo(index * 13 + park.z) * 0.18);
      const x = park.x + Math.cos(angle) * radius;
      const z = park.z + Math.sin(angle) * radius;
      const height = 4.8 + pseudo(index * 31 + park.x - park.z) * 3.8;
      treeTrunks.push({ x, z, height: height * 0.42 });
      treeCrowns.push({
        x,
        z,
        y: height * 0.76,
        radius: 1.8 + height * 0.22,
        height: height * 0.82,
        color: park.color
      });
    }

    if (park.fountain) {
      fountainAnchor = new THREE.Vector3(
        park.x - park.radius * 0.2,
        TRACK_Y,
        park.z + park.radius * 0.12
      );
      addProceduralFountain(group, park, fountainAnchor.clone().sub(group.position));
    }

    world.add(group);
  }

  installParkTrees(world, treeTrunks, treeCrowns);
  return {
    count: accepted.length,
    treeCount: treeCrowns.length,
    pondCount,
    fountainAnchor
  };
}

function isAreaClearOfTrack(x, z, radius, samples, trackWidth) {
  const required = radius + trackWidth / 2 + 5;
  const requiredSquared = required * required;
  for (let index = 0; index < samples.length; index += 3) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    if (dx * dx + dz * dz < requiredSquared) return false;
  }
  return true;
}

function addParkLabel(group, park) {
  const sign = makeNeonSign(park.label, park.color, { arrow: false, width: 30 });
  sign.position.set(0, 4.5, -park.radius * 0.76);
  sign.rotation.y = 0;
  group.add(sign);
}

function addParkBenches(group, park) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x5d3c2a,
    roughness: 0.88,
    metalness: 0.04
  });
  for (const angle of [0.65, 2.6, 4.55]) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.45, 1.6), material);
    seat.position.y = 1.05;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.9, 0.35), material);
    back.position.set(0, 1.85, -0.62);
    back.rotation.x = -0.1;
    bench.add(back);
    for (const x of [-2.1, 2.1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), material);
      leg.position.set(x, 0.55, 0);
      bench.add(leg);
    }
    const radius = park.radius * 0.46;
    bench.position.set(Math.cos(angle) * radius, TRACK_Y, Math.sin(angle) * radius);
    bench.rotation.y = -angle + Math.PI / 2;
    group.add(bench);
  }
}

function addProceduralFountain(group, park, localPosition) {
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x8793a6,
    roughness: 0.58,
    metalness: 0.18
  });
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.water,
    transparent: true,
    opacity: 0.88,
    toneMapped: false
  });
  const fountain = new THREE.Group();
  fountain.name = 'Midnight City neon fountain fallback';
  fountain.position.copy(localPosition);

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.8, 1.1, 40), baseMaterial);
  basin.position.y = 0.55;
  fountain.add(basin);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 0.18, 40), waterMaterial);
  water.position.y = 1.18;
  fountain.add(water);

  const centre = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.7, 4.8, 20), baseMaterial);
  centre.position.y = 3.4;
  fountain.add(centre);

  const jet = new THREE.Mesh(new THREE.ConeGeometry(1.7, 10.5, 20, 1, true), waterMaterial);
  jet.position.y = 8.2;
  fountain.add(jet);

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(7.5, 8.2, 40),
    new THREE.MeshBasicMaterial({
      color: park.color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 1.25;
  fountain.add(glow);
  group.add(fountain);
}

function installParkTrees(world, trunks, crowns) {
  if (!crowns.length) return;

  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.32, 0.5, 1, 7),
    new THREE.MeshStandardMaterial({ color: 0x4b3024, roughness: 1 }),
    trunks.length
  );
  trunkMesh.name = 'Midnight City park tree trunks';

  const crownMaterials = new Map();
  for (const crown of crowns) {
    if (!crownMaterials.has(crown.color)) crownMaterials.set(crown.color, []);
    crownMaterials.get(crown.color).push(crown);
  }

  const marker = new THREE.Object3D();
  for (let index = 0; index < trunks.length; index += 1) {
    const trunk = trunks[index];
    marker.position.set(trunk.x, TRACK_Y + trunk.height / 2, trunk.z);
    marker.scale.set(1, trunk.height, 1);
    marker.rotation.set(0, pseudo(index) * Math.PI, 0);
    marker.updateMatrix();
    trunkMesh.setMatrixAt(index, marker.matrix);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  world.add(trunkMesh);

  for (const [color, entries] of crownMaterials) {
    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 8),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).multiplyScalar(0.34),
        roughness: 0.94,
        metalness: 0
      }),
      entries.length
    );
    mesh.name = `Midnight City park crowns ${color.toString(16)}`;
    for (let index = 0; index < entries.length; index += 1) {
      const crown = entries[index];
      marker.position.set(crown.x, TRACK_Y + crown.y, crown.z);
      marker.scale.set(crown.radius, crown.height, crown.radius);
      marker.rotation.set(0, pseudo(index + color) * Math.PI, 0);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
  }
}

function installDistrictColorLanguage(world, samples, trackWidth) {
  let entranceCount = 0;
  const pylonsByColor = new Map(DISTRICTS.map((district) => [district.color, []]));

  for (const district of DISTRICTS) {
    const matchingIndices = [];
    for (let index = 0; index < samples.length; index += 1) {
      const point = samples[index].point;
      if (
        Math.abs(point.x - district.centerX) <= district.width / 2 + 35 &&
        Math.abs(point.z - district.centerZ) <= district.depth / 2 + 35
      ) {
        matchingIndices.push(index);
      }
    }
    if (!matchingIndices.length) continue;

    const entranceIndex = matchingIndices[0];
    const entrance = samples[entranceIndex];
    const stripeGroup = new THREE.Group();
    stripeGroup.name = `Midnight City district entrance ${district.label}`;
    const angle = Math.atan2(entrance.tangent.x, entrance.tangent.z);
    stripeGroup.position.copy(entrance.point).setY(entrance.point.y + TRACK_Y + 0.08);
    stripeGroup.rotation.y = angle;
    for (let stripe = -2; stripe <= 2; stripe += 1) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(trackWidth * 0.86, 0.055, 0.62),
        new THREE.MeshBasicMaterial({
          color: district.color,
          transparent: true,
          opacity: 0.82,
          toneMapped: false
        })
      );
      bar.position.z = stripe * 1.25;
      stripeGroup.add(bar);
    }
    world.add(stripeGroup);
    entranceCount += 1;

    for (let cursor = 0; cursor < matchingIndices.length; cursor += 22) {
      const sample = samples[matchingIndices[cursor]];
      for (const side of [-1, 1]) {
        const position = sample.point.clone()
          .addScaledVector(sample.normal, side * (trackWidth / 2 + 2.9));
        pylonsByColor.get(district.color).push({
          x: position.x,
          y: sample.point.y + 2.2,
          z: position.z,
          rotation: Math.atan2(sample.tangent.x, sample.tangent.z)
        });
      }
    }
  }

  let pylonCount = 0;
  for (const [color, entries] of pylonsByColor) {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.42, 4.4, 0.42),
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      Math.max(1, entries.length)
    );
    mesh.name = `Midnight City district edge pylons ${color.toString(16)}`;
    const marker = new THREE.Object3D();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      marker.position.set(entry.x, entry.y, entry.z);
      marker.rotation.set(0, entry.rotation, 0);
      marker.scale.set(1, 1, 1);
      marker.updateMatrix();
      mesh.setMatrixAt(index, marker.matrix);
    }
    mesh.count = entries.length;
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
    pylonCount += entries.length;
  }

  return { entrances: entranceCount, pylons: pylonCount };
}

function installLoreRoads(world, samples, trackWidth) {
  if (!samples.length) return { roads: 0, signs: 0 };

  let roadCount = 0;
  let signCount = 0;
  for (const lore of LORE_ROADS) {
    const index = Math.round(lore.sampleRatio * (samples.length - 1));
    const sample = samples[index];
    const outward = sample.normal.clone().multiplyScalar(lore.side);
    const group = new THREE.Group();
    group.name = `Midnight City inaccessible lore road ${lore.label}`;
    group.position.copy(sample.point)
      .addScaledVector(outward, trackWidth / 2 + 39)
      .setY(sample.point.y + TRACK_Y);
    group.rotation.y = Math.atan2(outward.x, outward.z);

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.16, 64),
      new THREE.MeshStandardMaterial({
        color: 0x101522,
        roughness: 0.9,
        metalness: 0.02
      })
    );
    road.position.z = 25;
    group.add(road);

    const centreLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.08, 48),
      new THREE.MeshBasicMaterial({
        color: lore.color,
        transparent: true,
        opacity: 0.74,
        toneMapped: false
      })
    );
    centreLine.position.set(0, 0.13, 28);
    group.add(centreLine);

    const barrier = makeRoadBarrier(lore.color);
    barrier.position.set(0, 1.15, -1.5);
    group.add(barrier);

    const sign = makeNeonSign(lore.label, lore.color, { arrow: true, width: 28 });
    sign.position.set(lore.side > 0 ? -12 : 12, 7.8, -4);
    sign.rotation.y = lore.side > 0 ? 0.12 : -0.12;
    group.add(sign);

    const closedPlate = makeNeonSign('ROAD CLOSED', 0xfff0c2, { arrow: false, width: 19 });
    closedPlate.position.set(0, 3.5, 3.5);
    closedPlate.scale.setScalar(0.64);
    group.add(closedPlate);

    world.add(group);
    roadCount += 1;
    signCount += 2;
  }

  return { roads: roadCount, signs: signCount };
}

function makeRoadBarrier(color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x131722,
    roughness: 0.78,
    metalness: 0.16
  });
  const glow = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 1), material);
  group.add(beam);
  for (const x of [-6.5, -2.2, 2.2, 6.5]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.52, 1.08), glow);
    panel.position.set(x, 0, 0);
    panel.rotation.z = 0.25;
    group.add(panel);
  }
  for (const x of [-6.8, 6.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.7, 0.7), material);
    post.position.set(x, -1.25, 0);
    group.add(post);
  }
  return group;
}

function makeNeonSign(label, color, { arrow = false, width = 28 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  const cssColor = `#${color.toString(16).padStart(6, '0')}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(3, 5, 12, 0.92)';
  context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.shadowColor = cssColor;
  context.shadowBlur = 18;
  context.strokeStyle = cssColor;
  context.lineWidth = 12;
  context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  context.shadowBlur = 12;
  context.fillStyle = cssColor;
  context.font = '900 78px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${arrow ? '← ' : ''}${label}`, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * 0.25),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  sign.name = `Midnight City neon sign ${label}`;
  return sign;
}

function installSkylineBillboards(world) {
  const texture = makeSkylineTexture();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: true
  });
  const radius = 960;
  const panelCount = 6;

  for (let index = 0; index < panelCount; index += 1) {
    const angle = (index / panelCount) * Math.PI * 2;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(520, 190), material);
    panel.name = `Midnight City skyline billboard ${index + 1}`;
    panel.position.set(Math.cos(angle) * radius, 88, Math.sin(angle) * radius);
    panel.rotation.y = -angle - Math.PI / 2;
    panel.renderOrder = -2;
    world.add(panel);
  }

  return { panels: panelCount };
}

function makeSkylineTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  const skyGradient = context.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, 'rgba(10, 13, 32, 0)');
  skyGradient.addColorStop(1, 'rgba(5, 7, 18, 0.94)');
  context.fillStyle = skyGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  let x = 0;
  let building = 0;
  while (x < canvas.width) {
    const width = 28 + Math.floor(pseudo(building * 17 + 3) * 58);
    const height = 70 + Math.floor(pseudo(building * 23 + 7) * 240);
    const y = canvas.height - height;
    context.fillStyle = building % 3 === 0 ? '#0b1024' : '#080c1c';
    context.fillRect(x, y, width, height);

    const windowColor = ['#5de4ff', '#ffdc68', '#ff4fa3', '#9d7cff'][building % 4];
    context.fillStyle = windowColor;
    context.globalAlpha = 0.34;
    for (let wy = y + 18; wy < canvas.height - 12; wy += 22) {
      for (let wx = x + 9; wx < x + width - 7; wx += 18) {
        if (pseudo(wx * 0.7 + wy * 1.3) > 0.55) context.fillRect(wx, wy, 7, 3);
      }
    }
    context.globalAlpha = 1;
    x += width + 6;
    building += 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function installKenneyFountain(world, anchor) {
  if (!anchor) return;
  fountainSourcePromise ||= loader.loadAsync(FOUNTAIN_ASSET).then((gltf) => gltf.scene);

  fountainSourcePromise
    .then((source) => {
      if (!world.parent) return;
      const model = prepareAsset(source, {
        targetSize: 17,
        tint: COLORS.cyan,
        tintAmount: 0.22
      });
      model.name = 'Midnight City Kenney fountain landmark';
      model.position.copy(anchor);
      model.position.y += 0.35;
      model.rotation.y = Math.PI / 4;
      world.add(model);

      const plaque = makeNeonSign('TURN COMMONS', COLORS.cyan, { arrow: false, width: 23 });
      plaque.position.copy(anchor).add(new THREE.Vector3(0, 5.8, -11));
      world.add(plaque);
    })
    .catch((error) => {
      console.warn('TURN: Midnight City fountain asset failed to load; procedural fountain remains.', error);
    });
}

function prepareAsset(source, { targetSize, tint, tintAmount }) {
  const model = source.clone(true);
  const tintColor = new THREE.Color(tint);
  model.traverse((node) => {
    if (!node.isMesh) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const materials = sourceMaterials.map((material) => {
      const clone = material.clone();
      clone.color?.lerp(tintColor, tintAmount);
      clone.roughness = Math.max(clone.roughness ?? 0.75, 0.72);
      clone.metalness = Math.min(clone.metalness ?? 0.08, 0.16);
      return clone;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0];
  });

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(model);
  const centre = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= centre.z;
  return model;
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

return installMidnightCityWorld;
})();

// ==== Layer r6 (formerly midnight-city-world-r6.js) ====
const installMidnightCityLayerR6 = (() => {
const installMidnightCityWorldR5 = installMidnightCityLayerR5;

const TRACK_Y = 0.16;
const SHOWCASE_CENTER = Object.freeze({ x: 80, z: 75 });
const SHOWCASE_FOUNTAIN = Object.freeze({ x: 20, z: -27 });
const SHOWCASE_ASSET_SCALE = 1.42;

const COLORS = Object.freeze({
  ink: 0x070a14,
  lawn: 0x102a22,
  lawnAccent: 0x16382d,
  path: 0x343d49,
  pathLight: 0x596677,
  water: 0x143f58,
  waterGlow: 0x79eeff,
  cyan: 0x5de4ff,
  paleCyan: 0xb8f7ff,
  warmWhite: 0xfff4cf,
  trunk: 0x4b3024,
  foliage: 0x174f40,
  violet: 0x9d7cff,
  yellow: 0xffdc68,
  bench: 0x6a432d
});

const OTHER_PARKS = Object.freeze([
  Object.freeze({ x: -418, z: -286, radius: 42, color: COLORS.violet }),
  Object.freeze({ x: 405, z: 292, radius: 44, color: COLORS.yellow })
]);

function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR5(options);

  const hiddenOriginal = hideOriginalCommons(world);
  const removedLegacyTrees = removeLegacyParkTrees(world);
  const showcase = installTracksideCommons(world);
  const treeCount = installReframedParkTrees(world);
  const assetRedirectInstalled = redirectAsyncFountainAsset(world, showcase);

  world.name = 'TURN Midnight City r6';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r6',
    originalCommonsHidden: hiddenOriginal,
    originalParkTreeMeshesRemoved: removedLegacyTrees,
    showcasePark: 'TURN COMMONS moved to the central trackside block and framed as an approach landmark',
    showcaseParkCenter: Object.freeze({ ...SHOWCASE_CENTER }),
    showcaseFountainPosition: Object.freeze({
      x: SHOWCASE_CENTER.x + SHOWCASE_FOUNTAIN.x,
      z: SHOWCASE_CENTER.z + SHOWCASE_FOUNTAIN.z
    }),
    showcaseComposition: 'road-facing fountain plaza, axial promenade, reflecting pond, bridge, paths, benches and framed trees',
    showcaseTreeCount: treeCount,
    kenneyFountainRedirectedToShowcase: assetRedirectInstalled,
    noDynamicLightsAdded: true,
    noIndependentAnimationLoop: true
  });

  return world;
}

function hideOriginalCommons(world) {
  const original = world.getObjectByName('Midnight City park TURN COMMONS');
  if (!original) return false;
  original.visible = false;
  original.name = 'Midnight City retired park TURN COMMONS';
  return true;
}

function removeLegacyParkTrees(world) {
  const removals = [];
  world.traverse((node) => {
    if (
      node.name === 'Midnight City park tree trunks' ||
      node.name?.startsWith('Midnight City park crowns ')
    ) {
      removals.push(node);
    }
  });

  for (const node of removals) {
    node.parent?.remove(node);
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) material?.dispose?.();
  }
  return removals.length;
}

function installTracksideCommons(world) {
  const group = new THREE.Group();
  group.name = 'Midnight City showcase park TURN COMMONS';
  group.position.set(SHOWCASE_CENTER.x, 0, SHOWCASE_CENTER.z);

  addParkGround(group);
  addParkPaths(group);
  addReflectingWater(group);
  const fallback = addShowcaseFountain(group);
  addParkFurniture(group);
  addParkLanterns(group);
  addParkTitle(group);

  world.add(group);

  return {
    group,
    fallback,
    fountainAnchor: new THREE.Vector3(
      SHOWCASE_CENTER.x + SHOWCASE_FOUNTAIN.x,
      TRACK_Y,
      SHOWCASE_CENTER.z + SHOWCASE_FOUNTAIN.z
    ),
    plaqueAnchor: new THREE.Vector3(
      SHOWCASE_CENTER.x + 20,
      TRACK_Y + 8.2,
      SHOWCASE_CENTER.z - 47
    )
  };
}

function addParkGround(group) {
  const lawn = new THREE.Mesh(
    makeRoundedRectGeometry(108, 92, 16),
    new THREE.MeshStandardMaterial({
      color: COLORS.lawn,
      roughness: 0.96,
      metalness: 0
    })
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = TRACK_Y + 0.018;
  lawn.name = 'TURN Commons lawn';
  group.add(lawn);

  const innerLawn = new THREE.Mesh(
    makeRoundedRectGeometry(88, 72, 13),
    new THREE.MeshBasicMaterial({
      color: COLORS.lawnAccent,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  innerLawn.rotation.x = -Math.PI / 2;
  innerLawn.position.y = TRACK_Y + 0.038;
  innerLawn.name = 'TURN Commons inner lawn';
  group.add(innerLawn);

  const neonEdge = new THREE.Mesh(
    makeRoundedRectRingGeometry(108, 92, 16, 1.15),
    new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  neonEdge.rotation.x = -Math.PI / 2;
  neonEdge.position.y = TRACK_Y + 0.07;
  neonEdge.name = 'TURN Commons neon perimeter';
  group.add(neonEdge);
}

function addParkPaths(group) {
  const pathMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.path,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const trimMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.pathLight,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    toneMapped: false
  });

  const promenade = new THREE.Mesh(new THREE.PlaneGeometry(15, 42), pathMaterial);
  promenade.rotation.x = -Math.PI / 2;
  promenade.position.set(20, TRACK_Y + 0.06, -25);
  promenade.name = 'TURN Commons road-facing promenade';
  group.add(promenade);

  for (const x of [12.15, 27.85]) {
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 42), trimMaterial);
    trim.rotation.x = -Math.PI / 2;
    trim.position.set(x, TRACK_Y + 0.075, -25);
    group.add(trim);
  }

  const crossPath = new THREE.Mesh(new THREE.PlaneGeometry(82, 8.5), pathMaterial);
  crossPath.rotation.x = -Math.PI / 2;
  crossPath.position.set(-5, TRACK_Y + 0.058, 5);
  group.add(crossPath);

  const pondWalk = new THREE.Mesh(
    new THREE.RingGeometry(24.5, 30.5, 56),
    pathMaterial
  );
  pondWalk.scale.set(1.18, 0.68, 1);
  pondWalk.rotation.x = -Math.PI / 2;
  pondWalk.position.set(-13, TRACK_Y + 0.062, 14);
  pondWalk.name = 'TURN Commons pond walk';
  group.add(pondWalk);

  const fountainPlaza = new THREE.Mesh(
    new THREE.CircleGeometry(14.5, 40),
    pathMaterial
  );
  fountainPlaza.rotation.x = -Math.PI / 2;
  fountainPlaza.position.set(
    SHOWCASE_FOUNTAIN.x,
    TRACK_Y + 0.064,
    SHOWCASE_FOUNTAIN.z
  );
  fountainPlaza.name = 'TURN Commons fountain plaza';
  group.add(fountainPlaza);

  const plazaRing = new THREE.Mesh(
    new THREE.RingGeometry(13.3, 14.3, 40),
    new THREE.MeshBasicMaterial({
      color: COLORS.paleCyan,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  plazaRing.rotation.x = -Math.PI / 2;
  plazaRing.position.copy(fountainPlaza.position);
  plazaRing.position.y += 0.02;
  group.add(plazaRing);
}

function addReflectingWater(group) {
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(22, 56),
    new THREE.MeshBasicMaterial({
      color: COLORS.water,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  pond.scale.set(1.25, 0.72, 1);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-13, TRACK_Y + 0.082, 14);
  pond.name = 'TURN Commons reflecting pond';
  group.add(pond);

  const waterRim = new THREE.Mesh(
    new THREE.RingGeometry(21.2, 22.4, 56),
    new THREE.MeshBasicMaterial({
      color: COLORS.waterGlow,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  waterRim.scale.copy(pond.scale);
  waterRim.rotation.copy(pond.rotation);
  waterRim.position.copy(pond.position);
  waterRim.position.y += 0.018;
  group.add(waterRim);

  const bridge = new THREE.Group();
  bridge.name = 'TURN Commons illuminated footbridge';
  bridge.position.set(-13, TRACK_Y + 0.32, 14);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.45, 34),
    new THREE.MeshStandardMaterial({
      color: 0x66717f,
      roughness: 0.74,
      metalness: 0.12
    })
  );
  bridge.add(deck);
  for (const x of [-2.65, 2.65]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.28, 34),
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, toneMapped: false })
    );
    rail.position.set(x, 1.15, 0);
    bridge.add(rail);
  }
  group.add(bridge);
}

function addShowcaseFountain(group) {
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x9aa6b8,
    roughness: 0.5,
    metalness: 0.2
  });
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.waterGlow,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    toneMapped: false
  });

  const fountain = new THREE.Group();
  fountain.name = 'Midnight City showcase fountain fallback';
  fountain.position.set(SHOWCASE_FOUNTAIN.x, TRACK_Y, SHOWCASE_FOUNTAIN.z);

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(10.4, 11.2, 1.35, 48), baseMaterial);
  basin.position.y = 0.68;
  fountain.add(basin);

  const basinWater = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 9.6, 0.2, 48), waterMaterial);
  basinWater.position.y = 1.43;
  fountain.add(basinWater);

  const centre = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.1, 5.8, 24), baseMaterial);
  centre.position.y = 4.2;
  fountain.add(centre);

  const mainJet = new THREE.Mesh(new THREE.ConeGeometry(2.1, 14.5, 24, 1, true), waterMaterial);
  mainJet.position.y = 10.1;
  fountain.add(mainJet);

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.72, 7.2, 14, 1, true), waterMaterial);
    jet.position.set(Math.cos(angle) * 5.6, 5.0, Math.sin(angle) * 5.6);
    jet.rotation.z = Math.cos(angle) * 0.18;
    jet.rotation.x = Math.sin(angle) * 0.18;
    fountain.add(jet);
  }

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(9.7, 10.7, 48),
    new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 1.53;
  fountain.add(glow);

  group.add(fountain);
  return fountain;
}

function addParkFurniture(group) {
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.bench,
    roughness: 0.88,
    metalness: 0.04
  });
  const placements = [
    [-39, -4, Math.PI / 2],
    [-38, 28, Math.PI / 2],
    [25, 22, -Math.PI / 2],
    [36, 8, -Math.PI / 2],
    [-4, 39, Math.PI]
  ];

  for (const [x, z, rotation] of placements) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.45, 1.65), material);
    seat.position.y = 1.05;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2, 0.35), material);
    back.position.set(0, 1.9, -0.64);
    back.rotation.x = -0.1;
    bench.add(back);
    for (const legX of [-2.25, 2.25]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.1, 0.34), material);
      leg.position.set(legX, 0.55, 0);
      bench.add(leg);
    }
    bench.position.set(x, TRACK_Y, z);
    bench.rotation.y = rotation;
    group.add(bench);
  }
}

function addParkLanterns(group) {
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x151a22,
    roughness: 0.78,
    metalness: 0.18
  });
  const lampMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.warmWhite,
    toneMapped: false
  });
  const positions = [
    [-30, -31], [-8, -31], [42, -31],
    [-42, 10], [39, 10],
    [-31, 36], [8, 39], [36, 34]
  ];

  for (const [x, z] of positions) {
    const lantern = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 4.6, 7), postMaterial);
    post.position.y = 2.3;
    lantern.add(post);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.9), lampMaterial);
    lamp.position.y = 4.75;
    lantern.add(lamp);
    lantern.position.set(x, TRACK_Y, z);
    group.add(lantern);
  }
}

function addParkTitle(group) {
  const sign = makeParkSign('TURN COMMONS', COLORS.cyan);
  sign.position.set(20, TRACK_Y + 7.6, -45);
  sign.rotation.y = 0;
  group.add(sign);
}

function makeParkSign(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  const cssColor = `#${color.toString(16).padStart(6, '0')}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(3, 5, 12, 0.92)';
  context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.shadowColor = cssColor;
  context.shadowBlur = 20;
  context.strokeStyle = cssColor;
  context.lineWidth = 12;
  context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  context.shadowBlur = 12;
  context.fillStyle = cssColor;
  context.font = '900 78px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(31, 7.75),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  sign.name = 'Midnight City showcase park title TURN COMMONS';
  return sign;
}

function installReframedParkTrees(world) {
  const trees = [];

  for (let index = 0; index < 23; index += 1) {
    const angle = (index / 23) * Math.PI * 2;
    const southEastView = angle > Math.PI * 1.52 || angle < Math.PI * 0.12;
    if (southEastView && index % 2 === 0) continue;
    const radiusX = 47 + pseudo(index * 11) * 3;
    const radiusZ = 38 + pseudo(index * 17) * 4;
    trees.push({
      x: SHOWCASE_CENTER.x + Math.cos(angle) * radiusX,
      z: SHOWCASE_CENTER.z + Math.sin(angle) * radiusZ,
      height: 7 + pseudo(index * 29) * 4,
      color: COLORS.cyan
    });
  }

  for (const [parkIndex, park] of OTHER_PARKS.entries()) {
    for (let index = 0; index < 15; index += 1) {
      const angle = (index / 15) * Math.PI * 2 + parkIndex * 0.2;
      const radius = park.radius * (0.74 + pseudo(index * 13 + park.x) * 0.14);
      trees.push({
        x: park.x + Math.cos(angle) * radius,
        z: park.z + Math.sin(angle) * radius,
        height: 5.4 + pseudo(index * 31 + park.z) * 3.5,
        color: park.color
      });
    }
  }

  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.34, 0.52, 1, 7),
    new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 1 }),
    trees.length
  );
  trunkMesh.name = 'Midnight City reframed park tree trunks';

  const crownGroups = new Map();
  for (const tree of trees) {
    if (!crownGroups.has(tree.color)) crownGroups.set(tree.color, []);
    crownGroups.get(tree.color).push(tree);
  }

  const marker = new THREE.Object3D();
  for (let index = 0; index < trees.length; index += 1) {
    const tree = trees[index];
    const trunkHeight = tree.height * 0.42;
    marker.position.set(tree.x, TRACK_Y + trunkHeight / 2, tree.z);
    marker.scale.set(1, trunkHeight, 1);
    marker.rotation.set(0, pseudo(index) * Math.PI, 0);
    marker.updateMatrix();
    trunkMesh.setMatrixAt(index, marker.matrix);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  world.add(trunkMesh);

  for (const [color, entries] of crownGroups) {
    const base = new THREE.Color(COLORS.foliage);
    const accent = new THREE.Color(color);
    const materialColor = base.lerp(accent, 0.18);
    const crownMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 8),
      new THREE.MeshStandardMaterial({
        color: materialColor,
        roughness: 0.94,
        metalness: 0
      }),
      entries.length
    );
    crownMesh.name = `Midnight City reframed park crowns ${color.toString(16)}`;
    for (let index = 0; index < entries.length; index += 1) {
      const tree = entries[index];
      marker.position.set(tree.x, TRACK_Y + tree.height * 0.76, tree.z);
      marker.scale.set(2.3 + tree.height * 0.2, tree.height * 0.82, 2.3 + tree.height * 0.2);
      marker.rotation.set(0, pseudo(index + color) * Math.PI, 0);
      marker.updateMatrix();
      crownMesh.setMatrixAt(index, marker.matrix);
    }
    crownMesh.instanceMatrix.needsUpdate = true;
    world.add(crownMesh);
  }

  return trees.length;
}

function redirectAsyncFountainAsset(world, showcase) {
  if (world.userData.turnCommonsFountainRedirectInstalled) return false;

  const originalAdd = world.add;
  world.add = function addWithFountainRedirect(...objects) {
    for (const object of objects) {
      if (object.name === 'Midnight City Kenney fountain landmark') {
        object.position.copy(showcase.fountainAnchor);
        object.position.y += 0.4;
        object.scale.multiplyScalar(SHOWCASE_ASSET_SCALE);
        object.rotation.y = -Math.PI / 8;
        showcase.fallback.visible = false;
      }
      if (object.name === 'Midnight City neon sign TURN COMMONS') {
        object.visible = false;
      }
    }
    return originalAdd.apply(this, objects);
  };

  world.userData.turnCommonsFountainRedirectInstalled = true;
  return true;
}

function makeRoundedRectGeometry(width, height, radius) {
  const shape = roundedRectShape(width, height, radius);
  return new THREE.ShapeGeometry(shape, 24);
}

function makeRoundedRectRingGeometry(width, height, radius, thickness) {
  const outer = roundedRectShape(width, height, radius);
  const hole = roundedRectShape(
    width - thickness * 2,
    height - thickness * 2,
    Math.max(1, radius - thickness)
  );
  outer.holes.push(hole);
  return new THREE.ShapeGeometry(outer, 24);
}

function roundedRectShape(width, height, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const r = Math.min(radius, halfWidth, halfHeight);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + r, -halfHeight);
  shape.lineTo(halfWidth - r, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + r);
  shape.lineTo(halfWidth, halfHeight - r);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - r, halfHeight);
  shape.lineTo(-halfWidth + r, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - r);
  shape.lineTo(-halfWidth, -halfHeight + r);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + r, -halfHeight);
  return shape;
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

return installMidnightCityWorld;
})();

// ==== Layer r7 (formerly midnight-city-world-r7.js) ====
const installMidnightCityLayerR7 = (() => {
const installMidnightCityWorldR6 = installMidnightCityLayerR6;

const TRACK_Y = 0.16;
const COMMONS_CENTER = Object.freeze({ x: 80, z: 75 });
const COLORS = Object.freeze({
  trunk: 0x4b3024,
  foliage: 0x174f40,
  cyan: 0x5de4ff,
  violet: 0x9d7cff,
  yellow: 0xffdc68,
  path: 0x343d49,
  pathTrim: 0xb8f7ff
});

const SECONDARY_PARKS = Object.freeze([
  Object.freeze({
    label: 'VIOLET GARDENS',
    x: -590,
    z: -125,
    radius: 42,
    color: COLORS.violet,
    roadSide: 1
  }),
  Object.freeze({
    label: 'SUNRISE PARK',
    x: 570,
    z: 145,
    radius: 44,
    color: COLORS.yellow,
    roadSide: -1
  })
]);

function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR6(options);

  const readableSigns = installReadableSignBacks(world);
  const relocatedParks = relocateSecondaryParks(world);
  const treeResult = rebuildParkTrees(world);

  world.name = 'TURN Midnight City r7';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r7',
    readableTwoSidedSigns: readableSigns,
    signTechnique: 'separate front-facing planes on each side, never mirrored DoubleSide text',
    secondaryParkLocations: Object.freeze(SECONDARY_PARKS.map(({ label, x, z }) => Object.freeze({ label, x, z }))),
    secondaryParksRelocatedTrackside: relocatedParks,
    secondaryParkApproaches: relocatedParks,
    rebuiltParkTreeCount: treeResult.treeCount,
    noDynamicLightsAdded: true,
    noIndependentAnimationLoop: true
  });

  return world;
}

function installReadableSignBacks(world) {
  const signs = [];
  world.traverse((node) => {
    if (!node.isMesh || !node.material || node.userData.turnReadableSignBack) return;
    const isCitySign =
      node.name?.startsWith('Midnight City neon sign ') ||
      node.name?.startsWith('Midnight City district sign ') ||
      node.name === 'Midnight City showcase park title TURN COMMONS';
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (isCitySign && materials.some((material) => material?.map)) signs.push(node);
  });

  for (const sign of signs) {
    const materials = Array.isArray(sign.material) ? sign.material : [sign.material];
    for (const material of materials) {
      material.side = THREE.FrontSide;
      material.needsUpdate = true;
    }

    const reverseMaterials = materials.map((material) => {
      const clone = material.clone();
      clone.side = THREE.FrontSide;
      clone.needsUpdate = true;
      return clone;
    });
    const reverse = new THREE.Mesh(
      sign.geometry,
      Array.isArray(sign.material) ? reverseMaterials : reverseMaterials[0]
    );
    reverse.name = `${sign.name} readable reverse`;
    reverse.position.z = -0.012;
    reverse.rotation.y = Math.PI;
    reverse.renderOrder = sign.renderOrder;
    reverse.frustumCulled = sign.frustumCulled;
    reverse.userData.turnReadableSignBack = true;
    sign.add(reverse);
    sign.userData.turnReadableSignPair = true;
  }

  return signs.length;
}

function relocateSecondaryParks(world) {
  let relocated = 0;
  for (const park of SECONDARY_PARKS) {
    const group = world.getObjectByName(`Midnight City park ${park.label}`);
    if (!group) continue;
    group.position.set(park.x, group.position.y, park.z);
    group.name = `Midnight City trackside park ${park.label}`;
    addParkApproach(group, park);
    relocated += 1;
  }
  return relocated;
}

function addParkApproach(group, park) {
  const approach = new THREE.Group();
  approach.name = `Midnight City ${park.label} track-facing entrance`;

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(park.radius * 0.72, 8.5),
    new THREE.MeshBasicMaterial({
      color: COLORS.path,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(park.roadSide * park.radius * 0.68, TRACK_Y + 0.07, 0);
  path.name = `${park.label} entrance path`;
  approach.add(path);

  for (const z of [-4.55, 4.55]) {
    const trim = new THREE.Mesh(
      new THREE.PlaneGeometry(park.radius * 0.72, 0.45),
      new THREE.MeshBasicMaterial({
        color: park.color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    trim.rotation.x = -Math.PI / 2;
    trim.position.set(park.roadSide * park.radius * 0.68, TRACK_Y + 0.082, z);
    approach.add(trim);
  }

  const gateMaterial = new THREE.MeshBasicMaterial({ color: park.color, toneMapped: false });
  for (const z of [-5.5, 5.5]) {
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.6, 0.55), gateMaterial);
    gate.position.set(park.roadSide * (park.radius + 1.5), TRACK_Y + 2.3, z);
    approach.add(gate);
  }

  group.add(approach);
}

function rebuildParkTrees(world) {
  const removals = [];
  world.traverse((node) => {
    if (
      node.name === 'Midnight City reframed park tree trunks' ||
      node.name?.startsWith('Midnight City reframed park crowns ')
    ) {
      removals.push(node);
    }
  });
  for (const node of removals) disposeAndRemove(node);

  const trees = [];
  addCommonsTrees(trees);
  for (const park of SECONDARY_PARKS) addSecondaryParkTrees(trees, park);
  installTreeInstances(world, trees);
  return { removedMeshes: removals.length, treeCount: trees.length };
}

function addCommonsTrees(trees) {
  for (let index = 0; index < 23; index += 1) {
    const angle = (index / 23) * Math.PI * 2;
    const roadFacingOpening = angle > Math.PI * 1.52 || angle < Math.PI * 0.12;
    if (roadFacingOpening && index % 2 === 0) continue;
    const radiusX = 47 + pseudo(index * 11) * 3;
    const radiusZ = 38 + pseudo(index * 17) * 4;
    trees.push({
      x: COMMONS_CENTER.x + Math.cos(angle) * radiusX,
      z: COMMONS_CENTER.z + Math.sin(angle) * radiusZ,
      height: 7 + pseudo(index * 29) * 4,
      color: COLORS.cyan
    });
  }
}

function addSecondaryParkTrees(trees, park) {
  for (let index = 0; index < 15; index += 1) {
    const angle = (index / 15) * Math.PI * 2;
    const facesRoad = park.roadSide > 0
      ? Math.cos(angle) > 0.72
      : Math.cos(angle) < -0.72;
    if (facesRoad && index % 2 === 0) continue;
    const radius = park.radius * (0.74 + pseudo(index * 13 + park.x) * 0.14);
    trees.push({
      x: park.x + Math.cos(angle) * radius,
      z: park.z + Math.sin(angle) * radius,
      height: 5.4 + pseudo(index * 31 + park.z) * 3.5,
      color: park.color
    });
  }
}

function installTreeInstances(world, trees) {
  if (!trees.length) return;

  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.34, 0.52, 1, 7),
    new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 1 }),
    trees.length
  );
  trunkMesh.name = 'Midnight City trackside park tree trunks r7';

  const crownGroups = new Map();
  for (const tree of trees) {
    if (!crownGroups.has(tree.color)) crownGroups.set(tree.color, []);
    crownGroups.get(tree.color).push(tree);
  }

  const marker = new THREE.Object3D();
  for (let index = 0; index < trees.length; index += 1) {
    const tree = trees[index];
    const trunkHeight = tree.height * 0.42;
    marker.position.set(tree.x, TRACK_Y + trunkHeight / 2, tree.z);
    marker.scale.set(1, trunkHeight, 1);
    marker.rotation.set(0, pseudo(index) * Math.PI, 0);
    marker.updateMatrix();
    trunkMesh.setMatrixAt(index, marker.matrix);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  world.add(trunkMesh);

  for (const [color, entries] of crownGroups) {
    const materialColor = new THREE.Color(COLORS.foliage).lerp(new THREE.Color(color), 0.18);
    const crownMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 8),
      new THREE.MeshStandardMaterial({
        color: materialColor,
        roughness: 0.94,
        metalness: 0
      }),
      entries.length
    );
    crownMesh.name = `Midnight City trackside park crowns r7 ${color.toString(16)}`;
    for (let index = 0; index < entries.length; index += 1) {
      const tree = entries[index];
      marker.position.set(tree.x, TRACK_Y + tree.height * 0.76, tree.z);
      marker.scale.set(2.3 + tree.height * 0.2, tree.height * 0.82, 2.3 + tree.height * 0.2);
      marker.rotation.set(0, pseudo(index + color) * Math.PI, 0);
      marker.updateMatrix();
      crownMesh.setMatrixAt(index, marker.matrix);
    }
    crownMesh.instanceMatrix.needsUpdate = true;
    world.add(crownMesh);
  }
}

function disposeAndRemove(node) {
  node.parent?.remove(node);
  node.geometry?.dispose?.();
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  for (const material of materials) material?.dispose?.();
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

return installMidnightCityWorld;
})();

// ==== Layer r11 (formerly midnight-city-world-r11.js) ====
const installMidnightCityLayerR11 = (() => {
const installMidnightCityWorldR7 = installMidnightCityLayerR7;

const LILYA_TEXTURE_URL = new URL('../LILYA.PNG', import.meta.url).href;
const TRACK_Y = 0.16;
const LOW_CITY_BODY_COLORS = Object.freeze([0x2b2138, 0x241a32, 0x2b2138, 0x20283a]);
const LOW_CITY_GLOW_COLORS = Object.freeze([0x5de4ff, 0xff4fa3, 0xffdc68, 0x9d7cff]);
const LOW_CITY_PARKS = Object.freeze([
  Object.freeze({ x: 80, z: 75, radius: 78 }),
  Object.freeze({ x: -590, z: -125, radius: 58 }),
  Object.freeze({ x: 570, z: 145, radius: 60 })
]);
const LOW_CITY_CANDIDATES = Object.freeze([
  Object.freeze({ ratio: 0.020, side: -1 }),
  Object.freeze({ ratio: 0.035, side: 1 }),
  Object.freeze({ ratio: 0.065, side: 1 }),
  Object.freeze({ ratio: 0.090, side: -1 }),
  Object.freeze({ ratio: 0.120, side: -1 }),
  Object.freeze({ ratio: 0.145, side: 1 }),
  Object.freeze({ ratio: 0.175, side: 1 }),
  Object.freeze({ ratio: 0.205, side: -1 }),
  Object.freeze({ ratio: 0.240, side: 1 }),
  Object.freeze({ ratio: 0.270, side: -1 }),
  Object.freeze({ ratio: 0.305, side: -1 }),
  Object.freeze({ ratio: 0.335, side: 1 }),
  Object.freeze({ ratio: 0.370, side: 1 }),
  Object.freeze({ ratio: 0.405, side: -1 }),
  Object.freeze({ ratio: 0.440, side: -1 }),
  Object.freeze({ ratio: 0.470, side: 1 }),
  Object.freeze({ ratio: 0.505, side: -1 }),
  Object.freeze({ ratio: 0.535, side: 1 }),
  Object.freeze({ ratio: 0.570, side: 1 }),
  Object.freeze({ ratio: 0.600, side: -1 }),
  Object.freeze({ ratio: 0.635, side: -1 }),
  Object.freeze({ ratio: 0.665, side: 1 }),
  Object.freeze({ ratio: 0.700, side: 1 }),
  Object.freeze({ ratio: 0.730, side: -1 }),
  Object.freeze({ ratio: 0.765, side: 1 }),
  Object.freeze({ ratio: 0.795, side: -1 }),
  Object.freeze({ ratio: 0.825, side: -1 }),
  Object.freeze({ ratio: 0.855, side: 1 }),
  Object.freeze({ ratio: 0.885, side: 1 }),
  Object.freeze({ ratio: 0.915, side: -1 }),
  Object.freeze({ ratio: 0.940, side: -1 }),
  Object.freeze({ ratio: 0.965, side: 1 })
]);
const CITY_BUILDER_COMMIT = '4535092b740b378b700efd9df9e27a631815b84a';
const CITY_MODEL_BASE = `https://cdn.jsdelivr.net/gh/KenneyNL/Starter-Kit-City-Builder@${CITY_BUILDER_COMMIT}/models/`;
const LOW_CITY_ASSET_NAMES = Object.freeze([
  'building-small-a.glb',
  'building-small-c.glb'
]);
const lowCityLoader = new GLTFLoader();
const lowCitySources = new Map();


const LILYA_WALL = Object.freeze({
  x: -500.70,
  y: 11.96,
  z: 40.20,
  maxWidth: 46,
  maxHeight: 21
});
const LILYA_WALL_NORMAL = new THREE.Vector3(-1, 0, 0);
const LILYA_LOAD_DISTANCE = 220;
const LILYA_LOAD_DISTANCE_SQUARED = LILYA_LOAD_DISTANCE * LILYA_LOAD_DISTANCE;
const LILYA_MIN_VIEW_DOT = 0.56;
const LILYA_MIN_FRONT_DOT = 0.12;
const LILYA_MAX_TRACK_ALIGNMENT = -0.62;
const LILYA_DISCOVERY_HOLD_MS = 650;
const TRACK_SURFACE_NAME = /^Midnight City (race road|road edge|sidewalk)/;

function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR7(options);
  const inheritedReady = world.ready;
  const nightSky = installSharedNightSky(world, { trackId: 'midnight-city' });
  world.ready = Promise.resolve(inheritedReady)
    .then(() => nightSky?.ready)
    .then(() => world);
  const surfaceNormals = repairTrackSurfaceWinding(world);
  const lowCity = installLowCityInfill(world, options.samples || [], options.trackWidth || 27);
  const lowCityAssetRequests = installLowCityAssets(world, lowCity.assetAnchors);
  const portrait = installHiddenLilyaPortrait(world);
  const lazyLoadArmed = armWrongWayTextureLoad(world, portrait, options);
  const playerSpotlight = installNightPlayerSpotlight(options.runtime?.playerCar, options.runtime);

  world.name = 'TURN Midnight City r11';
  world.userData.turnPlayerLightRig = playerSpotlight;
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r11',
    hiddenLilyaPortrait: true,
    hiddenLilyaPlacement: 'west facade of the surviving low Neon Quarter building inside the western hairpin',
    hiddenLilyaLazyLoad: lazyLoadArmed
      ? 'load only after the player approaches from the visible side, looks at the wall and remains turned against race direction'
      : 'unavailable because the race-road render trigger was not found',
    hiddenLilyaWrongWayOnly: true,
    hiddenLilyaDiscoveryHoldMs: LILYA_DISCOVERY_HOLD_MS,
    hiddenLilyaMipmaps: false,
    hiddenLilyaFitsFacade: true,
    gameplayGeometryUnchanged: true,
    playerVisibilityLight: playerSpotlight
      ? 'shared-warm-shadowless-spotlight-identical-to-mountain'
      : 'unavailable-without-player-car',
    sharedNightSpotlight: Boolean(playerSpotlight),
    sharedProceduralNightSky: Boolean(nightSky?.sky),
    sharedSouthernMoon: 'canonical-mountain-moon-image',
    nightSkyVariation: 'restrained-purple-horizon-glow',
    headlightRoadReflectance: 'original-midnight-city-road-material-with-upward-facing-surface-normals',
    repairedDownwardSurfaceMeshes: surfaceNormals.repaired,
    inspectedTrackSurfaceMeshes: surfaceNormals.inspected,
    lowCityBuildingCount: lowCity.buildings,
    lowCityGlowStripCount: lowCity.glowStrips,
    lowCityAssetRequests,
    lowCityTechnique: 'three-instanced-draw-call-purple-weighted-low-rise-infill-plus-two-small-pinned-Kenney-landmarks',
    lowCityTrackSafetyMargin: 'placement rejected against the full sampled race corridor, parks and existing district buildings',
    lowCityPurpleBodyShare: 'three of four palette entries are purple-family',
    lowCityAddsDynamicLights: false,
    hiddenLilyaAddsDynamicLights: false,
    noIndependentAnimationLoop: true
  });

  return world;
}

function installLowCityInfill(world, samples, trackWidth) {
  if (!samples.length) return Object.freeze({ buildings: 0, glowStrips: 0, assetAnchors: Object.freeze([]) });

  const occupied = collectDistrictBuildingFootprints(world);
  const placements = [];
  for (let index = 0; index < LOW_CITY_CANDIDATES.length; index += 1) {
    const candidate = LOW_CITY_CANDIDATES[index];
    const sample = samples[Math.round(candidate.ratio * (samples.length - 1))];
    if (!sample?.point || !sample?.normal || !sample?.tangent) continue;

    const seed = index * 37 + 11;
    const width = 24 + pseudoLowCity(seed + 1) * 20;
    const depth = 15 + pseudoLowCity(seed + 2) * 10;
    const height = 7.5 + pseudoLowCity(seed + 3) * 10.5;
    const footprintRadius = Math.hypot(width, depth) / 2;
    const setback = trackWidth / 2 + 42 + pseudoLowCity(seed + 4) * 26;
    const tangentNudge = (pseudoLowCity(seed + 5) - 0.5) * 24;
    const centre = sample.point.clone()
      .addScaledVector(sample.normal, candidate.side * setback)
      .addScaledVector(sample.tangent, tangentNudge);

    if (!isLowCityPlacementClear(centre.x, centre.z, footprintRadius, samples, trackWidth, occupied, placements)) continue;

    const rotation = Math.atan2(sample.tangent.x, sample.tangent.z);
    const bodyColor = LOW_CITY_BODY_COLORS[index % LOW_CITY_BODY_COLORS.length];
    const glowColor = LOW_CITY_GLOW_COLORS[index % LOW_CITY_GLOW_COLORS.length];
    placements.push(Object.freeze({
      x: centre.x,
      z: centre.z,
      width,
      depth,
      height,
      rotation,
      side: candidate.side,
      normalX: sample.normal.x,
      normalZ: sample.normal.z,
      tangentX: sample.tangent.x,
      tangentZ: sample.tangent.z,
      footprintRadius,
      bodyColor,
      glowColor,
      seed
    }));
  }

  if (!placements.length) return Object.freeze({ buildings: 0, glowStrips: 0, assetAnchors: Object.freeze([]) });

  const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.05
  });
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, placements.length);
  bodies.name = 'Midnight City low-city building bodies';
  const marker = new THREE.Object3D();

  for (let index = 0; index < placements.length; index += 1) {
    const building = placements[index];
    marker.position.set(building.x, building.height / 2, building.z);
    marker.rotation.set(0, building.rotation, 0);
    marker.scale.set(building.depth, building.height, building.width);
    marker.updateMatrix();
    bodies.setMatrixAt(index, marker.matrix);
    bodies.setColorAt(index, new THREE.Color(building.bodyColor));
  }
  bodies.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  bodies.computeBoundingSphere?.();
  world.add(bodies);

  const glowGeometry = new THREE.BoxGeometry(1, 1, 1);
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const glows = new THREE.InstancedMesh(glowGeometry, glowMaterial, placements.length * 2);
  glows.name = 'Midnight City low-city shopfront and roofline glow';
  let glowCursor = 0;

  for (const building of placements) {
    const roadFacing = -building.side;
    const frontX = building.x + building.normalX * roadFacing * (building.depth / 2 + 0.08);
    const frontZ = building.z + building.normalZ * roadFacing * (building.depth / 2 + 0.08);

    marker.position.set(frontX, 2.35, frontZ);
    marker.rotation.set(0, building.rotation, 0);
    marker.scale.set(0.18, 1.15, building.width * 0.72);
    marker.updateMatrix();
    glows.setMatrixAt(glowCursor, marker.matrix);
    glows.setColorAt(glowCursor, new THREE.Color(building.glowColor));
    glowCursor += 1;

    marker.position.set(frontX, building.height + 0.18, frontZ);
    marker.rotation.set(0, building.rotation, 0);
    marker.scale.set(0.22, 0.28, building.width * 0.82);
    marker.updateMatrix();
    glows.setMatrixAt(glowCursor, marker.matrix);
    glows.setColorAt(glowCursor, new THREE.Color(building.glowColor));
    glowCursor += 1;
  }
  glows.count = glowCursor;
  glows.instanceMatrix.needsUpdate = true;
  if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
  glows.computeBoundingSphere?.();
  world.add(glows);

  const ventGeometry = new THREE.BoxGeometry(1, 1, 1);
  const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x242b39, roughness: 0.9, metalness: 0.08 });
  const vents = new THREE.InstancedMesh(ventGeometry, ventMaterial, placements.length);
  vents.name = 'Midnight City low-city rooftop units';
  for (let index = 0; index < placements.length; index += 1) {
    const building = placements[index];
    marker.position.set(
      building.x + building.tangentX * (pseudoLowCity(building.seed + 8) - 0.5) * building.width * 0.34,
      building.height + 0.75,
      building.z + building.tangentZ * (pseudoLowCity(building.seed + 8) - 0.5) * building.width * 0.34
    );
    marker.rotation.set(0, building.rotation, 0);
    marker.scale.set(
      Math.max(2.2, building.depth * 0.22),
      1.5,
      Math.max(3.2, building.width * 0.22)
    );
    marker.updateMatrix();
    vents.setMatrixAt(index, marker.matrix);
  }
  vents.instanceMatrix.needsUpdate = true;
  vents.computeBoundingSphere?.();
  world.add(vents);

  const assetAnchors = [];
  for (const placementIndex of [5, 21]) {
    const building = placements[placementIndex];
    if (!building) continue;
    const direction = placementIndex % 2 === 0 ? 1 : -1;
    const spacing = building.width * 0.62 + 18;
    const anchorX = building.x + building.tangentX * spacing * direction;
    const anchorZ = building.z + building.tangentZ * spacing * direction;
    const assetRadius = 11;
    if (!isLowCityPlacementClear(anchorX, anchorZ, assetRadius, samples, trackWidth, occupied, placements)) continue;
    assetAnchors.push(Object.freeze({
      x: anchorX,
      z: anchorZ,
      rotation: building.rotation,
      targetSize: 17 + assetAnchors.length * 2,
      name: LOW_CITY_ASSET_NAMES[assetAnchors.length]
    }));
  }

  return Object.freeze({
    buildings: placements.length,
    glowStrips: glowCursor,
    assetAnchors: Object.freeze(assetAnchors)
  });
}

function collectDistrictBuildingFootprints(world) {
  const occupied = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  world.traverse((node) => {
    if (!node?.isInstancedMesh || !node.name?.startsWith('Midnight City district building bodies')) return;
    for (let index = 0; index < node.count; index += 1) {
      node.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      occupied.push(Object.freeze({
        x: position.x,
        z: position.z,
        radius: Math.hypot(scale.x, scale.z) / 2
      }));
    }
  });
  return occupied;
}

function isLowCityPlacementClear(x, z, radius, samples, trackWidth, occupied, planned) {
  const trackClearance = trackWidth / 2 + radius + 10;
  const trackClearanceSquared = trackClearance * trackClearance;
  for (let index = 0; index < samples.length; index += 4) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    if (dx * dx + dz * dz < trackClearanceSquared) return false;
  }

  for (const park of LOW_CITY_PARKS) {
    const required = park.radius + radius + 10;
    const dx = x - park.x;
    const dz = z - park.z;
    if (dx * dx + dz * dz < required * required) return false;
  }

  for (const entry of occupied) {
    const required = entry.radius + radius + 7;
    const dx = x - entry.x;
    const dz = z - entry.z;
    if (dx * dx + dz * dz < required * required) return false;
  }

  for (const entry of planned) {
    const required = entry.footprintRadius + radius + 6;
    const dx = x - entry.x;
    const dz = z - entry.z;
    if (dx * dx + dz * dz < required * required) return false;
  }

  return true;
}

function installLowCityAssets(world, anchors) {
  if (!anchors?.length) return 0;

  for (const [index, anchor] of anchors.entries()) {
    const url = `${CITY_MODEL_BASE}${anchor.name}`;
    let sourcePromise = lowCitySources.get(url);
    if (!sourcePromise) {
      sourcePromise = lowCityLoader.loadAsync(url).then((gltf) => gltf.scene);
      lowCitySources.set(url, sourcePromise);
    }

    sourcePromise
      .then((source) => {
        if (!world.parent) return;
        const model = prepareLowCityAsset(source, anchor.targetSize);
        model.name = `Midnight City Kenney low-city landmark ${index + 1} ${anchor.name}`;
        model.position.set(anchor.x, TRACK_Y, anchor.z);
        model.rotation.y = anchor.rotation;
        world.add(model);
      })
      .catch((error) => {
        console.warn(`TURN: Midnight City low-city asset failed to load: ${anchor.name}`, error);
      });
  }

  return anchors.length;
}

function prepareLowCityAsset(source, targetSize) {
  const model = source.clone(true);
  const nightTint = new THREE.Color(0x182338);
  model.traverse((node) => {
    if (!node.isMesh) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const materials = sourceMaterials.map((material) => {
      const clone = material.clone();
      clone.color?.lerp(nightTint, 0.16);
      clone.roughness = Math.max(clone.roughness ?? 0.75, 0.72);
      clone.metalness = Math.min(clone.metalness ?? 0.08, 0.14);
      return clone;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0];
  });

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(model);
  const centre = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= centre.z;
  return model;
}

function pseudoLowCity(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function repairTrackSurfaceWinding(world) {
  let inspected = 0;
  let repaired = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();

  world.traverse((node) => {
    if (!node?.isMesh || !TRACK_SURFACE_NAME.test(node.name || '')) return;
    const geometry = node.geometry;
    const index = geometry?.index;
    const position = geometry?.getAttribute?.('position');
    if (!index || !position || index.count < 3) return;

    inspected += 1;
    a.fromBufferAttribute(position, index.getX(0));
    b.fromBufferAttribute(position, index.getX(1));
    c.fromBufferAttribute(position, index.getX(2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    faceNormal.crossVectors(ab, ac);
    if (faceNormal.y >= 0) return;

    for (let offset = 0; offset < index.count; offset += 3) {
      const second = index.getX(offset + 1);
      index.setX(offset + 1, index.getX(offset + 2));
      index.setX(offset + 2, second);
    }
    index.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.getAttribute('normal').needsUpdate = true;
    node.userData.turnMidnightSurfaceWinding = 'upward-r176';
    repaired += 1;
  });

  return Object.freeze({ inspected, repaired });
}

function installHiddenLilyaPortrait(world) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const portrait = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  portrait.name = 'Midnight City hidden LILYA portrait';
  portrait.position.set(LILYA_WALL.x, LILYA_WALL.y, LILYA_WALL.z);
  portrait.rotation.y = -Math.PI / 2;
  portrait.visible = false;
  portrait.renderOrder = 4;
  portrait.userData.turnEasterEgg = 'hidden-lilya-portrait';
  world.add(portrait);
  return portrait;
}

function armWrongWayTextureLoad(world, portrait, options = {}) {
  const road = world.getObjectByName('Midnight City race road');
  if (!road) {
    console.warn('TURN: Midnight City could not arm the hidden LILYA portrait lazy loader.');
    return false;
  }

  const runtime = options.runtime;
  const trackSamples = options.samples || options.trackRuntime?.samples || [];
  const wallPosition = new THREE.Vector3(LILYA_WALL.x, LILYA_WALL.y, LILYA_WALL.z);
  const cameraPosition = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const cameraToWall = new THREE.Vector3();
  const wallToCamera = new THREE.Vector3();
  const previousOnBeforeRender = road.onBeforeRender;
  let discoveryStartedAt = null;
  let loadStarted = false;

  function restoreRoadRenderHook() {
    if (road.onBeforeRender === wrongWayTriggeredLoad) road.onBeforeRender = previousOnBeforeRender;
  }

  function resetDiscoveryHold() {
    discoveryStartedAt = null;
  }

  function wrongWayTriggeredLoad(...args) {
    previousOnBeforeRender?.call(this, ...args);
    if (loadStarted) return;

    const camera = args[2];
    if (!camera?.isCamera) {
      resetDiscoveryHold();
      return;
    }

    camera.getWorldPosition(cameraPosition);
    if (cameraPosition.distanceToSquared(wallPosition) > LILYA_LOAD_DISTANCE_SQUARED) {
      resetDiscoveryHold();
      return;
    }

    wallToCamera.copy(cameraPosition).sub(wallPosition).normalize();
    if (wallToCamera.dot(LILYA_WALL_NORMAL) < LILYA_MIN_FRONT_DOT) {
      resetDiscoveryHold();
      return;
    }

    camera.getWorldDirection(cameraForward);
    cameraToWall.copy(wallPosition).sub(cameraPosition).normalize();
    if (cameraForward.dot(cameraToWall) < LILYA_MIN_VIEW_DOT) {
      resetDiscoveryHold();
      return;
    }

    if (!playerFacesAgainstRaceDirection(runtime, trackSamples)) {
      resetDiscoveryHold();
      return;
    }

    const now = globalThis.performance?.now?.() ?? Date.now();
    if (discoveryStartedAt == null) {
      discoveryStartedAt = now;
      return;
    }
    if (now - discoveryStartedAt < LILYA_DISCOVERY_HOLD_MS) return;

    loadStarted = true;
    restoreRoadRenderHook();
    loadLilyaTexture(portrait, runtime);
  }

  road.onBeforeRender = wrongWayTriggeredLoad;
  portrait.userData.turnLazyTexture = 'wrong-way-camera-proximity-front-side-view-direction-and-hold';
  return true;
}

function playerFacesAgainstRaceDirection(runtime, trackSamples) {
  const state = runtime?.state;
  const sample = trackSamples[state?.nearestTrackIndex];
  if (state?.running !== true || !Number.isFinite(state.heading) || !sample?.tangent) return false;

  const forwardX = Math.sin(state.heading);
  const forwardZ = Math.cos(state.heading);
  const trackAlignment = forwardX * sample.tangent.x + forwardZ * sample.tangent.z;
  return trackAlignment <= LILYA_MAX_TRACK_ALIGNMENT;
}

function loadLilyaTexture(portrait, runtime) {
  new THREE.TextureLoader().load(
    LILYA_TEXTURE_URL,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const imageWidth = texture.image?.naturalWidth || texture.image?.width || 1;
      const imageHeight = texture.image?.naturalHeight || texture.image?.height || 1;
      const aspectRatio = imageWidth / imageHeight;
      let width = LILYA_WALL.maxWidth;
      let height = width / aspectRatio;

      if (height > LILYA_WALL.maxHeight) {
        height = LILYA_WALL.maxHeight;
        width = height * aspectRatio;
      }

      portrait.material.map = texture;
      portrait.material.needsUpdate = true;
      portrait.scale.set(width, height, 1);
      portrait.visible = true;
      portrait.userData.turnSecretAchievementFound = true;
      signalSecretAchievement('find-lilya', {
        trackId: 'midnight-city',
        vehicleId: runtime?.state?.vehicleId || ''
      });
    },
    undefined,
    (error) => {
      console.warn('TURN: Midnight City could not load the hidden LILYA portrait.', error);
    }
  );
}

return installMidnightCityWorld;
})();

export { installMidnightCityLayerR11 as installMidnightCityWorld };
