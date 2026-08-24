import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCarVisual } from '../vehicle/emergency-livery-models.js?build=20260811-r164';

const REVISION = 'r531-countryside-world-redesign';
const INK = 0x08090a;
const LAKE_LEVEL = 0.051;
const BELLA_SAMPLE_INDEX = 500;
const BELLA_SIDE = -1;
const BELLA_DISTANCE_FROM_ROAD = 42;
const BELLA_TANGENT_OFFSET = 18;
const BELLA_CLEAR_RADIUS = 34;

const SUBURBAN_ROOT = new URL('../assets/scenery/countryside/suburban/', import.meta.url);
const NATURE_ROOT = new URL('../assets/scenery/countryside/nature/', import.meta.url);

const ASSET_URLS = Object.freeze({
  houseA: new URL('building-type-a.glb', SUBURBAN_ROOT).href,
  houseB: new URL('building-type-b.glb', SUBURBAN_ROOT).href,
  raceOffice: new URL('building-type-h.glb', SUBURBAN_ROOT).href,
  houseM: new URL('building-type-m.glb', SUBURBAN_ROOT).href,
  houseS: new URL('building-type-s.glb', SUBURBAN_ROOT).href,
  houseU: new URL('building-type-u.glb', SUBURBAN_ROOT).href,
  driveway: new URL('driveway-short.glb', SUBURBAN_ROOT).href,
  villageFence: new URL('fence-low.glb', SUBURBAN_ROOT).href,
  wheat: new URL('crops_wheatStageB.glb', NATURE_ROOT).href,
  corn: new URL('crops_cornStageD.glb', NATURE_ROOT).href,
  cropBed: new URL('crops_dirtDoubleRow.glb', NATURE_ROOT).href,
  farmFence: new URL('fence_simple.glb', NATURE_ROOT).href,
  farmGate: new URL('fence_gate.glb', NATURE_ROOT).href,
  oak: new URL('tree_oak.glb', NATURE_ROOT).href,
  broadleaf: new URL('tree_default.glb', NATURE_ROOT).href,
  smallTree: new URL('tree_small.glb', NATURE_ROOT).href,
  bush: new URL('plant_bushDetailed.glb', NATURE_ROOT).href,
  logStack: new URL('log_stack.glb', NATURE_ROOT).href,
  lakeRock: new URL('rock_largeA.glb', NATURE_ROOT).href,
  rowBoat: new URL(
    '../assets/scenery/watercraft/boat-row-small.glb?asset=kenney-watercraft-kit-2.1-row-boat',
    import.meta.url
  ).href
});

const VILLAGE_HOUSES = Object.freeze([
  Object.freeze({ key: 'houseA', along: -30, outward: 33, height: 8.7, row: 'near', yaw: -0.04 }),
  Object.freeze({ key: 'houseM', along: 30, outward: 33, height: 9.1, row: 'near', yaw: 0.05 }),
  Object.freeze({ key: 'houseS', along: -31, outward: 63, height: 9.2, row: 'far', yaw: 0.04 }),
  Object.freeze({ key: 'houseB', along: 0, outward: 64, height: 9.8, row: 'far', yaw: -0.02 }),
  Object.freeze({ key: 'houseU', along: 31, outward: 63, height: 9.5, row: 'far', yaw: -0.05 })
]);

const loader = new GLTFLoader();
const sourceCache = new Map();
const inkMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

function loadSource(key) {
  if (!sourceCache.has(key)) {
    const request = loader.loadAsync(ASSET_URLS[key])
      .then((gltf) => gltf.scene)
      .catch((error) => {
        sourceCache.delete(key);
        throw error;
      });
    sourceCache.set(key, request);
  }
  return sourceCache.get(key);
}

function sampleAt(samples, index) {
  return samples[((Math.round(index) % samples.length) + samples.length) % samples.length];
}

function trackCentre(samples) {
  const centre = new THREE.Vector3();
  for (const sample of samples) centre.add(sample.point);
  centre.multiplyScalar(1 / Math.max(1, samples.length));
  centre.y = 0;
  return centre;
}

