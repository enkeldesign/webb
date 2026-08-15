import * as THREE from 'three';
import {
  createCarVisual,
  preloadCarModels
} from '../vehicle/car-models.js?build=20260720-r19';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r174-bella-siren-zone';
import {
  prepareMaydayAudio,
  playMaydayCrashSound,
  updateMaydayFire,
  updateMaydayResponderSiren,
  muteMaydayGuides
} from '../audio/mayday-audio-r493.js?revision=r493';

const AIRPORT_TRACK_ID = 'airport';
const AMBULANCE_ID = 'ambulance';
const TRANSFER_LIMIT_MS = 30_000;
const PICKUP_RADIUS = 24;
const MEDICAL_RADIUS = 42;
const PICKUP_RADIUS_SQUARED = PICKUP_RADIUS * PICKUP_RADIUS;
const MEDICAL_RADIUS_SQUARED = MEDICAL_RADIUS * MEDICAL_RADIUS;
const CRASH_REFERENCE = Object.freeze({ x: 192, z: 70 });
const CRASH_OUTSIDE_REFERENCE = Object.freeze({ x: 235, z: 108 });
const TERMINAL_NAME = 'TURN International Terminal';
const OVERFLIGHT_NAME = 'Airport B787 Overflight';
const PREPARED_WRECK_NAME = 'Airport B787 Prepared Wreck';
const OVERFLIGHT_TARGET_LENGTH = 22;
const WRECK_TARGET_LENGTH = 62;
const WRECK_SCALE = WRECK_TARGET_LENGTH / OVERFLIGHT_TARGET_LENGTH;
const WRECK_GROUND_Y = 0.12;
const MAP_STYLE_ID = 'turn-airport-emergency-map-style-r493';
const MAP_MARKER_ID = 'turn-airport-emergency-map-marker';
const MAYDAY_INFO_ID = 'turn-mayday-info-plate';

export const AIRPORT_EMERGENCY_CONFIG = Object.freeze({
  trackId: AIRPORT_TRACK_ID,
  vehicleId: AMBULANCE_ID,
  transferLimitMs: TRANSFER_LIMIT_MS,
  pickupRadius: PICKUP_RADIUS,
  medicalRadius: MEDICAL_RADIUS,
  wreckTargetLength: WRECK_TARGET_LENGTH
});

const session = {
  crashActive: false,
  resolved: false,
  phase: 'idle',
  transferStartedAt: 0,
  transferDeadline: 0,
  crashAircraftMounted: false,
  nextAircraftCheckAt: 0
};

let installation = null;

export function qualifiesForAirportCrash(detail, {
  trackId = '',
  vehicleId = '',
  crashActive = false
} = {}) {
  return crashActive !== true
    && trackId === AIRPORT_TRACK_ID
    && vehicleId === AMBULANCE_ID
    && detail?.valid === true
    && Number.isFinite(Number(detail?.time))
    && Number(detail.time) > 5;
}

