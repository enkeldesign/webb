import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const WORLD_PLAYGROUND_TRACK_ID = 'world-playground';
export const WORLD_PLAYGROUND_ROAD_WIDTH = 38;
export const WORLD_PLAYGROUND_SAMPLE_COUNT = 720;

const INK = 0x08090a;
const CREAM = 0xfff8e8;
const ASPHALT = 0x3d4348;
const SEA = 0x2689a7;
const GRASS = 0x78a96c;
const FIELD = 0xb9c96a;
const FIELD_GOLD = 0xd8b83f;
const ROCK = 0x77736b;
const MOUNTAIN = 0x655f59;
const SNOW = 0xe8edf0;
const WATER = 0x42a7c5;
const CYAN = 0x38d9ff;
const PINK = 0xff4fa3;
const YELLOW = 0xffd43b;
const ORANGE = 0xff7b54;
const TRACK_Y = 0.22;

const loader = new GLTFLoader();
const assetCache = new Map();

const ASSETS = Object.freeze({
  windmill: '/turn/assets/scenery/fantasy-town/windmill.glb',
  liner: '/turn/assets/scenery/watercraft/ship-ocean-liner.glb',
  houseA: '/turn/assets/scenery/countryside/suburban/building-type-a.glb',
  houseB: '/turn/assets/scenery/countryside/suburban/building-type-b.glb',
  tree: '/turn/assets/scenery/countryside/nature/tree_oak.glb',
  pine: '/turn/assets/scenery/countryside/nature/tree_pineRoundB.glb',
  rock: '/turn/assets/scenery/countryside/nature/rock_largeA.glb',
  cabinWall: '/turn/assets/scenery/mountain/holiday/cabin-wall.glb',
  cabinRoof: '/turn/assets/scenery/mountain/holiday/cabin-roof-snow.glb',
  waterfallRock: '/turn/assets/scenery/mountain/nature/cliff-waterfall-rock.glb',
  waterfallTopRock: '/turn/assets/scenery/mountain/nature/cliff-waterfall-top-rock.glb'
});

// The loop follows the illustrated TURN world map clockwise: Harbor -> Cliffside ->
// Mountain -> Airport -> Countryside -> Midnight City -> Harbor. Y is intentionally
// modest: this is a theme-park/model-world interpretation, not six full-size tracks.
const CONTROL_POINTS = Object.freeze([
  [-215, 2, 165],
  [-315, 4, 105],
  [-345, 8, 10],
  [-325, 18, -105],
  [-275, 34, -215],
  [-180, 58, -300],
  [-55, 76, -340],
  [65, 68, -325],
  [165, 44, -275],
  [270, 24, -215],
  [365, 12, -125],
  [425, 4, -25],
  [435, 2, 80],
  [390, 1, 160],
  [285, 1, 185],
  [190, 1, 145],
  [95, 1, 105],
  [20, 1, 125],
  [-35, 1, 190],
  [-110, 1, 230],
  [-190, 1, 225],
  [-260, 1, 205]
]);

// Shore on the west, mountain range on the north/east and an arc back to the sea
// south of Harbor. The session uses this polygon as an invisible hard world wall.
export const WORLD_PLAYGROUND_BOUNDARY = Object.freeze([
  Object.freeze([-405, -275]),
  Object.freeze([-365, -390]),
  Object.freeze([-175, -430]),
  Object.freeze([45, -430]),
  Object.freeze([260, -370]),
  Object.freeze([455, -260]),
  Object.freeze([535, -70]),
  Object.freeze([520, 145]),
  Object.freeze([420, 285]),
  Object.freeze([230, 335]),
  Object.freeze([25, 330]),
  Object.freeze([-185, 325]),
  Object.freeze([-355, 280]),
  Object.freeze([-420, 180]),
  Object.freeze([-430, 20]),
  Object.freeze([-420, -135])
]);

export function buildWorldPlayground(trackWidth = WORLD_PLAYGROUND_ROAD_WIDTH) {
  const samples = sampleLoop();
  const world = new THREE.Group();
  world.name = 'TURN World Playground';
  world.userData.turnWorldPlayground = 'r1-map-layout';
  world.userData.noLapVoid = true;
  world.userData.singleContinuousLoop = true;
  world.userData.noMountainTunnel = true;

  world.add(makeLand(), makeSea(), makeRoad(samples, trackWidth), makeRoadEdges(samples, trackWidth));
  installHarbor(world);
  installCliffside(world);
  installMountain(world);
  installMidnightCity(world);
  installCountryside(world);
  installAirport(world);
  installMountainRange(world);
  installDistrictSigns(world);
  void installClassicAssets(world);

  return Object.freeze({
    samples,
    world,
    boundary: WORLD_PLAYGROUND_BOUNDARY,
    startIndex: Math.floor(samples.length * 0.76),
    trackWidth
  });
}

