import * as THREE from 'three';

const REVISION = 'r532-countryside-nature-polish';
const INK = 0x08090a;

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function isInk(material) {
  return materialList(material).some((entry) => entry?.color?.getHex?.() === INK);
}

function thinContours(world) {
  world.traverse((node) => {
    if (!node?.isMesh) return;
    if (node.userData?.turnOutline || node.name === 'TURN outline') {
      node.scale.setScalar(1.024);
      return;
    }
    if (
      node.parent?.isMesh
      && isInk(node.material)
      && materialList(node.material).some((material) => material?.side === THREE.BackSide)
    ) {
      node.scale.setScalar(1.024);
    }
  });
}

function lockAuthoredSceneryPalettes(world) {
  world.traverse((node) => {
    if (!node?.isMesh || !node.userData?.turnPaletteLocked) return;
    node.userData.turnZoneTinted = false;
    node.userData.turnCountrysidePalettePolicy = 'authored-palette';
  });
}

export function installTrackIdentity({ world }) {
  if (!world) return;

  // COUNTRYSIDE used to add eight unrelated procedural zone sculptures here: blossom
  // clumps, pines, a gold torus and crystals. The planned world now provides identity
  // through real places instead, so this compatibility layer only maintains TURN's
  // established contour weight and protects the supplied Kenney palettes.
  thinContours(world);
  lockAuthoredSceneryPalettes(world);

  for (const delay of [800, 1900, 3700]) {
    window.setTimeout(() => {
      thinContours(world);
      lockAuthoredSceneryPalettes(world);
    }, delay);
  }

  world.userData.turnCountrysideIdentity = Object.freeze({
    revision: REVISION,
    visualLanguage: 'planned rural districts',
    randomZoneLandmarks: 0,
    globalAssetTinting: false,
    authoredPaletteLock: true
  });
  console.info('TURN: planned Countryside identity loaded.');
}
