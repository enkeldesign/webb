const PLAYER_FACING_POSITION = Object.freeze({ x: 217.35, y: 14.4, z: 237.55 });
const PLAYER_FACING_ROTATION_Y = Math.PI * 0.675;

export function installHarborHiddenFaceOrientation() {
  const orientFace = (trackId = globalThis.__turnRuntime?.trackId) => {
    if (trackId !== 'harbor') return false;

    const face = globalThis.__turnRuntime?.activeWorld?.children?.find(
      (node) => node?.userData?.turnEasterEgg === 'hidden-silo-face'
    );
    if (!face) return false;

    face.position.set(
      PLAYER_FACING_POSITION.x,
      PLAYER_FACING_POSITION.y,
      PLAYER_FACING_POSITION.z
    );
    face.rotation.y = PLAYER_FACING_ROTATION_Y;
    face.userData.turnEasterEggOrientation = 'faces-player-approach-opposite-side';
    return true;
  };

  window.addEventListener('turn:track-changed', (event) => {
    orientFace(event.detail?.trackId);
  });
  orientFace();
}
