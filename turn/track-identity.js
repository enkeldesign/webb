
const REVISION = 'r532-countryside-nature-polish';


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
  // through real places instead, so this compatibility layer only protects the
  // supplied Kenney palettes.

  lockAuthoredSceneryPalettes(world);

  for (const delay of [800, 1900, 3700]) {
    window.setTimeout(() => {

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