function outwardSide(sample, centre) {
  const towardsCentre = centre.clone().sub(sample.point).setY(0);
  return sample.normal.dot(towardsCentre) > 0 ? -1 : 1;
}

function frameAt(samples, index, trackWidth, forcedSide = null) {
  const sample = sampleAt(samples, index);
  const side = forcedSide ?? outwardSide(sample, trackCentre(samples));
  return {
    sample,
    side,
    trackWidth,
    tangent: sample.tangent.clone().setY(0).normalize(),
    outward: sample.normal.clone().setY(0).normalize().multiplyScalar(side),
    yaw: Math.atan2(sample.tangent.x, sample.tangent.z)
  };
}

function pointInFrame(frame, outwardDistance, tangentDistance = 0, y = 0) {
  const point = frame.sample.point.clone()
    .addScaledVector(frame.outward, frame.trackWidth / 2 + outwardDistance)
    .addScaledVector(frame.tangent, tangentDistance);
  point.y = y;
  return point;
}

function bellaProtectedPoint(samples, trackWidth) {
  const sample = sampleAt(samples, BELLA_SAMPLE_INDEX);
  return sample.point.clone()
    .addScaledVector(sample.normal, BELLA_SIDE * (trackWidth / 2 + BELLA_DISTANCE_FROM_ROAD))
    .addScaledVector(sample.tangent, BELLA_TANGENT_OFFSET)
    .setY(0);
}

function safelyOutsideBella(position, protectedPoint) {
  return position.distanceToSquared(protectedPoint) >= BELLA_CLEAR_RADIUS * BELLA_CLEAR_RADIUS;
}

function materialEntries(material) {
  return Array.isArray(material) ? material : [material];
}

function tuneNatureMaterial(material, semantic) {
  const name = String(material.name || '').toLowerCase();
  let color = null;

  if (semantic === 'wheat') {
    color = name.includes('inner') ? 0xf4d58a : 0xd9a83d;
  } else if (semantic === 'corn') {
    color = name.includes('corn') ? 0xf2c14e : 0x4d9848;
  } else if (semantic === 'cropBed') {
    color = name.includes('dark') ? 0x76503a : 0x9a6846;
  } else if (semantic === 'rock') {
    color = name.includes('grass') ? 0x5f9b58 : 0x79848d;
  } else if (name.includes('leaf') || name === 'grass') {
    color = semantic === 'bush' ? 0x4f914c : 0x5aa153;
  } else if (name.includes('bark')) {
    color = 0x765038;
  } else if (name.includes('inner')) {
    color = 0xd8ad79;
  } else if (name.includes('wooddark')) {
    color = 0x684630;
  } else if (name.includes('wood')) {
    color = 0x93613d;
  } else if (name.includes('stone')) {
    color = 0x87929a;
  }

  if (color != null) material.color?.set(color);
  if ('roughness' in material) material.roughness = Math.max(material.roughness ?? 0.9, 0.9);
  if ('metalness' in material) material.metalness = 0;
  material.needsUpdate = true;
}

function cloneAndTuneMaterials(node, semantic) {
  const materials = materialEntries(node.material).map((material) => {
    const clone = material.clone();
    if (semantic) tuneNatureMaterial(clone, semantic);
    return clone;
  });
  node.material = Array.isArray(node.material) ? materials : materials[0];
}

function addInkOutline(root, scale = 1.022) {
  const surfaces = [];
  root.traverse((node) => {
    if (node?.isMesh && !node.userData?.turnOutline) surfaces.push(node);
  });

  for (const surface of surfaces) {
    const outline = new THREE.Mesh(surface.geometry, inkMaterial);
    outline.name = `${surface.name || 'Countryside surface'} outline`;
    outline.scale.setScalar(scale);
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.userData.turnOutline = true;
    outline.userData.turnOutlined = true;
    surface.add(outline);
  }
}

