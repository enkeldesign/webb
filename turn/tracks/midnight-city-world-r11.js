import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r157-hidden-achievements';
import { installMidnightCityWorld as installMidnightCityWorldR7 } from './midnight-city-world-r7.js?build=20260921-r280';
import { installNightPlayerSpotlight } from './night-player-spotlight-r560.js?revision=r175-reconcile';
import { installSharedNightSky } from '/turn/tracks/shared-night-sky.js';

const LILYA_TEXTURE_URL = new URL('../LILYA.PNG', import.meta.url).href;
const TRACK_Y = 0.16;
const LOW_CITY_BODY_COLORS = Object.freeze([0x2b2138, 0x241a32, 0x2b2138, 0x20283a]);
const LOW_CITY_GLOW_COLORS = Object.freeze([0x5de4ff, 0xff4fa3, 0xffdc68, 0x9d7cff]);
const LOW_CITY_PARKS = Object.freeze([
  Object.freeze({ x: 80, z: 75, radius: 78 }),
  Object.freeze({ x: -590, z: -125, radius: 58 }),
  Object.freeze({ x: 570, z: 145, radius: 60 })
]);
const LOW_CITY_CANDIDATES = Object.freeze([
  Object.freeze({ ratio: 0.020, side: -1 }),
  Object.freeze({ ratio: 0.035, side: 1 }),
  Object.freeze({ ratio: 0.065, side: 1 }),
  Object.freeze({ ratio: 0.090, side: -1 }),
  Object.freeze({ ratio: 0.120, side: -1 }),
  Object.freeze({ ratio: 0.145, side: 1 }),
  Object.freeze({ ratio: 0.175, side: 1 }),
  Object.freeze({ ratio: 0.205, side: -1 }),
  Object.freeze({ ratio: 0.240, side: 1 }),
  Object.freeze({ ratio: 0.270, side: -1 }),
  Object.freeze({ ratio: 0.305, side: -1 }),
  Object.freeze({ ratio: 0.335, side: 1 }),
  Object.freeze({ ratio: 0.370, side: 1 }),
  Object.freeze({ ratio: 0.405, side: -1 }),
  Object.freeze({ ratio: 0.440, side: -1 }),
  Object.freeze({ ratio: 0.470, side: 1 }),
  Object.freeze({ ratio: 0.505, side: -1 }),
  Object.freeze({ ratio: 0.535, side: 1 }),
  Object.freeze({ ratio: 0.570, side: 1 }),
  Object.freeze({ ratio: 0.600, side: -1 }),
  Object.freeze({ ratio: 0.635, side: -1 }),
  Object.freeze({ ratio: 0.665, side: 1 }),
  Object.freeze({ ratio: 0.700, side: 1 }),
  Object.freeze({ ratio: 0.730, side: -1 }),
  Object.freeze({ ratio: 0.765, side: 1 }),
  Object.freeze({ ratio: 0.795, side: -1 }),
  Object.freeze({ ratio: 0.825, side: -1 }),
  Object.freeze({ ratio: 0.855, side: 1 }),
  Object.freeze({ ratio: 0.885, side: 1 }),
  Object.freeze({ ratio: 0.915, side: -1 }),
  Object.freeze({ ratio: 0.940, side: -1 }),
  Object.freeze({ ratio: 0.965, side: 1 })
]);
const CITY_BUILDER_COMMIT = '4535092b740b378b700efd9df9e27a631815b84a';
const CITY_MODEL_BASE = `https://cdn.jsdelivr.net/gh/KenneyNL/Starter-Kit-City-Builder@${CITY_BUILDER_COMMIT}/models/`;
const LOW_CITY_ASSET_NAMES = Object.freeze([
  'building-small-a.glb',
  'building-small-c.glb'
]);
const lowCityLoader = new GLTFLoader();
const lowCitySources = new Map();


