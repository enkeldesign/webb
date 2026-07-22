import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCarVisual } from '../vehicle/car-models.js?build=20260720-r19';

const INK = 0x08090a;
const RUNWAY = 0x25292e;
const TARMAC = 0x747d85;
const CONCRETE = 0xaeb7bf;
const WINDOW = 0x67d6f4;
const YELLOW = 0xffd43b;
const PINK = 0xff4fa3;
const RED = 0xff5f67;
const CREAM = 0xfff8e8;
const TRACK_PROP_CLEARANCE = 25;
const AIRCRAFT_CLEARANCE = 44;

// This tiny low-poly aircraft was authored with Kenney AssetForge. It is an optional visual
// enhancement only: TURN places a local procedural fallback first, so Airport remains playable
// and visually complete if the external source is unavailable or the device is offline.
const AIRCRAFT_ASSET_URL = 'https://raw.githubusercontent.com/crystal-bit/platform-3d/main/assets/airplane.glb';
const aircraftLoader = new GLTFLoader();
let aircraftSourcePromise = null;

const AIRCRAFT_SLOTS = Object.freeze([
  Object.freeze({ position: [-58, 0.35, 186], rotation: 0.08, scale: 1.05, targetLength: 25 }),
  Object.freeze({ position: [133, 0.35, 190], rotation: -0.16, scale: 0.94, targetLength: 23 }),
  Object.freeze({ position: [208, 0.35, 166], rotation: -1.22, scale: 0.82, targetLength: 20 }),
  Object.freeze({ position: [108, 0.35, -190], rotation: Math.PI / 2, scale: 0.72, targetLength: 18 })
]);

const SERVICE_VEHICLE_SLOTS = Object.freeze([
  Object.freeze({ carId: 'sedan', color: '#ffd43b', position: [-32, 0.2, 188], rotation: 1.36, targetLength: 6.1 }),
  Object.freeze({ carId: 'van', color: '#38d9ff', position: [82, 0.2, 34], rotation: -0.32, targetLength: 7.2 }),
  Object.freeze({ carId: 'truck', color: '#ff922b', position: [126, 0.2, 184], rotation: -0.1, targetLength: 8.4 }),
  Object.freeze({ carId: 'truck-flat', color: '#ffd43b', position: [178, 0.2, 184], rotation: 0.18, targetLength: 8.8 }),
  Object.freeze({ carId: 'suv', color: '#ff4fa3', position: [-112, 0.2, 172], rotation: -0.42, targetLength: 6.8 })
]);

const blackOutlineMaterial = new THREE.MeshBasicMaterial({
  color: INK,
  side: THREE.BackSide
});

export function installAirportWorld({ scene, samples, trackWidth = 27 }) {
  const world = new THREE.Group();
  world.name = 'TURN Airport';
  scene.add(world);

  makeGround(world);
  makeRunway(world);
  makeRaceRoad(world, samples, trackWidth);
  makeAirportBuildings(world);
  const aircraftFallbacks = makeAircraftFallbacks(world, samples);
  makeGroundOperations(world, samples);
  makeDistantWorld(world);
  makeStartGate(world, samples, trackWidth);

  installAircraftAssets(world, samples, aircraftFallbacks).catch((error) => {
    console.info('TURN: Airport aircraft asset unavailable; keeping the local fallback.', error);
  });
  installServiceVehicleAssets(world, samples).catch((error) => {
    console.info('TURN: Airport service vehicle assets unavailable; keeping the apron clear.', error);
  });

  return world;
}

function outlinedMesh(geometry, meshMaterial, scale = 1.035, { castShadow = true, receiveShadow = true } = {}) {
  const group = new THREE.Group();
  const outline = new THREE.Mesh(geometry, blackOutlineMaterial);
  outline.scale.setScalar(scale);
  outline.castShadow = false;
  outline.receiveShadow = false;
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  group.add(outline, mesh);
  return group;
}

function material(color, roughness = 0.82, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeGround(world) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 560),
    material(0xa9e98f, 1)
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.08;
  grass.receiveShadow = true;
  world.add(grass);

  const airportBase = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 340),
    material(CONCRETE, 0.98)
  );
  airportBase.rotation.x = -Math.PI / 2;
  airportBase.position.set(15, -0.035, -4);
  airportBase.receiveShadow = true;
  world.add(airportBase);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(290, 125),
    material(TARMAC, 0.96)
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(45, 0.005, 113);
  apron.receiveShadow = true;
  world.add(apron);
}

