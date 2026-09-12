import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WORLD_PLAYGROUND_V2_SEA_LEVEL } from './world-playground-v2-map.js?revision=r1-environment';

const REVISION = 'r1-macro-landmarks';
const INK = 0x08090a;
const loader = new GLTFLoader();
const sourceCache = new Map();

const AMVLAB_COMMIT = '91d835e8e851b2317fe79af291c9fed6153fd525';
const AMVLAB_BASE = `https://raw.githubusercontent.com/amvlab/aircraft-models/${AMVLAB_COMMIT}/models/`;

const ASSETS = Object.freeze({
  windmill: new URL(
    '../assets/scenery/fantasy-town/windmill.glb?asset=kenney-fantasy-town-kit-2.0-palette-4aac939d',
    import.meta.url
  ).href,
  oceanLiner: new URL(
    '../assets/scenery/watercraft/ship-ocean-liner.glb?asset=kenney-watercraft-kit-2.1-luxury-palette-31113835',
    import.meta.url
  ).href,
  a320: `${AMVLAB_BASE}A320_nologo.glb`,
  b787: `${AMVLAB_BASE}B787_nologo.glb`
});

const inkMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

export function installWorldPlaygroundV2Landmarks({ world, terrainHeight }) {
  if (!world || typeof terrainHeight !== 'function') {
    throw new Error('World V2 macro landmarks require the environment world and terrain sampler.');
  }
  const existing = world.getObjectByName('TURN World V2 macro landmarks');
  if (existing) return existing;

  const root = new THREE.Group();
  root.name = 'TURN World V2 macro landmarks';
  Object.assign(root.userData, {
    revision: REVISION,
    signsInstalled: false,
    macroOnly: true,
    districtCount: 6,
    silhouetteFirst: true
  });

  root.add(makeHarbor(terrainHeight));
  root.add(makeCliffside(terrainHeight));
  root.add(makeMountain(terrainHeight));
  root.add(makeCountryside(terrainHeight));
  root.add(makeAirport(terrainHeight));
  root.add(makeMidnightCity(terrainHeight));
  world.add(root);

  world.userData.assetsInstalled = true;
  world.userData.signsInstalled = false;
  world.userData.turnWorldMacroLandmarks = REVISION;

  root.userData.ready = installClassicAssets(root, terrainHeight)
    .catch((error) => {
      console.info('TURN LAB: World V2 classic landmark assets did not all load; procedural silhouettes remain.', error);
      return false;
    });
  return root;
}

function makeHarbor(heightAt) {
  const group = districtGroup('HARBOR macro landmarks', 'harbor');

  const craneSlots = [
    [-730, 510, -0.08, 48],
    [-675, 535, -0.08, 43],
    [-615, 550, -0.08, 39]
  ];
  for (const [x, z, rotation, height] of craneSlots) {
    const crane = makeQuayCrane(height);
    groundObject(crane, heightAt, x, z, 0.35);
    crane.rotation.y = rotation;
    group.add(crane);
  }

  const yard = new THREE.Group();
  yard.name = 'HARBOR container yard silhouette';
  const containerGeometry = new THREE.BoxGeometry(13, 5.2, 5.4);
  const containerMaterials = [0xff5f67, 0x38d9ff, 0xffd43b, 0x5470c6].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.08 })
  );
  const stacks = [
    [-555, 495, 2, 0], [-530, 500, 3, 1], [-505, 504, 2, 2],
    [-575, 525, 3, 3], [-545, 530, 2, 2], [-515, 535, 3, 0]
  ];
  for (const [x, z, levels, materialIndex] of stacks) {
    for (let level = 0; level < levels; level += 1) {
      const box = new THREE.Mesh(containerGeometry, containerMaterials[(materialIndex + level) % containerMaterials.length]);
      box.name = 'HARBOR container';
      box.position.set(x, heightAt(x, z) + 2.7 + level * 5.3, z);
      box.rotation.y = -0.08;
      box.castShadow = true;
      box.receiveShadow = true;
      yard.add(box);
    }
  }
  group.add(yard);

  const ship = makeCargoShip(88, 23, 15, 0x394d63);
  ship.name = 'HARBOR docked cargo ship';
  ship.position.set(-835, WORLD_PLAYGROUND_V2_SEA_LEVEL + 4.3, 510);
  ship.rotation.y = 0.2;
  group.add(ship);

  return group;
}

