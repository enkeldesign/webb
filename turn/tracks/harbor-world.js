import * as THREE from 'three';

const INK = 0x08090a;
const CREAM = 0xfff8e8;
const ASPHALT_DARK = 0x2f3438;
const ASPHALT_LIGHT = 0x464d52;
const CONCRETE = 0x9da4a5;
const QUAY_EDGE = 0xd9c37a;
const WATER = 0x287f9f;
const WATER_LIGHT = 0x53b4c8;
const RUST = 0xc95b35;
const PETROL = 0x167b82;
const YELLOW = 0xf5c542;
const BLUE = 0x3d6fbb;
const GREEN = 0x4d8b63;
const RED = 0xb9463f;
const STEEL = 0x59636a;
const TRACK_Y = 0.18;

export function installHarborWorld({ scene, samples, trackWidth = 27 }) {
  const world = new THREE.Group();
  world.name = 'TURN Harbor r80';
  scene.add(world);

  makeGround(world);
  makeRaceRoad(world, samples, trackWidth);
  makeStartFinishDistrict(world, samples, trackWidth);
  makeContainerYards(world);
  makeQuayDistrict(world);
  makeWarehouses(world);
  makeHarborShips(world);
  makeDistantHarbor(world);

  world.userData.turnHarborArtDirection = Object.freeze({
    version: 'r80',
    closedSerpentineCourse: true,
    quayBreathingStraight: true,
    switchbackCount: 3,
    proceduralWatercraftFallbacks: true,
    noIndependentAnimationLoop: true
  });

  return world;
}

function material(color, roughness = 0.88, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeGround(world) {
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 500),
    material(0xb7c99a, 1)
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set(0, -0.13, 35);
  land.receiveShadow = true;
  world.add(land);

  const harborApron = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 385),
    material(CONCRETE, 1)
  );
  harborApron.rotation.x = -Math.PI / 2;
  harborApron.position.set(-4, -0.07, 18);
  harborApron.receiveShadow = true;
  world.add(harborApron);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 190, 18, 4),
    new THREE.MeshStandardMaterial({
      color: WATER,
      roughness: 0.62,
      metalness: 0.08,
      side: THREE.DoubleSide
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.16, -235);
  water.receiveShadow = true;
  world.add(water);

  const waterGlintGeometry = new THREE.BoxGeometry(18, 0.025, 0.45);
  const waterGlints = new THREE.InstancedMesh(
    waterGlintGeometry,
    new THREE.MeshBasicMaterial({ color: WATER_LIGHT, transparent: true, opacity: 0.46 }),
    38
  );
  const marker = new THREE.Object3D();
  for (let index = 0; index < 38; index += 1) {
    const row = index % 4;
    marker.position.set(-330 + (index * 43) % 660, -0.09, -198 - row * 25);
    marker.rotation.y = (index % 3 - 1) * 0.07;
    marker.scale.x = 0.7 + pseudo(index * 2.3) * 1.5;
    marker.updateMatrix();
    waterGlints.setMatrixAt(index, marker.matrix);
  }
  waterGlints.instanceMatrix.needsUpdate = true;
  world.add(waterGlints);
}