const LILYA_WALL = Object.freeze({
  x: -500.70,
  y: 11.96,
  z: 40.20,
  maxWidth: 46,
  maxHeight: 21
});
const LILYA_WALL_NORMAL = new THREE.Vector3(-1, 0, 0);
const LILYA_LOAD_DISTANCE = 220;
const LILYA_LOAD_DISTANCE_SQUARED = LILYA_LOAD_DISTANCE * LILYA_LOAD_DISTANCE;
const LILYA_MIN_VIEW_DOT = 0.56;
const LILYA_MIN_FRONT_DOT = 0.12;
const LILYA_MAX_TRACK_ALIGNMENT = -0.62;
const LILYA_DISCOVERY_HOLD_MS = 650;
const TRACK_SURFACE_NAME = /^Midnight City (race road|road edge|sidewalk)/;

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR7(options);
  const inheritedReady = world.ready;
  const nightSky = installSharedNightSky(world, { trackId: 'midnight-city' });
  world.ready = Promise.resolve(inheritedReady)
    .then(() => nightSky?.ready)
    .then(() => world);
  const surfaceNormals = repairTrackSurfaceWinding(world);
  const lowCity = installLowCityInfill(world, options.samples || [], options.trackWidth || 27);
  const lowCityAssetRequests = installLowCityAssets(world, lowCity.assetAnchors);
  const portrait = installHiddenLilyaPortrait(world);
  const lazyLoadArmed = armWrongWayTextureLoad(world, portrait, options);
  const playerSpotlight = installNightPlayerSpotlight(options.runtime?.playerCar, options.runtime);

  world.name = 'TURN Midnight City r11';
  world.userData.turnPlayerLightRig = playerSpotlight;
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r11',
    hiddenLilyaPortrait: true,
    hiddenLilyaPlacement: 'west facade of the surviving low Neon Quarter building inside the western hairpin',
    hiddenLilyaLazyLoad: lazyLoadArmed
      ? 'load only after the player approaches from the visible side, looks at the wall and remains turned against race direction'
      : 'unavailable because the race-road render trigger was not found',
    hiddenLilyaWrongWayOnly: true,
    hiddenLilyaDiscoveryHoldMs: LILYA_DISCOVERY_HOLD_MS,
    hiddenLilyaMipmaps: false,
    hiddenLilyaFitsFacade: true,
    gameplayGeometryUnchanged: true,
    playerVisibilityLight: playerSpotlight
      ? 'shared-warm-shadowless-spotlight-identical-to-mountain'
      : 'unavailable-without-player-car',
    sharedNightSpotlight: Boolean(playerSpotlight),
    sharedProceduralNightSky: Boolean(nightSky?.sky),
    sharedSouthernMoon: 'canonical-mountain-moon-image',
    nightSkyVariation: 'restrained-purple-horizon-glow',
    headlightRoadReflectance: 'original-midnight-city-road-material-with-upward-facing-surface-normals',
    repairedDownwardSurfaceMeshes: surfaceNormals.repaired,
    inspectedTrackSurfaceMeshes: surfaceNormals.inspected,
    lowCityBuildingCount: lowCity.buildings,
    lowCityGlowStripCount: lowCity.glowStrips,
    lowCityAssetRequests,
    lowCityTechnique: 'three-instanced-draw-call-purple-weighted-low-rise-infill-plus-two-small-pinned-Kenney-landmarks',
    lowCityTrackSafetyMargin: 'placement rejected against the full sampled race corridor, parks and existing district buildings',
    lowCityPurpleBodyShare: 'three of four palette entries are purple-family',
    lowCityAddsDynamicLights: false,
    hiddenLilyaAddsDynamicLights: false,
    noIndependentAnimationLoop: true
  });

  return world;
}