function makeCliffside(heightAt) {
  const group = districtGroup('CLIFFSIDE macro landmarks', 'cliffside');

  const houses = [
    [-835, -35, 14, 0.22, 0xe9d0a6, 0xa44d45],
    [-820, -180, 12, -0.12, 0xd4e3d5, 0x5f6f8f],
    [-790, -330, 15, 0.18, 0xf0d6b3, 0x8b5348],
    [-750, -485, 13, -0.18, 0xd8d4bd, 0x526f66],
    [-680, -610, 16, 0.1, 0xe6d4bd, 0x86505a]
  ];
  for (const [x, z, scale, rotation, wall, roof] of houses) {
    const house = makeHouse(scale, wall, roof);
    house.name = 'CLIFFSIDE coastal house';
    groundObject(house, heightAt, x, z, 0.18);
    house.rotation.y = rotation;
    group.add(house);
  }

  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x71675e, roughness: 1, flatShading: true });
  const rockSlots = [
    [-1065, -90, 12], [-1085, -180, 18], [-1090, -300, 16], [-1055, -430, 20],
    [-1010, -560, 14], [-925, -655, 17], [-875, -705, 11]
  ];
  for (const [x, z, scale] of rockSlots) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.name = 'CLIFFSIDE coastal rock';
    const y = Math.max(WORLD_PLAYGROUND_V2_SEA_LEVEL + scale * 0.2, heightAt(x, z));
    rock.position.set(x, y + scale * 0.42, z);
    rock.scale.set(scale * 0.8, scale * 0.55, scale);
    rock.rotation.set(0.15, (x + z) * 0.01, -0.09);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  const linerFallback = makePassengerShip(94, 18, 22);
  linerFallback.name = 'CLIFFSIDE ocean liner fallback';
  linerFallback.position.set(-1190, WORLD_PLAYGROUND_V2_SEA_LEVEL + 5.1, -310);
  linerFallback.rotation.y = -0.16;
  linerFallback.userData.assetSlot = 'cliffside-ocean-liner';
  group.add(linerFallback);

  return group;
}

function makeMountain(heightAt) {
  const group = districtGroup('MOUNTAIN macro landmarks', 'mountain');

  const cabins = [
    [-350, -780, 13, -0.18], [-315, -752, 11, 0.2], [-270, -745, 14, -0.06],
    [-225, -760, 12, 0.14], [-185, -790, 11, -0.2], [-335, -825, 10, 0.12],
    [-285, -835, 12, -0.1], [-225, -835, 10, 0.18]
  ];
  for (let index = 0; index < cabins.length; index += 1) {
    const [x, z, scale, rotation] = cabins[index];
    const cabin = makeHouse(
      scale,
      index % 3 === 0 ? 0xc79c6c : index % 3 === 1 ? 0xd8c5a0 : 0xb98262,
      index % 2 ? 0x474a46 : 0x76514a,
      0.72
    );
    cabin.name = 'MOUNTAIN model village cabin';
    groundObject(cabin, heightAt, x, z, 0.14);
    cabin.rotation.y = rotation;
    group.add(cabin);
  }

  const lodge = makeHouse(22, 0xc6aa84, 0x4b4d49, 0.62);
  lodge.name = 'MOUNTAIN village lodge';
  groundObject(lodge, heightAt, -385, -842, 0.18);
  lodge.rotation.y = -0.22;
  group.add(lodge);

  const chapel = new THREE.Group();
  chapel.name = 'MOUNTAIN village chapel';
  const body = outlinedPrimitive(
    new THREE.BoxGeometry(10, 13, 17),
    new THREE.MeshStandardMaterial({ color: 0xe6ddd0, roughness: 0.92 })
  );
  body.position.y = 6.5;
  const roof = outlinedPrimitive(
    new THREE.ConeGeometry(9.5, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x68534d, roughness: 0.94 })
  );
  roof.position.y = 16;
  roof.rotation.y = Math.PI / 4;
  const steeple = outlinedPrimitive(
    new THREE.ConeGeometry(2.4, 9, 6),
    new THREE.MeshStandardMaterial({ color: 0x4e5551, roughness: 0.9 })
  );
  steeple.position.set(0, 23, -1.5);
  chapel.add(body, roof, steeple);
  groundObject(chapel, heightAt, -165, -740, 0.18);
  chapel.rotation.y = 0.12;
  group.add(chapel);

  return group;
}

