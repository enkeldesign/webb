import * as THREE from 'three';
import { installMidnightCityWorld as installMidnightCityWorldR7 } from './midnight-city-world-r7.js?base=20260801-r7';

const LILYA_TEXTURE_URL = new URL('../LILYA.PNG', import.meta.url).href;
const LILYA_WALL = Object.freeze({
  x: -474.52,
  y: 29.8,
  z: 140.12,
  maxWidth: 38,
  maxHeight: 48
});
const LILYA_LOAD_DISTANCE = 260;
const LILYA_LOAD_DISTANCE_SQUARED = LILYA_LOAD_DISTANCE * LILYA_LOAD_DISTANCE;
const LILYA_MIN_VIEW_DOT = 0.52;

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR7(options);
  const portrait = installHiddenLilyaPortrait(world);
  const lazyLoadArmed = armViewTriggeredTextureLoad(world, portrait);

  world.name = 'TURN Midnight City r9';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r9',
    hiddenLilyaPortrait: true,
    hiddenLilyaPlacement: 'north road-facing facade of the Neon Quarter building, visible from the reverse approach',
    hiddenLilyaLazyLoad: lazyLoadArmed
      ? 'load only when the camera approaches and looks toward the wall'
      : 'unavailable because the race-road render trigger was not found',
    hiddenLilyaMipmaps: false,
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
  portrait.rotation.y = 0;
  portrait.visible = false;
  portrait.renderOrder = 4;
  portrait.userData.turnEasterEgg = 'hidden-lilya-portrait';
  world.add(portrait);
  return portrait;
}

function armViewTriggeredTextureLoad(world, portrait) {
  const road = world.getObjectByName('Midnight City race road');
  if (!road) {
    console.warn('TURN: Midnight City could not arm the hidden LILYA portrait lazy loader.');
    return false;
  }

  const wallPosition = new THREE.Vector3(LILYA_WALL.x, LILYA_WALL.y, LILYA_WALL.z);
  const cameraPosition = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const cameraToWall = new THREE.Vector3();
  const previousOnBeforeRender = road.onBeforeRender;
  let loadStarted = false;

  function restoreRoadRenderHook() {
    if (road.onBeforeRender === viewTriggeredLoad) {
      road.onBeforeRender = previousOnBeforeRender;
    }
  }

  function viewTriggeredLoad(...args) {
    previousOnBeforeRender?.call(this, ...args);
    if (loadStarted) return;

    const camera = args[2];
    if (!camera?.isCamera) return;

    camera.getWorldPosition(cameraPosition);
    if (cameraPosition.distanceToSquared(wallPosition) > LILYA_LOAD_DISTANCE_SQUARED) return;

    camera.getWorldDirection(cameraForward);
    cameraToWall.copy(wallPosition).sub(cameraPosition).normalize();
    if (cameraForward.dot(cameraToWall) < LILYA_MIN_VIEW_DOT) return;

    loadStarted = true;
    restoreRoadRenderHook();
    loadLilyaTexture(portrait);
  }

  road.onBeforeRender = viewTriggeredLoad;
  portrait.userData.turnLazyTexture = 'camera-proximity-and-view-direction';
  return true;
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