export function disposeWorldPlayground(world) {
  if (!world) return;
  world.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((entry) => entry?.dispose?.());
    else node.material?.dispose?.();
    node.material?.map?.dispose?.();
  });
  world.removeFromParent();
}

function sampleLoop() {
  const points = CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  const samples = [];
  let distance = 0;
  for (let index = 0; index < WORLD_PLAYGROUND_SAMPLE_COUNT; index += 1) {
    const progress = index / WORLD_PLAYGROUND_SAMPLE_COUNT;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    if (index) distance += point.distanceTo(samples[index - 1].point);
    samples.push({ point, tangent, normal, distance });
  }
  return samples;
}

function mat(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeLand() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(980, 820), mat(GRASS, 1));
  ground.name = 'World Playground land';
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(55, -1.2, -40);
  ground.receiveShadow = true;
  return ground;
}

function makeSea() {
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(470, 980),
    new THREE.MeshStandardMaterial({ color: SEA, roughness: 0.55, metalness: 0.05 })
  );
  sea.name = 'World Playground western sea';
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-520, -0.6, -40);
  sea.receiveShadow = true;
  return sea;
}

function makeRoad(samples, trackWidth) {
  const positions = [];
  const indices = [];
  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2);
    left.y += TRACK_Y;
    right.y += TRACK_Y;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    if (index === samples.length) continue;
    const offset = index * 2;
    indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(geometry, mat(ASPHALT, 0.97));
  road.name = 'World Playground oversized road loop';
  road.receiveShadow = true;
  return road;
}

function makeRoadEdges(samples, trackWidth) {
  const group = new THREE.Group();
  group.name = 'World Playground road edges';
  for (const side of [-1, 1]) {
    const points = samples.map((sample) => sample.point.clone()
      .addScaledVector(sample.normal, side * (trackWidth / 2 + 0.6))
      .add(new THREE.Vector3(0, TRACK_Y + 0.2, 0)));
    points.push(points[0].clone());
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: CREAM })));
  }
  return group;
}

function box(world, name, size, position, color, rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

function cylinder(world, name, radiusTop, radiusBottom, height, position, color, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat(color));
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

function installHarbor(world) {
  const group = new THREE.Group();
  group.name = 'HARBOR model district';
  world.add(group);
  const colors = [0xc95b35, 0x167b82, 0xf5c542, 0x3d6fbb, 0x4d8b63];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const h = 5 + ((row + column) % 3) * 5;
      box(group, 'Harbor container stack', [22, h, 8], [-305 + column * 27, h / 2, 150 + row * 12], colors[(row + column) % colors.length]);
    }
  }
  for (const x of [-310, -225, -145]) makeCrane(group, x, 118);
  box(group, 'Harbor quay', [250, 2, 38], [-225, 0, 112], 0x92999b);
  makeShip(group, [-340, 2, 85], 1.25, 0x355a78);
  makeShip(group, [-270, 2, 72], 0.85, 0xa34837);
}

function makeCrane(group, x, z) {
  box(group, 'Harbor crane tower', [5, 46, 5], [x, 23, z], 0xd86642);
  box(group, 'Harbor crane boom', [5, 4, 55], [x, 44, z - 24], 0xd86642, -0.08);
  box(group, 'Harbor crane counterweight', [12, 8, 10], [x, 39, z + 8], 0x454a50);
}

function makeShip(group, [x, y, z], scale, color) {
  const ship = new THREE.Group();
  ship.name = 'Harbor ship';
  const hull = new THREE.Mesh(new THREE.BoxGeometry(48, 7, 13), mat(color));
  hull.position.y = 3.5;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 10), mat(CREAM));
  cabin.position.set(8, 10, 0);
  ship.add(hull, cabin);
  ship.scale.setScalar(scale);
  ship.position.set(x, y, z);
  ship.rotation.y = Math.PI / 2;
  group.add(ship);
}

