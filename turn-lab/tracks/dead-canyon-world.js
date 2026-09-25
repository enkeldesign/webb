import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const ROAD = 0x343238;
const ROAD_EDGE = 0xffd7a0;
const ROAD_LINE = 0xffb04a;
const SHOULDER = 0xa95f42;
const SAND = 0xc46f4e;
const SAND_LIGHT = 0xe29a68;
const SAND_DARK = 0x7a4038;
const ROCK = 0xa95640;
const ROCK_LIGHT = 0xd17854;
const ROCK_DARK = 0x65362f;
const ROCK_DEEP = 0x472a28;
const SOLAR = 0x26334d;
const SOLAR_FRAME = 0xd7b27b;
const STEEL = 0x615d62;
const RUST = 0x7e493f;
const CONCRETE = 0xbba990;
const RETRO_GREEN = 0x4f8d7d;
const SUN = 0xffb25f;
const ROAD_HEIGHT = 0.16;
const RETRO_ROOT = '/turn-lab/assets/kenney/retro-urban/';

const RETRO_ASSETS = Object.freeze({
  garage: Object.freeze({ file: 'wall-a-garage.obj', height: 10, color: CONCRETE }),
  brokenWall: Object.freeze({ file: 'wall-broken-type-a.obj', height: 8, color: 0x9e8e7d }),
  scaffold: Object.freeze({ file: 'scaffolding-structure.obj', height: 20, color: RUST }),
  truck: Object.freeze({ file: 'truck-green-cargo.obj', height: 4.8, color: RETRO_GREEN }),
  parkTree: Object.freeze({ file: 'tree-park-large.obj', height: 14, color: 0xd99a3b }),
  shedPoles: Object.freeze({ file: 'roof-metal-poles.obj', height: 7.2, color: 0x6e625b }),
  shedRoof: Object.freeze({ file: 'roof-metal-type-a.obj', height: 3.8, color: 0x8d5943 })
});