function makeCountryside(heightAt) {
  const group = districtGroup('COUNTRYSIDE macro landmarks', 'countryside');

  const windmill = makeWindmillFallback();
  windmill.name = 'COUNTRYSIDE classic windmill';
  windmill.userData.assetSlot = 'countryside-windmill-rotor';
  groundObject(windmill, heightAt, 650, 165, 0.16);
  windmill.rotation.y = -0.45;
  group.add(windmill);

  const barn = makeBarn(34, 16, 20, 0xb95f4f, 0x4e514c);
  barn.name = 'COUNTRYSIDE large barn';
  groundObject(barn, heightAt, 455, 445, 0.18);
  barn.rotation.y = 0.2;
  group.add(barn);

  const farmhouse = makeHouse(18, 0xe5dcc4, 0x98514c, 0.68);
  farmhouse.name = 'COUNTRYSIDE farmhouse';
  groundObject(farmhouse, heightAt, 735, 215, 0.17);
  farmhouse.rotation.y = -0.14;
  group.add(farmhouse);

  const silo = new THREE.Group();
  silo.name = 'COUNTRYSIDE farm silo';
  const shaft = outlinedPrimitive(
    new THREE.CylinderGeometry(7.5, 8.2, 28, 12),
    new THREE.MeshStandardMaterial({ color: 0xb9b5a7, roughness: 0.76, metalness: 0.14 })
  );
  shaft.position.y = 14;
  const cap = outlinedPrimitive(
    new THREE.ConeGeometry(8.4, 5.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x777b76, roughness: 0.7, metalness: 0.18 })
  );
  cap.position.y = 30.4;
  silo.add(shaft, cap);
  groundObject(silo, heightAt, 485, 405, 0.16);
  group.add(silo);

  return group;
}

function makeAirport(heightAt) {
  const group = districtGroup('AIRPORT macro landmarks', 'airport');

  const terminal = new THREE.Group();
  terminal.name = 'AIRPORT terminal massing';
  const main = outlinedPrimitive(
    new THREE.BoxGeometry(125, 19, 42),
    new THREE.MeshStandardMaterial({ color: 0xc2c5c3, roughness: 0.82 })
  );
  main.position.y = 9.5;
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(108, 8, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x66c9df, roughness: 0.28, metalness: 0.05, emissive: 0x15333c })
  );
  glass.position.set(0, 10.2, 21.3);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(136, 1.4, 47),
    new THREE.MeshStandardMaterial({ color: 0x6f7678, roughness: 0.7, metalness: 0.12 })
  );
  roof.position.y = 20;
  terminal.add(main, glass, roof);
  groundObject(terminal, heightAt, 815, 65, 0.2);
  terminal.rotation.y = 0.03;
  group.add(terminal);

  const tower = makeControlTower();
  tower.name = 'AIRPORT control tower';
  groundObject(tower, heightAt, 790, -105, 0.2);
  group.add(tower);

  const parkedFallback = makeJetFallback(42, 38);
  parkedFallback.name = 'AIRPORT A320 fallback';
  parkedFallback.userData.assetSlot = 'airport-a320';
  groundObject(parkedFallback, heightAt, 910, 68, 1.5);
  parkedFallback.rotation.y = -0.05;
  group.add(parkedFallback);

  const airborneFallback = makeJetFallback(30, 27);
  airborneFallback.name = 'AIRPORT B787 overflight fallback';
  airborneFallback.userData.assetSlot = 'airport-b787';
  airborneFallback.position.set(685, heightAt(685, -285) + 210, -285);
  airborneFallback.rotation.set(0.02, -0.72, -0.12);
  group.add(airborneFallback);

  return group;
}

