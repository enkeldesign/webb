import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCarVisual } from '../vehicle/car-models.js?build=20260720-r19';

const INK = 0x08090a;
const CREAM = 0xfff8e8;
const YELLOW = 0xffd43b;
const PINK = 0xff4fa3;
const CYAN = 0x38d9ff;
const RED = 0xff5f67;
const RUNWAY = 0x242a30;
const ASPHALT_DARK = 0x34383d;
const ASPHALT_LIGHT = 0x4a4f55;
const CONCRETE = 0xd9d7c8;
const APRON = 0x89929b;
const WINDOW = 0x67d6f4;

const SUMMER_INDUSTRIAL_COMMIT = '0831a1937a59562b6165ccfab30f64f35c957b6f';
const SUMMER_INDUSTRIAL_BASE = `https://raw.githubusercontent.com/immaculate-lift-studio/CityCrafter3D/${SUMMER_INDUSTRIAL_COMMIT}/addons/citycrafter/assets/example_assets/kenney_city-kit-industrial_1.0/Models/GLB%20format/`;
const SUMMER_INDUSTRIAL_ASSETS = Object.freeze({
  maintenanceA: `${SUMMER_INDUSTRIAL_BASE}building-a.glb`,
  maintenanceB: `${SUMMER_INDUSTRIAL_BASE}building-b.glb`,
  maintenanceC: `${SUMMER_INDUSTRIAL_BASE}building-c.glb`,
  tank: `${SUMMER_INDUSTRIAL_BASE}detail-tank.glb`
});

const SERVICE_VEHICLE_SLOTS = Object.freeze([
  Object.freeze({ carId: 'van', color: '#38d9ff', position: [-118, 0.2, -94], rotation: 1.52, targetLength: 7.2 }),
  Object.freeze({ carId: 'truck-flat', color: '#ffd43b', position: [-62, 0.2, -96], rotation: 1.54, targetLength: 8.8 }),
  Object.freeze({ carId: 'truck', color: '#ff922b', position: [62, 0.2, -92], rotation: -1.54, targetLength: 8.4 }),
  Object.freeze({ carId: 'suv', color: '#ff4fa3', position: [118, 0.2, -88], rotation: -1.47, targetLength: 6.8 })
]);

const loader = new GLTFLoader();
const summerModelCache = new Map();
const blackOutlineMaterial = new THREE.MeshBasicMaterial({
  color: INK,
  side: THREE.BackSide
});

export function installAirportWorld({ scene, samples, trackWidth = 27 }) {
  const world = new THREE.Group();
  world.name = 'TURN Airport r50';
  scene.add(world);

  makeGround(world);
  makeRunwaySystem(world);
  makeRaceRoad(world, samples, trackWidth);
  makeStartFinishDistrict(world, samples, trackWidth);
  makeTerminalCampus(world, samples);
  makeAircraftApron(world, samples);
  makeFuelFarm(world, samples);
  makePerimeterDetails(world, samples, trackWidth);
  makeDistantHills(world);

  void installServiceVehicles(world, samples).catch((error) => {
    console.info('TURN: Airport service vehicle assets unavailable; keeping the curated apron layout.', error);
  });

  void installSummerIndustrialDistrict(world, samples).catch((error) => {
    console.info('TURN: Summer Engine industrial assets unavailable; keeping local Airport fallbacks.', error);
  });

  world.userData.turnAirportArtDirection = Object.freeze({
    version: 'r50',
    curatedStartVista: true,
    summerIndustrialAssets: true,
    proceduralFallbacks: true
  });

  return world;
}

function outlinedMesh(geometry, meshMaterial, scale = 1.035, {
  castShadow = true,
  receiveShadow = true
} = {}) {
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
    new THREE.PlaneGeometry(900, 700),
    material(0xb9ef8e, 1)
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.11;
  grass.receiveShadow = true;
  world.add(grass);

  const airportBase = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 390),
    material(CONCRETE, 1)
  );
  airportBase.rotation.x = -Math.PI / 2;
  airportBase.position.set(0, -0.055, -36);
  airportBase.receiveShadow = true;
  world.add(airportBase);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(390, 150),
    material(APRON, 0.96)
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(-8, -0.01, -49);
  apron.receiveShadow = true;
  world.add(apron);

  const terminalForecourt = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 52),
    material(0xb8b8ad, 0.98)
  );
  terminalForecourt.rotation.x = -Math.PI / 2;
  terminalForecourt.position.set(-15, 0.005, -101);
  terminalForecourt.receiveShadow = true;
  world.add(terminalForecourt);
}