export function installAirportEmergency({ world, samples, runtime = globalThis.__turnRuntime } = {}) {
  if (installation) return installation;
  if (!world || !Array.isArray(samples) || !samples.length || !runtime?.state) return null;

  const placement = emergencyPlacement(world, samples);
  installMaydayUiStyle();
  installMedicalSign(world, placement);
  maydayInfoPlate();
  prepareMaydayAudio();

  const {
    scene: crashScene,
    aircraftMount,
    fireRecords
  } = makeCrashScene();
  crashScene.position.copy(placement.crashPoint);
  crashScene.rotation.y = placement.crashYaw;
  crashScene.visible = false;
  world.add(crashScene);

  const mapMarker = installMapMarker(samples);
  let respondersPromise = null;
  let responderVisuals = [];
  let renderWarmPromise = null;
  let crashRevealTimer = 0;
  let wreckPrepareTimer = 0;
  let wreckAircraft = null;
  let overflightAircraft = null;

  function activeTrackId() {
    return runtime.state.trackId || globalThis.__turnGetTrackId?.() || '';
  }

  function playerPosition() {
    return runtime.state.position || runtime.playerCar?.position || null;
  }

  function syncMapMarker() {
    if (!mapMarker) return;
    if (activeTrackId() !== AIRPORT_TRACK_ID || !session.crashActive || session.resolved) {
      mapMarker.hide();
      return;
    }
    mapMarker.show(
      session.phase === 'transport' ? placement.medicalPoint : placement.crashPoint,
      session.phase === 'transport' ? 'medical' : 'crash'
    );
  }

  function syncResponders() {
    for (const responder of responderVisuals) responder.visual.visible = session.crashActive;
  }

  function prepareResponders() {
    if (respondersPromise) return respondersPromise;
    respondersPromise = preloadCarModels(['firetruck', 'ambulance'])
      .then(() => Promise.all([
        makeResponder({
          carId: 'firetruck',
          color: '#d92d20',
          secondaryColor: '#ffcc00',
          name: 'Airport MAYDAY medical fire truck',
          position: placement.firetruckPoint,
          yaw: placement.responderYaw
        }),
        makeResponder({
          carId: 'ambulance',
          color: '#f8f9fa',
          secondaryColor: '#d92d20',
          name: 'Airport MAYDAY medical ambulance',
          position: placement.ambulancePoint,
          yaw: placement.responderYaw
        })
      ]))
      .then((records) => {
        responderVisuals = records.filter(Boolean);
        for (const responder of responderVisuals) {
          responder.visual.visible = session.crashActive;
          world.add(responder.visual);
        }
        syncResponders();
        void precompileEmergencyVisuals();
        return responderVisuals;
      })
      .catch((error) => {
        console.info('TURN: MAYDAY medical responders unavailable; the medical bay and audible guide remain active.', error);
        responderVisuals = [];
        return responderVisuals;
      });
    return respondersPromise;
  }

  function prepareWreckAircraft(now = performance.now()) {
    if (wreckAircraft) return true;
    if (now < session.nextAircraftCheckAt) return false;
    session.nextAircraftCheckAt = now + 250;

    const aircraft = world.getObjectByName(OVERFLIGHT_NAME);
    if (!aircraft) return false;
    overflightAircraft = aircraft;

    // Clone and scale the already-loaded overflight before the lap finishes. The old
    // implementation reparented/scaled the live B787 after the finish event, which was
    // still capable of producing an iOS main-thread hitch even after a 120 ms delay.
    wreckAircraft = aircraft.clone(true);
    wreckAircraft.name = PREPARED_WRECK_NAME;
    wreckAircraft.position.set(0, 0, 0);
    wreckAircraft.scale.multiplyScalar(WRECK_SCALE);
    wreckAircraft.visible = false;
    aircraftMount.add(wreckAircraft);

    // Fit the tilted wreck to the actual ground plane instead of using a hard-coded
    // negative Y offset. This keeps the lowest geometry at ground level and prevents
    // the fuselage from disappearing into the apron.
    crashScene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(wreckAircraft);
    if (Number.isFinite(bounds.min.y)) {
      aircraftMount.position.y += WRECK_GROUND_Y - bounds.min.y;
      crashScene.updateMatrixWorld(true);
    }

    session.crashAircraftMounted = true;
    if (session.crashActive && crashScene.visible) {
      overflightAircraft.visible = false;
      wreckAircraft.visible = true;
    }
    void precompileEmergencyVisuals();
    return true;
  }

  function startWreckPrewarm() {
    if (wreckAircraft || wreckPrepareTimer || runtime.state.vehicleId !== AMBULANCE_ID) return;
    const attempt = () => {
      wreckPrepareTimer = 0;
      if (prepareWreckAircraft()) return;
      if (!session.crashActive) wreckPrepareTimer = globalThis.setTimeout(attempt, 250);
    };
    wreckPrepareTimer = globalThis.setTimeout(attempt, 0);
  }

  function precompileEmergencyVisuals() {
    if (renderWarmPromise) return renderWarmPromise;
    const renderer = runtime.renderer;
    const camera = runtime.camera;
    if (
      typeof renderer?.compileAsync !== 'function'
      || !camera
      || !wreckAircraft
      || responderVisuals.length === 0
    ) return Promise.resolve(false);

    const staging = new THREE.Scene();
    const crashClone = crashScene.clone(true);
    crashClone.visible = true;
    const stagedWreck = crashClone.getObjectByName(PREPARED_WRECK_NAME);
    if (stagedWreck) stagedWreck.visible = true;
    staging.add(crashClone);
    for (const responder of responderVisuals) {
      const clone = responder.visual.clone(true);
      clone.visible = true;
      staging.add(clone);
    }

    renderWarmPromise = renderer.compileAsync(staging, camera)
      .then(() => true)
      .catch(() => false);
    return renderWarmPromise;
  }

  function startEmergencyPrewarm() {
    if (runtime.state.vehicleId !== AMBULANCE_ID) return;
    globalThis.setTimeout(() => {
      void prepareResponders();
      startWreckPrewarm();
    }, 0);
  }

  function revealCrashVisuals() {
    crashRevealTimer = 0;
    crashScene.visible = true;
    if (!wreckAircraft) prepareWreckAircraft(0);
    if (wreckAircraft) wreckAircraft.visible = true;
    if (overflightAircraft) overflightAircraft.visible = false;
    syncResponders();
  }

  function triggerCrash() {
    if (session.crashActive) return;

    // At the finish line we now only start audio, flip small state/DOM flags and schedule
    // a visibility change. The B787 clone, scale, ground fit, responder GLTFs and shaders
    // are all prepared during the first lap.
    playMaydayCrashSound();

    session.crashActive = true;
    session.resolved = false;
    session.phase = 'waiting';
    session.transferStartedAt = 0;
    session.transferDeadline = 0;
    syncMapMarker();
    showMessage('MAYDAY · AIRPORT CRASH REPORTED', 2400);
    publishState('crash');

    if (respondersPromise) void respondersPromise.then(syncResponders);
    else globalThis.setTimeout(() => void prepareResponders(), 500);

    globalThis.clearTimeout(crashRevealTimer);
    crashRevealTimer = globalThis.setTimeout(revealCrashVisuals, 120);
  }

  function beginTransfer(now) {
    session.phase = 'transport';
    session.transferStartedAt = now;
    session.transferDeadline = now + TRANSFER_LIMIT_MS;
    syncMapMarker();
    globalThis.__turnAudio?.cue?.('ui-confirm');
    showMessage('PATIENT ON BOARD · MEDICAL BAY · 30 SECONDS', 2800);
    publishState('pickup');
  }

  function failTransfer() {
    session.phase = 'waiting';
    session.transferStartedAt = 0;
    session.transferDeadline = 0;
    syncMapMarker();
    globalThis.__turnAudio?.cue?.('ui-back');
    showMessage('TRANSFER MISSED · RETURN TO THE CRASH', 2300);
    publishState('retry');
  }

  function completeTransfer(now) {
    const transferSeconds = Math.max(0, (now - session.transferStartedAt) / 1000);
    session.phase = 'resolved';
    session.resolved = true;
    session.transferDeadline = 0;
    syncMapMarker();
    muteMaydayGuides();
    globalThis.__turnAudio?.cue?.('ui-confirm');
    showMessage('PATIENT DELIVERED · MAYDAY!', 2100);
    signalSecretAchievement('golden-hour', {
      trackId: AIRPORT_TRACK_ID,
      vehicleId: AMBULANCE_ID,
      time: transferSeconds,
      rescueConfirmed: true
    });
    publishState('resolved');
  }

  function updateAudibleGuide(position) {
    if (session.phase === 'waiting') {
      const distance = Math.sqrt(horizontalDistanceSquared(position, placement.crashPoint));
      updateMaydayFire({
        active: true,
        pan: positionalPan(runtime, position, placement.crashPoint),
        intensity: THREE.MathUtils.clamp(1 - distance / 300, 0.3, 1)
      });
      updateMaydayResponderSiren({ active: false });
      return;
    }

    if (session.phase === 'transport') {
      const distance = Math.sqrt(horizontalDistanceSquared(position, placement.medicalPoint));
      updateMaydayFire({ active: false });
      updateMaydayResponderSiren({
        active: true,
        pan: positionalPan(runtime, position, placement.medicalPoint),
        intensity: THREE.MathUtils.clamp(1 - distance / 320, 0.35, 1)
      });
      return;
    }

    muteMaydayGuides();
  }

  function isInsideMedicalBay(position) {
    return horizontalDistanceSquared(position, placement.medicalPoint) <= MEDICAL_RADIUS_SQUARED;
  }

  function updateEmergencyFrame() {
    if (!session.crashActive) {
      muteMaydayGuides();
      return;
    }
    const now = performance.now();
    if (crashScene.visible) updateFire(fireRecords, now);

    if (session.phase === 'transport' && now > session.transferDeadline) {
      failTransfer();
      return;
    }

    const state = runtime.state;
    if (activeTrackId() !== AIRPORT_TRACK_ID || state.running !== true) {
      muteMaydayGuides();
      return;
    }
    const position = playerPosition();
    if (!position) {
      muteMaydayGuides();
      return;
    }

    updateAudibleGuide(position);

    if (session.phase === 'waiting') {
      const sirenActive = state.vehicleId === AMBULANCE_ID && globalThis.__turnBoostActive === true;
      if (!sirenActive || horizontalDistanceSquared(position, placement.crashPoint) > PICKUP_RADIUS_SQUARED) return;
      beginTransfer(now);
      return;
    }

    if (
      session.phase === 'transport'
      && state.vehicleId === AMBULANCE_ID
      && isInsideMedicalBay(position)
    ) {
      completeTransfer(now);
    }
  }

  // Scene-level rendering keeps the continuous guide audio and trigger checks alive
  // even when the crash site itself is outside the camera frustum.
  const renderScene = runtime.scene || world.parent;
  const previousSceneBeforeRender = renderScene?.onBeforeRender;
  if (renderScene) {
    renderScene.onBeforeRender = function airportEmergencyFrame(...args) {
      previousSceneBeforeRender?.call(this, ...args);
      updateEmergencyFrame();
    };
  }

  const onLapResult = (event) => {
    if (!qualifiesForAirportCrash(event.detail, {
      trackId: activeTrackId(),
      vehicleId: runtime.state.vehicleId,
      crashActive: session.crashActive
    })) return;
    triggerCrash();
  };

  const onUiState = () => {
    if (!session.crashActive && runtime.state.vehicleId === AMBULANCE_ID) startEmergencyPrewarm();
    syncMapMarker();
    syncResponders();
  };

  globalThis.addEventListener?.('turn:lap-result', onLapResult);
  globalThis.addEventListener?.('turn:track-changed', onUiState);
  globalThis.addEventListener?.('turn:ui-state-change', onUiState);

  world.userData.turnAirportEmergency = Object.freeze({
    achievementId: 'golden-hour',
    achievementTitle: 'MAYDAY!',
    requiredVehicle: AMBULANCE_ID,
    transferSeconds: TRANSFER_LIMIT_MS / 1000,
    crashPoint: placement.crashPoint.clone(),
    medicalPoint: placement.medicalPoint.clone(),
    sessionPersistent: true,
    clearsOnPageReload: true,
    realAircraftWreck: 'prepares a hidden clone of the Airport B787 overflight before the finish line, then swaps visibility at the crash',
    medicalResponders: 'prewarmed Fire Truck and Ambulance with flashing lights',
    audibleGuidance: 'continuous fire at the crash trigger and the canonical Fire Truck siren voice at the Ambulance-centred medical trigger'
  });

  installation = Object.freeze({
    getState() {
      return Object.freeze({
        crashActive: session.crashActive,
        resolved: session.resolved,
        phase: session.phase,
        transferDeadline: session.transferDeadline,
        crashAircraftMounted: session.crashAircraftMounted
      });
    },
    triggerCrash,
    crashPoint: placement.crashPoint.clone(),
    medicalPoint: placement.medicalPoint.clone()
  });
  globalThis.__turnAirportEmergency = installation;

  startEmergencyPrewarm();
  syncMapMarker();
  return installation;
}