export function installDeadCanyonWorld({ scene, samples, trackWidth = 27, runtime } = {}) {
  if (!scene || !Array.isArray(samples) || samples.length < 16) {
    throw new Error('TURN LAB: Dead Canyon requires a scene and sampled route.');
  }

  const world = new THREE.Group();
  world.name = 'TURN LAB Dead Canyon';
  scene.add(world);

  makeDesertFloor(world);
  makeTerrainRibbon(world, samples, trackWidth);
  makeTerrainSkirts(world, samples, trackWidth);
  makeRoad(world, samples, trackWidth);
  makeShoulders(world, samples, trackWidth);
  makeRoadEdgeLines(world, samples, trackWidth);
  makeCenterDashes(world, samples);
  makeStartLine(world, samples, trackWidth);
  makeEasternEscarpment(world);
  makeDistantCanyonSilhouettes(world);
  makeCanyonEdgeBarriers(world, samples, trackWidth);
  makeRoadsideChevrons(world, samples, trackWidth);
  makeCanyonOverhangs(world);
  makeDeadCanyonLandmark(world);
  makeRockFormations(world, samples, trackWidth);
  makeSolarField(world);
  makeTracksideRocks(world, samples, trackWidth);
  makeSun(world);

  const metrics = {
    version: 'dead-canyon-polish',
    proceduralWorld: true,
    routeSamples: samples.length,
    theme: 'golden-hour-canyon-road',
    easternEscarpmentHeight: 220,
    cliffBands: 4,
    cliffSegmentsPerBand: 16,
    cliffFrontX: 715,
    cliffDepth: 2800,
    fogFadeNear: 260,
    fogFadeFar: 760,
    cameraFar: runtime?.camera?.far ?? null,
    fogSafetyMargin: Number.isFinite(runtime?.camera?.far) ? runtime.camera.far - 760 : null,
    distantMesaCount: 12,
    canyonBarrierCount: 0,
    hairpinLandmark: false,
    roadsideChevronCount: 5,
    canyonOverhangCount: 4,
    landmark: 'DEAD CANYON CROWN',
    standingRockCount: 1,
    tableMesaCount: 1,
    yellowTreeCount: 20,
    centralRockFormationCount: 6,
    openShedCount: 1,
    rustTruckCount: 1,
    ruinClusterCount: 1,
    yellowStepBarrierCount: 0,
    embeddedWallRocks: true,
    crownShelvesEmbedded: true,
    shedRoofSeated: true,
    needleCount: 0,
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

  metrics.canyonBarrierCount = world.getObjectByName('Dead Canyon canyon-edge barriers')?.count || 0;

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

function makeTerrainSkirts(world, samples, trackWidth) {
  // Close the outer edge of the raised route terrain down to the desert floor.
  // Without this skirt the high side can reveal daylight underneath the ridge.
  const half = trackWidth / 2;
  const sides = [
    { offset: -(half + 95), phaseColumn: 0, name: 'left' },
    { offset: half + 95, phaseColumn: 3, name: 'right' }
  ];

  for (const side of sides) {
    const positions = [];
    const indices = [];
    for (let index = 0; index <= samples.length; index += 1) {
      const sample = samples[index % samples.length];
      const top = sample.point.clone().addScaledVector(sample.normal, side.offset);
      top.y = Math.max(
        0,
        sample.point.y - 7.5 + Math.sin(index * 0.017 + side.phaseColumn) * 1.8
      );
      positions.push(top.x, top.y, top.z, top.x, -0.18, top.z);
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
    const skirt = new THREE.Mesh(geometry, material(SAND_DARK, 1, true));
    skirt.name = `Dead Canyon terrain skirt ${side.name}`;
    skirt.castShadow = false;
    skirt.receiveShadow = false;
    world.add(skirt);
  }
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
  // Four huge terraced bands, but each front is built from a handful of broad
  // flat-shaded facets rather than one perfect cuboid. The nearest front stays
  // ~80 m east of the route's furthest point so the chase camera cannot enter it.
  const bands = [
    { frontX: 715, backX: 785, baseY: 0, topY: 58, color: ROCK_DARK, phase: 0.3 },
    { frontX: 775, backX: 850, baseY: 55, topY: 108, color: 0x7b4034, phase: 1.2 },
    { frontX: 840, backX: 925, baseY: 104, topY: 164, color: ROCK, phase: 2.1 },
    { frontX: 910, backX: 1010, baseY: 160, topY: 220, color: ROCK_LIGHT, phase: 2.8 }
  ];

  bands.forEach((spec, index) => {
    const cliff = makeFacetedCliffBand(spec, 16, 2800);
    cliff.name = `Dead Canyon eastern cliff band ${index + 1}`;
    cliff.frustumCulled = false;
    world.add(cliff);
  });

  // A few broad skyline blocks are set back on the upper terraces. They read as
  // mesa tops in silhouette, but never become detached foreground needles.
  const skyline = [
    [840, -880, 100, 60, 190, 0x7b4034],
    [925, -510, 132, 84, 250, ROCK],
    [970, -70, 160, 104, 290, ROCK_LIGHT],
    [895, 380, 118, 72, 230, ROCK],
    [955, 760, 146, 92, 270, ROCK_LIGHT]
  ];
  skyline.forEach(([x, z, width, height, depth, color], index) => {
    const block = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.46, width * 0.56, height, 6, 1, false),
      material(color, 1, true)
    );
    // Bury the skyline mesas deep into the top terrace. With only a 5 m
    // overlap they could read as detached blocks through the canyon haze.
    const embeddedX = Math.max(x, 950);
    block.position.set(embeddedX, 185 + height / 2, z);
    block.rotation.y = 0.16 * index;
    block.name = `Dead Canyon integrated skyline mesa ${index + 1}`;
    block.castShadow = false;
    block.receiveShadow = false;
    block.frustumCulled = false;
    world.add(block);
  });
}

function makeFacetedCliffBand(spec, segments, depth) {
  const positions = [];
  const indices = [];
  const halfDepth = depth / 2;

  for (let row = 0; row <= segments; row += 1) {
    const t = row / segments;
    const z = THREE.MathUtils.lerp(-halfDepth, halfDepth, t);
    const frontJitter =
      Math.sin(row * 1.37 + spec.phase) * 10
      + Math.sin(row * 0.53 + spec.phase * 2.4) * 7;
    const topJitter = Math.sin(row * 0.91 + spec.phase) * 4;
    const frontX = spec.frontX + frontJitter;
    const topY = spec.topY + topJitter;

    positions.push(
      frontX, spec.baseY, z,
      frontX, topY, z,
      spec.backX, topY + 2, z,
      spec.backX, spec.baseY, z
    );
  }

  for (let row = 0; row < segments; row += 1) {
    const a = row * 4;
    const b = (row + 1) * 4;
    // Front cliff face.
    indices.push(a, b, a + 1, a + 1, b, b + 1);
    // Top terrace.
    indices.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    // Back wall keeps the silhouette closed.
    indices.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material(spec.color, 1, true));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function makeDistantCanyonSilhouettes(world) {
  const sites = [
    [-690, -520, 120, 54], [-650, -180, 82, 48], [-710, 210, 136, 58],
    [-620, 520, 96, 52], [-430, 690, 74, 46], [-120, 720, 102, 48],
    [210, 705, 126, 54], [430, 650, 94, 48], [-370, -700, 88, 48],
    [-70, -720, 118, 54], [260, -700, 78, 44], [500, -610, 106, 50]
  ];
  const mesas = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.68, 1, 1, 6, 1, false),
    material(0xb96850, 1, true),
    sites.length
  );
  const dummy = new THREE.Object3D();
  sites.forEach(([x, z, height, radius], index) => {
    dummy.position.set(x, height * 0.48, z);
    dummy.scale.set(radius, height * 0.96, radius * (0.72 + (index % 3) * 0.09));
    dummy.rotation.set(0, index * 0.47, 0);
    dummy.updateMatrix();
    mesas.setMatrixAt(index, dummy.matrix);
  });
  mesas.instanceMatrix.needsUpdate = true;
  mesas.frustumCulled = false;
  mesas.name = 'Dead Canyon distant haze mesas';
  world.add(mesas);
}