function makeRunway(world) {
  const runway = outlinedMesh(
    new THREE.BoxGeometry(455, 0.1, 62),
    material(RUNWAY, 0.98),
    1.006,
    { castShadow: false }
  );
  runway.position.set(0, 0.015, -127);
  world.add(runway);

  const white = material(CREAM, 0.88);
  const dashGeometry = new THREE.BoxGeometry(13, 0.08, 0.8);
  const dashes = new THREE.InstancedMesh(dashGeometry, white, 18);
  const marker = new THREE.Object3D();
  for (let index = 0; index < 18; index += 1) {
    marker.position.set(-205 + index * 24, 0.12, -127);
    marker.updateMatrix();
    dashes.setMatrixAt(index, marker.matrix);
  }
  dashes.instanceMatrix.needsUpdate = true;
  dashes.receiveShadow = true;
  world.add(dashes);

  for (const x of [-207, 207]) {
    for (let stripe = -3; stripe <= 3; stripe += 1) {
      const threshold = new THREE.Mesh(new THREE.BoxGeometry(17, 0.08, 2.2), white);
      threshold.position.set(x, 0.12, -127 + stripe * 6.2);
      threshold.receiveShadow = true;
      world.add(threshold);
    }
  }

  const lightGeometry = new THREE.SphereGeometry(0.42, 7, 5);
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3a6 });
  const lights = new THREE.InstancedMesh(lightGeometry, lightMaterial, 40);
  let lightIndex = 0;
  for (const z of [-157, -97]) {
    for (let x = -215; x <= 215; x += 24) {
      marker.position.set(x, 0.48, z);
      marker.updateMatrix();
      lights.setMatrixAt(lightIndex, marker.matrix);
      lightIndex += 1;
    }
  }
  lights.instanceMatrix.needsUpdate = true;
  world.add(lights);
}

function makeRaceRoad(world, samples, trackWidth) {
  const count = samples.length;
  const roadPositions = [];
  const roadColors = [];
  const roadIndices = [];
  const asphaltDark = new THREE.Color(0x34383d);
  const asphaltLight = new THREE.Color(0x4a4f55);

  for (let index = 0; index <= count; index += 1) {
    const sample = samples[index % count];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2).setY(0.17);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2).setY(0.17);
    roadPositions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    const variation = THREE.MathUtils.clamp(
      0.44 + Math.sin(index * 0.17) * 0.1 + Math.sin(index * 0.61 + 0.8) * 0.06,
      0,
      1
    );
    const color = asphaltDark.clone().lerp(asphaltLight, variation);
    roadColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  for (let index = 0; index < count; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    roadIndices.push(a, c, b, b, c, d);
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeometry.setAttribute('color', new THREE.Float32BufferAttribute(roadColors, 3));
  roadGeometry.setIndex(roadIndices);
  roadGeometry.computeVertexNormals();

  const road = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.98,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
  road.receiveShadow = true;
  world.add(road);

  const curbWidth = 1.75;
  const curbSegmentLength = 12;
  const curbColors = [new THREE.Color(0xe63946), new THREE.Color(CREAM)];

  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];
    for (let index = 0; index < count; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % count];
      const innerOffset = side * (trackWidth / 2 - 0.05);
      const outerOffset = side * (trackWidth / 2 + curbWidth);
      const a = current.point.clone().addScaledVector(current.normal, innerOffset).setY(0.205);
      const b = current.point.clone().addScaledVector(current.normal, outerOffset).setY(0.205);
      const c = next.point.clone().addScaledVector(next.normal, innerOffset).setY(0.205);
      const d = next.point.clone().addScaledVector(next.normal, outerOffset).setY(0.205);
      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
      );
      const color = curbColors[Math.floor(index / curbSegmentLength) % 2];
      for (let vertex = 0; vertex < 6; vertex += 1) colors.push(color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const curb = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })
    );
    curb.receiveShadow = true;
    world.add(curb);
  }

  const dashStep = 8;
  const dashGeometry = new THREE.BoxGeometry(0.34, 0.045, 5.2);
  const dashMaterial = material(CREAM, 0.92);
  const centreLine = new THREE.InstancedMesh(dashGeometry, dashMaterial, Math.ceil(count / dashStep));
  const marker = new THREE.Object3D();
  let cursor = 0;
  for (let index = 0; index < count; index += dashStep) {
    const sample = samples[index];
    marker.position.copy(sample.point).setY(0.23);
    marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    centreLine.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }
  centreLine.instanceMatrix.needsUpdate = true;
  world.add(centreLine);
}