function makeRunwaySystem(world) {
  const runway = outlinedMesh(
    new THREE.BoxGeometry(540, 0.12, 62),
    material(RUNWAY, 0.98),
    1.004,
    { castShadow: false }
  );
  runway.position.set(20, 0.015, -221);
  world.add(runway);

  const white = material(CREAM, 0.9);
  const dashGeometry = new THREE.BoxGeometry(14, 0.08, 0.9);
  const dashes = new THREE.InstancedMesh(dashGeometry, white, 21);
  const marker = new THREE.Object3D();

  for (let index = 0; index < 21; index += 1) {
    marker.position.set(-225 + index * 24.5, 0.13, -221);
    marker.updateMatrix();
    dashes.setMatrixAt(index, marker.matrix);
  }
  dashes.instanceMatrix.needsUpdate = true;
  dashes.receiveShadow = true;
  world.add(dashes);

  const thresholdGeometry = new THREE.BoxGeometry(17, 0.08, 2.1);
  for (const x of [-236, 276]) {
    for (let stripe = -3; stripe <= 3; stripe += 1) {
      const threshold = new THREE.Mesh(thresholdGeometry, white);
      threshold.position.set(x, 0.13, -221 + stripe * 6.2);
      threshold.receiveShadow = true;
      world.add(threshold);
    }
  }

  const edgeLightGeometry = new THREE.SphereGeometry(0.42, 7, 5);
  const edgeLightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3a6 });
  const edgeLights = new THREE.InstancedMesh(edgeLightGeometry, edgeLightMaterial, 48);
  let cursor = 0;
  for (const z of [-251, -191]) {
    for (let x = -245; x <= 285; x += 24) {
      marker.position.set(x, 0.52, z);
      marker.updateMatrix();
      edgeLights.setMatrixAt(cursor, marker.matrix);
      cursor += 1;
    }
  }
  edgeLights.count = cursor;
  edgeLights.instanceMatrix.needsUpdate = true;
  world.add(edgeLights);

  for (const x of [-132, 18, 170]) {
    const taxiway = outlinedMesh(
      new THREE.BoxGeometry(34, 0.08, 82),
      material(0x4f555c, 0.96),
      1.006,
      { castShadow: false }
    );
    taxiway.position.set(x, 0.025, -169);
    world.add(taxiway);

    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.05, 72),
      material(YELLOW, 0.86)
    );
    line.position.set(x, 0.11, -169);
    world.add(line);
  }
}

function makeRaceRoad(world, samples, trackWidth) {
  const count = samples.length;
  const roadPositions = [];
  const roadColors = [];
  const roadIndices = [];
  const asphaltDark = new THREE.Color(ASPHALT_DARK);
  const asphaltLight = new THREE.Color(ASPHALT_LIGHT);

  for (let index = 0; index <= count; index += 1) {
    const sample = samples[index % count];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2).setY(0.17);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2).setY(0.17);
    roadPositions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    const variation = THREE.MathUtils.clamp(
      0.43 + Math.sin(index * 0.17) * 0.09 + Math.sin(index * 0.61 + 0.8) * 0.05,
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
  const curbColors = [new THREE.Color(RED), new THREE.Color(CREAM)];

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
      for (let vertex = 0; vertex < 6; vertex += 1) {
        colors.push(color.r, color.g, color.b);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const curb = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        side: THREE.DoubleSide
      })
    );
    curb.receiveShadow = true;
    world.add(curb);
  }

  const dashStep = 9;
  const dashGeometry = new THREE.BoxGeometry(0.34, 0.045, 5.4);
  const dashMaterial = material(CREAM, 0.92);
  const centreLine = new THREE.InstancedMesh(dashGeometry, dashMaterial, Math.ceil(count / dashStep));
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (let index = 0; index < count; index += dashStep) {
    const sample = samples[index];
    marker.position.copy(sample.point).setY(0.235);
    marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    centreLine.setMatrixAt(cursor, marker.matrix);
    cursor += 1;
  }

  centreLine.count = cursor;
  centreLine.instanceMatrix.needsUpdate = true;
  world.add(centreLine);
}