function makeCanyonEdgeBarriers(world, samples, trackWidth) {
  const start = Math.floor(samples.length * 0.13);
  const end = Math.floor(samples.length * 0.33);
  const step = 18;
  const entries = [];
  for (let index = start; index <= end; index += step) {
    const sample = samples[index];
    const westSide = sample.normal.x > 0 ? -1 : 1;
    entries.push({ sample, side: westSide });
  }

  const barriers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(4.6, 1.05, 0.7),
    material(0xe7d6bf, 0.9, true),
    entries.length
  );
  const dummy = new THREE.Object3D();
  entries.forEach(({ sample, side }, instance) => {
    dummy.position.copy(sample.point).addScaledVector(sample.normal, side * (trackWidth / 2 + 1.7));
    dummy.position.y += 0.62;
    dummy.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    barriers.setMatrixAt(instance, dummy.matrix);
  });
  barriers.instanceMatrix.needsUpdate = true;
  barriers.name = 'Dead Canyon canyon-edge barriers';
  world.add(barriers);
}

function makeRoadsideChevrons(world, samples, trackWidth) {
  // Keep the graphic yellow/black detail, but explicitly outside the driveable road.
  const frame = frameAt(samples, 0.245);
  const side = outwardSide(frame);
  const panelMaterial = new THREE.MeshBasicMaterial({ color: 0xf2c34f });
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2020 });
  const group = new THREE.Group();
  group.name = 'Dead Canyon roadside chevrons';

  [-18, -9, 0, 9, 18].forEach((along, index) => {
    const sign = new THREE.Group();
    sign.name = `Dead Canyon roadside chevron ${index + 1}`;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(8.5, 3.0, 0.5), panelMaterial);
    sign.add(panel);
    for (const stripeX of [-2.2, 0, 2.2]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.62), stripeMaterial);
      stripe.position.x = stripeX;
      stripe.rotation.z = -0.42;
      sign.add(stripe);
    }
    sign.position.copy(frame.point)
      .addScaledVector(frame.tangent, along)
      .addScaledVector(frame.normal, side * (trackWidth / 2 + 9.5));
    sign.position.y += 2.1;
    sign.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z);
    group.add(sign);
  });

  world.add(group);
}

function makeCanyonOverhangs(world) {
  // Broad strata shapes: larger in wall-width/height, deliberately shallow in X.
  // Their centres sit inside the cliff face so no rock can read as floating.
  const specs = [
    // Each rock is keyed to the cliff band at its height. The previous upper
    // rocks all sat around x≈745, which left three of them visibly detached
    // from the stepped wall. Keep only a shallow lip exposed.
    [730, 48, -430, 18, 27, 84, -0.08, 0.10],
    [792, 86, -185, 20, 31, 92, 0.05, -0.08],
    [855, 111, 330, 20, 29, 88, -0.04, 0.10],
    [860, 143, 575, 22, 36, 104, 0.06, -0.06]
  ];
  specs.forEach(([x, y, z, sx, sy, sz, rz, ry], index) => {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 0),
      material(index % 2 ? ROCK : ROCK_DARK, 1, true)
    );
    rock.position.set(x, y, z);
    rock.scale.set(sx, sy, sz);
    rock.rotation.set(0, ry, rz);
    rock.name = `Dead Canyon embedded overhang ${index + 1}`;
    rock.castShadow = false;
    rock.receiveShadow = false;
    world.add(rock);
  });
}