function makeAirportBuildings(world) {
  const terminal = new THREE.Group();
  const terminalBody = outlinedMesh(new THREE.BoxGeometry(118, 15, 24), material(0xf3ead7, 0.78), 1.018);
  terminalBody.position.y = 7.5;
  terminal.add(terminalBody);

  const glass = material(WINDOW, 0.32, 0.08);
  for (let x = -48; x <= 48; x += 12) {
    const window = outlinedMesh(new THREE.BoxGeometry(8.5, 5.2, 0.45), glass, 1.025, { castShadow: false });
    window.position.set(x, 8.5, -12.3);
    terminal.add(window);
  }

  const roof = outlinedMesh(new THREE.BoxGeometry(126, 1.8, 28), material(0x39434d, 0.78), 1.015);
  roof.position.y = 16.2;
  terminal.add(roof);
  terminal.position.set(48, 0, 158);
  world.add(terminal);

  for (const x of [10, 50, 90]) {
    const bridge = outlinedMesh(new THREE.BoxGeometry(4.5, 4, 15), material(0xe8edf1, 0.8), 1.025);
    bridge.position.set(x, 6.4, 146);
    world.add(bridge);
  }

  const tower = new THREE.Group();
  const shaft = outlinedMesh(new THREE.CylinderGeometry(5.2, 7.2, 29, 8), material(0xe6e0d5, 0.78), 1.03);
  shaft.position.y = 14.5;
  tower.add(shaft);
  const cabin = outlinedMesh(new THREE.CylinderGeometry(10, 8.2, 7, 8), material(WINDOW, 0.3, 0.12), 1.035);
  cabin.position.y = 31;
  tower.add(cabin);
  const cap = outlinedMesh(new THREE.CylinderGeometry(11.5, 11.5, 1.4, 8), material(0x34383d, 0.78), 1.03);
  cap.position.y = 35;
  tower.add(cap);
  tower.position.set(-76, 0, 151);
  world.add(tower);

  for (const [x, z, color] of [[160, 148, 0x6b7280], [205, 122, 0x58616a]]) {
    const hangar = new THREE.Group();
    const body = outlinedMesh(new THREE.BoxGeometry(48, 20, 34), material(color, 0.9), 1.025);
    body.position.y = 10;
    hangar.add(body);
    const door = outlinedMesh(new THREE.BoxGeometry(32, 13, 0.7), material(0x2d3339, 0.9), 1.025, { castShadow: false });
    door.position.set(0, 6.8, -17.4);
    hangar.add(door);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(40, 1.2, 0.4), material(YELLOW, 0.8));
    stripe.position.set(0, 17.2, -17.8);
    hangar.add(stripe);
    hangar.position.set(x, 0, z);
    world.add(hangar);
  }

  const fuelZone = new THREE.Group();
  for (const x of [-13, 0, 13]) {
    const tank = outlinedMesh(new THREE.CylinderGeometry(5.2, 5.2, 14, 12), material(0xe8edf1, 0.72, 0.08), 1.028);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(x, 5.6, 0);
    fuelZone.add(tank);
  }
  fuelZone.position.set(-170, 0, 165);
  world.add(fuelZone);
}

function makeAircraftFallbacks(world, samples) {
  const records = [];
  for (let index = 0; index < AIRCRAFT_SLOTS.length; index += 1) {
    const slot = AIRCRAFT_SLOTS[index];
    const fallback = makePlane(CREAM, [PINK, 0x38d9ff, YELLOW, RED][index % 4]);
    fallback.scale.setScalar(slot.scale);
    const placed = placeScenerySafely(world, fallback, samples, slot, AIRCRAFT_CLEARANCE, `aircraft fallback ${index + 1}`);
    if (placed) records.push({ slot, fallback });
  }
  return records;
}