function makeRaceRoad(world, samples, trackWidth) {
  const count = samples.length;
  const roadPositions = [];
  const roadColors = [];
  const roadIndices = [];
  const dark = new THREE.Color(ASPHALT_DARK);
  const light = new THREE.Color(ASPHALT_LIGHT);

  for (let index = 0; index <= count; index += 1) {
    const sample = samples[index % count];
    const left = sample.point.clone().addScaledVector(sample.normal, trackWidth / 2).setY(TRACK_Y);
    const right = sample.point.clone().addScaledVector(sample.normal, -trackWidth / 2).setY(TRACK_Y);
    roadPositions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    const variation = THREE.MathUtils.clamp(
      0.42 + Math.sin(index * 0.13) * 0.1 + Math.sin(index * 0.51 + 0.9) * 0.05,
      0,
      1
    );
    const color = dark.clone().lerp(light, variation);
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
  road.name = 'Harbor race road';
  road.receiveShadow = true;
  world.add(road);

  makeCurbs(world, samples, trackWidth);
  makeCentreDashes(world, samples);
}

function makeCurbs(world, samples, trackWidth) {
  const curbWidth = 1.8;
  const segmentLength = 10;
  const colors = [new THREE.Color(YELLOW), new THREE.Color(INK)];

  for (const side of [-1, 1]) {
    const positions = [];
    const vertexColors = [];

    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index];
      const next = samples[(index + 1) % samples.length];
      const innerOffset = side * (trackWidth / 2 - 0.05);
      const outerOffset = side * (trackWidth / 2 + curbWidth);
      const a = current.point.clone().addScaledVector(current.normal, innerOffset).setY(TRACK_Y + 0.035);
      const b = current.point.clone().addScaledVector(current.normal, outerOffset).setY(TRACK_Y + 0.035);
      const c = next.point.clone().addScaledVector(next.normal, innerOffset).setY(TRACK_Y + 0.035);
      const d = next.point.clone().addScaledVector(next.normal, outerOffset).setY(TRACK_Y + 0.035);
      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
      );

      const color = colors[Math.floor(index / segmentLength) % colors.length];
      for (let vertex = 0; vertex < 6; vertex += 1) vertexColors.push(color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
    geometry.computeVertexNormals();

    const curb = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        side: THREE.DoubleSide
      })
    );
    curb.receiveShadow = true;
    world.add(curb);
  }
}

function makeCentreDashes(world, samples) {
  const step = 9;
  const geometry = new THREE.BoxGeometry(0.34, 0.045, 5.3);
  const dashes = new THREE.InstancedMesh(
    geometry,
    material(CREAM, 0.92),
    Math.ceil(samples.length / step)
  );
  const marker = new THREE.Object3D();
  let cursor = 0;

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];
    marker.position.copy(sample.point).setY(TRACK_Y + 0.08);
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

function makeStartFinishDistrict(world, samples, trackWidth) {
  const start = samples[0];
  const heading = Math.atan2(start.tangent.x, start.tangent.z);
  const line = new THREE.Group();
  line.name = 'Harbor start finish';
  line.position.copy(start.point).setY(TRACK_Y + 0.09);
  line.rotation.y = heading;

  const stripeCount = 12;
  for (let stripe = 0; stripe < stripeCount; stripe += 1) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(trackWidth / stripeCount + 0.04, 0.04, 1.6),
      material(stripe % 2 ? CREAM : INK, 0.9)
    );
    tile.position.x = -trackWidth / 2 + (stripe + 0.5) * trackWidth / stripeCount;
    tile.receiveShadow = true;
    line.add(tile);
  }
  world.add(line);

  const gate = new THREE.Group();
  gate.position.copy(start.point).addScaledVector(start.tangent, 11).setY(0);
  gate.rotation.y = heading;
  const postGeometry = new THREE.BoxGeometry(1.15, 9, 1.15);
  const beamGeometry = new THREE.BoxGeometry(trackWidth + 6, 1.35, 1.35);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, material(PETROL, 0.74, 0.08));
    post.position.set(side * (trackWidth / 2 + 2), 4.5, 0);
    post.castShadow = true;
    gate.add(post);
  }
  const beam = new THREE.Mesh(beamGeometry, material(YELLOW, 0.72, 0.06));
  beam.position.y = 8.35;
  beam.castShadow = true;
  gate.add(beam);
  world.add(gate);
}

function makeContainerYards(world) {
  const yardZones = [
    { z: -90, rows: 2, columns: 9, startX: -118, spacingX: 29, spacingZ: 19, rotation: -0.035 },
    { z: 16, rows: 2, columns: 8, startX: -104, spacingX: 30, spacingZ: 18, rotation: 0.025 },
    { z: 108, rows: 2, columns: 7, startX: -92, spacingX: 31, spacingZ: 18, rotation: -0.02 }
  ];

  for (let zoneIndex = 0; zoneIndex < yardZones.length; zoneIndex += 1) {
    const zone = yardZones[zoneIndex];
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(300 - zoneIndex * 18, 0.22, 42),
      material(0x777f81, 1)
    );
    slab.position.set(4, 0, zone.z + 8.5);
    slab.rotation.y = zone.rotation;
    slab.receiveShadow = true;
    world.add(slab);

    for (let row = 0; row < zone.rows; row += 1) {
      for (let column = 0; column < zone.columns; column += 1) {
        if ((column + row + zoneIndex) % 5 === 0) continue;
        const stack = 1 + ((column * 3 + row + zoneIndex) % 3);
        const x = zone.startX + column * zone.spacingX;
        const z = zone.z + row * zone.spacingZ;
        makeContainerStack(world, x, z, stack, zoneIndex * 19 + row * 7 + column, zone.rotation);
      }
    }
  }
}

