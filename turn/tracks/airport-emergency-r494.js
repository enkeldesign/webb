import * as THREE from 'three';
import {
  AIRPORT_EMERGENCY_CONFIG,
  installAirportEmergency as installAirportEmergencyR493
} from './airport-emergency-r493.js?revision=r493';

export { AIRPORT_EMERGENCY_CONFIG };

const AMBULANCE_ID = 'ambulance';
const TERMINAL_NAME = 'TURN International Terminal';
const PREPARED_WRECK_NAME = 'Airport B787 Prepared Wreck';
const MEDICAL_DOOR_NAME = 'Airport MAYDAY medical entrance';

// r492 intentionally pushed the live B787 down by 4.8 local units while its mount sat
// another 0.7 units low. With the wreck pitched and rolled 20 degrees, that 4.8-unit
// local-Y move contributed about 4.24 world-Y units (4.8 * cos20 * cos20), for an
// effective deliberate sink of about 4.94 units. r493 removed all penetration and
// ground-fit the lowest geometry. Split those two playtest extremes: lower the fitted
// wreck by half the old effective sink, 2.47 world units.
const WRECK_PENETRATION_Y = 2.47;
const WRECK_FIND_INTERVAL_MS = 120;
const WRECK_FIND_ATTEMPTS = 160;

export function installAirportEmergency(options = {}) {
  const runtime = options.runtime || globalThis.__turnRuntime;
  const world = options.world;
  const audioRuntime = makeScreenRelativeRuntime(runtime);

  const installation = installAirportEmergencyR493({
    ...options,
    runtime: audioRuntime
  });

  if (world) {
    installMedicalEntrance(world);
    installWreckPenetration(world, runtime);
  }

  return installation;
}

function makeScreenRelativeRuntime(runtime) {
  if (!runtime) return runtime;

  const view = Object.create(runtime);
  const cameraRight = new THREE.Vector3();
  const fallbackRight = new THREE.Vector3();

  Object.defineProperty(view, 'getRight', {
    configurable: true,
    value() {
      // Web Audio pan must describe the source relative to what the player actually sees.
      // TURN's physics getRight() has the opposite handedness from camera screen-right:
      // when the camera looks along +Z, screen-right is -X. Use camera local +X so the
      // channel assignment also remains correct through camera follow lag and drifting.
      const camera = runtime.camera;
      if (camera?.quaternion) {
        cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        cameraRight.y = 0;
        if (cameraRight.lengthSq() > 0.000001) return cameraRight.normalize();
      }

      const physicsRight = runtime.getRight?.();
      if (physicsRight) {
        fallbackRight.set(
          -Number(physicsRight.x || 0),
          0,
          -Number(physicsRight.z || 0)
        );
        if (fallbackRight.lengthSq() > 0.000001) return fallbackRight.normalize();
      }

      return fallbackRight.set(-1, 0, 0);
    }
  });

  return view;
}

function installWreckPenetration(world, runtime) {
  if (world.userData.turnMaydayR494WreckPenetration) return;

  let timer = 0;
  let attempts = 0;
  let applied = false;

  const tryApply = () => {
    timer = 0;
    if (applied) return;

    const wreck = world.getObjectByName(PREPARED_WRECK_NAME);
    const mount = wreck?.parent;
    if (wreck && mount && !mount.userData.turnMaydayR494DepthApplied) {
      mount.position.y -= WRECK_PENETRATION_Y;
      mount.userData.turnMaydayR494DepthApplied = true;
      world.updateMatrixWorld(true);
      applied = true;
      return;
    }

    attempts += 1;
    if (
      attempts < WRECK_FIND_ATTEMPTS
      && String(runtime?.state?.vehicleId || '').toLowerCase() === AMBULANCE_ID
    ) {
      timer = globalThis.setTimeout(tryApply, WRECK_FIND_INTERVAL_MS);
    }
  };

  const arm = () => {
    if (applied || timer) return;
    if (String(runtime?.state?.vehicleId || '').toLowerCase() !== AMBULANCE_ID) return;
    attempts = 0;
    timer = globalThis.setTimeout(tryApply, 0);
  };

  globalThis.addEventListener?.('turn:ui-state-change', arm);
  globalThis.addEventListener?.('turn:track-changed', arm);
  arm();

  world.userData.turnMaydayR494WreckPenetration = Object.freeze({
    amount: WRECK_PENETRATION_Y,
    basis: 'half of the r492 effective hard-coded vertical sink after 20-degree pitch/roll'
  });
}

function installMedicalEntrance(world) {
  if (world.getObjectByName(MEDICAL_DOOR_NAME)) return;
  const terminal = world.getObjectByName(TERMINAL_NAME);
  if (!terminal) return;

  const entrance = new THREE.Group();
  entrance.name = MEDICAL_DOOR_NAME;
  entrance.userData.turnAirportMedicalEntrance = true;

  const ink = new THREE.MeshBasicMaterial({ color: 0x08090a, toneMapped: false });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.88 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x39434d, roughness: 0.76 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x55c7df, roughness: 0.34, metalness: 0.04 });
  const red = new THREE.MeshBasicMaterial({ color: 0xd92d20, toneMapped: false });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.8, 7.4, 0.72), ink);
  frame.position.y = 3.7;
  entrance.add(frame);

  const surround = new THREE.Mesh(new THREE.BoxGeometry(6.25, 6.85, 0.82), cream);
  surround.position.set(0, 3.7, 0.08);
  entrance.add(surround);

  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.72, 6.25, 0.44), dark);
    leaf.position.set(side * 1.47, 3.45, 0.58);
    entrance.add(leaf);

    const windowPane = new THREE.Mesh(new THREE.BoxGeometry(2.08, 2.18, 0.16), glass);
    windowPane.position.set(side * 1.47, 4.72, 0.86);
    entrance.add(windowPane);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.18), red);
    handle.position.set(side * 0.36, 2.72, 0.91);
    entrance.add(handle);
  }

  const threshold = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.28, 1.35), red);
  threshold.position.set(0, 0.18, 0.48);
  entrance.add(threshold);

  entrance.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = true;
  });

  // The H occupies the central north-facing window. Put the entrance immediately to
  // its right, toward the responder Ambulance, replacing the adjacent window visually.
  entrance.position.set(9.2, 0, 12.68);
  terminal.add(entrance);
}