async function installAircraftAssets(world, samples, fallbackRecords) {
  const source = await loadAircraftSource();
  for (let index = 0; index < fallbackRecords.length; index += 1) {
    const { slot, fallback } = fallbackRecords[index];
    const root = new THREE.Group();
    const model = source.clone(true);
    prepareStaticAsset(model, { outline: true, castShadow: index < 2 });
    normalizeModelToGround(model, slot.targetLength);
    root.add(model);
    root.rotation.y = slot.rotation;

    if (!placeScenerySafely(world, root, samples, slot, AIRCRAFT_CLEARANCE, `aircraft asset ${index + 1}`)) continue;
    world.remove(fallback);
  }
}

function loadAircraftSource() {
  if (!aircraftSourcePromise) {
    aircraftSourcePromise = aircraftLoader.loadAsync(AIRCRAFT_ASSET_URL).then((gltf) => gltf.scene);
  }
  return aircraftSourcePromise;
}

function makePlane(bodyColor, tailColor) {
  const plane = new THREE.Group();
  const bodyMaterial = material(bodyColor, 0.52, 0.04);
  const tailMaterial = material(tailColor, 0.58);
  const darkMaterial = material(0x34383d, 0.82);

  const fuselage = outlinedMesh(new THREE.CylinderGeometry(2.05, 1.75, 24, 10), bodyMaterial, 1.04);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = 3.6;
  plane.add(fuselage);

  const nose = outlinedMesh(new THREE.ConeGeometry(2.05, 5, 10), bodyMaterial, 1.04);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 3.6, -14.5);
  plane.add(nose);

  const wing = outlinedMesh(new THREE.BoxGeometry(25, 0.48, 4.7), bodyMaterial, 1.035);
  wing.position.set(0, 3.45, -1.5);
  plane.add(wing);

  const tailWing = outlinedMesh(new THREE.BoxGeometry(10, 0.4, 3), tailMaterial, 1.04);
  tailWing.position.set(0, 4.1, 9.7);
  plane.add(tailWing);

  const fin = outlinedMesh(new THREE.BoxGeometry(0.7, 6, 4.2), tailMaterial, 1.05);
  fin.position.set(0, 6.5, 10.2);
  fin.rotation.x = -0.2;
  plane.add(fin);

  for (const x of [-5.6, 5.6]) {
    const engine = outlinedMesh(new THREE.CylinderGeometry(1.25, 1.25, 4.2, 10), darkMaterial, 1.04);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, 2.45, -1.7);
    plane.add(engine);
  }

  return plane;
}

function makeGroundOperations(world, samples) {
  const coneGeometry = new THREE.ConeGeometry(0.8, 2.2, 8);
  const coneMaterial = material(0xff7b3d, 0.85);
  const coneSlots = [
    [60, 28], [72, 30], [84, 31], [96, 32], [108, 34], [120, 36],
    [66, 47], [78, 49], [90, 50], [102, 51], [114, 52], [126, 53]
  ];
  const cones = new THREE.InstancedMesh(coneGeometry, coneMaterial, coneSlots.length);
  const marker = new THREE.Object3D();
  let coneCursor = 0;
  for (const [x, z] of coneSlots) {
    if (minimumTrackDistance(samples, x, z) < TRACK_PROP_CLEARANCE) continue;
    marker.position.set(x, 1.1, z);
    marker.rotation.y = coneCursor * 0.31;
    marker.updateMatrix();
    cones.setMatrixAt(coneCursor, marker.matrix);
    coneCursor += 1;
  }
  cones.count = coneCursor;
  cones.instanceMatrix.needsUpdate = true;
  world.add(cones);

  const cartSlots = [
    { position: [-92, 0, 18], rotation: -0.45 },
    { position: [92, 0, 12], rotation: 0.18 },
    { position: [142, 0, 32], rotation: 0.55 }
  ];
  for (const [index, slot] of cartSlots.entries()) {
    const cartTrain = new THREE.Group();
    for (let cart = 0; cart < 3; cart += 1) {
      const box = outlinedMesh(new THREE.BoxGeometry(4.4, 2.4, 5.2), material(0x737b84, 0.92), 1.035);
      box.position.set(0, 1.6, cart * 6.2);
      cartTrain.add(box);
    }
    placeScenerySafely(world, cartTrain, samples, slot, TRACK_PROP_CLEARANCE + 4, `baggage carts ${index + 1}`);
  }
}