function installLowCityInfill(world, samples, trackWidth) {
  if (!samples.length) return Object.freeze({ buildings: 0, glowStrips: 0, assetAnchors: Object.freeze([]) });

  const occupied = collectDistrictBuildingFootprints(world);
  const placements = [];
  for (let index = 0; index < LOW_CITY_CANDIDATES.length; index += 1) {
    const candidate = LOW_CITY_CANDIDATES[index];
    const sample = samples[Math.round(candidate.ratio * (samples.length - 1))];
    if (!sample?.point || !sample?.normal || !sample?.tangent) continue;

    const seed = index * 37 + 11;
    const width = 24 + pseudoLowCity(seed + 1) * 20;
    const depth = 15 + pseudoLowCity(seed + 2) * 10;
    const height = 7.5 + pseudoLowCity(seed + 3) * 10.5;
    const footprintRadius = Math.hypot(width, depth) / 2;
    const setback = trackWidth / 2 + 42 + pseudoLowCity(seed + 4) * 26;
    const tangentNudge = (pseudoLowCity(seed + 5) - 0.5) * 24;
    const centre = sample.point.clone()
      .addScaledVector(sample.normal, candidate.side * setback)
      .addScaledVector(sample.tangent, tangentNudge);

    if (!isLowCityPlacementClear(centre.x, centre.z, footprintRadius, samples, trackWidth, occupied, placements)) continue;

    const rotation = Math.atan2(sample.tangent.x, sample.tangent.z);
    const bodyColor = LOW_CITY_BODY_COLORS[index % LOW_CITY_BODY_COLORS.length];
    const glowColor = LOW_CITY_GLOW_COLORS[index % LOW_CITY_GLOW_COLORS.length];
    placements.push(Object.freeze({
      x: centre.x,
      z: centre.z,
      width,
      depth,
      height,
      rotation,
      side: candidate.side,
      normalX: sample.normal.x,
      normalZ: sample.normal.z,
      tangentX: sample.tangent.x,
      tangentZ: sample.tangent.z,
      footprintRadius,
      bodyColor,
      glowColor,
      seed
    }));
  }

  if (!placements.length) return Object.freeze({ buildings: 0, glowStrips: 0, assetAnchors: Object.freeze([]) });

  const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.05
  });
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, placements.length);
  bodies.name = 'Midnight City low-city building bodies';
  const marker = new THREE.Object3D();

  for (let index = 0; index < placements.length; index += 1) {
    const building = placements[index];
    marker.position.set(building.x, building.height / 2, building.z);
    marker.rotation.set(0, building.rotation, 0);
    marker.scale.set(building.depth, building.height, building.width);
    marker.updateMatrix();
    bodies.setMatrixAt(index, marker.matrix);
    bodies.setColorAt(index, new THREE.Color(building.bodyColor));
  }
  bodies.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  bodies.computeBoundingSphere?.();
  world.add(bodies);

  const glowGeometry = new THREE.BoxGeometry(1, 1, 1);
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const glows = new THREE.InstancedMesh(glowGeometry, glowMaterial, placements.length * 2);
  glows.name = 'Midnight City low-city shopfront and roofline glow';
  let glowCursor = 0;

  for (const building of placements) {
    const roadFacing = -building.side;
    const frontX = building.x + building.normalX * roadFacing * (building.depth / 2 + 0.08);
    const frontZ = building.z + building.normalZ * roadFacing * (building.depth / 2 + 0.08);

    marker.position.set(frontX, 2.35, frontZ);
    marker.rotation.set(0, building.rotation, 0);
    marker.scale.set(0.18, 1.15, building.width * 0.72);
    marker.updateMatrix();
    glows.setMatrixAt(glowCursor, marker.matrix);
    glows.setColorAt(glowCursor, new THREE.Color(building.glowColor));
    glowCursor += 1;

    marker.position.set(frontX, building.height + 0.18, frontZ);
    marker.rotation.set(0, building.rotation, 0);
    marker.scale.set(0.22, 0.28, building.width * 0.82);
    marker.updateMatrix();
    glows.setMatrixAt(glowCursor, marker.matrix);
    glows.setColorAt(glowCursor, new THREE.Color(building.glowColor));
    glowCursor += 1;
  }
  glows.count = glowCursor;
  glows.instanceMatrix.needsUpdate = true;
  if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
  glows.computeBoundingSphere?.();
  world.add(glows);

  const ventGeometry = new THREE.BoxGeometry(1, 1, 1);
  const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x242b39, roughness: 0.9, metalness: 0.08 });
  const vents = new THREE.InstancedMesh(ventGeometry, ventMaterial, placements.length);
  vents.name = 'Midnight City low-city rooftop units';
  for (let index = 0; index < placements.length; index += 1) {
    const building = placements[index];
    marker.position.set(
      building.x + building.tangentX * (pseudoLowCity(building.seed + 8) - 0.5) * building.width * 0.34,
      building.height + 0.75,
      building.z + building.tangentZ * (pseudoLowCity(building.seed + 8) - 0.5) * building.width * 0.34
    );
    marker.rotation.set(0, building.rotation, 0);
    marker.scale.set(
      Math.max(2.2, building.depth * 0.22),
      1.5,
      Math.max(3.2, building.width * 0.22)
    );
    marker.updateMatrix();
    vents.setMatrixAt(index, marker.matrix);
  }
  vents.instanceMatrix.needsUpdate = true;
  vents.computeBoundingSphere?.();
  world.add(vents);

  const assetAnchors = [];
  for (const placementIndex of [5, 21]) {
    const building = placements[placementIndex];
    if (!building) continue;
    const direction = placementIndex % 2 === 0 ? 1 : -1;
    const spacing = building.width * 0.62 + 18;
    const anchorX = building.x + building.tangentX * spacing * direction;
    const anchorZ = building.z + building.tangentZ * spacing * direction;
    const assetRadius = 11;
    if (!isLowCityPlacementClear(anchorX, anchorZ, assetRadius, samples, trackWidth, occupied, placements)) continue;
    assetAnchors.push(Object.freeze({
      x: anchorX,
      z: anchorZ,
      rotation: building.rotation,
      targetSize: 17 + assetAnchors.length * 2,
      name: LOW_CITY_ASSET_NAMES[assetAnchors.length]
    }));
  }

  return Object.freeze({
    buildings: placements.length,
    glowStrips: glowCursor,
    assetAnchors: Object.freeze(assetAnchors)
  });
}

