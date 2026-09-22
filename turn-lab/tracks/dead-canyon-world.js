import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const ROAD = 0x343238;
const ROAD_EDGE = 0xffd7a0;
const ROAD_LINE = 0xffb04a;
const SHOULDER = 0xa95f42;
const SAND = 0xb76f4f;
const SAND_LIGHT = 0xd58a61;
const SAND_DARK = 0x713b36;
const ROCK = 0x8f4c3f;
const ROCK_LIGHT = 0xc87554;
const ROCK_DARK = 0x56313a;
const ROCK_DEEP = 0x3c2530;
const SOLAR = 0x26334d;
const SOLAR_FRAME = 0xd7b27b;
const STEEL = 0x615d62;
const RUST = 0x7e493f;
const CONCRETE = 0xbba990;
const RETRO_GREEN = 0x4f8d7d;
const BARRIER_YELLOW = 0xe2b64c;
const SUN = 0xffb25f;
const ROAD_HEIGHT = 0.16;
const RETRO_ROOT = '/turn-lab/assets/kenney/retro-urban/';

const RETRO_ASSETS = Object.freeze({
  garage: Object.freeze({ file: 'wall-a-garage.obj', height: 10, color: CONCRETE }),
  brokenWall: Object.freeze({ file: 'wall-broken-type-a.obj', height: 8, color: 0x9e8e7d }),
  scaffold: Object.freeze({ file: 'scaffolding-structure.obj', height: 20, color: RUST }),
  truck: Object.freeze({ file: 'truck-green-cargo.obj', height: 4.8, color: RETRO_GREEN }),
  barrier: Object.freeze({ file: 'detail-barrier-strong-damaged.obj', height: 2.4, color: BARRIER_YELLOW })
});

export function installDeadCanyonWorld({ scene, samples, trackWidth = 27 } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 16) {
    throw new Error('TURN LAB: Dead Canyon requires a scene and sampled route.');
  }

  const world = new THREE.Group();
  world.name = 'TURN LAB Dead Canyon';
  scene.add(world);

  makeDesertFloor(world);
  makeTerrainRibbon(world, samples, trackWidth);
  makeRoad(world, samples, trackWidth);
  makeShoulders(world, samples, trackWidth);
  makeRoadEdgeLines(world, samples, trackWidth);
  makeCenterDashes(world, samples);
  makeStartLine(world, samples, trackWidth);
  makeEasternEscarpment(world);
  makeNeedleCountry(world);
  makeRockFormations(world);
  makeSolarField(world);
  makeTracksideRocks(world, samples, trackWidth);
  makeSun(world);

  const metrics = {
    version: 'dead-canyon-r1',
    proceduralWorld: true,
    routeSamples: samples.length,
    theme: 'grand-canyon-retro-urban-dusk',
    easternEscarpmentHeight: 210,
    easternEscarpmentSegments: 31,
    needleCount: 11,
    geologyArchetypes: 4,
    solarPanels: 24,
    retroUrbanAssetsReady: false,
    retroUrbanLoaded: 0,
    retroUrbanInstances: 0,
    retroUrbanErrors: [],
    dynamicLights: 0,
    shadowCasters: 0
  };
  world.userData.turnDeadCanyon = metrics;

  world.ready = installRetroUrbanSites(world, samples, trackWidth)
    .then((retro) => {
      Object.assign(metrics, retro, { retroUrbanAssetsReady: true });
      return world;
    })
    .catch((error) => {
      metrics.retroUrbanAssetsReady = true;
      metrics.retroUrbanErrors = [String(error?.message || error)];
      console.warn('TURN LAB: Retro Urban dressing failed; DEAD CANYON remains playable.', error);
      return world;
    });

  return world;
}

function makeDesertFloor(world) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1900, 1450),
    material(SAND_DARK)
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(110, -0.22, 0);
  floor.receiveShadow = false;
  floor.name = 'Dead Canyon desert floor';
  world.add(floor);
}

function makeTerrainRibbon(world, samples, trackWidth) {
  const half = trackWidth / 2;
  const offsets = [-(half + 95), -(half + 7), half + 7, half + 95];
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
      point.y = edge
        ? Math.max(0, sample.point.y - 7.5 + Math.sin(index * 0.017 + column) * 1.8)
        : sample.point.y - 0.28;
      positions.push(point.x, point.y, point.z);
      const blend = edge ? 0.03 : 0.58 + 0.16 * Math.sin(index * 0.033 + column);
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
  terrain.name = 'Dead Canyon route terrain';
  world.add(terrain);
}