function prepareModel(source, {
  targetHeight = null,
  targetSpan = null,
  semantic = null,
  outline = false,
  outlineScale = 1.022,
  castShadow = true,
  receiveShadow = true
} = {}) {
  const model = source.clone(true);
  model.traverse((node) => {
    if (!node?.isMesh) return;
    cloneAndTuneMaterials(node, semantic);
    node.castShadow = castShadow;
    node.receiveShadow = receiveShadow;
    node.userData.turnOutlined = true;
    node.userData.turnPaletteLocked = true;
    node.userData.turnCountrysideAsset = REVISION;
  });

  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model, true);
  const size = bounds.getSize(new THREE.Vector3());
  const reference = targetHeight != null
    ? Math.max(size.y, 0.001)
    : Math.max(size.x, size.y, size.z, 0.001);
  const desired = targetHeight ?? targetSpan ?? reference;
  model.scale.multiplyScalar(desired / reference);

  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model, true);
  const centre = bounds.getCenter(new THREE.Vector3());
  model.position.set(-centre.x, -bounds.min.y, -centre.z);
  if (outline) addInkOutline(model, outlineScale);
  return model;
}

function sceneryGround(name, position, width, depth, yaw, color, y = 0.006) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.035, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 })
  );
  mesh.name = name;
  mesh.position.copy(position);
  mesh.position.y = y;
  mesh.rotation.y = yaw;
  mesh.receiveShadow = true;
  mesh.userData.turnNoAutoOutline = true;
  mesh.userData.turnSceneryOnly = true;
  return mesh;
}

function placePrepared(root, source, options, {
  name,
  position,
  rotation = 0,
  metadata = {}
}) {
  const model = prepareModel(source, options);
  model.name = name;
  model.position.add(position);
  model.rotation.y = rotation;
  model.userData.turnSceneryOnly = true;
  Object.assign(model.userData, metadata);
  root.add(model);
  return model;
}

function facingTrackYaw(frame, adjustment = 0) {
  return frame.yaw + (frame.side > 0 ? Math.PI : 0) + adjustment;
}

function installRacePaddock(root, sources, samples, trackWidth) {
  const frame = frameAt(samples, 18, trackWidth, 1);
  const officeSource = sources.get('raceOffice');
  if (!officeSource) return 0;

  placePrepared(root, officeSource, {
    targetHeight: 9.2,
    outline: true,
    outlineScale: 1.018
  }, {
    name: 'Countryside Paddock Race Office',
    position: pointInFrame(frame, 34, 9, 0.04),
    rotation: facingTrackYaw(frame, -0.03),
    metadata: {
      turnCountrysideDistrict: 'paddock',
      turnKenneySuburbanAsset: 'building-type-h'
    }
  });
  return 1;
}