function makeDeadCanyonLandmark(world) {
  // The landmark is geology, not a backing block: three huge shallow strata
  // shelves embedded directly into the canyon wall.
  const crown = new THREE.Group();
  crown.name = 'DEAD CANYON CROWN landmark';

  const shelves = [
    // Follow the stepped escarpment inward as height increases. Offset the
    // shelves in Z and vary their spans so they read as geology, not a stack.
    [790, 62, 22, 22, 31, 122, ROCK_DARK],
    [855, 121, 68, 19, 43, 146, ROCK],
    [925, 181, 42, 25, 37, 158, ROCK_LIGHT]
  ];
  shelves.forEach(([x, y, z, sx, sy, sz, color], index) => {
    const shelf = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 0),
      material(color, 1, true)
    );
    shelf.position.set(x, y, z);
    shelf.scale.set(sx, sy, sz);
    shelf.rotation.set(
      0.025 * (index - 1),
      [-0.12, 0.08, -0.05][index],
      [-0.06, 0.035, -0.08][index]
    );
    shelf.name = `DEAD CANYON CROWN shelf ${index + 1}`;
    shelf.castShadow = false;
    shelf.receiveShadow = false;
    crown.add(shelf);
  });

  world.add(crown);
}

function makeRockFormations(world, samples, trackWidth) {
  // One table mesa is enough to make this geological form memorable.
  const tables = [
    [-250, 485, 82, 50, -0.22]
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

  const sentinel = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1, 0),
    material(ROCK_DARK, 1, true)
  );
  sentinel.position.set(-650, 58, 20);
  sentinel.scale.set(31, 65, 28);
  sentinel.rotation.set(-0.04, 0.55, 0.05);
  sentinel.name = 'Dead Canyon sentinel standing rock';
  world.add(sentinel);

  const fallenSites = [
    [-625, 330, 34, 14, 43, 0.35],
    [-605, -270, 40, 15, 48, -0.28],
    [420, -505, 36, 13, 41, 0.42],
    [250, 520, 38, 14, 45, -0.36]
  ];
  const fallen = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    material(ROCK_DARK, 1, true),
    fallenSites.length
  );
  fallenSites.forEach(([x, z, sx, sy, sz, tilt], index) => {
    dummy.position.set(x, Math.max(1.5, sy * 0.28), z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(tilt, index * 0.72, Math.PI / 2.7 + index * 0.08);
    dummy.updateMatrix();
    fallen.setMatrixAt(index, dummy.matrix);
  });
  fallen.instanceMatrix.needsUpdate = true;
  fallen.name = 'Dead Canyon fallen rock formations';
  world.add(fallen);

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

  // Fill the previously empty interior basin with large, readable formations.
  // The route now sweeps through the western half of the basin, while these
  // landmarks occupy the open eastern half with generous road clearance.
  const centralSites = [
    [125, 215, 36, 30, 24, 0.18],
    [205, 145, 52, 38, 31, -0.34],
    [285, 70, 68, 42, 35, 0.26],
    [165, -70, 44, 34, 27, -0.16],
    [270, -135, 58, 40, 33, 0.38],
    [360, 165, 48, 36, 30, -0.28]
  ];
  const central = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    material(ROCK, 1, true),
    centralSites.length
  );
  centralSites.forEach(([x, z, height, sx, sz, yaw], index) => {
    const clearance = distanceToRouteXZ(samples, x, z);
    const safeScale = clearance < trackWidth / 2 + 24 ? 0.72 : 1;
    dummy.position.set(x, height * 0.44, z);
    dummy.scale.set(sx * safeScale, height * 0.72, sz * safeScale);
    dummy.rotation.set(0.05 * ((index % 3) - 1), yaw, 0.04 * (index % 2 ? 1 : -1));
    dummy.updateMatrix();
    central.setMatrixAt(index, dummy.matrix);
  });
  central.instanceMatrix.needsUpdate = true;
  central.name = 'Dead Canyon central badlands formations';
  world.add(central);
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
  const treeTexture = await new THREE.TextureLoader()
    .loadAsync(RETRO_ROOT + 'treeA.png')
    .catch((error) => {
      console.warn('TURN LAB: Retro Urban tree texture failed; using flat autumn foliage.', error);
      return null;
    });
  if (treeTexture) {
    treeTexture.colorSpace = THREE.SRGBColorSpace;
    treeTexture.wrapS = THREE.RepeatWrapping;
    treeTexture.wrapT = THREE.RepeatWrapping;
  }

  const entries = await Promise.all(Object.entries(RETRO_ASSETS).map(async ([key, spec]) => {
    const source = await loader.loadAsync(RETRO_ROOT + spec.file);
    source.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.computeVertexNormals();

      if (key === 'parkTree') {
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        const mapped = sourceMaterials.map((sourceMaterial) => {
          const name = String(sourceMaterial?.name || '').toLowerCase();
          if (name.includes('tree')) {
            if (!treeTexture) return material(0xd99a3b, 1, true);
            return new THREE.MeshStandardMaterial({
              map: treeTexture,
              transparent: true,
              alphaTest: 0.12,
              roughness: 1,
              metalness: 0,
              side: THREE.DoubleSide
            });
          }
          if (name.includes('dirt')) return material(0x6b4435, 1, true);
          return material(CONCRETE, 1, true);
        });
        object.material = Array.isArray(object.material) ? mapped : mapped[0];
      } else {
        object.material = material(spec.color, key === 'truck' ? 0.72 : 0.94, true);
      }

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

  const cliffService = frameAt(samples, 0.405);
  instances += placeCliffService(world, templates, cliffService, trackWidth);

  const scrapyard = frameAt(samples, 0.565);
  instances += placeOutpost(world, templates, scrapyard, trackWidth, 'scrapyard');

  const ghostStop = frameAt(samples, 0.825);
  instances += placeOutpost(world, templates, ghostStop, trackWidth, 'ghost-stop');

  instances += placeVisibleRetroLandmarks(world, templates, samples, trackWidth);

  return {
    retroUrbanLoaded: entries.length,
    retroUrbanInstances: instances,
    retroUrbanErrors: [],
    retroUrbanAssetNames: Object.freeze(Object.keys(templates)),
    treeTextureLoaded: Boolean(treeTexture)
  };
}

function placeVisibleRetroLandmarks(world, templates, samples, trackWidth) {
  let count = 0;

  const treePlacements = [
    [0.090, -20, 32, 0.90],
    [0.115, -18, 31, 0.92],
    [0.115, 2, 36, 1.08],
    [0.115, 22, 32, 0.98],
    [0.305, -18, 34, 0.96],
    [0.305, 12, 39, 1.10],
    [0.685, -16, 31, 1.05],
    [0.685, 7, 37, 0.94],
    [0.685, 28, 33, 1.12],
    [0.865, -18, 34, 0.92],
    [0.865, 8, 38, 1.06],
    [0.865, 30, 35, 0.98]
  ];
  treePlacements.forEach(([progress, along, lateralDistance, scale], index) => {
    const frame = frameAt(samples, progress);
    const side = outwardSide(frame);
    count += placeTemplate(
      world,
      templates.parkTree,
      frame,
      along,
      side * (trackWidth / 2 + lateralDistance),
      scale,
      index * 0.27,
      'yellow-tree-' + (index + 1),
      -3.15
    );
  });

  const centralTrees = [
    [75, 245, 0.94, 0.20],
    [125, 185, 1.08, -0.34],
    [185, 100, 0.96, 0.48],
    [235, 15, 1.12, -0.16],
    [120, -105, 0.92, 0.28],
    [215, -165, 1.04, -0.42],
    [315, -80, 0.98, 0.12],
    [330, 125, 1.10, -0.26]
  ];
  centralTrees.forEach(([x, z, scale, yaw], index) => {
    count += placeAbsoluteTemplate(
      world,
      templates.parkTree,
      x,
      z,
      scale,
      yaw,
      'central-yellow-tree-' + (index + 1),
      -3.0
    );
  });

  const shedFrame = frameAt(samples, 0.705);
  count += placeOpenShed(world, templates, shedFrame, trackWidth);

  const truckFrame = frameAt(samples, 0.735);
  count += placeRustTruck(world, templates, truckFrame, trackWidth);

  const ruinsFrame = frameAt(samples, 0.535);
  count += placeRuinCluster(world, templates, ruinsFrame, trackWidth);

  return count;
}

function placeOpenShed(world, templates, frame, trackWidth) {
  const side = outwardSide(frame);
  const lateral = side * (trackWidth / 2 + 36);
  let count = 0;

  const poles = cloneTemplateAt(
    world, templates.shedPoles, frame, -5, lateral, 1.12, 0.08, 'open-shed-poles'
  );
  if (poles) count += 1;

  const roof = cloneTemplateAt(
    world, templates.shedRoof, frame, -5, lateral, 1.12, 0.08, 'open-shed-roof'
  );
  if (roof) {
    // Seat the roof from the actual transformed bounds instead of a guessed
    // vertical offset so it visibly rests on the Kenney pole frame.
    poles?.updateMatrixWorld(true);
    roof.updateMatrixWorld(true);
    const poleBounds = poles ? new THREE.Box3().setFromObject(poles) : null;
    const roofBounds = new THREE.Box3().setFromObject(roof);
    const supportTop = poleBounds?.max?.y;
    if (Number.isFinite(supportTop) && Number.isFinite(roofBounds.min.y)) {
      // Deliberately overlap the roof with the support tops a little. The OBJ's
      // bounds include thin underside geometry, so merely matching the bounds
      // still reads as a visible air gap from race-camera height.
      roof.position.y += supportTop - roofBounds.min.y - 0.95;
    }
    count += 1;
  }
  return count;
}

function placeRustTruck(world, templates, frame, trackWidth) {
  const side = outwardSide(frame);
  const object = cloneTemplateAt(
    world,
    templates.truck,
    frame,
    10,
    side * (trackWidth / 2 + 29),
    1.15,
    Math.PI / 2 + 0.14,
    'rust-truck'
  );
  if (!object) return 0;
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.material = material(0x7d4939, 0.98, true);
  });
  return 1;
}