async function makeResponder({ carId, color, secondaryColor, name, position, yaw }) {
  const visual = await createCarVisual({
    carId,
    color,
    secondaryColor,
    targetLength: 8.4,
    outline: true
  });
  visual.name = name;
  visual.position.copy(position);
  visual.rotation.y = yaw;
  visual.visible = false;
  visual.traverse((node) => {
    if (node.isMesh) node.castShadow = false;
  });
  installResponderLightOverride(visual);
  return { service: carId, visual };
}

function emergencyPlacement(world, samples) {
  const crashSample = nearestSample(samples, CRASH_REFERENCE.x, CRASH_REFERENCE.z);
  const sideA = crashSample.point.clone().addScaledVector(crashSample.normal, 34);
  const sideB = crashSample.point.clone().addScaledVector(crashSample.normal, -34);
  const outside = new THREE.Vector3(CRASH_OUTSIDE_REFERENCE.x, 0, CRASH_OUTSIDE_REFERENCE.z);
  const crashPoint = sideA.distanceToSquared(outside) <= sideB.distanceToSquared(outside) ? sideA : sideB;
  crashPoint.y = 0.3;

  const terminal = world.getObjectByName(TERMINAL_NAME) || null;
  let firetruckPoint = new THREE.Vector3(-74, 0.2, -35);
  let ambulancePoint = new THREE.Vector3(-42, 0.2, -35);
  let responderYaw = Math.PI / 2;

  if (terminal) {
    terminal.updateMatrixWorld(true);
    firetruckPoint = terminal.localToWorld(new THREE.Vector3(-16, 0.2, 28));
    ambulancePoint = terminal.localToWorld(new THREE.Vector3(16, 0.2, 28));
    const centre = terminal.localToWorld(new THREE.Vector3(0, 0.2, 28));
    const localForward = terminal.localToWorld(new THREE.Vector3(0, 0.2, 38));
    responderYaw = Math.atan2(
      localForward.x - centre.x,
      localForward.z - centre.z
    ) + Math.PI / 2;
  }

  const medicalPoint = ambulancePoint.clone();
  medicalPoint.y = 0.3;

  return {
    terminal,
    crashPoint,
    medicalPoint,
    firetruckPoint,
    ambulancePoint,
    responderYaw,
    crashYaw: Math.atan2(crashSample.tangent.x, crashSample.tangent.z) + 0.62
  };
}