function makeRoad(world, samples, trackWidth) {
  const road = makeRibbon(samples, -trackWidth / 2, trackWidth / 2, ROAD_HEIGHT);
  road.material = material(ROAD, 0.96);
  road.name = 'Dead Canyon asphalt';
  world.add(road);
}

function makeShoulders(world, samples, trackWidth) {
  const half = trackWidth / 2;
  for (const side of [-1, 1]) {
    const inner = side * (half + 0.05);
    const outer = side * (half + 5.4);
    const shoulder = makeRibbon(samples, Math.min(inner, outer), Math.max(inner, outer), ROAD_HEIGHT - 0.02);
    shoulder.material = material(SHOULDER);
    shoulder.name = 'Dead Canyon shoulder';
    world.add(shoulder);
  }
}

function makeRoadEdgeLines(world, samples, trackWidth) {
  const half = trackWidth / 2;
  for (const side of [-1, 1]) {
    const center = side * (half - 0.45);
    const line = makeRibbon(samples, center - 0.22, center + 0.22, ROAD_HEIGHT + 0.035);
    line.material = new THREE.MeshBasicMaterial({ color: ROAD_EDGE, side: THREE.DoubleSide });
    line.name = 'Dead Canyon pale road edge';
    world.add(line);
  }
}

function makeCenterDashes(world, samples) {
  const step = Math.max(24, Math.floor(samples.length / 108));
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
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    dash.setMatrixAt(instanceIndex, dummy.matrix);
  });
  dash.instanceMatrix.needsUpdate = true;
  dash.name = 'Dead Canyon amber center dashes';
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
  line.name = 'Dead Canyon start finish stripe';
  world.add(line);

  const arch = new THREE.Group();
  arch.name = 'Dead Canyon start arch';
  const postGeometry = new THREE.BoxGeometry(1.1, 9.5, 1.1);
  const beamGeometry = new THREE.BoxGeometry(trackWidth + 5.5, 1.4, 1.1);
  const archMaterial = material(ROCK_DEEP, 0.9);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, archMaterial);
    post.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 + 2.1));
    post.position.y += 4.6;
    arch.add(post);
  }
  const beam = new THREE.Mesh(beamGeometry, archMaterial);
  beam.position.copy(sample.point);
  beam.position.y += 8.9;
  beam.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
  arch.add(beam);
  world.add(arch);
}

function makeEasternEscarpment(world) {
  const zSegments = 30;
  const zMin = -590;
  const zMax = 590;
  const levels = [
    { y: 0, x: 700, color: ROCK_DARK },
    { y: 58, x: 712, color: 0x724038 },
    { y: 108, x: 742, color: ROCK },
    { y: 157, x: 785, color: 0xa95f48 },
    { y: 210, x: 835, color: ROCK_LIGHT }
  ];
  const positions = [];
  const colors = [];
  const indices = [];

  for (let zi = 0; zi <= zSegments; zi += 1) {
    const t = zi / zSegments;
    const z = THREE.MathUtils.lerp(zMin, zMax, t);
    const ripple = Math.sin(zi * 1.71) * 13 + Math.sin(zi * 0.47 + 1.3) * 8;
    for (let level = 0; level < levels.length; level += 1) {
      const spec = levels[level];
      const x = spec.x + ripple + Math.sin(zi * 0.83 + level * 1.7) * (7 + level * 2);
      const y = spec.y + Math.sin(zi * 0.64 + level) * (level === 0 ? 0 : 4);
      positions.push(x, y, z);
      const color = new THREE.Color(spec.color);
      colors.push(color.r, color.g, color.b);
    }
  }

  const rowWidth = levels.length;
  for (let zi = 0; zi < zSegments; zi += 1) {
    const row = zi * rowWidth;
    const next = (zi + 1) * rowWidth;
    for (let level = 0; level < rowWidth - 1; level += 1) {
      const a = row + level;
      const b = a + 1;
      const c = next + level;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const cliff = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide
    })
  );
  cliff.name = 'Dead Canyon eastern Grand Canyon escarpment';
  cliff.receiveShadow = false;
  world.add(cliff);

  const plateau = new THREE.Mesh(
    new THREE.BoxGeometry(620, 12, 1250),
    material(0xb3684e)
  );
  plateau.position.set(1125, 211, 0);
  plateau.name = 'Dead Canyon eastern plateau';
  world.add(plateau);

  const strata = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xe09a6d, transparent: true, opacity: 0.34 }),
    18
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 18; i += 1) {
    const z = -555 + i * 65;
    dummy.position.set(717 + Math.sin(i * 0.9) * 11, 72 + (i % 3) * 31, z);
    dummy.scale.set(2.2, 1.4, 44 + (i % 4) * 6);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    strata.setMatrixAt(i, dummy.matrix);
  }
  strata.instanceMatrix.needsUpdate = true;
  strata.name = 'Dead Canyon exposed cliff strata';
  world.add(strata);
}

