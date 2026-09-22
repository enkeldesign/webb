import * as THREE from 'three';

const ROAD = 0x343238;
const ROAD_EDGE = 0xffd7a0;
const ROAD_LINE = 0xffb04a;
const SHOULDER = 0xa95f42;
const SAND = 0xb76f4f;
const SAND_LIGHT = 0xd58a61;
const SAND_DARK = 0x7f4438;
const ROCK = 0x8f4c3f;
const ROCK_LIGHT = 0xc16d50;
const ROCK_DARK = 0x5f3434;
const SOLAR = 0x26334d;
const SOLAR_FRAME = 0xd7b27b;
const STEEL = 0x615d62;
const SUN = 0xffb25f;
const ROAD_HEIGHT = 0.16;

export function installBadlandsWorld({ scene, samples, trackWidth = 27 } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 16) {
    throw new Error('TURN LAB: Badlands requires a scene and sampled route.');
  }

  const world = new THREE.Group();
  world.name = 'TURN LAB Badlands';
  scene.add(world);

  makeDesertFloor(world);
  makeTerrainRibbon(world, samples, trackWidth);
  makeRoad(world, samples, trackWidth);
  makeShoulders(world, samples, trackWidth);
  makeRoadEdgeLines(world, samples, trackWidth);
  makeCenterDashes(world, samples);
  makeStartLine(world, samples, trackWidth);
  makeMesas(world);
  makeNeedleRock(world);
  makeSolarField(world);
  makeTelemetryMasts(world);
  makeTracksideRocks(world, samples, trackWidth);
  makeSun(world);

  world.userData.turnBadlands = Object.freeze({
    version: 'badlands-r1',
    proceduralWorld: true,
    routeSamples: samples.length,
    theme: 'desert-dusk',
    landmark: 'needle-rock',
    solarPanels: 30,
    telemetryMasts: 4,
    dynamicLights: 0,
    shadowCasters: 0
  });

  return world;
}

function makeDesertFloor(world) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1250, 980),
    material(SAND_DARK, { roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.18;
  floor.receiveShadow = false;
  floor.name = 'Badlands desert floor';
  world.add(floor);
}

function makeTerrainRibbon(world, samples, trackWidth) {
  const half = trackWidth / 2;
  const offsets = [-(half + 72), -(half + 7), half + 7, half + 72];
  const positions = [];
  const colors = [];
  const indices = [];
  const dark = new THREE.Color(SAND);
  const light = new THREE.Color(SAND_LIGHT);

  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    for (let column = 0; column < offsets.length; column += 1) {
      const offset = offsets[column];
      const point = sample.point.clone().addScaledVector(sample.normal, offset);
      const edge = column === 0 || column === offsets.length - 1;
      point.y = edge ? Math.max(0, sample.point.y - 6.5) : sample.point.y - 0.28;
      positions.push(point.x, point.y, point.z);
      const blend = edge ? 0.05 : 0.62 + 0.12 * Math.sin(index * 0.041 + column);
      const color = dark.clone().lerp(light, THREE.MathUtils.clamp(blend, 0, 1));
      colors.push(color.r, color.g, color.b);
    }
  }

  const width = offsets.length;
  for (let index = 0; index < samples.length; index += 1) {
    const row = index * width;
    const next = (index + 1) * width;
    for (let column = 0; column < width - 1; column += 1) {
      const a = row + column;
      const b = a + 1;
      const c = next + column;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide
    })
  );
  terrain.receiveShadow = false;
  terrain.name = 'Badlands route terrain ribbon';
  world.add(terrain);
}

function makeRoad(world, samples, trackWidth) {
  const road = makeRibbon(samples, -trackWidth / 2, trackWidth / 2, ROAD_HEIGHT);
  road.material = material(ROAD, { roughness: 0.96 });
  road.name = 'Badlands asphalt';
  world.add(road);
}

function makeShoulders(world, samples, trackWidth) {
  const half = trackWidth / 2;
  for (const side of [-1, 1]) {
    const inner = side * (half + 0.05);
    const outer = side * (half + 4.8);
    const shoulder = makeRibbon(samples, Math.min(inner, outer), Math.max(inner, outer), ROAD_HEIGHT - 0.02);
    shoulder.material = material(SHOULDER, { roughness: 1 });
    shoulder.name = `Badlands shoulder ${side < 0 ? 'left' : 'right'}`;
    world.add(shoulder);
  }
}