function nearestSample(samples, x, z) {
  let nearest = samples[0];
  let best = Infinity;
  for (const sample of samples) {
    const dx = sample.point.x - x;
    const dz = sample.point.z - z;
    const distance = dx * dx + dz * dz;
    if (distance >= best) continue;
    best = distance;
    nearest = sample;
  }
  return nearest;
}

function horizontalDistanceSquared(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dz = Number(a.z) - Number(b.z);
  return dx * dx + dz * dz;
}

function positionalPan(runtime, listenerPosition, sourcePosition) {
  const dx = Number(sourcePosition.x) - Number(listenerPosition.x);
  const dz = Number(sourcePosition.z) - Number(listenerPosition.z);
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const right = runtime?.getRight?.();
  if (right) {
    return THREE.MathUtils.clamp(
      (dx / length) * Number(right.x || 0) + (dz / length) * Number(right.z || 0),
      -0.96,
      0.96
    );
  }
  const heading = Number(runtime?.state?.heading) || 0;
  return THREE.MathUtils.clamp(
    (dx / length) * Math.cos(heading) - (dz / length) * Math.sin(heading),
    -0.96,
    0.96
  );
}

function installMedicalSign(world, placement) {
  const sign = makeMedicalSign();
  if (placement.terminal) {
    sign.position.set(0, 8.7, 12.72);
    placement.terminal.add(sign);
    return sign;
  }
  sign.position.copy(placement.medicalPoint).setY(8.7);
  world.add(sign);
  return sign;
}