function makeContainerStack(world, x, z, stack, seed, rotation) {
  const colors = [RUST, PETROL, YELLOW, BLUE, GREEN, RED];
  const geometry = new THREE.BoxGeometry(19, 7.3, 7.4);
  for (let level = 0; level < stack; level += 1) {
    const shell = new THREE.Mesh(geometry, material(colors[(seed + level) % colors.length], 0.78, 0.06));
    shell.position.set(x + (level % 2 ? 0.7 : 0), 3.8 + level * 7.45, z);
    shell.rotation.y = rotation + (seed % 3 - 1) * 0.012;
    shell.castShadow = true;
    shell.receiveShadow = true;
    world.add(shell);

    const ribs = new THREE.Mesh(
      new THREE.BoxGeometry(17.8, 6.45, 7.48),
      new THREE.MeshBasicMaterial({
        color: INK,
        wireframe: true,
        transparent: true,
        opacity: 0.22
      })
    );
    ribs.position.copy(shell.position);
    ribs.rotation.copy(shell.rotation);
    world.add(ribs);
  }
}

function makeQuayDistrict(world) {
  const quay = new THREE.Mesh(
    new THREE.BoxGeometry(620, 2.2, 34),
    material(0x858c8d, 0.98)
  );
  quay.position.set(0, -0.9, -174);
  quay.receiveShadow = true;
  world.add(quay);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(620, 1.5, 3),
    material(QUAY_EDGE, 0.9)
  );
  edge.position.set(0, 0.3, -190);
  edge.castShadow = true;
  world.add(edge);

  const bollards = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.75, 0.95, 2.2, 8),
    material(INK, 0.78, 0.12),
    18
  );
  const marker = new THREE.Object3D();
  for (let index = 0; index < 18; index += 1) {
    marker.position.set(-280 + index * 33, 1.1, -184.5);
    marker.updateMatrix();
    bollards.setMatrixAt(index, marker.matrix);
  }
  bollards.instanceMatrix.needsUpdate = true;
  bollards.castShadow = true;
  world.add(bollards);

  makeGantryCrane(world, -115, -196, 1.04, PETROL);
  makeGantryCrane(world, 62, -198, 0.94, RUST);
  makeGantryCrane(world, 210, -196, 0.78, YELLOW);
}

function makeGantryCrane(world, x, z, scale, color) {
  const crane = new THREE.Group();
  crane.position.set(x, 0, z);
  crane.scale.setScalar(scale);

  const steel = material(color, 0.68, 0.18);
  const legGeometry = new THREE.BoxGeometry(2.1, 31, 2.1);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeometry, steel);
    leg.position.set(side * 10.5, 15.5, 0);
    leg.rotation.z = side * -0.1;
    leg.castShadow = true;
    crane.add(leg);
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 2.3, 2.5), steel);
  beam.position.set(0, 30.2, 0);
  beam.castShadow = true;
  crane.add(beam);

  const boom = new THREE.Mesh(new THREE.BoxGeometry(33, 1.4, 1.7), steel);
  boom.position.set(8.5, 34.5, -5.2);
  boom.rotation.z = -0.12;
  boom.castShadow = true;
  crane.add(boom);

  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.25, 14, 0.25), material(INK, 0.8));
  cable.position.set(20, 26.4, -5.2);
  crane.add(cable);

  world.add(crane);
}

function makeWarehouses(world) {
  const buildings = [
    [-130, 204, 86, 20, 42, 0x8b989e],
    [-25, 208, 92, 24, 46, 0xa47257],
    [90, 205, 98, 22, 43, 0x6f8586],
    [202, 196, 76, 18, 38, 0x8e8371]
  ];

  for (const [x, z, width, height, depth, color] of buildings) {
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material(color, 0.94)
    );
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    world.add(building);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width + 2.4, 1.8, depth + 2.4),
      material(INK, 0.82, 0.08)
    );
    roof.position.set(x, height + 0.9, z);
    roof.castShadow = true;
    world.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(22, width * 0.32), height * 0.62, 0.8),
      material(0x454d52, 0.9, 0.05)
    );
    door.position.set(x, height * 0.31, z - depth / 2 - 0.45);
    world.add(door);
  }
}