function installVillage(root, sources, samples, trackWidth, protectedPoint) {
  const frame = frameAt(samples, 590, trackWidth);
  const village = new THREE.Group();
  village.name = 'Countryside Birchfield Village';
  village.userData.turnCountrysideDistrict = 'village';
  village.userData.turnTownPlan = 'five red homes around a T-shaped gravel lane with private drives and rear boundaries';
  root.add(village);

  village.add(
    sceneryGround(
      'Birchfield village lane',
      pointInFrame(frame, 48, 0),
      7.5,
      78,
      frame.yaw,
      0xbda77e,
      0.018
    ),
    sceneryGround(
      'Birchfield access lane',
      pointInFrame(frame, 31, 0),
      7.5,
      34,
      frame.yaw + Math.PI / 2,
      0xbda77e,
      0.019
    )
  );

  let houses = 0;
  let drives = 0;
  for (const [index, spec] of VILLAGE_HOUSES.entries()) {
    const source = sources.get(spec.key);
    if (!source) continue;
    const position = pointInFrame(frame, spec.outward, spec.along, 0.035);
    if (!safelyOutsideBella(position, protectedPoint)) continue;
    const faceLaneAdjustment = spec.row === 'near' ? Math.PI : 0;
    placePrepared(village, source, {
      targetHeight: spec.height,
      outline: true,
      outlineScale: 1.018
    }, {
      name: `Birchfield red house ${index + 1}`,
      position,
      rotation: facingTrackYaw(frame, faceLaneAdjustment + spec.yaw),
      metadata: {
        turnCountrysideDistrict: 'village',
        turnKenneySuburbanAsset: spec.key.replace('house', 'building-type-').toLowerCase(),
        turnPalette: 'Swedish-red variation B'
      }
    });
    houses += 1;

    const drivewaySource = sources.get('driveway');
    if (drivewaySource) {
      const drivewayOutward = spec.row === 'near' ? spec.outward + 8.5 : spec.outward - 8.5;
      placePrepared(village, drivewaySource, {
        targetSpan: 8.5,
        castShadow: false
      }, {
        name: `Birchfield private drive ${index + 1}`,
        position: pointInFrame(frame, drivewayOutward, spec.along, 0.046),
        rotation: frame.yaw + Math.PI / 2,
        metadata: { turnCountrysideDistrict: 'village' }
      });
      drives += 1;
    }
  }

  const fenceSource = sources.get('villageFence');
  if (fenceSource) {
    for (const along of [-31, -15.5, 0, 15.5, 31]) {
      placePrepared(village, fenceSource, {
        targetSpan: 14,
        castShadow: false,
        receiveShadow: true
      }, {
        name: 'Birchfield rear garden fence',
        position: pointInFrame(frame, 75, along, 0.03),
        rotation: frame.yaw + Math.PI / 2,
        metadata: { turnCountrysideDistrict: 'village' }
      });
    }
  }

  const bushSource = sources.get('bush');
  if (bushSource) {
    for (const [along, outward, scale] of [
      [-40, 47, 2.1], [-19, 54, 1.8], [18, 54, 2.0], [40, 47, 1.9], [-41, 69, 1.7], [42, 69, 1.8]
    ]) {
      const position = pointInFrame(frame, outward, along, 0.035);
      if (!safelyOutsideBella(position, protectedPoint)) continue;
      placePrepared(village, bushSource, {
        targetHeight: scale,
        semantic: 'bush',
        castShadow: false
      }, {
        name: 'Birchfield garden shrub',
        position,
        rotation: frame.yaw + along * 0.015,
        metadata: { turnCountrysideDistrict: 'village' }
      });
    }
  }

  village.userData.turnVillageMetrics = Object.freeze({ houses, drives });
  return houses;
}