function installCliffside(world) {
  const group = new THREE.Group();
  group.name = 'CLIFFSIDE model district';
  world.add(group);
  const rockPositions = [
    [-390, -115, 20], [-382, -170, 29], [-360, -225, 38], [-325, -270, 46], [-285, -295, 49]
  ];
  rockPositions.forEach(([x, z, h], index) => {
    const rock = new THREE.Mesh(new THREE.ConeGeometry(26 + index * 2, h, 7), mat(ROCK));
    rock.position.set(x, h / 2 - 3, z);
    rock.rotation.y = index * 0.44;
    group.add(rock);
  });
  for (let index = 0; index < 7; index += 1) {
    const x = -318 + index * 18;
    const z = -145 - index * 17;
    box(group, 'Cliffside house', [13, 10 + (index % 2) * 4, 12], [x, 7 + (index % 2) * 2, z], index % 2 ? 0xb55e48 : 0xd9c8a6, -0.35);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 6, 4), mat(0x6e4c3b));
    roof.name = 'Cliffside house roof';
    roof.position.set(x, 15 + (index % 2) * 4, z);
    roof.rotation.y = Math.PI / 4 - 0.35;
    group.add(roof);
  }
  makeShip(group, [-455, 0, -120], 1.1, 0x304b68);
}

function installMountain(world) {
  const group = new THREE.Group();
  group.name = 'MOUNTAIN model district';
  world.add(group);
  const peaks = [
    [-155, -370, 92], [-80, -390, 116], [0, -395, 130], [75, -378, 105], [135, -345, 82]
  ];
  peaks.forEach(([x, z, h], index) => {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(50 - index * 2, h, 8), mat(MOUNTAIN));
    peak.position.set(x, h / 2 - 2, z);
    peak.rotation.y = index * 0.28;
    group.add(peak);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(21, h * 0.28, 8), mat(SNOW));
    cap.position.set(x, h * 0.78, z);
    cap.rotation.y = peak.rotation.y;
    group.add(cap);
  });

  // Model village. The road intentionally stays outside it and never enters a tunnel.
  for (let index = 0; index < 8; index += 1) {
    const x = -135 + (index % 4) * 33;
    const z = -285 + Math.floor(index / 4) * 31;
    makeAlpineHouse(group, x, 10, z, index % 2 ? 0xb35042 : 0x7f5b47);
  }
  const river = new THREE.Mesh(new THREE.PlaneGeometry(22, 150), mat(WATER, 0.45));
  river.name = 'Mountain model river';
  river.rotation.x = -Math.PI / 2;
  river.rotation.z = -0.18;
  river.position.set(72, 1.4, -255);
  group.add(river);
  box(group, 'Mountain waterfall', [28, 38, 2.5], [107, 19, -325], WATER);
  cylinder(group, 'Mountain waterfall pool', 30, 30, 1.2, [103, 0, -303], WATER, 24).rotation.x = Math.PI / 2;
}

function makeAlpineHouse(group, x, y, z, color) {
  box(group, 'Mountain village house', [24, 16, 19], [x, y, z], color);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(18, 10, 4), mat(0x665044));
  roof.name = 'Mountain village roof';
  roof.position.set(x, y + 13, z);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
}

function installMidnightCity(world) {
  const group = new THREE.Group();
  group.name = 'MIDNIGHT CITY model district';
  world.add(group);
  const baseX = -35;
  const baseZ = 180;
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      if ((row === 2 && column === 2) || (row === 3 && column === 3)) continue;
      const h = 22 + ((row * 7 + column * 11) % 48);
      const color = (row + column) % 3 === 0 ? 0x33415b : 0x43495d;
      const tower = box(group, 'Midnight City skyscraper', [22, h, 22], [baseX + column * 30, h / 2, baseZ + row * 28], color);
      if ((row + column) % 2 === 0) {
        const neon = new THREE.Mesh(
          new THREE.BoxGeometry(22.5, 2.2, 22.5),
          new THREE.MeshBasicMaterial({ color: (row + column) % 4 ? PINK : CYAN })
        );
        neon.name = 'Midnight City neon crown';
        neon.position.set(tower.position.x, h - 3, tower.position.z);
        group.add(neon);
      }
    }
  }
  // Two real parks interrupt the dense skyline.
  for (const [x, z] of [[28, 236], [61, 208]]) {
    const park = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), mat(0x4c8b63));
    park.name = 'Midnight City park';
    park.rotation.x = -Math.PI / 2;
    park.position.set(x, 0.8, z);
    group.add(park);
    for (let index = 0; index < 4; index += 1) makeTree(group, x - 8 + index * 5, z + (index % 2 ? 7 : -7), 0x275c42);
  }
  group.add(makeRoadSign('← HARBOR', [-18, 16, 145], -0.15));
  group.add(makeRoadSign('AIRPORT →', [72, 15, 140], 0.08));
  group.add(makeNeonSign('MIDNIGHT CITY', [8, 31, 268], PINK));
}