function makeMedicalSign() {
  const sign = new THREE.Group();
  sign.name = 'Airport terminal medical H';
  sign.userData.turnAirportMedical = true;

  const panel = outlinedPrimitive(
    new THREE.BoxGeometry(10.4, 6.4, 0.65),
    new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.86 }),
    1.045
  );
  sign.add(panel);

  const red = new THREE.MeshBasicMaterial({ color: 0xd92d20, toneMapped: false });
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.3, 5.0, 0.3), red);
  const right = left.clone();
  const middle = new THREE.Mesh(new THREE.BoxGeometry(4.9, 1.25, 0.3), red);
  left.position.set(-1.8, 0, 0.49);
  right.position.set(1.8, 0, 0.49);
  middle.position.set(0, 0, 0.49);
  sign.add(left, right, middle);
  return sign;
}

function makeCrashScene() {
  const root = new THREE.Group();
  root.name = 'Airport MAYDAY crash site';
  root.userData.turnAirportCrashSite = true;

  const aircraftMount = new THREE.Group();
  aircraftMount.name = 'Airport B787 wreck mount';
  aircraftMount.position.y = 0;
  aircraftMount.rotation.x = THREE.MathUtils.degToRad(-20);
  aircraftMount.rotation.y = Math.PI;
  aircraftMount.rotation.z = THREE.MathUtils.degToRad(20);
  root.add(aircraftMount);

  const dark = new THREE.MeshStandardMaterial({ color: 0x34383d, roughness: 0.94 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x737b82, roughness: 0.98 });
  const debris = [
    [-13, 0.7, -8, 5.2, 2.3, 0.35],
    [-8, 0.6, 7, 4.2, 2.6, -0.6],
    [-2, 0.8, -10, 6.1, 2.4, 0.9],
    [5, 0.6, 9, 4.7, 2.7, -0.25],
    [10, 0.75, -6, 5.8, 2.2, 0.5],
    [14, 0.65, 4, 4.4, 3.0, -0.8],
    [-16, 0.55, 2, 3.9, 2.8, 0.15],
    [1, 0.55, 13, 4.8, 2.4, 0.72]
  ];
  for (const [x, y, z, width, depth, rotation] of debris) {
    const chunk = outlinedPrimitive(
      new THREE.BoxGeometry(width, 1.0, depth),
      Math.abs(rotation) > 0.5 ? concrete : dark,
      1.04
    );
    chunk.position.set(x, y, z);
    chunk.rotation.set(0.16, rotation, 0.18);
    root.add(chunk);
  }

  const fireGroup = new THREE.Group();
  fireGroup.name = 'Airport MAYDAY fire';
  fireGroup.position.set(3.2, 0.8, 1.2);
  root.add(fireGroup);

  const ember = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.6, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff5c22,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  ember.scale.set(1.25, 0.55, 1.0);
  ember.position.y = 1.1;
  fireGroup.add(ember);

  const tongueSpecs = [
    [2.8, 11.8, -0.4, 0.1, -1.1, 0.25, 0xd92d20, 0.86],
    [2.2, 9.4, 1.8, -0.6, 0.8, -0.35, 0xff6b22, 0.92],
    [1.9, 8.0, -2.0, 0.8, -0.5, 0.55, 0xff922b, 0.96],
    [1.45, 6.8, 0.25, 1.9, 0.35, 0.2, 0xffcc00, 0.98],
    [1.2, 5.5, 0.7, -1.8, -0.25, -0.35, 0xffe066, 0.98]
  ];
  const fireRecords = [];
  tongueSpecs.forEach(([radius, height, x, z, bendX, bendZ, color, opacity], index) => {
    const tongue = makeFlameTongue(radius, height, bendX, bendZ, color, opacity);
    tongue.position.set(x, height * 0.48, z);
    tongue.rotation.y = index * 0.73;
    fireGroup.add(tongue);
    fireRecords.push({
      mesh: tongue,
      baseX: tongue.scale.x,
      baseY: tongue.scale.y,
      phase: index * 1.17
    });
  });

  const smokeGeometry = new THREE.DodecahedronGeometry(2.5, 0);
  const smokeMaterials = [0x34383d, 0x46515b, 0x59636f, 0x69737d].map((color, index) => (
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.78 - index * 0.08,
      depthWrite: false
    })
  ));
  const smoke = [
    [2.8, 10, 1.2, 1.5],
    [1.0, 15, 1.8, 2.0],
    [3.8, 20, 0.5, 2.4],
    [0.2, 26, 2.2, 2.8],
    [4.5, 32, 1.0, 3.2],
    [1.2, 39, 2.8, 3.6],
    [5.6, 47, 1.4, 4.0],
    [2.2, 56, 3.1, 4.5],
    [7.0, 65, 2.0, 4.9]
  ];
  smoke.forEach(([x, y, z, scale], index) => {
    const cloud = new THREE.Mesh(smokeGeometry, smokeMaterials[index % smokeMaterials.length]);
    cloud.position.set(x, y, z);
    cloud.scale.set(scale, scale * 0.92, scale);
    root.add(cloud);
  });

  return {
    scene: root,
    aircraftMount,
    fireRecords
  };
}