function makeMidnightCity(heightAt) {
  const group = districtGroup('MIDNIGHT CITY macro landmarks', 'midnight-city');

  const towers = [
    [-285, 455, 38, 38, 118, 0x38455d, 0x38d9ff],
    [-225, 410, 42, 42, 154, 0x51405e, 0xff4fa3],
    [-155, 438, 34, 34, 102, 0x344f55, 0x38d9ff],
    [-80, 405, 48, 44, 174, 0x433b57, 0xb66cff],
    [5, 430, 38, 38, 128, 0x2f4852, 0x38d9ff],
    [60, 505, 33, 33, 96, 0x4e3a50, 0xff4fa3],
    [-295, 575, 34, 36, 92, 0x3f4659, 0x38d9ff],
    [-235, 615, 43, 43, 138, 0x3b4055, 0xb66cff],
    [-125, 650, 38, 38, 112, 0x334b50, 0x38d9ff],
    [-20, 650, 46, 42, 146, 0x4b3b54, 0xff4fa3]
  ];

  towers.forEach(([x, z, width, depth, height, bodyColor, lightColor], index) => {
    const tower = makeCityTower(width, depth, height, bodyColor, lightColor, index);
    groundObject(tower, heightAt, x, z, 0.16);
    tower.rotation.y = (index % 3 - 1) * 0.06;
    group.add(tower);
  });

  const civic = makeCityTower(65, 45, 78, 0x4e5657, 0xffd43b, 11);
  civic.name = 'MIDNIGHT CITY civic landmark';
  groundObject(civic, heightAt, -360, 495, 0.16);
  civic.rotation.y = -0.08;
  group.add(civic);

  return group;
}

async function installClassicAssets(root, heightAt) {
  const jobs = [
    replaceWindmillRotor(root),
    replaceCliffsideLiner(root),
    replaceAirportAircraft(root, heightAt, 'a320', 'airport-a320', 42, { x: 910, z: 68, rotation: -0.05, lift: 1.6 }),
    replaceAirportAircraft(root, heightAt, 'b787', 'airport-b787', 30, {
      x: 685, z: -285, rotation: -0.72, lift: 210, bank: -0.12, airborne: true
    })
  ];
  const results = await Promise.allSettled(jobs);
  root.userData.classicAssetResults = results.map((result) => result.status);
  root.userData.classicAssetsReady = results.every((result) => result.status === 'fulfilled');
  return root.userData.classicAssetsReady;
}

async function replaceWindmillRotor(root) {
  const windmill = root.getObjectByName('COUNTRYSIDE classic windmill');
  if (!windmill) return false;
  const fallback = windmill.getObjectByName('COUNTRYSIDE windmill rotor fallback');
  const source = await loadSource('windmill');
  const rotor = prepareAsset(source, { targetSpan: 25, outline: false, paletteLocked: true });
  rotor.name = 'COUNTRYSIDE Kenney windmill rotor';
  rotor.rotation.y = -Math.PI / 2;
  rotor.position.set(0, 26.5, 8.6);
  if (fallback) fallback.removeFromParent();
  windmill.add(rotor);
  return true;
}