function makeStartFinishDistrict(world, samples, trackWidth) {
  const start = samples[0];
  const yaw = Math.atan2(start.tangent.x, start.tangent.z);
  const gate = new THREE.Group();
  gate.name = 'TURN Airport Start Finish';

  const checkerMaterial = [
    new THREE.MeshBasicMaterial({ color: INK }),
    new THREE.MeshBasicMaterial({ color: CREAM })
  ];
  const cellWidth = trackWidth / 12;

  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      const cell = new THREE.Mesh(
        new THREE.BoxGeometry(cellWidth + 0.05, 0.07, 1.35),
        checkerMaterial[(row + column) % 2]
      );
      cell.position.set(
        -trackWidth / 2 + cellWidth * (column + 0.5),
        0.27,
        (row - 0.5) * 1.35
      );
      gate.add(cell);
    }
  }

  const postGeometry = new THREE.BoxGeometry(1.7, 9.2, 1.7);
  for (const side of [-1, 1]) {
    const post = outlinedMesh(postGeometry, material(0x30363d, 0.82), 1.06);
    post.position.set(side * (trackWidth / 2 + 2.1), 4.6, 0);
    gate.add(post);
  }

  const beam = outlinedMesh(
    new THREE.BoxGeometry(trackWidth + 7, 2.4, 2.1),
    material(YELLOW, 0.7),
    1.04
  );
  beam.position.y = 9.2;
  gate.add(beam);

  const signPanel = outlinedMesh(
    new THREE.BoxGeometry(17.5, 3.1, 0.62),
    material(CREAM, 0.7),
    1.05,
    { castShadow: false }
  );
  signPanel.position.set(0, 9.2, -1.28);
  gate.add(signPanel);

  const signFace = makeTextPanel('TURN AIRPORT', {
    width: 640,
    height: 128,
    background: '#fff8e8',
    foreground: '#08090a'
  });
  signFace.scale.set(10.9, 2.18, 1);
  signFace.position.set(0, 9.2, -1.62);
  gate.add(signFace);

  const lightGeometry = new THREE.SphereGeometry(0.58, 9, 6);
  for (let index = 0; index < 5; index += 1) {
    const light = new THREE.Mesh(
      lightGeometry,
      new THREE.MeshBasicMaterial({ color: [RED, YELLOW, CYAN, YELLOW, RED][index] })
    );
    light.position.set((index - 2) * 2.8, 10.85, 0);
    gate.add(light);
  }

  gate.position.copy(start.point);
  gate.rotation.y = yaw;
  world.add(gate);

  const approachIndices = [samples.length - 64, samples.length - 40, samples.length - 16, 20, 44, 68];
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffe28a });
  const lightGeometrySmall = new THREE.SphereGeometry(0.46, 7, 5);

  for (const sampleIndex of approachIndices) {
    const sample = samples[sampleIndex % samples.length];
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(lightGeometrySmall, lightMaterial);
      light.position.copy(sample.point)
        .addScaledVector(sample.normal, side * (trackWidth / 2 + 3.8))
        .setY(0.7);
      world.add(light);
    }
  }

  const timingHut = new THREE.Group();
  const hut = outlinedMesh(
    new THREE.BoxGeometry(10, 5.5, 7.5),
    material(CREAM, 0.85),
    1.045
  );
  hut.position.y = 2.75;
  timingHut.add(hut);

  const hutGlass = outlinedMesh(
    new THREE.BoxGeometry(8.4, 2.1, 0.45),
    material(WINDOW, 0.35, 0.08),
    1.04,
    { castShadow: false }
  );
  hutGlass.position.set(0, 3.2, -3.92);
  timingHut.add(hutGlass);

  placeAlongTrack(world, timingHut, samples, 24, 1, trackWidth / 2 + 12, 0);
}