function installCountryside(world) {
  const group = new THREE.Group();
  group.name = 'COUNTRYSIDE model district';
  world.add(group);
  const fields = [
    [135, 62, 72, 54, FIELD], [220, 58, 82, 48, FIELD_GOLD], [160, -5, 76, 45, 0x97b45e],
    [260, 5, 70, 50, FIELD], [305, 70, 70, 44, FIELD_GOLD]
  ];
  for (const [x, z, w, h, color] of fields) {
    const field = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(color, 1));
    field.name = 'Countryside farm field';
    field.rotation.x = -Math.PI / 2;
    field.position.set(x, 0.7, z);
    group.add(field);
  }
  for (let index = 0; index < 22; index += 1) {
    makeTree(group, 95 + (index % 8) * 34, -55 + Math.floor(index / 8) * 42, index % 3 ? 0x356b46 : 0x4c7c42);
  }
  for (let index = 0; index < 6; index += 1) {
    const x = 145 + index * 31;
    makeFarmHouse(group, x, 14 + (index % 2) * 3, 112 + (index % 2) * 20);
  }
  makeWindmillTower(group, 245, -48);
}

function makeTree(group, x, z, color) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 9, 7), mat(0x6f5138));
  trunk.position.set(x, 4.5, z);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(6.8, 8, 6), mat(color));
  crown.position.set(x, 12, z);
  group.add(trunk, crown);
}

function makeFarmHouse(group, x, y, z) {
  box(group, 'Countryside farmhouse', [23, y, 17], [x, y / 2, z], 0xb94d42);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(17, 8, 4), mat(0x5e463c));
  roof.position.set(x, y + 4, z);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
}

function makeWindmillTower(group, x, z) {
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 24, 10), mat(0xe2d5b8));
  tower.name = 'Countryside classic windmill tower';
  tower.position.set(x, 12, z);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), mat(0x5c4638));
  hub.position.set(x, 22, z - 7);
  group.add(tower, hub);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 24, 0.8), mat(CREAM));
    blade.name = 'Countryside windmill blade fallback';
    blade.position.copy(hub.position);
    blade.rotation.z = angle;
    group.add(blade);
  }
}

function installAirport(world) {
  const group = new THREE.Group();
  group.name = 'AIRPORT model district';
  world.add(group);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(250, 185), mat(0x8b9295, 1));
  apron.name = 'Airport apron';
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(385, 0.5, 45);
  group.add(apron);
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(52, 285), mat(0x33383c));
  runway.name = 'Airport runway';
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(455, 0.9, -10);
  group.add(runway);
  for (let index = 0; index < 12; index += 1) {
    box(group, 'Airport runway centre marking', [2.5, 0.15, 10], [455, 1.05, -125 + index * 22], CREAM);
  }
  box(group, 'Airport terminal', [105, 24, 32], [340, 12, 65], 0xd9dfe0);
  cylinder(group, 'Airport control tower shaft', 6, 8, 40, [305, 20, -5], 0xcbd0d2, 10);
  cylinder(group, 'Airport control tower cab', 13, 10, 8, [305, 43, -5], 0x3c5666, 10);
  makeAirplane(group, [355, 6, 15], 0.95, -0.15, 0xf1f3f5);
  makeAirplane(group, [397, 6, 80], 0.82, 0.12, 0xf1f3f5);
  makeAirplane(group, [470, 95, -70], 0.7, -0.55, 0xffffff);
  makeAirplane(group, [355, 125, -165], 0.55, 0.25, 0xffffff);
}

function makeAirplane(group, [x, y, z], scale, rotation, color) {
  const plane = new THREE.Group();
  plane.name = y > 30 ? 'Airport airplane in the air' : 'Airport grounded airplane';
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 34, 12), mat(color, 0.65));
  fuselage.rotation.x = Math.PI / 2;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.8, 6), mat(color, 0.65));
  wing.position.z = 1;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(12, 0.7, 4), mat(color, 0.65));
  tail.position.z = 12;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 6), mat(0x3d6fbb, 0.65));
  fin.position.set(0, 4, 13);
  plane.add(fuselage, wing, tail, fin);
  plane.scale.setScalar(scale);
  plane.position.set(x, y, z);
  plane.rotation.y = rotation;
  if (y > 30) plane.rotation.z = -0.08;
  group.add(plane);
}

