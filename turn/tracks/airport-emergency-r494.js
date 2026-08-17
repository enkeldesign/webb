import * as THREE from 'three';
import {
  AIRPORT_EMERGENCY_CONFIG,
  installAirportEmergency as installAirportEmergencyR493
} from './airport-emergency-r493.js?revision=r527-no-finish-sync-wreck';

export { AIRPORT_EMERGENCY_CONFIG };

const AMBULANCE_ID = 'ambulance';
const TERMINAL_NAME = 'TURN International Terminal';
const PREPARED_WRECK_NAME = 'Airport B787 Prepared Wreck';
const MEDICAL_DOOR_NAME = 'Airport MAYDAY medical entrance';

// r492 effectively lowered the wreck by about 4.94 world-Y units: the aircraft-local
// -4.8 Y offset contributes about 4.24 after the 20-degree pitch/roll, plus the mount's
// -0.7 Y. r494 used 2.47, exactly halfway between r493's ground fit and r492. Playtesting
// still showed the fuselage clearly above ground, while r492 was closer but slightly too low.
// Move 78% of the remaining 2.47-unit gap back toward r492:
// 2.47 + (4.94 - 2.47) * 0.78 = 4.3966 -> 4.40 world units.
const WRECK_PENETRATION_Y = 4.40;
const WRECK_FIND_INTERVAL_MS = 120;
const WRECK_FIND_ATTEMPTS = 160;
const MEDICAL_WINDOW_X = 12.5;
const MEDICAL_WINDOW_Y = 8.7;
const MEDICAL_WINDOW_Z = 12.25;

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
    basis: '78 percent of the remaining distance from r494 back toward the r492 wreck depth'
  });
}

function installMedicalEntrance(world) {
  if (world.getObjectByName(MEDICAL_DOOR_NAME)) return;
  const terminal = world.getObjectByName(TERMINAL_NAME);
  if (!terminal) return;

  // The terminal windows are facade overlays rather than holes in the wall. Remove the
  // north-facing window in this exact bay, then put the medical entrance on its centreline
  // so the door genuinely replaces the window instead of floating between two bays.
  const replacedWindow = terminal.children.find((node) => (
    node?.isGroup
    && nearly(node.position?.x, MEDICAL_WINDOW_X)
    && nearly(node.position?.y, MEDICAL_WINDOW_Y)
    && nearly(node.position?.z, MEDICAL_WINDOW_Z)
    && node.children?.length === 2
  ));
  if (replacedWindow) terminal.remove(replacedWindow);

  const entrance = new THREE.Group();
  entrance.name = MEDICAL_DOOR_NAME;
  entrance.userData.turnAirportMedicalEntrance = true;
  entrance.userData.turnReplacesTerminalWindow = true;

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

  entrance.position.set(MEDICAL_WINDOW_X, 0, 12.68);
  terminal.add(entrance);
}

function nearly(value, expected) {
  return Math.abs(Number(value) - expected) < 0.01;
}