function makeTerminalCampus(world, samples) {
  const terminal = new THREE.Group();
  terminal.name = 'TURN International Terminal';

  const terminalBody = outlinedMesh(
    new THREE.BoxGeometry(124, 16, 24),
    material(0xf2ead5, 0.78),
    1.018
  );
  terminalBody.position.y = 8;
  terminal.add(terminalBody);

  const glass = material(WINDOW, 0.3, 0.08);
  for (let x = -50; x <= 50; x += 12.5) {
    const southWindow = outlinedMesh(
      new THREE.BoxGeometry(9.2, 5.4, 0.5),
      glass,
      1.025,
      { castShadow: false }
    );
    southWindow.position.set(x, 8.7, -12.25);
    terminal.add(southWindow);

    const northWindow = southWindow.clone(true);
    northWindow.position.z = 12.25;
    terminal.add(northWindow);
  }

  const roof = outlinedMesh(
    new THREE.BoxGeometry(132, 2, 30),
    material(0x39434d, 0.78),
    1.014
  );
  roof.position.y = 17;
  terminal.add(roof);

  const departureHall = outlinedMesh(
    new THREE.BoxGeometry(58, 8.5, 17),
    material(0xfff3c4, 0.75),
    1.022
  );
  departureHall.position.set(-8, 4.25, -18);
  terminal.add(departureHall);

  const hallGlass = outlinedMesh(
    new THREE.BoxGeometry(48, 4.3, 0.5),
    glass,
    1.02,
    { castShadow: false }
  );
  hallGlass.position.set(-8, 4.8, -26.65);
  terminal.add(hallGlass);

  const terminalSign = makeTextPanel('TURN INTERNATIONAL', {
    width: 720,
    height: 120,
    background: '#ffd43b',
    foreground: '#08090a'
  });
  terminalSign.scale.set(23, 3.6, 1);
  terminalSign.position.set(-8, 12.5, -12.65);
  terminal.add(terminalSign);

  placeScenerySafely(world, terminal, samples, {
    position: [-58, 0, -63],
    rotation: 0,
    margin: 5
  });

  const tower = new THREE.Group();
  tower.name = 'Airport Control Tower';

  const shaft = outlinedMesh(
    new THREE.CylinderGeometry(5.2, 7.4, 31, 10),
    material(0xe8e1d2, 0.82),
    1.03
  );
  shaft.position.y = 15.5;
  tower.add(shaft);

  const cabin = outlinedMesh(
    new THREE.CylinderGeometry(10.4, 8.2, 7.3, 10),
    material(WINDOW, 0.3, 0.12),
    1.035
  );
  cabin.position.y = 33;
  tower.add(cabin);

  const cap = outlinedMesh(
    new THREE.CylinderGeometry(11.7, 11.7, 1.5, 10),
    material(0x34383d, 0.78),
    1.03
  );
  cap.position.y = 37.2;
  tower.add(cap);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 9, 6),
    new THREE.MeshBasicMaterial({ color: RED })
  );
  beacon.position.y = 39;
  tower.add(beacon);

  placeScenerySafely(world, tower, samples, {
    position: [20, 0, -50],
    rotation: 0,
    margin: 8
  });

  makeHangar(world, samples, {
    position: [92, 0, -61],
    size: [58, 22, 38],
    accent: YELLOW
  });

  makeHangar(world, samples, {
    position: [158, 0, -48],
    size: [54, 20, 34],
    accent: CYAN
  });

  for (const x of [-108, -52, 4, 60, 116]) {
    const bridge = new THREE.Group();
    const tunnel = outlinedMesh(
      new THREE.BoxGeometry(14, 3.8, 4.4),
      material(0xcad1d5, 0.74),
      1.03
    );
    tunnel.position.y = 6.2;
    bridge.add(tunnel);

    const support = outlinedMesh(
      new THREE.BoxGeometry(1.2, 5.5, 1.2),
      material(0x4b5560, 0.86),
      1.05
    );
    support.position.set(5, 2.75, 0);
    bridge.add(support);

    bridge.position.set(x, 0, -32);
    world.add(bridge);
  }
}