function makeNeedleCountry(world) {
  const sites = [
    [666, -420, 82, 17, -0.05],
    [688, -340, 126, 24, 0.035],
    [660, -245, 96, 19, -0.04],
    [696, -145, 151, 27, 0.025],
    [674, -42, 112, 21, -0.03],
    [704, 62, 166, 29, 0.02],
    [671, 160, 118, 22, -0.025],
    [699, 252, 143, 25, 0.035],
    [662, 338, 88, 18, -0.04],
    [706, 418, 131, 23, 0.02],
    [681, 500, 104, 19, -0.03]
  ];
  const lower = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.58, 1, 1, 6, 1, false),
    material(ROCK, 1, true),
    sites.length
  );
  const upper = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.62, 1, 5, 1, false),
    material(ROCK_LIGHT, 1, true),
    sites.length
  );
  const dummy = new THREE.Object3D();
  sites.forEach(([x, z, height, radius, lean], index) => {
    dummy.position.set(x, height * 0.31, z);
    dummy.scale.set(radius, height * 0.62, radius);
    dummy.rotation.set(0, index * 0.41, lean);
    dummy.updateMatrix();
    lower.setMatrixAt(index, dummy.matrix);

    dummy.position.set(x + lean * height * 0.55, height * 0.77, z);
    dummy.scale.set(radius * 0.7, height * 0.46, radius * 0.7);
    dummy.rotation.set(0, index * 0.53, lean * 1.4);
    dummy.updateMatrix();
    upper.setMatrixAt(index, dummy.matrix);
  });
  lower.instanceMatrix.needsUpdate = true;
  upper.instanceMatrix.needsUpdate = true;
  lower.name = 'Dead Canyon needle bases';
  upper.name = 'Dead Canyon needle crowns';
  world.add(lower, upper);
}

function makeRockFormations(world) {
  const tables = [
    [-430, -470, 68, 42, 0.15], [-250, 485, 82, 50, -0.22],
    [78, 505, 75, 44, 0.08], [355, 470, 61, 39, 0.31]
  ];
  const tableBase = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.82, 1, 1, 8, 1, false),
    material(ROCK, 1, true),
    tables.length
  );
  const tableCap = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1, 1, 8, 1, false),
    material(ROCK_LIGHT, 1, true),
    tables.length
  );
  const dummy = new THREE.Object3D();
  tables.forEach(([x, z, height, radius, yaw], index) => {
    dummy.position.set(x, height * 0.45, z);
    dummy.scale.set(radius * 0.76, height * 0.9, radius * 0.7);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    tableBase.setMatrixAt(index, dummy.matrix);
    dummy.position.set(x, height * 0.93, z);
    dummy.scale.set(radius, height * 0.13, radius * 0.92);
    dummy.updateMatrix();
    tableCap.setMatrixAt(index, dummy.matrix);
  });
  tableBase.instanceMatrix.needsUpdate = true;
  tableCap.instanceMatrix.needsUpdate = true;
  tableBase.name = 'Dead Canyon table mesas';
  tableCap.name = 'Dead Canyon table mesa caps';
  world.add(tableBase, tableCap);

  const buttes = [
    [-625, 330, 88, 34], [-650, 20, 118, 31], [-605, -270, 72, 38],
    [420, -505, 91, 33], [250, 520, 103, 28]
  ];
  const butte = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    material(ROCK_DARK, 1, true),
    buttes.length
  );
  buttes.forEach(([x, z, height, radius], index) => {
    dummy.position.set(x, height * 0.45, z);
    dummy.scale.set(radius, height * 0.55, radius * (0.72 + (index % 3) * 0.12));
    dummy.rotation.set(index * 0.07, index * 0.68, index * -0.04);
    dummy.updateMatrix();
    butte.setMatrixAt(index, dummy.matrix);
  });
  butte.instanceMatrix.needsUpdate = true;
  butte.name = 'Dead Canyon eroded buttes';
  world.add(butte);

  const domes = [
    [-360, 500, 42, 58], [-515, -440, 35, 64], [160, -520, 38, 55]
  ];
  const dome = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    material(0x7b453d, 1, true),
    domes.length
  );
  domes.forEach(([x, z, height, radius], index) => {
    dummy.position.set(x, height * 0.22, z);
    dummy.scale.set(radius, height * 0.55, radius * 0.72);
    dummy.rotation.set(0, index * 0.9, 0);
    dummy.updateMatrix();
    dome.setMatrixAt(index, dummy.matrix);
  });
  dome.instanceMatrix.needsUpdate = true;
  dome.name = 'Dead Canyon eroded domes';
  world.add(dome);
}