function makeFlameTongue(radius, height, bendX, bendZ, color, opacity) {
  const geometry = new THREE.ConeGeometry(radius, height, 7, 3, false);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    const t = THREE.MathUtils.clamp((y + height / 2) / height, 0, 1);
    const bend = t * t;
    positions.setX(index, positions.getX(index) + bendX * bend);
    positions.setZ(index, positions.getZ(index) + bendZ * bend);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
}

function updateFire(records, now) {
  const seconds = now / 1000;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const flicker = Math.sin(seconds * (8.2 + index * 0.7) + record.phase);
    const sway = Math.sin(seconds * (4.1 + index * 0.35) + record.phase * 0.7);
    record.mesh.scale.y = record.baseY * (0.94 + flicker * 0.075);
    record.mesh.scale.x = record.baseX * (1.0 - flicker * 0.035);
    record.mesh.rotation.z = sway * 0.045;
  }
}

function installResponderLightOverride(root) {
  const rig = root?.userData?.turnEmergencyLightRig;
  if (!rig?.lamps?.length) return;
  for (const record of rig.lamps) {
    record.lamp.onBeforeRender = () => updateResponderLights(rig);
  }
}

function updateResponderLights(rig) {
  const now = performance.now();
  if (now === rig.lastFrameAt) return;
  rig.lastFrameAt = now;
  const active = session.crashActive && !session.resolved;
  const phase = (now % rig.periodMs) / rig.periodMs;
  const firstOn = phase < 0.5;

  for (const record of rig.lamps) {
    const on = record.index === 0 ? firstOn : !firstOn;
    record.lamp.visible = true;
    record.halo.visible = active && on;
    record.wideHalo.visible = active && !rig.reducedMotion && on;
    record.material.opacity = active ? (on ? 1 : 0.08) : 0;
    record.haloMaterial.opacity = active && on ? (rig.reducedMotion ? 0.42 : 0.68) : 0;
    record.wideHaloMaterial.opacity = active && on ? 0.26 : 0;
    record.pointLight.intensity = active && on ? (rig.reducedMotion ? 70 : 110) : 0;
  }
}