function makeHangar(world, samples, { position, size, accent }) {
  const [width, height, depth] = size;
  const hangar = new THREE.Group();

  const body = outlinedMesh(
    new THREE.BoxGeometry(width, height, depth),
    material(0x59636b, 0.9),
    1.022
  );
  body.position.y = height / 2;
  hangar.add(body);

  const door = outlinedMesh(
    new THREE.BoxGeometry(width * 0.72, height * 0.68, 0.72),
    material(0x23282d, 0.95),
    1.024,
    { castShadow: false }
  );
  door.position.set(0, height * 0.35, -depth / 2 - 0.4);
  hangar.add(door);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.84, 1.35, 0.5),
    material(accent, 0.8)
  );
  stripe.position.set(0, height * 0.84, -depth / 2 - 0.78);
  hangar.add(stripe);

  placeScenerySafely(world, hangar, samples, {
    position,
    rotation: 0,
    margin: 7
  });
}

function makeAircraftApron(world, samples) {
  const aircraftSlots = [
    { position: [-145, 0.35, -22], rotation: 0.1, body: CREAM, tail: PINK, scale: 1.0 },
    { position: [78, 0.35, -8], rotation: -0.2, body: CREAM, tail: CYAN, scale: 0.9 }
  ];

  for (const [index, slot] of aircraftSlots.entries()) {
    const aircraft = makeJet(slot.body, slot.tail);
    aircraft.scale.setScalar(slot.scale);
    placeScenerySafely(world, aircraft, samples, {
      position: slot.position,
      rotation: slot.rotation,
      margin: 12
    });

    makeStandMarkings(world, slot.position[0], slot.position[2], slot.rotation, index);
  }

  const baggageTrain = makeBaggageTrain();
  placeScenerySafely(world, baggageTrain, samples, {
    position: [-18, 0, -20],
    rotation: Math.PI / 2,
    margin: 8
  });

  const coneGeometry = new THREE.ConeGeometry(0.72, 2, 8);
  const coneMaterial = material(0xff7b3d, 0.86);
  const coneSlots = [
    [-128, -40], [-118, -41], [-108, -42],
    [54, -29], [65, -30], [76, -31],
    [-13, -7], [-2, -8], [9, -9]
  ];

  for (const [x, z] of coneSlots) {
    if (minimumTrackDistance(samples, x, z) < 24) continue;
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.set(x, 1, z);
    cone.castShadow = false;
    world.add(cone);
  }
}

function makeJet(bodyColor, tailColor) {
  const jet = new THREE.Group();
  jet.name = 'Parked Airport Jet';

  const bodyMaterial = material(bodyColor, 0.54, 0.04);
  const tailMaterial = material(tailColor, 0.58);
  const darkMaterial = material(0x34383d, 0.85);

  const fuselage = outlinedMesh(
    new THREE.CylinderGeometry(2.2, 1.9, 29, 12),
    bodyMaterial,
    1.038
  );
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = 4.2;
  jet.add(fuselage);

  const nose = outlinedMesh(
    new THREE.ConeGeometry(2.2, 5.8, 12),
    bodyMaterial,
    1.038
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 4.2, -17.3);
  jet.add(nose);

  const wing = outlinedMesh(
    new THREE.BoxGeometry(31, 0.5, 6.2),
    bodyMaterial,
    1.03
  );
  wing.position.set(0, 4, -1.8);
  jet.add(wing);

  const tailWing = outlinedMesh(
    new THREE.BoxGeometry(12, 0.42, 3.4),
    tailMaterial,
    1.035
  );
  tailWing.position.set(0, 4.7, 11.4);
  jet.add(tailWing);

  const fin = outlinedMesh(
    new THREE.BoxGeometry(0.8, 7.2, 4.8),
    tailMaterial,
    1.045
  );
  fin.position.set(0, 7.7, 12);
  fin.rotation.x = -0.18;
  jet.add(fin);

  for (const x of [-6.3, 6.3]) {
    const engine = outlinedMesh(
      new THREE.CylinderGeometry(1.35, 1.35, 4.8, 10),
      darkMaterial,
      1.04
    );
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, 2.8, -2);
    jet.add(engine);
  }

  return jet;
}