function makeHarborShips(world) {
  // The silhouettes follow Summer Engine's CC0 Watercraft Pack language
  // (Ship Cargo A/B and Boat Tug), while remaining local and deterministic.
  makeCargoShip(world, -168, -236, 1.08, RUST, 0.03);
  makeCargoShip(world, 108, -248, 0.9, PETROL, -0.045);
  makeTugboat(world, 254, -218, 0.85, YELLOW, -0.18);
}

function makeCargoShip(world, x, z, scale, color, rotation) {
  const ship = new THREE.Group();
  ship.position.set(x, -0.2, z);
  ship.rotation.y = rotation;
  ship.scale.setScalar(scale);

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(82, 8, 20),
    material(0x38444c, 0.76, 0.12)
  );
  hull.position.y = 3.2;
  hull.scale.x = 0.98;
  hull.castShadow = true;
  ship.add(hull);

  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(10, 18, 4),
    material(0x38444c, 0.76, 0.12)
  );
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(48, 3.2, 0);
  bow.scale.set(1, 1, 0.72);
  bow.castShadow = true;
  ship.add(bow);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(72, 1.2, 18), material(CREAM, 0.88));
  deck.position.y = 7.6;
  ship.add(deck);

  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const container = new THREE.Mesh(
        new THREE.BoxGeometry(10.5, 5.1, 7.2),
        material([color, BLUE, GREEN, YELLOW][(row + column) % 4], 0.78, 0.04)
      );
      container.position.set(-20 + column * 11.2, 10.7 + row * 5.2, row ? 4.1 : -4.1);
      container.castShadow = true;
      ship.add(container);
    }
  }

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(13, 15, 16), material(0xe5e0cf, 0.88));
  bridge.position.set(-31, 15, 0);
  bridge.castShadow = true;
  ship.add(bridge);

  const windows = new THREE.Mesh(new THREE.BoxGeometry(13.3, 3, 16.3), material(0x4baec4, 0.5, 0.12));
  windows.position.set(-31, 17.5, 0);
  ship.add(windows);

  world.add(ship);
}

function makeTugboat(world, x, z, scale, color, rotation) {
  const tug = new THREE.Group();
  tug.position.set(x, -0.05, z);
  tug.rotation.y = rotation;
  tug.scale.setScalar(scale);

  const hull = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 14), material(0x35434a, 0.76, 0.12));
  hull.position.y = 2.8;
  hull.castShadow = true;
  tug.add(hull);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 12), material(color, 0.78));
  deck.position.y = 6.2;
  tug.add(deck);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(11, 9, 10), material(CREAM, 0.88));
  cabin.position.set(-3, 10.3, 0);
  cabin.castShadow = true;
  tug.add(cabin);

  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 6, 7), material(INK, 0.8, 0.1));
  chimney.position.set(-5, 17.5, 0);
  tug.add(chimney);

  world.add(tug);
}

function makeDistantHarbor(world) {
  const siloGeometry = new THREE.CylinderGeometry(7.2, 7.8, 25, 10);
  const silos = new THREE.InstancedMesh(siloGeometry, material(0xb8b6aa, 0.96), 10);
  const marker = new THREE.Object3D();
  for (let index = 0; index < 10; index += 1) {
    marker.position.set(-270 + index * 60, 12.5, 242 + (index % 2) * 11);
    marker.scale.setScalar(0.82 + pseudo(index * 4.7) * 0.32);
    marker.updateMatrix();
    silos.setMatrixAt(index, marker.matrix);
  }
  silos.instanceMatrix.needsUpdate = true;
  silos.castShadow = true;
  world.add(silos);

  const stacks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(2.2, 2.8, 32, 9),
    material(STEEL, 0.82, 0.12),
    4
  );
  for (let index = 0; index < 4; index += 1) {
    marker.position.set(-210 + index * 135, 16, 260 + (index % 2) * 12);
    marker.scale.setScalar(0.82 + index * 0.08);
    marker.updateMatrix();
    stacks.setMatrixAt(index, marker.matrix);
  }
  stacks.instanceMatrix.needsUpdate = true;
  stacks.castShadow = true;
  world.add(stacks);
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}