function installFarmFields(root, sources, samples, trackWidth, protectedPoint) {
  const frame = frameAt(samples, 365, trackWidth);
  const farm = new THREE.Group();
  farm.name = 'Countryside Windmill Farm Fields';
  farm.userData.turnCountrysideDistrict = 'windmill-farm';
  farm.userData.turnTownPlan = 'parallel crop beds contained by a roadside fence and centred gate';
  root.add(farm);

  farm.add(sceneryGround(
    'Windmill farm cultivated earth',
    pointInFrame(frame, 36, 0),
    35,
    72,
    frame.yaw,
    0xa87443,
    0.012
  ));

  const cropBedSource = sources.get('cropBed');
  const wheatSource = sources.get('wheat');
  const cornSource = sources.get('corn');
  let cropBeds = 0;

  for (const outward of [29, 42]) {
    for (let row = 0; row < 5; row += 1) {
      const along = -27 + row * 13.5;
      const position = pointInFrame(frame, outward, along, 0.04);
      if (!safelyOutsideBella(position, protectedPoint)) continue;
      if (cropBedSource) {
        placePrepared(farm, cropBedSource, {
          targetSpan: 7.2,
          semantic: 'cropBed',
          castShadow: false
        }, {
          name: 'Windmill farm ordered crop bed',
          position,
          rotation: frame.yaw,
          metadata: { turnCountrysideDistrict: 'windmill-farm' }
        });
      }

      const cropSource = (row + (outward > 35 ? 1 : 0)) % 2 === 0 ? wheatSource : cornSource;
      if (cropSource) {
        const wheat = cropSource === wheatSource;
        placePrepared(farm, cropSource, {
          targetHeight: wheat ? 1.8 : 2.45,
          semantic: wheat ? 'wheat' : 'corn',
          castShadow: false
        }, {
          name: wheat ? 'Windmill farm wheat' : 'Windmill farm corn',
          position: position.clone().setY(0.08),
          rotation: frame.yaw + row * 0.08,
          metadata: { turnCountrysideDistrict: 'windmill-farm' }
        });
      }
      cropBeds += 1;
    }
  }

  const fenceSource = sources.get('farmFence');
  const gateSource = sources.get('farmGate');
  if (fenceSource) {
    for (const along of [-29, -20, -11, 11, 20, 29]) {
      placePrepared(farm, fenceSource, {
        targetSpan: 8.2,
        semantic: 'wood',
        castShadow: false
      }, {
        name: 'Windmill farm roadside fence',
        position: pointInFrame(frame, 17.5, along, 0.035),
        rotation: frame.yaw + Math.PI / 2,
        metadata: { turnCountrysideDistrict: 'windmill-farm' }
      });
    }
  }
  if (gateSource) {
    placePrepared(farm, gateSource, {
      targetSpan: 9,
      semantic: 'wood',
      castShadow: true
    }, {
      name: 'Windmill farm gate',
      position: pointInFrame(frame, 17.5, 0, 0.035),
      rotation: frame.yaw + Math.PI / 2,
      metadata: { turnCountrysideDistrict: 'windmill-farm' }
    });
  }

  farm.userData.turnFarmMetrics = Object.freeze({ cropBeds });
  return cropBeds;
}

function installOrchard(root, sources, samples, trackWidth, protectedPoint) {
  const frame = frameAt(samples, 430, trackWidth);
  const orchard = new THREE.Group();
  orchard.name = 'Countryside Ordered Orchard';
  orchard.userData.turnCountrysideDistrict = 'orchard';
  orchard.userData.turnTownPlan = 'two aligned rows with a clear sightline between trunks';
  root.add(orchard);

  orchard.add(sceneryGround(
    'Orchard grass enclosure',
    pointInFrame(frame, 36, 0),
    32,
    52,
    frame.yaw,
    0x73ad62,
    0.009
  ));

  const oak = sources.get('oak');
  const broadleaf = sources.get('broadleaf');
  let trees = 0;
  for (const outward of [29, 43]) {
    for (const along of [-18, -6, 6, 18]) {
      const position = pointInFrame(frame, outward, along, 0.03);
      if (!safelyOutsideBella(position, protectedPoint)) continue;
      const source = (trees + (outward > 35 ? 1 : 0)) % 2 ? broadleaf : oak;
      if (!source) continue;
      placePrepared(orchard, source, {
        targetHeight: 7.7 + (trees % 3) * 0.55,
        semantic: 'tree',
        castShadow: trees % 3 === 0
      }, {
        name: 'Countryside orchard tree',
        position,
        rotation: frame.yaw + trees * 0.47,
        metadata: { turnCountrysideDistrict: 'orchard' }
      });
      trees += 1;
    }
  }

  const fence = sources.get('farmFence');
  if (fence) {
    for (const along of [-18, -9, 0, 9, 18]) {
      placePrepared(orchard, fence, {
        targetSpan: 8,
        semantic: 'wood',
        castShadow: false
      }, {
        name: 'Orchard roadside fence',
        position: pointInFrame(frame, 18, along, 0.035),
        rotation: frame.yaw + Math.PI / 2,
        metadata: { turnCountrysideDistrict: 'orchard' }
      });
    }
  }

  orchard.userData.turnOrchardMetrics = Object.freeze({ trees });
  return trees;
}