function placeRuinCluster(world, templates, frame, trackWidth) {
  const side = outwardSide(frame);
  let count = 0;
  const ruinLateral = side * (trackWidth / 2 + 31);

  const ruins = [
    [-20, 0, -0.25, 0.92],
    [1, 6, 0.22, 1.12],
    [21, -2, -0.08, 0.82]
  ];
  ruins.forEach(([along, lateralNudge, yaw, scale], index) => {
    count += placeTemplate(
      world,
      templates.brokenWall,
      frame,
      along,
      ruinLateral + side * lateralNudge,
      scale,
      yaw,
      'stone-ruin-' + (index + 1)
    );
  });

  return count;
}

function cloneTemplateAt(world, template, frame, along, lateral, scale, yawOffset, name) {
  if (!template) return null;
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
  return object;
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
  return count;
}

function placeCliffService(world, templates, frame, trackWidth) {
  const outside = outwardSide(frame);
  let count = 0;
  count += placeTemplate(world, templates.scaffold, frame, -24, outside * (trackWidth / 2 + 40), 1.1, 0.1, 'cliff-service-watchtower');
  count += placeTemplate(world, templates.garage, frame, 8, outside * (trackWidth / 2 + 50), 1.15, -0.12, 'cliff-service-bay');
  count += placeTemplate(world, templates.truck, frame, 20, outside * (trackWidth / 2 + 32), 1.0, Math.PI / 2, 'cliff-service-truck');
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

function placeTemplate(world, template, frame, along, lateral, scale, yawOffset, name, verticalOffset = 0) {
  if (!template) return 0;
  const object = template.clone(true);
  object.name = 'Dead Canyon Retro Urban ' + name;
  object.position.copy(frame.point)
    .addScaledVector(frame.tangent, along)
    .addScaledVector(frame.normal, lateral);
  object.position.y = Math.max(0.25, frame.point.y - 0.25) + verticalOffset;
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

function placeAbsoluteTemplate(world, template, x, z, scale, yaw, name, y = 0) {
  if (!template) return 0;
  const object = template.clone(true);
  object.name = 'Dead Canyon Retro Urban ' + name;
  object.position.set(x, y, z);
  object.rotation.y = yaw;
  object.scale.multiplyScalar(scale);
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = false;
  });
  world.add(object);
  return 1;
}

function distanceToRouteXZ(samples, x, z) {
  let nearest = Infinity;
  for (const sample of samples) {
    nearest = Math.min(nearest, Math.hypot(sample.point.x - x, sample.point.z - z));
  }
  return nearest;
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