function makeStandMarkings(world, x, z, rotation, index) {
  const stand = new THREE.Group();
  const yellow = material(YELLOW, 0.88);

  const center = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.045, 42), yellow);
  center.position.y = 0.12;
  stand.add(center);

  for (const side of [-1, 1]) {
    const wingLine = new THREE.Mesh(new THREE.BoxGeometry(18, 0.045, 0.5), yellow);
    wingLine.position.set(side * 12, 0.12, 2);
    wingLine.rotation.y = side * 0.18;
    stand.add(wingLine);
  }

  const standNumber = makeTextPanel(`A${index + 1}`, {
    width: 160,
    height: 100,
    background: '#89929b',
    foreground: '#ffd43b',
    transparent: true
  });
  standNumber.rotation.x = -Math.PI / 2;
  standNumber.scale.set(5, 3.2, 1);
  standNumber.position.set(0, 0.15, 21);
  stand.add(standNumber);

  stand.position.set(x, 0, z);
  stand.rotation.y = rotation;
  world.add(stand);
}

function makeBaggageTrain() {
  const train = new THREE.Group();
  train.name = 'Airport Baggage Train';

  const tug = outlinedMesh(
    new THREE.BoxGeometry(4.4, 2.5, 6),
    material(YELLOW, 0.8),
    1.04
  );
  tug.position.set(0, 1.5, 0);
  train.add(tug);

  for (let index = 0; index < 2; index += 1) {
    const cart = outlinedMesh(
      new THREE.BoxGeometry(4.6, 2.2, 5.2),
      material(index ? 0x69737d : 0x7f8992, 0.9),
      1.035
    );
    cart.position.set(0, 1.4, 7 + index * 6.6);
    train.add(cart);
  }

  return train;
}

function makeFuelFarm(world, samples) {
  const fuelFarm = new THREE.Group();
  fuelFarm.name = 'Airport Fuel Farm';

  for (const x of [-13, 0, 13]) {
    const tank = outlinedMesh(
      new THREE.CylinderGeometry(5.2, 5.2, 15, 12),
      material(0xe8edf1, 0.72, 0.08),
      1.028
    );
    tank.rotation.z = Math.PI / 2;
    tank.position.set(x, 5.6, 0);
    fuelFarm.add(tank);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 16, 5.8),
      material(RED, 0.8)
    );
    stripe.rotation.z = Math.PI / 2;
    stripe.position.set(x, 5.6, -0.1);
    fuelFarm.add(stripe);
  }

  placeScenerySafely(world, fuelFarm, samples, {
    position: [103, 0, 18],
    rotation: 0.08,
    margin: 8
  });
}

function makePerimeterDetails(world, samples, trackWidth) {
  const signPalette = [YELLOW, CYAN, PINK];
  const signIndices = [90, 170, 255, 345, 520, 610];

  for (const [cursor, sampleIndex] of signIndices.entries()) {
    const sample = samples[sampleIndex % samples.length];
    const side = cursor % 2 ? 1 : -1;
    const sign = new THREE.Group();

    const panel = outlinedMesh(
      new THREE.BoxGeometry(9, 4.8, 0.55),
      material(signPalette[cursor % signPalette.length], 0.78),
      1.045
    );
    panel.position.y = 5.2;
    sign.add(panel);

    const post = outlinedMesh(
      new THREE.BoxGeometry(0.7, 5.2, 0.7),
      material(0x34383d, 0.85),
      1.06
    );
    post.position.y = 2.6;
    sign.add(post);

    sign.position.copy(sample.point)
      .addScaledVector(sample.normal, side * (trackWidth / 2 + 14));
    sign.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + (side > 0 ? 0 : Math.PI);
    world.add(sign);
  }

  const barrierGeometry = new THREE.BoxGeometry(11, 0.7, 0.65);
  const barrierMaterial = material(0x727b84, 0.92);

  for (const sampleIndex of [130, 145, 160, 430, 445, 460]) {
    const sample = samples[sampleIndex];
    const barrier = outlinedMesh(barrierGeometry, barrierMaterial, 1.035, { castShadow: false });
    barrier.position.copy(sample.point)
      .addScaledVector(sample.normal, trackWidth / 2 + 6)
      .setY(0.45);
    barrier.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    world.add(barrier);
  }
}