function installMountainRange(world) {
  const group = new THREE.Group();
  group.name = 'World Playground eastern mountain boundary';
  world.add(group);
  const ridge = [
    [90, -415, 78], [185, -390, 82], [285, -345, 76], [385, -285, 72], [470, -190, 66],
    [510, -70, 62], [505, 65, 58], [465, 180, 62], [385, 260, 70], [275, 305, 64],
    [150, 325, 58], [25, 320, 54], [-95, 315, 50], [-210, 305, 48], [-315, 275, 44]
  ];
  ridge.forEach(([x, z, h], index) => {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(32 + (index % 3) * 5, h, 7), mat(index < 5 ? MOUNTAIN : 0x67665c));
    peak.name = 'World boundary mountain';
    peak.position.set(x, h / 2 - 2, z);
    peak.rotation.y = index * 0.31;
    group.add(peak);
  });
}

function installDistrictSigns(world) {
  const labels = [
    ['HARBOR', [-250, 22, 98], CYAN],
    ['CLIFFSIDE', [-315, 42, -180], CREAM],
    ['MOUNTAIN', [-45, 84, -300], CREAM],
    ['MIDNIGHT CITY', [5, 28, 145], PINK],
    ['COUNTRYSIDE', [210, 24, 95], YELLOW],
    ['AIRPORT', [390, 31, 112], CYAN]
  ];
  for (const [text, position, color] of labels) world.add(makeNeonSign(text, position, color));
}

function makeNeonSign(text, [x, y, z], color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#08090a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#fff8e8';
  context.lineWidth = 8;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  context.fillStyle = `#${new THREE.Color(color).getHexString()}`;
  context.font = '900 50px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = `${text} world label`;
  sprite.position.set(x, y, z);
  sprite.scale.set(58, 15, 1);
  return sprite;
}

function makeRoadSign(text, [x, y, z], rotation = 0) {
  const sign = makeNeonSign(text, [0, 0, 0], YELLOW);
  sign.name = `${text} directional road sign`;
  sign.position.set(x, y, z);
  sign.rotation.y = rotation;
  sign.scale.set(46, 12, 1);
  return sign;
}

async function installClassicAssets(world) {
  const jobs = [
    placeAsset(world, 'liner', { name: 'Cliffside classic ocean liner asset', position: [-455, -1, -205], scale: 0.22, rotation: Math.PI / 2 }),
    placeAsset(world, 'houseA', { name: 'Cliffside classic suburban house asset', position: [-286, 16, -174], scale: 1.7, rotation: -0.35 }),
    placeAsset(world, 'tree', { name: 'Countryside classic oak asset', position: [185, 1, 15], scale: 4.5 }),
    placeAsset(world, 'pine', { name: 'Countryside classic pine asset', position: [120, 1, -20], scale: 4.6 }),
    placeAsset(world, 'rock', { name: 'Cliffside classic rock asset', position: [-345, 6, -72], scale: 7.5 }),
    placeAsset(world, 'waterfallRock', { name: 'Mountain classic waterfall rock asset', position: [103, 10, -326], scale: 6.5 }),
    placeAsset(world, 'waterfallTopRock', { name: 'Mountain classic waterfall top asset', position: [105, 29, -326], scale: 6.2 })
  ];
  await Promise.allSettled(jobs);

  // The supplied Fantasy Town windmill asset is the classic rotor/blades only.
  // Keep the purpose-built tower above and layer the authored rotor onto it.
  try {
    const source = await loadAsset('windmill');
    if (!world.parent) return;
    const rotor = source.clone(true);
    rotor.name = 'Countryside classic Kenney windmill rotor asset';
    rotor.position.set(245, 22, -55);
    rotor.rotation.y = -Math.PI / 2;
    rotor.scale.setScalar(7.2);
    world.add(rotor);
  } catch (_) {}
}

async function placeAsset(world, key, { name, position, scale = 1, rotation = 0 }) {
  try {
    const source = await loadAsset(key);
    if (!world.parent) return null;
    const model = source.clone(true);
    model.name = name;
    model.position.set(...position);
    model.rotation.y = rotation;
    model.scale.setScalar(scale);
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    world.add(model);
    return model;
  } catch (_) {
    return null;
  }
}

function loadAsset(key) {
  if (!assetCache.has(key)) {
    const url = ASSETS[key];
    assetCache.set(key, loader.loadAsync(url).then((gltf) => gltf.scene));
  }
  return assetCache.get(key);
}
