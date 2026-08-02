import * as THREE from 'three';
import { installMidnightCityWorld as installMidnightCityWorldR7 } from './midnight-city-world-r7.js?base=20260801-r7';

const LILYA_TEXTURE_URL = new URL('../LILYA.PNG', import.meta.url).href;

// This is the surviving low Neon Quarter building inside the western hairpin.
// The portrait belongs on its west facade, the vertical wall marked in the map close-up.
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

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR7(options);
  const portrait = installHiddenLilyaPortrait(world);
  const lazyLoadArmed = armWrongWayTextureLoad(world, portrait, options);

  world.name = 'TURN Midnight City r11';
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
    noDynamicLightsAdded: true,
    noIndependentAnimationLoop: true
  });

  return world;
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
    if (road.onBeforeRender === wrongWayTriggeredLoad) {
      road.onBeforeRender = previousOnBeforeRender;
    }
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
    loadLilyaTexture(portrait);
  }

  road.onBeforeRender = wrongWayTriggeredLoad;
  portrait.userData.turnLazyTexture = 'wrong-way-camera-proximity-front-side-view-direction-and-hold';
  return true;
}

function playerFacesAgainstRaceDirection(runtime, trackSamples) {
  const state = runtime?.state;
  const sample = trackSamples[state?.nearestTrackIndex];
  if (
    state?.running !== true
    || !Number.isFinite(state.heading)
    || !sample?.tangent
  ) {
    return false;
  }

  const forwardX = Math.sin(state.heading);
  const forwardZ = Math.cos(state.heading);
  const trackAlignment = forwardX * sample.tangent.x + forwardZ * sample.tangent.z;
  return trackAlignment <= LILYA_MAX_TRACK_ALIGNMENT;
}

function loadLilyaTexture(portrait) {
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
    },
    undefined,
    (error) => {
      console.warn('TURN: Midnight City could not load the hidden LILYA portrait.', error);
    }
  );
}