function makeDistantHills(world) {
  const hills = [
    { position: [-430, -18, 120], scale: [105, 44, 78], color: 0x718792 },
    { position: [-340, -20, 355], scale: [125, 52, 88], color: 0x8199a4 },
    { position: [25, -22, 430], scale: [148, 58, 96], color: 0x637985 },
    { position: [360, -20, 320], scale: [118, 48, 84], color: 0x718792 },
    { position: [455, -18, -55], scale: [128, 50, 92], color: 0x8199a4 },
    { position: [-390, -20, -310], scale: [115, 46, 82], color: 0x637985 }
  ];

  for (const hill of hills) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 7),
      material(hill.color, 1)
    );
    mesh.position.set(...hill.position);
    mesh.scale.set(...hill.scale);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    world.add(mesh);
  }
}

async function installServiceVehicles(world, samples) {
  await Promise.all(SERVICE_VEHICLE_SLOTS.map(async (slot) => {
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

    placeScenerySafely(world, visual, samples, {
      position: slot.position,
      rotation: slot.rotation,
      margin: 7
    });
  }));
}

async function installSummerIndustrialDistrict(world, samples) {
  const fallbackRecords = [
    {
      key: 'maintenanceA',
      fallback: makeMaintenanceFallback(28, 12, 19, YELLOW),
      position: [126, 0, -8],
      rotation: 0.06,
      targetSize: 30
    },
    {
      key: 'maintenanceB',
      fallback: makeMaintenanceFallback(24, 10, 17, CYAN),
      position: [164, 0, 15],
      rotation: -0.08,
      targetSize: 27
    },
    {
      key: 'maintenanceC',
      fallback: makeMaintenanceFallback(21, 9, 15, PINK),
      position: [135, 0, 44],
      rotation: 0.1,
      targetSize: 24
    }
  ];

  for (const record of fallbackRecords) {
    placeScenerySafely(world, record.fallback, samples, {
      position: record.position,
      rotation: record.rotation,
      margin: 7
    });
  }

  await Promise.all(fallbackRecords.map(async (record) => {
    try {
      const source = await loadSummerModel(record.key);
      const model = prepareStaticAsset(source, {
        targetSize: record.targetSize,
        outline: true
      });

      const placed = placeScenerySafely(world, model, samples, {
        position: record.position,
        rotation: record.rotation,
        margin: 7
      });

      if (placed) world.remove(record.fallback);
    } catch (error) {
      console.info(`TURN: ${record.key} stayed on its local fallback.`, error);
    }
  }));

  try {
    const tankSource = await loadSummerModel('tank');
    const tankModel = prepareStaticAsset(tankSource, {
      targetSize: 12,
      outline: true
    });
    placeScenerySafely(world, tankModel, samples, {
      position: [82, 0, 50],
      rotation: 0,
      margin: 6
    });
  } catch (error) {
    console.info('TURN: Summer Engine detail tank unavailable; procedural fuel farm remains complete.', error);
  }
}

function makeMaintenanceFallback(width, height, depth, accent) {
  const building = new THREE.Group();

  const body = outlinedMesh(
    new THREE.BoxGeometry(width, height, depth),
    material(0x6d7680, 0.9),
    1.025
  );
  body.position.y = height / 2;
  building.add(body);

  const door = outlinedMesh(
    new THREE.BoxGeometry(width * 0.55, height * 0.58, 0.55),
    material(0x252a2f, 0.94),
    1.04,
    { castShadow: false }
  );
  door.position.set(0, height * 0.3, -depth / 2 - 0.32);
  building.add(door);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.82, 0.9, 0.42),
    material(accent, 0.82)
  );
  stripe.position.set(0, height * 0.8, -depth / 2 - 0.58);
  building.add(stripe);

  return building;
}