async function replaceCliffsideLiner(root) {
  const fallback = findAssetSlot(root, 'cliffside-ocean-liner');
  if (!fallback) return false;
  const source = await loadSource('oceanLiner');
  const liner = prepareAsset(source, { targetSpan: 98, horizontalSpan: true, outlineScale: 1.012 });
  liner.name = 'CLIFFSIDE Kenney ocean liner';
  liner.position.copy(fallback.position);
  liner.rotation.copy(fallback.rotation);
  fallback.parent?.add(liner);
  fallback.removeFromParent();
  return true;
}

async function replaceAirportAircraft(root, heightAt, key, slot, targetLength, placement) {
  const fallback = findAssetSlot(root, slot);
  if (!fallback) return false;
  const source = await loadSource(key);
  const ratio = key === 'a320' ? 37.57 / 35.8 : 62.81 / 60.12;
  const model = prepareAircraft(source, targetLength, ratio, Boolean(placement.airborne));
  model.name = key === 'a320' ? 'AIRPORT production A320' : 'AIRPORT production B787 overflight';
  const y = placement.airborne
    ? heightAt(placement.x, placement.z) + placement.lift
    : heightAt(placement.x, placement.z) + placement.lift;
  model.position.set(placement.x, y, placement.z);
  model.rotation.y += placement.rotation || 0;
  model.rotation.z += placement.bank || 0;
  fallback.parent?.add(model);
  fallback.removeFromParent();
  return true;
}

function makeQuayCrane(height) {
  const root = new THREE.Group();
  root.name = 'HARBOR quay crane';
  const steel = new THREE.MeshStandardMaterial({ color: 0xcf4f44, roughness: 0.62, metalness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x555f64, roughness: 0.7, metalness: 0.2 });
  const legGeometry = new THREE.BoxGeometry(2.8, height, 2.8);
  for (const x of [-10, 10]) {
    const leg = new THREE.Mesh(legGeometry, steel);
    leg.position.set(x, height / 2, 0);
    leg.castShadow = true;
    root.add(leg);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(25, 3.1, 4), steel);
  cross.position.set(0, height - 3, 0);
  cross.castShadow = true;
  root.add(cross);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(44, 2.4, 2.8), steel);
  boom.position.set(-12, height + 5, 0);
  boom.rotation.z = 0.08;
  boom.castShadow = true;
  root.add(boom);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 6), dark);
  cabin.position.set(-2, height - 7, 0);
  cabin.castShadow = true;
  root.add(cabin);
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.4, 19, 0.4), dark);
  cable.position.set(-29, height - 4, 0);
  root.add(cable);
  return root;
}

function makeCargoShip(length, width, height, hullColor) {
  const root = new THREE.Group();
  const hull = outlinedPrimitive(
    new THREE.BoxGeometry(length, height, width),
    new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.72, metalness: 0.14 }),
    1.014
  );
  hull.position.y = height * 0.32;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(length * 0.82, 1.4, width * 0.88),
    new THREE.MeshStandardMaterial({ color: 0xc8c4b7, roughness: 0.8 })
  );
  deck.position.y = height * 0.78;
  root.add(hull, deck);
  for (let index = 0; index < 7; index += 1) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 4.6, 5.2),
      new THREE.MeshStandardMaterial({ color: [0xff5f67, 0x38d9ff, 0xffd43b][index % 3], roughness: 0.86 })
    );
    box.position.set(-26 + index * 9, height * 0.98, index % 2 ? 3.2 : -3.2);
    root.add(box);
  }
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(12, 11, width * 0.78),
    new THREE.MeshStandardMaterial({ color: 0xe6e0d1, roughness: 0.8 })
  );
  bridge.position.set(length * 0.32, height * 1.13, 0);
  root.add(bridge);
  return root;
}

function makePassengerShip(length, width, height) {
  const root = makeCargoShip(length, width, height * 0.55, 0x263d55);
  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(length * 0.68, height * 0.48, width * 0.74),
    new THREE.MeshStandardMaterial({ color: 0xf1eee4, roughness: 0.7 })
  );
  upper.position.set(2, height * 0.72, 0);
  root.add(upper);
  return root;
}

