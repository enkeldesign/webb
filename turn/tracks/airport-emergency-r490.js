import * as THREE from 'three';
import { createCarVisual } from '../vehicle/car-models.js?build=20260720-r19';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r174-bella-siren-zone';

const AIRPORT_TRACK_ID = 'airport';
const AMBULANCE_ID = 'ambulance';
const TRANSFER_LIMIT_MS = 30_000;
const PICKUP_RADIUS = 24;
const MEDICAL_RADIUS = 28;
const PICKUP_RADIUS_SQUARED = PICKUP_RADIUS * PICKUP_RADIUS;
const MEDICAL_RADIUS_SQUARED = MEDICAL_RADIUS * MEDICAL_RADIUS;
const CRASH_REFERENCE = Object.freeze({ x: 192, z: 70 });
const CRASH_OUTSIDE_REFERENCE = Object.freeze({ x: 235, z: 108 });
const TERMINAL_NAME = 'TURN International Terminal';
const OVERFLIGHT_NAME = 'Airport B787 Overflight';
const OVERFLIGHT_TARGET_LENGTH = 22;
const WRECK_TARGET_LENGTH = 62;
const WRECK_SCALE = WRECK_TARGET_LENGTH / OVERFLIGHT_TARGET_LENGTH;
const MAP_STYLE_ID = 'turn-airport-emergency-map-style';
const MAP_MARKER_ID = 'turn-airport-emergency-map-marker';
const GUIDE_CUE_INTERVAL_MS = 1250;

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
  nextAircraftCheckAt: 0,
  nextGuideCueAt: 0
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
  installMedicalSign(world, placement);
  const { scene: crashScene, renderAnchor, aircraftMount } = makeCrashScene();
  crashScene.position.copy(placement.crashPoint);
  crashScene.rotation.y = placement.crashYaw;
  crashScene.visible = false;
  world.add(crashScene);

  const mapMarker = installMapMarker(samples);
  let responderPromise = null;
  let medicalResponder = null;

  function activeTrackId() {
    return runtime.state.trackId || globalThis.__turnGetTrackId?.() || '';
  }

  function syncMapMarker() {
    if (!mapMarker) return;
    if (activeTrackId() !== AIRPORT_TRACK_ID || !session.crashActive || session.resolved) {
      mapMarker.hide();
      return;
    }
    if (session.phase === 'transport') mapMarker.show(placement.medicalPoint, 'medical');
    else mapMarker.show(placement.crashPoint, 'crash');
  }

  function syncResponder() {
    if (!medicalResponder) return;
    medicalResponder.visible = session.crashActive;
  }

  function ensureMedicalResponder() {
    if (responderPromise) return responderPromise;
    responderPromise = createCarVisual({
      carId: 'firetruck',
      color: '#d92d20',
      secondaryColor: '#ffcc00',
      targetLength: 8.4,
      outline: true
    }).then((visual) => {
      visual.name = 'Airport MAYDAY medical fire truck';
      visual.position.copy(placement.medicalResponderPoint);
      visual.rotation.y = placement.medicalResponderYaw;
      visual.visible = session.crashActive;
      visual.traverse((node) => {
        if (node.isMesh) node.castShadow = false;
      });
      installResponderLightOverride(visual);
      world.add(visual);
      medicalResponder = visual;
      syncResponder();
      return visual;
    }).catch((error) => {
      console.info('TURN: MAYDAY medical fire truck unavailable; audible medical guidance remains active.', error);
      return null;
    });
    return responderPromise;
  }

  function mountOverflightAsWreck(now = performance.now()) {
    if (!session.crashActive || session.crashAircraftMounted || now < session.nextAircraftCheckAt) return;
    session.nextAircraftCheckAt = now + 250;
    const aircraft = world.getObjectByName(OVERFLIGHT_NAME);
    if (!aircraft) return;

    aircraft.position.set(0, -4.8, 0);
    aircraft.scale.multiplyScalar(WRECK_SCALE);
    aircraftMount.add(aircraft);
    aircraft.visible = true;
    session.crashAircraftMounted = true;
  }

  function triggerCrash() {
    if (session.crashActive) return;
    session.crashActive = true;
    session.resolved = false;
    session.phase = 'waiting';
    session.transferStartedAt = 0;
    session.transferDeadline = 0;
    session.crashAircraftMounted = false;
    session.nextAircraftCheckAt = 0;
    session.nextGuideCueAt = 0;
    crashScene.visible = true;
    mountOverflightAsWreck(0);
    void ensureMedicalResponder();
    syncResponder();
    syncMapMarker();
    playDistantCrashCue();
    showMessage('MAYDAY · AIRPORT CRASH REPORTED', 2200);
    publishState('crash');
  }

  function beginTransfer(now) {
    session.phase = 'transport';
    session.transferStartedAt = now;
    session.transferDeadline = now + TRANSFER_LIMIT_MS;
    session.nextGuideCueAt = 0;
    syncMapMarker();
    globalThis.__turnAudio?.cue?.('ui-confirm');
    showMessage('PATIENT ON BOARD · MEDICAL BAY · 30 SECONDS', 2600);
    publishState('pickup');
  }

  function failTransfer() {
    session.phase = 'waiting';
    session.transferStartedAt = 0;
    session.transferDeadline = 0;
    session.nextGuideCueAt = 0;
    syncMapMarker();
    globalThis.__turnAudio?.cue?.('ui-back');
    showMessage('TRANSFER MISSED · RETURN TO THE CRASH', 2200);
    publishState('retry');
  }

  function completeTransfer(now) {
    const transferSeconds = Math.max(0, (now - session.transferStartedAt) / 1000);
    session.phase = 'resolved';
    session.resolved = true;
    session.transferDeadline = 0;
    session.nextGuideCueAt = Infinity;
    syncMapMarker();
    globalThis.__turnAudio?.cue?.('ui-confirm');
    showMessage('PATIENT DELIVERED', 1800);
    signalSecretAchievement('golden-hour', {
      trackId: AIRPORT_TRACK_ID,
      vehicleId: AMBULANCE_ID,
      time: transferSeconds,
      rescueConfirmed: true
    });
    publishState('resolved');
  }

  function updateAudibleGuide(now, state, position) {
    if (now < session.nextGuideCueAt) return;
    const source = session.phase === 'transport'
      ? placement.medicalResponderPoint
      : placement.crashPoint;
    const distance = Math.sqrt(horizontalDistanceSquared(position, source));
    const pan = positionalPan(state, position, source);
    const intensity = THREE.MathUtils.clamp(1 - distance / 260, 0.28, 1);

    // Reuse TURN's existing spatial world transient so this guidance inherits the
    // established audio graph, user audio preference, stereo panning and source limits.
    // At the wreck it reads as intermittent crackle; at the medical bay the steady,
    // flashing Fire Truck gives the same positioned pulse a clear emergency destination.
    globalThis.__turnAudio?.cue?.('car-near', { pan, intensity });
    session.nextGuideCueAt = now + GUIDE_CUE_INTERVAL_MS;
  }

  function updateEmergencyFrame() {
    if (!session.crashActive) return;
    const now = performance.now();
    mountOverflightAsWreck(now);

    if (session.phase === 'transport' && now > session.transferDeadline) {
      failTransfer();
      return;
    }

    const state = runtime.state;
    if (activeTrackId() !== AIRPORT_TRACK_ID || state.running !== true) return;
    const position = state.position;
    if (!position) return;

    if (session.phase === 'waiting' || session.phase === 'transport') {
      updateAudibleGuide(now, state, position);
    }

    if (session.phase === 'waiting') {
      const sirenActive = state.vehicleId === AMBULANCE_ID && globalThis.__turnBoostActive === true;
      if (!sirenActive || horizontalDistanceSquared(position, placement.crashPoint) > PICKUP_RADIUS_SQUARED) return;
      beginTransfer(now);
      return;
    }

    if (
      session.phase === 'transport'
      && state.vehicleId === AMBULANCE_ID
      && horizontalDistanceSquared(position, placement.medicalPoint) <= MEDICAL_RADIUS_SQUARED
    ) {
      completeTransfer(now);
    }
  }

  const previousOnBeforeRender = renderAnchor.onBeforeRender;
  renderAnchor.onBeforeRender = function airportEmergencyFrame(...args) {
    previousOnBeforeRender?.call(this, ...args);
    updateEmergencyFrame();
  };

  const onLapResult = (event) => {
    if (!qualifiesForAirportCrash(event.detail, {
      trackId: activeTrackId(),
      vehicleId: runtime.state.vehicleId,
      crashActive: session.crashActive
    })) return;
    triggerCrash();
  };

  const onTrackChanged = () => {
    syncMapMarker();
    syncResponder();
  };

  globalThis.addEventListener?.('turn:lap-result', onLapResult);
  globalThis.addEventListener?.('turn:track-changed', onTrackChanged);
  globalThis.addEventListener?.('turn:ui-state-change', syncMapMarker);

  world.userData.turnAirportEmergency = Object.freeze({
    achievementId: 'golden-hour',
    achievementTitle: 'MAYDAY!',
    requiredVehicle: AMBULANCE_ID,
    transferSeconds: TRANSFER_LIMIT_MS / 1000,
    crashPoint: placement.crashPoint.clone(),
    medicalPoint: placement.medicalPoint.clone(),
    sessionPersistent: true,
    clearsOnPageReload: true,
    realAircraftWreck: 'reuses the Airport B787 overflight at roughly full scale',
    permanentMedicalSign: 'red H mounted on TURN International Terminal; no protected Red Cross emblem',
    audibleGuidance: 'positioned world-audio pulses guide first to the wreck and then to the medical Fire Truck'
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
  syncMapMarker();
  return installation;
}

function emergencyPlacement(world, samples) {
  const crashSample = nearestSample(samples, CRASH_REFERENCE.x, CRASH_REFERENCE.z);
  const sideA = crashSample.point.clone().addScaledVector(crashSample.normal, 34);
  const sideB = crashSample.point.clone().addScaledVector(crashSample.normal, -34);
  const outside = new THREE.Vector3(CRASH_OUTSIDE_REFERENCE.x, 0, CRASH_OUTSIDE_REFERENCE.z);
  const crashPoint = sideA.distanceToSquared(outside) <= sideB.distanceToSquared(outside) ? sideA : sideB;
  crashPoint.y = 0.3;

  const terminal = world.getObjectByName(TERMINAL_NAME) || null;
  let medicalPoint = new THREE.Vector3(-58, 0.3, -32);
  let medicalResponderPoint = new THREE.Vector3(-40, 0.2, -35);
  let medicalResponderYaw = Math.PI / 2;

  if (terminal) {
    terminal.updateMatrixWorld(true);
    medicalPoint = terminal.localToWorld(new THREE.Vector3(0, 0.3, 31));
    medicalResponderPoint = terminal.localToWorld(new THREE.Vector3(18, 0.2, 28));
    const localForward = terminal.localToWorld(new THREE.Vector3(18, 0.2, 38));
    medicalResponderYaw = Math.atan2(
      localForward.x - medicalResponderPoint.x,
      localForward.z - medicalResponderPoint.z
    ) + Math.PI / 2;
  }

  return {
    terminal,
    crashPoint,
    medicalPoint,
    medicalResponderPoint,
    medicalResponderYaw,
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

function positionalPan(state, listenerPosition, sourcePosition) {
  const dx = Number(sourcePosition.x) - Number(listenerPosition.x);
  const dz = Number(sourcePosition.z) - Number(listenerPosition.z);
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const heading = Number(state?.heading) || 0;
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);
  return THREE.MathUtils.clamp((dx / length) * rightX + (dz / length) * rightZ, -0.96, 0.96);
}

function installMedicalSign(world, placement) {
  const sign = makeMedicalSign();
  if (placement.terminal) {
    sign.position.set(0, 9.4, 12.72);
    placement.terminal.add(sign);
    return sign;
  }
  sign.position.copy(placement.medicalPoint).setY(9.4);
  world.add(sign);
  return sign;
}

function makeMedicalSign() {
  const sign = new THREE.Group();
  sign.name = 'Airport terminal medical H';
  sign.userData.turnAirportMedical = true;

  const panel = outlinedPrimitive(
    new THREE.BoxGeometry(8.2, 7.2, 0.65),
    new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.86 }),
    1.045
  );
  sign.add(panel);

  const red = new THREE.MeshBasicMaterial({ color: 0xd92d20, toneMapped: false });
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.05, 4.8, 0.3), red);
  const right = left.clone();
  const middle = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.0, 0.3), red);
  left.position.set(-1.42, 0, 0.49);
  right.position.set(1.42, 0, 0.49);
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
  aircraftMount.position.y = -0.7;
  aircraftMount.rotation.x = THREE.MathUtils.degToRad(-20);
  aircraftMount.rotation.z = THREE.MathUtils.degToRad(20);
  root.add(aircraftMount);

  const dark = new THREE.MeshStandardMaterial({ color: 0x34383d, roughness: 0.94 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x737b82, roughness: 0.98 });
  const red = new THREE.MeshBasicMaterial({ color: 0xd92d20, toneMapped: false });
  const orange = new THREE.MeshBasicMaterial({ color: 0xff922b, toneMapped: false });

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

  const flameBack = new THREE.Mesh(new THREE.ConeGeometry(4.2, 11.5, 8), red);
  flameBack.position.set(3.3, 6.0, 1.8);
  flameBack.rotation.z = -0.12;
  root.add(flameBack);

  const flameFront = new THREE.Mesh(new THREE.ConeGeometry(2.8, 8.2, 8), orange);
  flameFront.position.set(2.4, 4.5, 0.9);
  flameFront.rotation.z = 0.14;
  root.add(flameFront);

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

  return { scene: root, renderAnchor: flameFront, aircraftMount };
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

function installMapMarker(samples) {
  const canvas = document.querySelector?.('#map');
  const wrap = canvas?.closest?.('.map-wrap');
  if (!canvas || !wrap) return null;

  if (!document.getElementById(MAP_STYLE_ID)) {
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
    `;
    document.head.appendChild(style);
  }

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

function playDistantCrashCue() {
  const audio = globalThis.__turnAudio;
  if (!audio?.cue) return;
  audio.cue('boost-empty');
  window.setTimeout(() => audio.cue('overtake', { places: 1 }), 150);
}

function showMessage(text, duration = 1800) {
  const message = document.querySelector?.('#message');
  if (!message) return;
  message.textContent = text;
  message.classList.add('show');
  window.setTimeout(() => message.classList.remove('show'), duration);
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