async function installServiceVehicleAssets(world, samples) {
  await Promise.all(SERVICE_VEHICLE_SLOTS.map(async (slot, index) => {
    const visual = await createCarVisual({
      carId: slot.carId,
      color: slot.color,
      targetLength: slot.targetLength,
      outline: true
    });
    visual.rotation.y = slot.rotation;
    visual.traverse((node) => {
      if (node.isMesh) node.castShadow = false;
    });
    placeScenerySafely(world, visual, samples, slot, TRACK_PROP_CLEARANCE, `service vehicle ${index + 1}`);
  }));
}

function placeScenerySafely(world, object, samples, slot, clearance, label) {
  const [x, y = 0, z] = slot.position;
  const distance = minimumTrackDistance(samples, x, z);
  if (distance < clearance) {
    console.warn(`TURN: skipped ${label}; ${distance.toFixed(1)}m from track is inside the ${clearance}m scenery clearance.`);
    return false;
  }
  object.position.set(x, y, z);
  if (Number.isFinite(slot.rotation)) object.rotation.y = slot.rotation;
  world.add(object);
  return true;
}

function minimumTrackDistance(samples, x, z) {
  let bestDistanceSq = Infinity;
  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq) bestDistanceSq = distanceSq;
  }
  return Math.sqrt(bestDistanceSq);
}

function prepareStaticAsset(model, { outline = true, castShadow = false } = {}) {
  const meshes = [];
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    meshes.push(node);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const cloned = materials.map((entry) => entry.clone());
    node.material = Array.isArray(node.material) ? cloned : cloned[0];
    node.castShadow = castShadow;
    node.receiveShadow = true;
  });

  if (!outline) return;
  for (const mesh of meshes) {
    const outlineMeshNode = new THREE.Mesh(
      mesh.geometry,
      new THREE.MeshBasicMaterial({
        color: INK,
        side: THREE.BackSide,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      })
    );
    outlineMeshNode.scale.setScalar(1.025);
    outlineMeshNode.castShadow = false;
    outlineMeshNode.receiveShadow = false;
    mesh.add(outlineMeshNode);
  }
}

function normalizeModelToGround(model, targetLength) {
  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model);
  const initialSize = initialBounds.getSize(new THREE.Vector3());
  const footprintLength = Math.max(0.001, initialSize.x, initialSize.z);
  model.scale.multiplyScalar(targetLength / footprintLength);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= bounds.min.y;
}

function makeDistantWorld(world) {
  const mountainColors = [0x718792, 0x8199a4, 0x637985];
  const mountainPositions = [
    [-290, 110, 100], [-250, -80, 82], [-130, 255, 104], [20, 285, 90],
    [175, 255, 112], [310, 110, 92], [300, -95, 104]
  ];
  for (let index = 0; index < mountainPositions.length; index += 1) {
    const [x, z, height] = mountainPositions[index];
    const mountain = outlinedMesh(
      new THREE.ConeGeometry(height * 0.72, height, 4),
      material(mountainColors[index % mountainColors.length], 1),
      1.018,
      { castShadow: false, receiveShadow: false }
    );
    mountain.position.set(x, height / 2 - 6, z);
    mountain.rotation.y = Math.PI / 4 + index * 0.16;
    world.add(mountain);
  }
}

function makeStartGate(world, samples, trackWidth) {
  const start = samples[0];
  const yaw = Math.atan2(start.tangent.x, start.tangent.z);
  const gate = new THREE.Group();
  const postGeometry = new THREE.BoxGeometry(1.5, 8.5, 1.5);
  const beamGeometry = new THREE.BoxGeometry(trackWidth + 5, 2.3, 1.8);
  for (const side of [-1, 1]) {
    const post = outlinedMesh(postGeometry, material(0x39434d, 0.8), 1.07);
    post.position.set(side * (trackWidth / 2 + 1.2), 4.25, 0);
    gate.add(post);
  }
  const beam = outlinedMesh(beamGeometry, material(YELLOW, 0.72), 1.045);
  beam.position.y = 8.5;
  gate.add(beam);
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(trackWidth - 5, 0.55, 2), new THREE.MeshBasicMaterial({ color: 0x38d9ff }));
  lightBar.position.y = 8.4;
  gate.add(lightBar);
  gate.position.copy(start.point);
  gate.rotation.y = yaw;
  world.add(gate);
}
