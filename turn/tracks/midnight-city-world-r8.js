import * as THREE from 'three';
import { installMidnightCityWorld as installMidnightCityWorldR7 } from './midnight-city-world-r7.js?base=20260801-r7';

const LILYA_TEXTURE_URL = new URL('../LILYA.PNG', import.meta.url).href;
const LILYA_WALL = Object.freeze({
  x: -495.42,
  y: 29.8,
  z: 113.29,
  maxWidth: 44,
  maxHeight: 48
});

export function installMidnightCityWorld(options) {
  const world = installMidnightCityWorldR7(options);
  installHiddenLilyaPortrait(world);

  world.name = 'TURN Midnight City r8';
  world.userData.turnMidnightCityArtDirection = Object.freeze({
    ...(world.userData.turnMidnightCityArtDirection || {}),
    version: 'r8',
    hiddenLilyaPortrait: true,
    hiddenLilyaPlacement: 'west face of the Neon Quarter building, visible from the reverse approach',
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
    toneMapped: false
  });
  const portrait = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  portrait.name = 'Midnight City hidden LILYA portrait';
  portrait.position.set(LILYA_WALL.x, LILYA_WALL.y, LILYA_WALL.z);
  portrait.rotation.y = -Math.PI / 2;
  portrait.visible = false;
  portrait.renderOrder = 3;
  portrait.userData.turnEasterEgg = 'hidden-lilya-portrait';
  world.add(portrait);

  new THREE.TextureLoader().load(
    LILYA_TEXTURE_URL,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
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

      material.map = texture;
      material.needsUpdate = true;
      portrait.scale.set(width, height, 1);
      portrait.visible = true;
    },
    undefined,
    (error) => {
      console.warn('TURN: Midnight City could not load the hidden LILYA portrait.', error);
    }
  );

  return portrait;
}