function collectDistrictBuildingFootprints(world) {
  const occupied = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  world.traverse((node) => {
    if (!node?.isInstancedMesh || !node.name?.startsWith('Midnight City district building bodies')) return;
    for (let index = 0; index < node.count; index += 1) {
      node.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      occupied.push(Object.freeze({
        x: position.x,
        z: position.z,
        radius: Math.hypot(scale.x, scale.z) / 2
      }));
    }
  });
  return occupied;
}

function isLowCityPlacementClear(x, z, radius, samples, trackWidth, occupied, planned) {
  const trackClearance = trackWidth / 2 + radius + 10;
  const trackClearanceSquared = trackClearance * trackClearance;
  for (let index = 0; index < samples.length; index += 4) {
    const point = samples[index].point;
    const dx = x - point.x;
    const dz = z - point.z;
    if (dx * dx + dz * dz < trackClearanceSquared) return false;
  }

  for (const park of LOW_CITY_PARKS) {
    const required = park.radius + radius + 10;
    const dx = x - park.x;
    const dz = z - park.z;
    if (dx * dx + dz * dz < required * required) return false;
  }

  for (const entry of occupied) {
    const required = entry.radius + radius + 7;
    const dx = x - entry.x;
    const dz = z - entry.z;
    if (dx * dx + dz * dz < required * required) return false;
  }

  for (const entry of planned) {
    const required = entry.footprintRadius + radius + 6;
    const dx = x - entry.x;
    const dz = z - entry.z;
    if (dx * dx + dz * dz < required * required) return false;
  }

  return true;
}

