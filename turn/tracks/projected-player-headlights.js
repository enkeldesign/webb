import * as THREE from 'three';

const PLAYER_FILL = 0xffe3b3;

/**
 * Shared night-driving headlight treatment first established for MIDNIGHT CITY:
 * one short-range local fill plus two cheap additive road-projection wedges.
 * The wedges are deliberately unlit geometry rather than SpotLights, keeping
 * the visual reach without adding shadow/render cost.
 */
export function populateProjectedHeadlightRig(rig, {
  label = 'Night track',
  projectionName = `${label} projected headlights`
} = {}) {
  if (!rig) return null;

  for (const child of [...rig.children]) {
    rig.remove(child);
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }

  const fill = new THREE.PointLight(PLAYER_FILL, 3.1, 17, 2);
  fill.name = `${label} player visibility fill`;
  fill.position.set(0, 2.55, 0.45);
  fill.castShadow = false;
  rig.add(fill);

  const headlights = new THREE.Group();
  headlights.name = projectionName;
  headlights.add(
    makeHeadlightWedge({
      nearWidth: 3.8,
      farWidth: 17,
      nearZ: -1.7,
      farZ: -38,
      opacity: 0.075
    }),
    makeHeadlightWedge({
      nearWidth: 2.5,
      farWidth: 9.5,
      nearZ: -1.4,
      farZ: -28,
      opacity: 0.14
    })
  );
  rig.add(headlights);
  rig.userData.turnProjectedHeadlights = 'midnight-city-shared-solution';
  return rig;
}

export function installProjectedHeadlightsForTrack(playerCar, {
  trackId,
  rigName,
  label,
  projectionName
} = {}) {
  if (!playerCar || !trackId || !rigName) return null;

  let rig = playerCar.getObjectByName?.(rigName);
  if (!rig) {
    rig = new THREE.Group();
    rig.name = rigName;
    playerCar.add(rig);
  }

  populateProjectedHeadlightRig(rig, { label, projectionName });
  rig.visible = true;
  rig.userData.turnTrackVisibility = trackId;

  if (!rig.userData.turnTrackVisibilityListener) {
    const onTrackChanged = (event) => {
      rig.visible = event.detail?.trackId === trackId;
    };
    globalThis.addEventListener?.('turn:track-changed', onTrackChanged);
    rig.userData.turnTrackVisibilityListener = true;
  }

  return rig;
}

function makeHeadlightWedge({ nearWidth, farWidth, nearZ, farZ, opacity }) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -nearWidth / 2, 0.24, nearZ,
    nearWidth / 2, 0.24, nearZ,
    -farWidth / 2, 0.24, farZ,
    farWidth / 2, 0.24, farZ
  ], 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.computeVertexNormals();

  const beam = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: PLAYER_FILL,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    })
  );
  beam.renderOrder = 5;
  return beam;
}