function makeSolarField(world) {
  const rows = 4;
  const columns = 6;
  const panel = new THREE.InstancedMesh(
    new THREE.BoxGeometry(8.5, 0.32, 4.8),
    material(SOLAR, 0.55),
    rows * columns
  );
  const dummy = new THREE.Object3D();
  let instance = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      dummy.position.set(-145 + column * 13, 3.0, -300 + row * 12);
      dummy.rotation.set(-0.32, -0.28, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      panel.setMatrixAt(instance, dummy.matrix);
      instance += 1;
    }
  }
  panel.instanceMatrix.needsUpdate = true;
  panel.name = 'Dead Canyon abandoned solar field';
  world.add(panel);

  const servicePad = new THREE.Mesh(
    new THREE.BoxGeometry(92, 0.24, 62),
    material(SOLAR_FRAME)
  );
  servicePad.position.set(-112, 1.1, -282);
  servicePad.name = 'Dead Canyon solar service pad';
  world.add(servicePad);
}

function makeTracksideRocks(world, samples, trackWidth) {
  const entries = [];
  const step = Math.max(28, Math.floor(samples.length / 82));
  for (let index = step; index < samples.length; index += step) {
    const sample = samples[index];
    const side = index % (step * 2) === 0 ? -1 : 1;
    const offset = side * (trackWidth / 2 + 13 + 9 * (0.5 + 0.5 * Math.sin(index * 0.37)));
    entries.push({
      sample,
      offset,
      scale: 1.3 + 1.9 * (0.5 + 0.5 * Math.sin(index * 0.19 + 1.3))
    });
  }
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    material(ROCK_DARK, 1, true),
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
  rocks.name = 'Dead Canyon trackside rock scatter';
  world.add(rocks);
}

function makeSun(world) {
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(25, 16, 10),
    new THREE.MeshBasicMaterial({ color: SUN, fog: false })
  );
  sun.position.set(-720, 150, -680);
  sun.name = 'Dead Canyon setting sun';
  world.add(sun);
}

async function installRetroUrbanSites(world, samples, trackWidth) {
  const loader = new OBJLoader();
  const entries = await Promise.all(Object.entries(RETRO_ASSETS).map(async ([key, spec]) => {
    const source = await loader.loadAsync(RETRO_ROOT + spec.file);
    source.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.computeVertexNormals();
      object.material = material(spec.color, key === 'truck' ? 0.72 : 0.94, true);
      object.castShadow = false;
      object.receiveShadow = false;
    });
    normalizeHeight(source, spec.height);
    source.name = 'Dead Canyon Kenney Retro Urban ' + key;
    return [key, source];
  }));
  const templates = Object.fromEntries(entries);
  let instances = 0;

  const outpost = frameAt(samples, 0.025);
  instances += placeOutpost(world, templates, outpost, trackWidth, 'start');

  const cliff = frameAt(samples, 0.225);
  instances += placeCliffMaintenance(world, templates, cliff, trackWidth);

  const scrapyard = frameAt(samples, 0.565);
  instances += placeOutpost(world, templates, scrapyard, trackWidth, 'scrapyard');

  const ghostStop = frameAt(samples, 0.825);
  instances += placeOutpost(world, templates, ghostStop, trackWidth, 'ghost-stop');

  return {
    retroUrbanLoaded: entries.length,
    retroUrbanInstances: instances,
    retroUrbanErrors: [],
    retroUrbanAssetNames: Object.freeze(Object.keys(templates))
  };
}

