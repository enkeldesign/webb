import * as THREE from 'three';

const TRACK_ID = 'mountain';
const RIG_NAME = 'TURN Mountain spotlight headlight r8';
const TARGET_NAME = 'TURN Mountain spotlight target r8';
const LIGHT_NAME = 'TURN Mountain warm spotlight headlight r8';
const HEADLIGHT_COLOR = 0xffe3b3;

// One real, shadowless light rather than projected beam geometry. Because both
// the lamp and its target are children of the player-car transform, TURN's
// existing road pitch/yaw/roll automatically carries the headlight with the car
// on MOUNTAIN's steep grades.
export function installMountainSpotlightHeadlight(playerCar, runtime) {
  if (!playerCar) return null;

  let rig = playerCar.getObjectByName?.(RIG_NAME);
  if (rig) return rig;

  rig = new THREE.Group();
  rig.name = RIG_NAME;

  const target = new THREE.Object3D();
  target.name = TARGET_NAME;
  target.position.set(0, -0.15, -44);

  const light = new THREE.SpotLight(
    HEADLIGHT_COLOR,
    650,
    54,
    THREE.MathUtils.degToRad(14),
    0.78,
    2
  );
  light.name = LIGHT_NAME;
  light.position.set(0, 1.05, -1.65);
  light.target = target;
  light.castShadow = false;

  rig.add(light, target);
  playerCar.add(rig);

  const syncTrackVisibility = (trackId = runtime?.trackId) => {
    rig.visible = trackId === TRACK_ID;
  };
  syncTrackVisibility();

  if (!rig.userData.turnTrackVisibilityListener) {
    globalThis.addEventListener?.('turn:track-changed', (event) => {
      syncTrackVisibility(event.detail?.trackId);
    });
    rig.userData.turnTrackVisibilityListener = true;
  }

  rig.userData.turnTrackVisibility = TRACK_ID;
  rig.userData.turnMountainHeadlight = Object.freeze({
    type: 'SpotLight',
    count: 1,
    shadows: false,
    color: HEADLIGHT_COLOR,
    intensity: light.intensity,
    distance: light.distance,
    angleDegrees: 14,
    penumbra: light.penumbra,
    decay: light.decay,
    targetLocal: Object.freeze({ x: 0, y: -0.15, z: -44 })
  });

  return rig;
}
