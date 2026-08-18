import * as THREE from 'three';

const NIGHT_TRACK_IDS = new Set(['midnight-city', 'mountain']);
const RIG_NAME = 'TURN shared night spotlight r560';
const TARGET_NAME = 'TURN shared night spotlight target r560';
const LIGHT_NAME = 'TURN shared warm spotlight headlight r560';
const LEGACY_MIDNIGHT_RIG_NAME = 'TURN Midnight City player light rig';
const LEGACY_MIDNIGHT_PROJECTION_NAME = 'Midnight City projected headlights';
const LEGACY_MIDNIGHT_FILL_NAME = 'Midnight City player visibility fill';
const HEADLIGHT_COLOR = 0xffe3b3;
const HEADLIGHT_REVISION = 'r175-reconcile';

// One configuration for both night tracks. Keep the performance contract tiny:
// one real shadowless light, no beam geometry, raycasts or extra loop. The r174
// tune adds a little more racing-speed reach and intensity, while moving the
// emitter closer to the car so the beam reads as originating at the bumper.
export const NIGHT_SPOTLIGHT_CONFIG = Object.freeze({
  color: HEADLIGHT_COLOR,
  intensity: 2600,
  distance: 220,
  angleDegrees: 14,
  penumbra: 0.78,
  decay: 2,
  lightLocal: Object.freeze({ x: 0, y: 0.82, z: -0.85 }),
  targetLocal: Object.freeze({ x: 0, y: -1.5, z: -54 })
});

export function installNightPlayerSpotlight(playerCar, runtime) {
  if (!playerCar) return null;

  removeLegacyMidnightPlayerLighting(playerCar);

  let rig = playerCar.getObjectByName?.(RIG_NAME);
  if (!rig) {
    rig = new THREE.Group();
    rig.name = RIG_NAME;
    playerCar.add(rig);
  }

  let target = rig.getObjectByName?.(TARGET_NAME);
  if (!target) {
    target = new THREE.Object3D();
    target.name = TARGET_NAME;
    rig.add(target);
  }

  let light = rig.getObjectByName?.(LIGHT_NAME);
  if (!light?.isSpotLight) {
    if (light) rig.remove(light);
    light = new THREE.SpotLight();
    light.name = LIGHT_NAME;
    rig.add(light);
  }

  // Do not trust an existing named rig to already carry this module revision.
  // MOUNTAIN and MIDNIGHT CITY can arrive through separately cache-busted
  // module graphs, so an older installer may have created the shared object
  // first. Re-applying the canonical configuration here makes activation order
  // and browser module-cache history irrelevant.
  applyNightSpotlightConfig(rig, light, target);

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

function applyNightSpotlightConfig(rig, light, target) {
  target.position.set(
    NIGHT_SPOTLIGHT_CONFIG.targetLocal.x,
    NIGHT_SPOTLIGHT_CONFIG.targetLocal.y,
    NIGHT_SPOTLIGHT_CONFIG.targetLocal.z
  );

  light.color.setHex(NIGHT_SPOTLIGHT_CONFIG.color);
  light.intensity = NIGHT_SPOTLIGHT_CONFIG.intensity;
  light.distance = NIGHT_SPOTLIGHT_CONFIG.distance;
  light.angle = THREE.MathUtils.degToRad(NIGHT_SPOTLIGHT_CONFIG.angleDegrees);
  light.penumbra = NIGHT_SPOTLIGHT_CONFIG.penumbra;
  light.decay = NIGHT_SPOTLIGHT_CONFIG.decay;
  light.position.set(
    NIGHT_SPOTLIGHT_CONFIG.lightLocal.x,
    NIGHT_SPOTLIGHT_CONFIG.lightLocal.y,
    NIGHT_SPOTLIGHT_CONFIG.lightLocal.z
  );
  light.target = target;
  light.castShadow = false;

  // If a stale module graph ever left another SpotLight in the named rig,
  // retain only the canonical one rather than stacking invisible performance
  // cost or letting activation order affect the picture.
  for (const child of [...rig.children]) {
    if (child !== light && child?.isSpotLight) rig.remove(child);
  }

  rig.userData.turnNightSpotlight = Object.freeze({
    type: 'SpotLight',
    revision: HEADLIGHT_REVISION,
    count: 1,
    tracks: Object.freeze([...NIGHT_TRACK_IDS]),
    shadows: false,
    ...NIGHT_SPOTLIGHT_CONFIG
  });
}

function removeLegacyMidnightPlayerLighting(playerCar) {
  const legacyNodes = new Set();
  for (const name of [
    LEGACY_MIDNIGHT_RIG_NAME,
    LEGACY_MIDNIGHT_PROJECTION_NAME,
    LEGACY_MIDNIGHT_FILL_NAME
  ]) {
    const node = playerCar.getObjectByName?.(name);
    if (node) legacyNodes.add(node);
  }

  for (const node of legacyNodes) {
    // If a child is already covered by the legacy rig, removing the rig is
    // sufficient. Otherwise remove the named leftover directly.
    if ([...legacyNodes].some((candidate) => candidate !== node && node.parent === candidate)) continue;
    node.parent?.remove(node);
    disposeObjectTree(node);
  }
}

function disposeObjectTree(root) {
  root.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) {
      for (const material of node.material) material?.dispose?.();
    } else {
      node.material?.dispose?.();
    }
  });
}