function loadSummerModel(key) {
  if (!summerModelCache.has(key)) {
    const url = SUMMER_INDUSTRIAL_ASSETS[key];
    summerModelCache.set(key, loader.loadAsync(url).then((gltf) => gltf.scene));
  }
  return summerModelCache.get(key);
}

function prepareStaticAsset(source, {
  targetSize = 24,
  outline = false
} = {}) {
  const model = source.clone(true);
  const meshes = [];

  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    meshes.push(node);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const clones = materials.map((entry) => {
      const clone = entry.clone();
      clone.roughness = Math.max(clone.roughness ?? 0.8, 0.78);
      return clone;
    });
    node.material = Array.isArray(node.material) ? clones : clones[0];
    node.castShadow = false;
    node.receiveShadow = true;
  });

  normalizeModelToGround(model, targetSize);

  if (outline) {
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
      outlineMeshNode.scale.setScalar(1.018);
      outlineMeshNode.castShadow = false;
      outlineMeshNode.receiveShadow = false;
      mesh.add(outlineMeshNode);
    }
  }

  return model;
}

function normalizeModelToGround(model, targetSize) {
  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model);
  const initialSize = initialBounds.getSize(new THREE.Vector3());
  const footprint = Math.max(0.001, initialSize.x, initialSize.z);
  model.scale.multiplyScalar(targetSize / footprint);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= bounds.min.y;
}

function makeTextPanel(text, {
  width = 640,
  height = 128,
  background = '#fff8e8',
  foreground = '#08090a',
  transparent = false
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, width, height);
  if (!transparent) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }

  context.fillStyle = foreground;
  context.font = `900 ${Math.round(height * 0.45)}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: !transparent
    })
  );
}

function placeAlongTrack(world, object, samples, sampleIndex, side, offset, rotationOffset = 0) {
  const sample = samples[((sampleIndex % samples.length) + samples.length) % samples.length];
  object.position.copy(sample.point)
    .addScaledVector(sample.normal, side * offset);
  object.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z)
    + (side < 0 ? Math.PI : 0)
    + rotationOffset;
  world.add(object);
  return object;
}

function placeScenerySafely(world, object, samples, {
  position,
  rotation = 0,
  margin = 7
}) {
  const [x, y = 0, z] = position;
  object.position.set(x, y, z);
  object.rotation.y = rotation;
  object.updateMatrixWorld(true);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const footprint = horizontalFootprint(object);
    const nearest = nearestTrackPoint(samples, footprint.center.x, footprint.center.z);
    const requiredDistance = footprint.radius + margin;

    if (nearest.distance >= requiredDistance) {
      world.add(object);
      object.userData.turnAirportFootprintValidated = true;
      return true;
    }

    let dx = footprint.center.x - nearest.point.x;
    let dz = footprint.center.z - nearest.point.z;
    let length = Math.hypot(dx, dz);

    if (length < 0.001) {
      dx = footprint.center.x || x || 1;
      dz = footprint.center.z || z || 0;
      length = Math.max(0.001, Math.hypot(dx, dz));
    }

    const pushDistance = requiredDistance - nearest.distance + 3;
    object.position.x += dx / length * pushDistance;
    object.position.z += dz / length * pushDistance;
    object.updateMatrixWorld(true);
  }

  console.warn('TURN: skipped Airport scenery that could not be cleared from the racing corridor.');
  return false;
}

function horizontalFootprint(object) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);

  if (bounds.isEmpty()) {
    return {
      center: new THREE.Vector3(object.position.x, 0, object.position.z),
      radius: 0
    };
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  return {
    center,
    radius: Math.hypot(size.x, size.z) * 0.5
  };
}

function nearestTrackPoint(samples, x, z) {
  let bestPoint = samples[0]?.point || { x: 0, z: 0 };
  let bestDistanceSq = Infinity;

  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    const distanceSq = dx * dx + dz * dz;

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestPoint = point;
    }
  }

  return {
    point: bestPoint,
    distance: Math.sqrt(bestDistanceSq)
  };
}

function minimumTrackDistance(samples, x, z) {
  return nearestTrackPoint(samples, x, z).distance;
}