function installForestEdge(root, sources, samples, trackWidth, protectedPoint) {
  const frame = frameAt(samples, 290, trackWidth);
  const forest = new THREE.Group();
  forest.name = 'Countryside Managed Forest Edge';
  forest.userData.turnCountrysideDistrict = 'forest-edge';
  root.add(forest);

  const logStack = sources.get('logStack');
  if (logStack) {
    const position = pointInFrame(frame, 23, -8, 0.03);
    if (safelyOutsideBella(position, protectedPoint)) {
      placePrepared(forest, logStack, {
        targetSpan: 6.2,
        semantic: 'wood',
        outline: true,
        outlineScale: 1.025
      }, {
        name: 'Managed forest log stack',
        position,
        rotation: frame.yaw + Math.PI / 2,
        metadata: { turnCountrysideDistrict: 'forest-edge' }
      });
    }
  }

  const smallTree = sources.get('smallTree');
  if (smallTree) {
    for (const [along, outward, height] of [[-18, 27, 6.2], [8, 31, 6.8], [19, 25, 5.9]]) {
      const position = pointInFrame(frame, outward, along, 0.03);
      if (!safelyOutsideBella(position, protectedPoint)) continue;
      placePrepared(forest, smallTree, {
        targetHeight: height,
        semantic: 'tree',
        castShadow: false
      }, {
        name: 'Managed forest young tree',
        position,
        rotation: frame.yaw + along * 0.05,
        metadata: { turnCountrysideDistrict: 'forest-edge' }
      });
    }
  }
}

function installLakeLife(root, sources, samples) {
  const centre = trackCentre(samples);
  const islandCentre = centre.clone().add(new THREE.Vector3(22, 0, -9));
  const lake = new THREE.Group();
  lake.name = 'Countryside Lake Life';
  lake.userData.turnCountrysideDistrict = 'lake';
  lake.userData.turnTownPlan = 'one quiet moored rowboat and a restrained natural shoreline accent';
  root.add(lake);

  const rowBoat = sources.get('rowBoat');
  if (rowBoat) {
    placePrepared(lake, rowBoat, {
      targetSpan: 5.6,
      outline: true,
      outlineScale: 1.024,
      castShadow: false,
      receiveShadow: false
    }, {
      name: 'Countryside moored rowboat',
      position: islandCentre.clone().add(new THREE.Vector3(-23, LAKE_LEVEL + 0.02, 4.5)),
      rotation: 0.58,
      metadata: { turnCountrysideDistrict: 'lake' }
    });
  }

  const rock = sources.get('lakeRock');
  if (rock) {
    for (const [x, z, scale, yaw] of [[-17, -4, 3.3, 0.4], [-15, 7, 2.5, 1.1]]) {
      placePrepared(lake, rock, {
        targetSpan: scale,
        semantic: 'rock',
        castShadow: false
      }, {
        name: 'Countryside island shoreline rock',
        position: islandCentre.clone().add(new THREE.Vector3(x, 0.06, z)),
        rotation: yaw,
        metadata: { turnCountrysideDistrict: 'lake' }
      });
    }
  }
}

async function installParkedCars(root, samples, trackWidth) {
  const villageFrame = frameAt(samples, 590, trackWidth);
  const paddockFrame = frameAt(samples, 18, trackWidth, 1);
  const specs = [
    {
      carId: 'suv', color: '#596b55', targetLength: 5.2,
      position: pointInFrame(villageFrame, 42, -30, 0.12),
      rotation: facingTrackYaw(villageFrame, Math.PI + 0.04),
      district: 'village'
    },
    {
      carId: 'sedan', color: '#7a4d45', targetLength: 5.0,
      position: pointInFrame(villageFrame, 55, 30, 0.12),
      rotation: facingTrackYaw(villageFrame, -0.06),
      district: 'village'
    },
    {
      carId: 'truck', color: '#566879', targetLength: 6.6,
      position: pointInFrame(paddockFrame, 26, -10, 0.13),
      rotation: facingTrackYaw(paddockFrame, 0.08),
      district: 'paddock'
    }
  ];

  const settled = await Promise.allSettled(specs.map(async (spec, index) => {
    const car = await createCarVisual({
      carId: spec.carId,
      color: spec.color,
      targetLength: spec.targetLength,
      outline: true
    });
    car.name = `Countryside parked ${spec.carId} ${index + 1}`;
    car.position.copy(spec.position);
    car.rotation.y = spec.rotation;
    car.userData.turnStaticSceneryCar = true;
    car.userData.turnSceneryOnly = true;
    car.userData.turnCountrysideDistrict = spec.district;
    car.traverse((node) => {
      if (node?.isMesh) node.castShadow = false;
    });
    root.add(car);
    return car;
  }));

  return {
    placed: settled.filter((result) => result.status === 'fulfilled').length,
    errors: settled
      .filter((result) => result.status === 'rejected')
      .map((result) => String(result.reason?.message || result.reason))
  };
}