function makeHouse(scale, wallColor, roofColor, depthScale = 0.8) {
  const root = new THREE.Group();
  const width = scale;
  const height = scale * 0.68;
  const depth = scale * depthScale;
  const body = outlinedPrimitive(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.96 })
  );
  body.position.y = height / 2;
  const roof = outlinedPrimitive(
    new THREE.ConeGeometry(width * 0.7, scale * 0.42, 4),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.94 })
  );
  roof.position.y = height + scale * 0.19;
  roof.rotation.y = Math.PI / 4;
  root.add(body, roof);
  return root;
}

function makeBarn(width, height, depth, bodyColor, roofColor) {
  const root = new THREE.Group();
  const body = outlinedPrimitive(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.96 })
  );
  body.position.y = height / 2;
  const roof = outlinedPrimitive(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.55, height * 0.52, 4),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.94 })
  );
  roof.position.y = height + height * 0.24;
  roof.rotation.y = Math.PI / 4;
  root.add(body, roof);
  return root;
}

function makeWindmillFallback() {
  const root = new THREE.Group();
  const tower = outlinedPrimitive(
    new THREE.CylinderGeometry(6.2, 9.3, 26, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2dfbd, roughness: 0.96 })
  );
  tower.position.y = 13;
  const roof = outlinedPrimitive(
    new THREE.ConeGeometry(7.7, 6.5, 10),
    new THREE.MeshStandardMaterial({ color: 0xa85b3f, roughness: 0.94 })
  );
  roof.position.y = 29.4;
  const rotor = new THREE.Group();
  rotor.name = 'COUNTRYSIDE windmill rotor fallback';
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 2.4, 10),
    new THREE.MeshStandardMaterial({ color: 0x73523a, roughness: 0.88 })
  );
  hub.rotation.x = Math.PI / 2;
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.94 });
  for (let blade = 0; blade < 4; blade += 1) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.1, 14, 0.9), bladeMaterial);
    arm.position.y = 7;
    const holder = new THREE.Group();
    holder.rotation.z = blade * Math.PI / 2;
    holder.add(arm);
    rotor.add(holder);
  }
  rotor.add(hub);
  rotor.position.set(0, 26.5, 8.6);
  root.add(tower, roof, rotor);
  return root;
}

function makeControlTower() {
  const root = new THREE.Group();
  const shaft = outlinedPrimitive(
    new THREE.CylinderGeometry(5.2, 7.4, 31, 10),
    new THREE.MeshStandardMaterial({ color: 0xc6c7bf, roughness: 0.9 })
  );
  shaft.position.y = 15.5;
  const cab = outlinedPrimitive(
    new THREE.CylinderGeometry(10.4, 8.2, 8.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x415967, roughness: 0.4, metalness: 0.08 }),
    1.025
  );
  cab.position.y = 34;
  const roof = outlinedPrimitive(
    new THREE.CylinderGeometry(11, 11, 1.3, 10),
    new THREE.MeshStandardMaterial({ color: 0x6d7475, roughness: 0.7, metalness: 0.12 })
  );
  roof.position.y = 38.7;
  root.add(shaft, cab, roof);
  return root;
}

function makeJetFallback(length, span) {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xe9e8e1, roughness: 0.66, metalness: 0.08 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x405e7a, roughness: 0.68 });
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(length * 0.09, length * 0.72, 6, 10), material);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = 3;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(span, 0.8, length * 0.28), material);
  wing.position.y = 3;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, length * 0.18, length * 0.12), accent);
  tail.position.set(0, length * 0.11, length * 0.32);
  root.add(fuselage, wing, tail);
  return root;
}

