import * as THREE from 'three';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r157-hidden-achievements';

const PLAYER_FACING_POSITION = Object.freeze({ x: 217.35, y: 14.4, z: 237.55 });
const PLAYER_FACING_ROTATION_Y = Math.PI * 0.675;
const DISCOVERY_DISTANCE = 115;
const DISCOVERY_DISTANCE_SQUARED = DISCOVERY_DISTANCE * DISCOVERY_DISTANCE;
const DISCOVERY_VIEW_DOT = 0.72;
const DISCOVERY_HOLD_MS = 550;

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
    armDarvidDiscovery(face);
    return true;
  };

  window.addEventListener('turn:track-changed', (event) => {
    orientFace(event.detail?.trackId);
  });
  orientFace();
}

function armDarvidDiscovery(face) {
  if (face.userData.turnDarvidDiscoveryArmed || face.userData.turnSecretAchievementFound) return;
  face.userData.turnDarvidDiscoveryArmed = true;

  const facePosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const cameraToFace = new THREE.Vector3();
  const previousOnBeforeRender = face.onBeforeRender;
  let discoveryStartedAt = null;

  face.onBeforeRender = function discoverDarvid(...args) {
    previousOnBeforeRender?.call(this, ...args);
    if (face.userData.turnSecretAchievementFound) return;

    const runtime = globalThis.__turnRuntime;
    const camera = args[2];
    if (runtime?.state?.running !== true || runtime?.trackId !== 'harbor' || !camera?.isCamera) {
      discoveryStartedAt = null;
      return;
    }

    face.getWorldPosition(facePosition);
    camera.getWorldPosition(cameraPosition);
    if (cameraPosition.distanceToSquared(facePosition) > DISCOVERY_DISTANCE_SQUARED) {
      discoveryStartedAt = null;
      return;
    }

    camera.getWorldDirection(cameraForward);
    cameraToFace.copy(facePosition).sub(cameraPosition).normalize();
    if (cameraForward.dot(cameraToFace) < DISCOVERY_VIEW_DOT) {
      discoveryStartedAt = null;
      return;
    }

    const now = globalThis.performance?.now?.() ?? Date.now();
    if (discoveryStartedAt == null) {
      discoveryStartedAt = now;
      return;
    }
    if (now - discoveryStartedAt < DISCOVERY_HOLD_MS) return;

    face.userData.turnSecretAchievementFound = true;
    face.onBeforeRender = previousOnBeforeRender;
    signalSecretAchievement('find-darvid', {
      trackId: 'harbor',
      vehicleId: runtime.state.vehicleId || ''
    });
  };
}
