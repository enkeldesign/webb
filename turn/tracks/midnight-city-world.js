import * as THREE from 'three';

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
const GROUND = 0x0e1420;
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

export function installMidnightCityWorld({ scene, samples, trackWidth = 27 }) {
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
  moon.castShadow = false;
  world.add(moon);
}

function makeGround(world) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1200),
    material(GROUND, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  world.add(ground);

  const downtownGlow = new THREE.Mesh(
    new THREE.CircleGeometry(520, 64),
    new THREE.MeshBasicMaterial({
      color: 0x16213d,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    })
  );
  downtownGlow.rotation.x = -Math.PI / 2;
  downtownGlow.position.set(20, -0.17, 35);
  world.add(downtownGlow);
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
  road.receiveShadow = true;
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
    edge.receiveShadow = true;
    world.add(edge);

    const sidewalk = makeRibbonMesh({
      samples,
      innerOffset: side * (trackWidth / 2 + 2),
      outerOffset: side * (trackWidth / 2 + 6.2),
      height: TRACK_Y + 0.11,
      name: `Midnight City sidewalk ${side}`,
      meshMaterial: material(SIDEWALK, 0.92)
    });
    sidewalk.receiveShadow = true;
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
  dashes.receiveShadow = true;
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

  for (let index = 0; index < samples.length; index += 90) {
    const sample = samples[index];
    const light = new THREE.PointLight(WARM_LIGHT, 7.5, 74, 1.65);
    light.position.copy(sample.point).setY(sample.point.y + 8.4);
    world.add(light);
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
    bodies[index].castShadow = !skyline;
    bodies[index].receiveShadow = true;
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