function makeRoadEdgeLines(world, samples, trackWidth) {
  const half = trackWidth / 2;
  for (const side of [-1, 1]) {
    const center = side * (half - 0.45);
    const line = makeRibbon(samples, center - 0.22, center + 0.22, ROAD_HEIGHT + 0.035);
    line.material = new THREE.MeshBasicMaterial({ color: ROAD_EDGE, side: THREE.DoubleSide });
    line.name = 'Badlands pale road edge';
    world.add(line);
  }
}

function makeCenterDashes(world, samples) {
  const step = Math.max(18, Math.floor(samples.length / 64));
  const indices = [];
  for (let index = 0; index < samples.length; index += step) indices.push(index);
  const dash = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.42, 0.055, 6.4),
    new THREE.MeshBasicMaterial({ color: ROAD_LINE }),
    indices.length
  );
  const dummy = new THREE.Object3D();
  indices.forEach((sampleIndex, instanceIndex) => {
    const sample = samples[sampleIndex];
    dummy.position.copy(sample.point);
    dummy.position.y += ROAD_HEIGHT + 0.055;
    dummy.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    dummy.updateMatrix();
    dash.setMatrixAt(instanceIndex, dummy.matrix);
  });
  dash.instanceMatrix.needsUpdate = true;
  dash.name = 'Badlands amber center dashes';
  world.add(dash);
}

function makeStartLine(world, samples, trackWidth) {
  const sample = samples[0];
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(trackWidth - 1, 0.07, 1.8),
    new THREE.MeshBasicMaterial({ color: 0xfff0d0 })
  );
  line.position.copy(sample.point);
  line.position.y += ROAD_HEIGHT + 0.05;
  line.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
  line.name = 'Badlands start finish stripe';
  world.add(line);

  const arch = new THREE.Group();
  arch.name = 'Badlands start arch';
  const postGeometry = new THREE.BoxGeometry(1.0, 8.5, 1.0);
  const beamGeometry = new THREE.BoxGeometry(trackWidth + 4.5, 1.2, 1.0);
  const archMaterial = material(ROCK_DARK, { roughness: 0.9 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, archMaterial);
    post.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 + 1.8));
    post.position.y += 4.1;
    arch.add(post);
  }
  const beam = new THREE.Mesh(beamGeometry, archMaterial);
  beam.position.copy(sample.point);
  beam.position.y += 8.1;
  beam.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
  arch.add(beam);
  world.add(arch);
}

function makeMesas(world) {
  const sites = [
    [-355, -125, 46, 54], [-345, 90, 58, 71], [-240, 235, 52, 62],
    [10, 270, 64, 74], [250, 230, 48, 59], [380, 65, 58, 68],
    [405, -170, 50, 60], [255, -310, 62, 48], [-290, -305, 56, 50]
  ];
  const layers = [
    { radius: 1.0, height: 0.34, y: 0.17, color: ROCK_DARK },
    { radius: 0.78, height: 0.34, y: 0.50, color: ROCK },
    { radius: 0.56, height: 0.32, y: 0.83, color: ROCK_LIGHT }
  ];
  const dummy = new THREE.Object3D();
  for (const layer of layers) {
    const mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1, 1, 7, 1, false),
      material(layer.color, { roughness: 1, flatShading: true }),
      sites.length
    );
    sites.forEach(([x, z, radius, height], index) => {
      dummy.position.set(x, height * layer.y, z);
      dummy.scale.set(radius * layer.radius, height * layer.height, radius * layer.radius);
      dummy.rotation.set(0, index * 0.31, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = 'Badlands instanced mesa layer';
    world.add(mesh);
  }
}

function makeNeedleRock(world) {
  const needle = new THREE.Group();
  needle.name = 'Badlands Needle Rock';
  const lower = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 27, 72, 6, 1, false),
    material(ROCK_DARK, { roughness: 1, flatShading: true })
  );
  lower.position.set(-18, 36, 8);
  lower.rotation.y = 0.22;
  needle.add(lower);
  const upper = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 15, 58, 6, 1, false),
    material(ROCK_LIGHT, { roughness: 1, flatShading: true })
  );
  upper.position.set(-13, 96, 5);
  upper.rotation.z = -0.05;
  needle.add(upper);
  world.add(needle);
}