function installLowCityAssets(world, anchors) {
  if (!anchors?.length) return 0;

  for (const [index, anchor] of anchors.entries()) {
    const url = `${CITY_MODEL_BASE}${anchor.name}`;
    let sourcePromise = lowCitySources.get(url);
    if (!sourcePromise) {
      sourcePromise = lowCityLoader.loadAsync(url).then((gltf) => gltf.scene);
      lowCitySources.set(url, sourcePromise);
    }

    sourcePromise
      .then((source) => {
        if (!world.parent) return;
        const model = prepareLowCityAsset(source, anchor.targetSize);
        model.name = `Midnight City Kenney low-city landmark ${index + 1} ${anchor.name}`;
        model.position.set(anchor.x, TRACK_Y, anchor.z);
        model.rotation.y = anchor.rotation;
        world.add(model);
      })
      .catch((error) => {
        console.warn(`TURN: Midnight City low-city asset failed to load: ${anchor.name}`, error);
      });
  }

  return anchors.length;
}

function prepareLowCityAsset(source, targetSize) {
  const model = source.clone(true);
  const nightTint = new THREE.Color(0x182338);
  model.traverse((node) => {
    if (!node.isMesh) return;
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const materials = sourceMaterials.map((material) => {
      const clone = material.clone();
      clone.color?.lerp(nightTint, 0.16);
      clone.roughness = Math.max(clone.roughness ?? 0.75, 0.72);
      clone.metalness = Math.min(clone.metalness ?? 0.08, 0.14);
      return clone;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0];
  });

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(model);
  const centre = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= centre.z;
  return model;
}

function pseudoLowCity(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function repairTrackSurfaceWinding(world) {
  let inspected = 0;
  let repaired = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();

  world.traverse((node) => {
    if (!node?.isMesh || !TRACK_SURFACE_NAME.test(node.name || '')) return;
    const geometry = node.geometry;
    const index = geometry?.index;
    const position = geometry?.getAttribute?.('position');
    if (!index || !position || index.count < 3) return;

    inspected += 1;
    a.fromBufferAttribute(position, index.getX(0));
    b.fromBufferAttribute(position, index.getX(1));
    c.fromBufferAttribute(position, index.getX(2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    faceNormal.crossVectors(ab, ac);
    if (faceNormal.y >= 0) return;

    for (let offset = 0; offset < index.count; offset += 3) {
      const second = index.getX(offset + 1);
      index.setX(offset + 1, index.getX(offset + 2));
      index.setX(offset + 2, second);
    }
    index.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.getAttribute('normal').needsUpdate = true;
    node.userData.turnMidnightSurfaceWinding = 'upward-r176';
    repaired += 1;
  });

  return Object.freeze({ inspected, repaired });
}

function installHiddenLilyaPortrait(world) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const portrait = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  portrait.name = 'Midnight City hidden LILYA portrait';
  portrait.position.set(LILYA_WALL.x, LILYA_WALL.y, LILYA_WALL.z);
  portrait.rotation.y = -Math.PI / 2;
  portrait.visible = false;
  portrait.renderOrder = 4;
  portrait.userData.turnEasterEgg = 'hidden-lilya-portrait';
  world.add(portrait);
  return portrait;
}

function armWrongWayTextureLoad(world, portrait, options = {}) {
  const road = world.getObjectByName('Midnight City race road');
  if (!road) {
    console.warn('TURN: Midnight City could not arm the hidden LILYA portrait lazy loader.');
    return false;
  }

  const runtime = options.runtime;
  const trackSamples = options.samples || options.trackRuntime?.samples || [];
  const wallPosition = new THREE.Vector3(LILYA_WALL.x, LILYA_WALL.y, LILYA_WALL.z);
  const cameraPosition = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const cameraToWall = new THREE.Vector3();
  const wallToCamera = new THREE.Vector3();
  const previousOnBeforeRender = road.onBeforeRender;
  let discoveryStartedAt = null;
  let loadStarted = false;

  function restoreRoadRenderHook() {
    if (road.onBeforeRender === wrongWayTriggeredLoad) road.onBeforeRender = previousOnBeforeRender;
  }

  function resetDiscoveryHold() {
    discoveryStartedAt = null;
  }

  function wrongWayTriggeredLoad(...args) {
    previousOnBeforeRender?.call(this, ...args);
    if (loadStarted) return;

    const camera = args[2];
    if (!camera?.isCamera) {
      resetDiscoveryHold();
      return;
    }

    camera.getWorldPosition(cameraPosition);
    if (cameraPosition.distanceToSquared(wallPosition) > LILYA_LOAD_DISTANCE_SQUARED) {
      resetDiscoveryHold();
      return;
    }

    wallToCamera.copy(cameraPosition).sub(wallPosition).normalize();
    if (wallToCamera.dot(LILYA_WALL_NORMAL) < LILYA_MIN_FRONT_DOT) {
      resetDiscoveryHold();
      return;
    }

    camera.getWorldDirection(cameraForward);
    cameraToWall.copy(wallPosition).sub(cameraPosition).normalize();
    if (cameraForward.dot(cameraToWall) < LILYA_MIN_VIEW_DOT) {
      resetDiscoveryHold();
      return;
    }

    if (!playerFacesAgainstRaceDirection(runtime, trackSamples)) {
      resetDiscoveryHold();
      return;
    }

    const now = globalThis.performance?.now?.() ?? Date.now();
    if (discoveryStartedAt == null) {
      discoveryStartedAt = now;
      return;
    }
    if (now - discoveryStartedAt < LILYA_DISCOVERY_HOLD_MS) return;

    loadStarted = true;
    restoreRoadRenderHook();
    loadLilyaTexture(portrait, runtime);
  }

  road.onBeforeRender = wrongWayTriggeredLoad;
  portrait.userData.turnLazyTexture = 'wrong-way-camera-proximity-front-side-view-direction-and-hold';
  return true;
}

function playerFacesAgainstRaceDirection(runtime, trackSamples) {
  const state = runtime?.state;
  const sample = trackSamples[state?.nearestTrackIndex];
  if (state?.running !== true || !Number.isFinite(state.heading) || !sample?.tangent) return false;

  const forwardX = Math.sin(state.heading);
  const forwardZ = Math.cos(state.heading);
  const trackAlignment = forwardX * sample.tangent.x + forwardZ * sample.tangent.z;
  return trackAlignment <= LILYA_MAX_TRACK_ALIGNMENT;
}

function loadLilyaTexture(portrait, runtime) {
  new THREE.TextureLoader().load(
    LILYA_TEXTURE_URL,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const imageWidth = texture.image?.naturalWidth || texture.image?.width || 1;
      const imageHeight = texture.image?.naturalHeight || texture.image?.height || 1;
      const aspectRatio = imageWidth / imageHeight;
      let width = LILYA_WALL.maxWidth;
      let height = width / aspectRatio;

      if (height > LILYA_WALL.maxHeight) {
        height = LILYA_WALL.maxHeight;
        width = height * aspectRatio;
      }

      portrait.material.map = texture;
      portrait.material.needsUpdate = true;
      portrait.scale.set(width, height, 1);
      portrait.visible = true;
      portrait.userData.turnSecretAchievementFound = true;
      signalSecretAchievement('find-lilya', {
        trackId: 'midnight-city',
        vehicleId: runtime?.state?.vehicleId || ''
      });
    },
    undefined,
    (error) => {
      console.warn('TURN: Midnight City could not load the hidden LILYA portrait.', error);
    }
  );
}