function placeOutpost(world, templates, frame, trackWidth, id) {
  const outside = outwardSide(frame);
  let count = 0;
  const baseLateral = outside * (trackWidth / 2 + 32);
  count += placeTemplate(world, templates.garage, frame, -18, baseLateral, 0.95, 0.05, id + '-garage-a');
  count += placeTemplate(world, templates.garage, frame, 1, baseLateral + outside * 5, 1.18, -0.22, id + '-garage-b');
  count += placeTemplate(world, templates.brokenWall, frame, 18, baseLateral + outside * 4, 1.0, 0.28, id + '-broken-wall');
  count += placeTemplate(world, templates.scaffold, frame, 31, baseLateral + outside * 14, 0.78, 0.12, id + '-scaffold');
  count += placeTemplate(world, templates.truck, frame, 9, outside * (trackWidth / 2 + 20), 1.05, Math.PI / 2, id + '-truck');
  for (let i = 0; i < 4; i += 1) {
    count += placeTemplate(
      world,
      templates.barrier,
      frame,
      -10 + i * 7,
      outside * (trackWidth / 2 + 7.5),
      0.92,
      i % 2 ? 0.08 : -0.08,
      id + '-barrier-' + i
    );
  }
  makeOutpostCanopy(world, frame, outside, trackWidth, id);
  return count;
}

function placeCliffMaintenance(world, templates, frame, trackWidth) {
  const eastSide = frame.normal.x >= 0 ? 1 : -1;
  let count = 0;
  count += placeTemplate(world, templates.scaffold, frame, -22, eastSide * (trackWidth / 2 + 26), 1.2, 0.08, 'cliff-scaffold-a');
  count += placeTemplate(world, templates.scaffold, frame, 3, eastSide * (trackWidth / 2 + 34), 0.9, -0.18, 'cliff-scaffold-b');
  count += placeTemplate(world, templates.brokenWall, frame, 26, eastSide * (trackWidth / 2 + 24), 1.25, 0.16, 'cliff-ruin');
  count += placeTemplate(world, templates.truck, frame, -5, eastSide * (trackWidth / 2 + 17), 1.0, Math.PI / 2, 'cliff-truck');
  for (let i = 0; i < 5; i += 1) {
    count += placeTemplate(world, templates.barrier, frame, -20 + i * 9, eastSide * (trackWidth / 2 + 6.8), 0.9, 0, 'cliff-barrier-' + i);
  }
  return count;
}

function makeOutpostCanopy(world, frame, side, trackWidth, id) {
  const group = new THREE.Group();
  group.name = 'Dead Canyon Retro Urban canopy ' + id;
  const offset = side * (trackWidth / 2 + 25);
  const center = frame.point.clone()
    .addScaledVector(frame.normal, offset)
    .addScaledVector(frame.tangent, -2);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 12), material(0x5e5557, 0.8));
  roof.position.copy(center);
  roof.position.y += 8.5;
  roof.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z);
  group.add(roof);
  for (const along of [-9, 9]) {
    for (const lateral of [-4, 4]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8.5, 0.7), material(STEEL, 0.85));
      post.position.copy(center)
        .addScaledVector(frame.tangent, along)
        .addScaledVector(frame.normal, lateral);
      post.position.y += 4.25;
      group.add(post);
    }
  }
  world.add(group);
}

function frameAt(samples, progress) {
  const index = Math.round(THREE.MathUtils.clamp(progress, 0, 0.9999) * (samples.length - 1));
  const sample = samples[index];
  return {
    point: sample.point.clone(),
    tangent: sample.tangent.clone(),
    normal: sample.normal.clone()
  };
}

function outwardSide(frame) {
  const radialDot = frame.point.x * frame.normal.x + frame.point.z * frame.normal.z;
  return radialDot >= 0 ? 1 : -1;
}

function placeTemplate(world, template, frame, along, lateral, scale, yawOffset, name) {
  if (!template) return 0;
  const object = template.clone(true);
  object.name = 'Dead Canyon Retro Urban ' + name;
  object.position.copy(frame.point)
    .addScaledVector(frame.tangent, along)
    .addScaledVector(frame.normal, lateral);
  object.position.y = Math.max(0.25, frame.point.y - 0.25);
  object.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z) + yawOffset;
  object.scale.multiplyScalar(scale);
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = false;
  });
  world.add(object);
  return 1;
}

function normalizeHeight(object, targetHeight) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const height = Math.max(0.0001, size.y);
  const scale = targetHeight / height;
  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(object);
  object.position.y -= scaledBounds.min.y;
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

function material(color, roughness = 1, flatShading = false) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    flatShading,
    side: THREE.DoubleSide
  });
}