function makeSolarField(world) {
  const rows = 5;
  const columns = 6;
  const panel = new THREE.InstancedMesh(
    new THREE.BoxGeometry(8.5, 0.32, 4.8),
    material(SOLAR, { roughness: 0.55, metalness: 0.15 }),
    rows * columns
  );
  const dummy = new THREE.Object3D();
  let instance = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      dummy.position.set(46 + column * 12, 2.2, -36 + row * 11);
      dummy.rotation.set(-0.32, -0.35, 0);
      dummy.updateMatrix();
      panel.setMatrixAt(instance, dummy.matrix);
      instance += 1;
    }
  }
  panel.instanceMatrix.needsUpdate = true;
  panel.name = 'Badlands solar field';
  world.add(panel);

  const servicePad = new THREE.Mesh(
    new THREE.BoxGeometry(92, 0.24, 72),
    material(SOLAR_FRAME, { roughness: 1 })
  );
  servicePad.position.set(76, 0.2, -14);
  servicePad.name = 'Badlands solar service pad';
  world.add(servicePad);
}

function makeTelemetryMasts(world) {
  const sites = [[-105, 30], [-65, 76], [95, 82], [120, 28]];
  for (let index = 0; index < sites.length; index += 1) {
    const [x, z] = sites[index];
    const mast = new THREE.Group();
    mast.name = 'Badlands telemetry mast';
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 1.0, 24, 6),
      material(STEEL, { roughness: 0.8 })
    );
    tower.position.set(x, 12, z);
    mast.add(tower);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.8, 1.1),
      material(ROAD_EDGE, { roughness: 0.7 })
    );
    head.position.set(x, 24, z);
    head.rotation.y = index * 0.55;
    mast.add(head);
    world.add(mast);
  }
}

function makeTracksideRocks(world, samples, trackWidth) {
  const entries = [];
  const step = Math.max(24, Math.floor(samples.length / 52));
  for (let index = step; index < samples.length; index += step) {
    const sample = samples[index];
    const side = index % (step * 2) === 0 ? -1 : 1;
    const offset = side * (trackWidth / 2 + 13 + 7 * (0.5 + 0.5 * Math.sin(index * 0.37)));
    entries.push({
      sample,
      offset,
      scale: 1.4 + 1.5 * (0.5 + 0.5 * Math.sin(index * 0.19 + 1.3))
    });
  }
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    material(ROCK_DARK, { roughness: 1, flatShading: true }),
    entries.length
  );
  const dummy = new THREE.Object3D();
  entries.forEach((entry, instance) => {
    dummy.position.copy(entry.sample.point).addScaledVector(entry.sample.normal, entry.offset);
    dummy.position.y = Math.max(0.8, entry.sample.point.y - 0.2);
    dummy.scale.set(entry.scale * 1.6, entry.scale, entry.scale * 1.25);
    dummy.rotation.set(instance * 0.13, instance * 0.61, instance * 0.27);
    dummy.updateMatrix();
    rocks.setMatrixAt(instance, dummy.matrix);
  });
  rocks.instanceMatrix.needsUpdate = true;
  rocks.name = 'Badlands trackside rock scatter';
  world.add(rocks);
}

function makeSun(world) {
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(22, 16, 10),
    new THREE.MeshBasicMaterial({ color: SUN, fog: false })
  );
  sun.position.set(470, 115, -540);
  sun.name = 'Badlands setting sun';
  world.add(sun);
}

function makeRibbon(samples, leftOffset, rightOffset, lift = 0) {
  const positions = [];
  const indices = [];
  for (let index = 0; index <= samples.length; index += 1) {
    const sample = samples[index % samples.length];
    const left = sample.point.clone().addScaledVector(sample.normal, leftOffset);
    const right = sample.point.clone().addScaledVector(sample.normal, rightOffset);
    left.y = sample.point.y + lift;
    right.y = sample.point.y + lift;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
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
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material(0xffffff));
  mesh.receiveShadow = false;
  return mesh;
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 1,
    metalness: options.metalness ?? 0,
    flatShading: options.flatShading ?? false,
    side: THREE.DoubleSide
  });
}
