import * as THREE from 'three';

const NIGHT_TRACK_IDS = new Set(['midnight-city', 'mountain']);
const RIG_NAME = 'TURN shared night spotlight r560';
const TARGET_NAME = 'TURN shared night spotlight target r560';
const LIGHT_NAME = 'TURN shared warm spotlight headlight r560';
const LEGACY_MIDNIGHT_RIG_NAME = 'TURN Midnight City player light rig';
const HEADLIGHT_COLOR = 0xffe3b3;

// One configuration for both night tracks. The 200 m reach is tuned for TURN's
// racing speeds, while the lower target makes the useful part of the cone meet
// flatter/downhill road surfaces sooner. The performance contract stays small:
// one real light, no shadow map, no beam geometry and no extra loop.
export const NIGHT_SPOTLIGHT_CONFIG = Object.freeze({
  color: HEADLIGHT_COLOR,
  intensity: 2200,
  distance: 200,
  angleDegrees: 14,
  penumbra: 0.78,
  decay: 2,
  lightLocal: Object.freeze({ x: 0, y: 1.05, z: -1.65 }),
  targetLocal: Object.freeze({ x: 0, y: -1.5, z: -54 })
});

export function installNightPlayerSpotlight(playerCar, runtime) {
  if (!playerCar) return null;

  removeLegacyMidnightPlayerLighting(playerCar);

  let rig = playerCar.getObjectByName?.(RIG_NAME);
  if (!rig) {
    rig = new THREE.Group();
    rig.name = RIG_NAME;

    const target = new THREE.Object3D();
    target.name = TARGET_NAME;
    target.position.set(
      NIGHT_SPOTLIGHT_CONFIG.targetLocal.x,
      NIGHT_SPOTLIGHT_CONFIG.targetLocal.y,
      NIGHT_SPOTLIGHT_CONFIG.targetLocal.z
    );

    const light = new THREE.SpotLight(
      NIGHT_SPOTLIGHT_CONFIG.color,
      NIGHT_SPOTLIGHT_CONFIG.intensity,
      NIGHT_SPOTLIGHT_CONFIG.distance,
      THREE.MathUtils.degToRad(NIGHT_SPOTLIGHT_CONFIG.angleDegrees),
      NIGHT_SPOTLIGHT_CONFIG.penumbra,
      NIGHT_SPOTLIGHT_CONFIG.decay
    );
    light.name = LIGHT_NAME;
    light.position.set(
      NIGHT_SPOTLIGHT_CONFIG.lightLocal.x,
      NIGHT_SPOTLIGHT_CONFIG.lightLocal.y,
      NIGHT_SPOTLIGHT_CONFIG.lightLocal.z
    );
    light.target = target;
    light.castShadow = false;

    rig.add(light, target);
    playerCar.add(rig);

    rig.userData.turnNightSpotlight = Object.freeze({
      type: 'SpotLight',
      count: 1,
      tracks: Object.freeze([...NIGHT_TRACK_IDS]),
      shadows: false,
      ...NIGHT_SPOTLIGHT_CONFIG
    });
  }

  const syncTrackVisibility = (trackId = runtime?.trackId) => {
    rig.visible = NIGHT_TRACK_IDS.has(trackId);
  };
  syncTrackVisibility();

  if (!rig.userData.turnTrackVisibilityListener) {
    globalThis.addEventListener?.('turn:track-changed', (event) => {
      syncTrackVisibility(event.detail?.trackId);
    });
    rig.userData.turnTrackVisibilityListener = true;
  }

  return rig;
}

function removeLegacyMidnightPlayerLighting(playerCar) {
  const legacyRig = playerCar.getObjectByName?.(LEGACY_MIDNIGHT_RIG_NAME);
  if (!legacyRig) return;

  for (const child of [...legacyRig.children]) {
    legacyRig.remove(child);
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      for (const material of child.material) material?.dispose?.();
    } else {
      child.material?.dispose?.();
    }
  }
  legacyRig.parent?.remove(legacyRig);
}