function makeCityTower(width, depth, height, bodyColor, lightColor, seed) {
  const root = new THREE.Group();
  root.name = 'MIDNIGHT CITY skyscraper';
  const body = outlinedPrimitive(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.74, metalness: 0.08 }),
    1.018
  );
  body.position.y = height / 2;
  root.add(body);

  const windowMaterial = new THREE.MeshBasicMaterial({ color: lightColor });
  const floors = Math.max(3, Math.min(8, Math.floor(height / 24)));
  for (let floor = 1; floor <= floors; floor += 1) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(width * 0.74, 1.25, 0.45), windowMaterial);
    band.position.set(0, floor * height / (floors + 1), depth / 2 + 0.24);
    root.add(band);
  }

  if (seed % 3 === 0) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.22, Math.min(22, height * 0.18), 5),
      new THREE.MeshStandardMaterial({ color: 0x505967, roughness: 0.7, metalness: 0.14 })
    );
    crown.position.y = height + Math.min(22, height * 0.18) / 2;
    root.add(crown);
  }
  return root;
}

function districtGroup(name, district) {
  const group = new THREE.Group();
  group.name = name;
  group.userData.turnWorldDistrict = district;
  group.userData.macroLandmarks = true;
  return group;
}

function outlinedPrimitive(geometry, surfaceMaterial, outlineScale = 1.03) {
  const root = new THREE.Group();
  const outline = new THREE.Mesh(geometry, inkMaterial);
  outline.scale.setScalar(outlineScale);
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.userData.turnOutline = true;
  const surface = new THREE.Mesh(geometry, surfaceMaterial);
  surface.castShadow = true;
  surface.receiveShadow = true;
  root.add(outline, surface);
  return root;
}

function groundObject(object, heightAt, x, z, lift = 0) {
  object.position.set(x, heightAt(x, z) + lift, z);
  return object;
}

function findAssetSlot(root, slot) {
  let match = null;
  root.traverse((node) => {
    if (!match && node.userData?.assetSlot === slot) match = node;
  });
  return match;
}

function loadSource(key) {
  if (!sourceCache.has(key)) {
    sourceCache.set(key, loader.loadAsync(ASSETS[key]).then((gltf) => gltf.scene));
  }
  return sourceCache.get(key);
}

function prepareAsset(source, {
  targetSpan,
  horizontalSpan = false,
  outline = true,
  outlineScale = 1.02,
  paletteLocked = false
}) {
  const model = source.clone(true);
  const surfaces = [];
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry = node.geometry.clone();
    if (Array.isArray(node.material)) node.material = node.material.map((material) => material.clone());
    else node.material = node.material?.clone?.() || node.material;
    node.castShadow = true;
    node.receiveShadow = true;
    if (paletteLocked) node.userData.turnPaletteLocked = true;
    surfaces.push(node);
  });
  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const reference = horizontalSpan ? Math.max(size.x, size.z, 0.001) : Math.max(size.x, size.y, size.z, 0.001);
  model.scale.multiplyScalar(targetSpan / reference);
  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
  if (outline) {
    surfaces.forEach((surface) => {
      const outlineMesh = new THREE.Mesh(surface.geometry, inkMaterial);
      outlineMesh.scale.setScalar(outlineScale);
      outlineMesh.castShadow = false;
      outlineMesh.receiveShadow = false;
      surface.add(outlineMesh);
    });
  }
  return model;
}

function prepareAircraft(source, targetLength, lengthToSpanRatio, airborne) {
  const model = prepareAsset(source, { targetSpan: targetLength, horizontalSpan: true, outline: false });
  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model);
  let size = bounds.getSize(new THREE.Vector3());
  const zAsLengthError = Math.abs((size.z / Math.max(size.x, 0.001)) - lengthToSpanRatio);
  const xAsLengthError = Math.abs((size.x / Math.max(size.z, 0.001)) - lengthToSpanRatio);
  if (xAsLengthError < zAsLengthError) model.rotation.y += Math.PI / 2;
  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  size = bounds.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(targetLength / Math.max(size.z, 0.001));
  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= airborne ? center.y : bounds.min.y;
  return model;
}