async function loadAllSources() {
  const entries = await Promise.all(Object.keys(ASSET_URLS).map(async (key) => {
    try {
      return [key, await loadSource(key), null];
    } catch (error) {
      return [key, null, `${key}: ${String(error?.message || error)}`];
    }
  }));
  return {
    sources: new Map(entries.filter(([, source]) => source).map(([key, source]) => [key, source])),
    errors: entries.map(([, , error]) => error).filter(Boolean)
  };
}

export async function installCountrysideWorld({ world, samples, trackWidth }) {
  if (!world || !Array.isArray(samples) || !samples.length || !Number.isFinite(trackWidth)) return null;
  if (world.userData.turnCountrysideWorld === REVISION) {
    return world.getObjectByName('Countryside Planned World');
  }
  if (world.userData.turnCountrysideWorldPending === REVISION) return null;

  world.userData.turnCountrysideWorldPending = REVISION;
  const root = new THREE.Group();
  root.name = 'Countryside Planned World';
  root.userData.turnCountrysideWorld = REVISION;
  root.userData.turnSceneryOnly = true;
  root.userData.gameplayGeometryUnchanged = true;
  root.userData.turnProtectedGameplayLandmarks = Object.freeze([
    'Bella rescue tree',
    'Bella discovery zone',
    'Countryside road and samples'
  ]);

  try {
    const { sources, errors } = await loadAllSources();
    const protectedPoint = bellaProtectedPoint(samples, trackWidth);
    const paddockBuildings = installRacePaddock(root, sources, samples, trackWidth);
    const villageHouses = installVillage(root, sources, samples, trackWidth, protectedPoint);
    const cropBeds = installFarmFields(root, sources, samples, trackWidth, protectedPoint);
    const orchardTrees = installOrchard(root, sources, samples, trackWidth, protectedPoint);
    installForestEdge(root, sources, samples, trackWidth, protectedPoint);
    installLakeLife(root, sources, samples);
    const parkedCars = await installParkedCars(root, samples, trackWidth);

    world.add(root);
    world.userData.turnCountrysideWorld = REVISION;
    world.userData.turnCountrysideWorldPending = null;
    world.userData.turnCountrysideAssetErrors = [...errors, ...parkedCars.errors];
    world.userData.turnCountrysideWorldMetrics = Object.freeze({
      revision: REVISION,
      districts: ['paddock', 'forest-edge', 'windmill-farm', 'orchard', 'village', 'lake'],
      villageHouses,
      paddockBuildings,
      cropBeds,
      orchardTrees,
      parkedCars: parkedCars.placed,
      randomZoneLandmarks: 0,
      scatteredTownBuildings: 0,
      bellaClearRadius: BELLA_CLEAR_RADIUS,
      gameplayGeometryUnchanged: true
    });
    return root;
  } catch (error) {
    world.userData.turnCountrysideWorldPending = null;
    world.userData.turnCountrysideAssetErrors = [String(error?.message || error)];
    console.warn('TURN: planned Countryside world failed to install.', error);
    return null;
  }
}

export { REVISION as COUNTRYSIDE_WORLD_REVISION };