function outlinedPrimitive(geometry, fillMaterial, scale = 1.04) {
  const group = new THREE.Group();
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x08090a, side: THREE.BackSide, toneMapped: false })
  );
  outline.scale.setScalar(scale);
  const fill = new THREE.Mesh(geometry, fillMaterial);
  fill.castShadow = false;
  fill.receiveShadow = true;
  group.add(outline, fill);
  return group;
}

function installMaydayUiStyle() {
  if (document.getElementById(MAP_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MAP_STYLE_ID;
  style.textContent = `
    .map-wrap { position: relative; }
    #${MAP_MARKER_ID} {
      position: absolute;
      z-index: 4;
      width: clamp(20px, 4.8vh, 29px);
      height: clamp(20px, 4.8vh, 29px);
      transform: translate(-50%, -50%);
      display: grid;
      place-items: center;
      box-sizing: border-box;
      border: 3px solid #08090a;
      border-radius: 50%;
      background: #fff8e8;
      font: 900 clamp(12px, 2.8vh, 18px)/1 system-ui, sans-serif;
      pointer-events: none;
    }
    #${MAP_MARKER_ID}[hidden] { display: none; }
    #${MAP_MARKER_ID}.is-medical { color: #d92d20; }
    #${MAP_MARKER_ID}.is-crash { color: #08090a; }
    .turn-mayday-info-plate {
      position: fixed;
      left: 50%;
      top: max(16px, calc(env(safe-area-inset-top) + 10px));
      z-index: 2147482999;
      width: min(620px, calc(100vw - 32px));
      margin: 0;
      padding: 10px 14px;
      border: 3px solid #08090a;
      border-radius: 14px;
      background: var(--paper, #fffdf6);
      color: #08090a;
      box-shadow: 5px 5px 0 #08090a;
      transform: translateX(-50%);
      text-align: center;
      font-size: clamp(0.72rem, 1.7vw, 0.92rem);
      font-weight: 900;
      line-height: 1.25;
      pointer-events: none;
    }
    .turn-mayday-info-plate[hidden] { display: none; }
    @media (max-height: 430px) {
      .turn-mayday-info-plate {
        top: max(10px, calc(env(safe-area-inset-top) + 6px));
        width: min(700px, calc(100vw - 20px));
        padding: 7px 11px;
        font-size: 0.7rem;
      }
    }
  `;
  document.head.appendChild(style);
}

function installMapMarker(samples) {
  const canvas = document.querySelector?.('#map');
  const wrap = canvas?.closest?.('.map-wrap');
  if (!canvas || !wrap) return null;

  let marker = document.getElementById(MAP_MARKER_ID);
  if (!marker) {
    marker = document.createElement('span');
    marker.id = MAP_MARKER_ID;
    marker.setAttribute('aria-hidden', 'true');
    marker.hidden = true;
    wrap.appendChild(marker);
  }

  const project = createMapProjection(samples, canvas);
  return {
    hide() {
      marker.hidden = true;
    },
    show(worldPoint, kind) {
      const point = project(worldPoint);
      marker.style.left = `${point.xPercent}%`;
      marker.style.top = `${point.yPercent}%`;
      marker.classList.toggle('is-medical', kind === 'medical');
      marker.classList.toggle('is-crash', kind !== 'medical');
      marker.textContent = kind === 'medical' ? 'H' : '🔥';
      marker.hidden = false;
    }
  };
}

function createMapProjection(samples, canvas) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const sample of samples) {
    minX = Math.min(minX, sample.point.x);
    maxX = Math.max(maxX, sample.point.x);
    minZ = Math.min(minZ, sample.point.z);
    maxZ = Math.max(maxZ, sample.point.z);
  }

  const pad = 20;
  const width = canvas.width - pad * 2;
  const height = canvas.height - pad * 2;
  const scale = Math.min(width / (maxX - minX), height / (maxZ - minZ));
  const contentWidth = (maxX - minX) * scale;
  const contentHeight = (maxZ - minZ) * scale;
  const offsetX = (canvas.width - contentWidth) / 2;
  const offsetY = (canvas.height - contentHeight) / 2;

  return (point) => ({
    xPercent: (offsetX + (point.x - minX) * scale) / canvas.width * 100,
    yPercent: (offsetY + (point.z - minZ) * scale) / canvas.height * 100
  });
}

function maydayInfoPlate() {
  let plate = document.getElementById(MAYDAY_INFO_ID);
  if (plate) return plate;
  plate = document.createElement('p');
  plate.id = MAYDAY_INFO_ID;
  plate.className = 'turn-mayday-info-plate';
  plate.hidden = true;
  plate.setAttribute('role', 'status');
  plate.setAttribute('aria-live', 'polite');
  plate.setAttribute('aria-atomic', 'true');
  document.body.appendChild(plate);
  return plate;
}

function showMessage(text, duration = 1800) {
  const plate = maydayInfoPlate();
  const token = `${performance.now()}-${Math.random()}`;
  plate.dataset.turnMaydayMessage = token;
  plate.textContent = text;
  plate.hidden = false;
  window.setTimeout(() => {
    if (plate.dataset.turnMaydayMessage !== token || plate.textContent !== text) return;
    plate.hidden = true;
    delete plate.dataset.turnMaydayMessage;
  }, duration);
}

function publishState(reason) {
  globalThis.dispatchEvent?.(new CustomEvent('turn:airport-emergency', {
    detail: {
      reason,
      crashActive: session.crashActive,
      resolved: session.resolved,
      phase: session.phase,
      transferDeadline: session.transferDeadline
    }
  }));
}
