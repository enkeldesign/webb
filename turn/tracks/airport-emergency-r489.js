import * as THREE from 'three';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r174-bella-siren-zone';

const AIRPORT_TRACK_ID = 'airport';
const AMBULANCE_ID = 'ambulance';
const TRANSFER_LIMIT_MS = 30_000;
const PICKUP_RADIUS = 24;
const MEDICAL_RADIUS = 22;
const PICKUP_RADIUS_SQUARED = PICKUP_RADIUS * PICKUP_RADIUS;
const MEDICAL_RADIUS_SQUARED = MEDICAL_RADIUS * MEDICAL_RADIUS;
const CRASH_REFERENCE = Object.freeze({ x: 192, z: 70 });
const CRASH_OUTSIDE_REFERENCE = Object.freeze({ x: 235, z: 108 });
const MEDICAL_REFERENCE = Object.freeze({ x: 82, z: 120 });
const OVERFLIGHT_NAME = 'Airport B787 Overflight';
const MAP_STYLE_ID = 'turn-airport-emergency-map-style';
const MAP_MARKER_ID = 'turn-airport-emergency-map-marker';

export const AIRPORT_EMERGENCY_CONFIG = Object.freeze({
  trackId: AIRPORT_TRACK_ID,
  vehicleId: AMBULANCE_ID,
  transferLimitMs: TRANSFER_LIMIT_MS,
  pickupRadius: PICKUP_RADIUS,
  medicalRadius: MEDICAL_RADIUS
});

const session = {
  crashActive: false,
  resolved: false,
  phase: 'idle',
  transferStartedAt: 0,
  transferDeadline: 0,
  overflightHidden: false,
  nextOverflightCheckAt: 0
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

  const placement = emergencyPlacement(samples);
  const medicalSign = makeMedicalSign();
  const { scene: crashScene, renderAnchor } = makeCrashScene();
  crashScene.position.copy(placement.crashPoint);
  crashScene.rotation.y = placement.crashYaw;
  crashScene.visible = false;
  world.add(medicalSign, crashScene);

  const mapMarker = installMapMarker(samples);

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

  function hideOverflight(now = performance.now()) {
    if (session.overflightHidden || now < session.nextOverflightCheckAt) return;
    session.nextOverflightCheckAt = now + 250;
    const overflight = world.getObjectByName(OVERFLIGHT_NAME);
    if (!overflight) return;
    overflight.visible = false;
    session.overflightHidden = true;
  }

  function triggerCrash() {
    if (session.crashActive) return;
    session.crashActive = true;
    session.resolved = false;
    session.phase = 'waiting';
    session.transferStartedAt = 0;
    session.transferDeadline = 0;
    session.overflightHidden = false;
    session.nextOverflightCheckAt = 0;
    crashScene.visible = true;
    hideOverflight(0);
    syncMapMarker();
    playDistantCrashCue();
    showMessage('MAYDAY · AIRPORT CRASH REPORTED', 2200);
    publishState('crash');
  }

  function beginTransfer(now) {
    session.phase = 'transport';
    session.transferStartedAt = now;
    session.transferDeadline = now + TRANSFER_LIMIT_MS;
    syncMapMarker();
    globalThis.__turnAudio?.cue?.('ui-confirm');
    showMessage('PATIENT ON BOARD · MEDICAL BAY · 30 SECONDS', 2600);
    publishState('pickup');
  }

  function failTransfer() {
    session.phase = 'waiting';
    session.transferStartedAt = 0;
    session.transferDeadline = 0;
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

  function updateEmergencyFrame() {
    if (!session.crashActive) return;
    const now = performance.now();
    hideOverflight(now);

    if (session.phase === 'transport' && now > session.transferDeadline) {
      failTransfer();
      return;
    }

    const state = runtime.state;
    if (activeTrackId() !== AIRPORT_TRACK_ID || state.running !== true) return;
    const position = state.position;
    if (!position) return;

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
    if (session.crashActive) hideOverflight(0);
    syncMapMarker();
  };

  globalThis.addEventListener?.('turn:lap-result', onLapResult);
  globalThis.addEventListener?.('turn:track-changed', onTrackChanged);
  globalThis.addEventListener?.('turn:ui-state-change', syncMapMarker);

  world.userData.turnAirportEmergency = Object.freeze({
    achievementId: 'golden-hour',
    requiredVehicle: AMBULANCE_ID,
    transferSeconds: TRANSFER_LIMIT_MS / 1000,
    crashPoint: placement.crashPoint.clone(),
    medicalPoint: placement.medicalPoint.clone(),
    sessionPersistent: true,
    clearsOnPageReload: true,
    permanentMedicalSign: 'red H medical marker on terminal; no protected Red Cross emblem'
  });

  installation = Object.freeze({
    getState() {
      return Object.freeze({
        crashActive: session.crashActive,
        resolved: session.resolved,
        phase: session.phase,
        transferDeadline: session.transferDeadline
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

function emergencyPlacement(samples) {
  const crashSample = nearestSample(samples, CRASH_REFERENCE.x, CRASH_REFERENCE.z);
  const sideA = crashSample.point.clone().addScaledVector(crashSample.normal, 34);
  const sideB = crashSample.point.clone().addScaledVector(crashSample.normal, -34);
  const outside = new THREE.Vector3(CRASH_OUTSIDE_REFERENCE.x, 0, CRASH_OUTSIDE_REFERENCE.z);
  const crashPoint = sideA.distanceToSquared(outside) <= sideB.distanceToSquared(outside) ? sideA : sideB;
  crashPoint.y = 0.3;

  const medicalSample = nearestSample(samples, MEDICAL_REFERENCE.x, MEDICAL_REFERENCE.z);
  const medicalPoint = medicalSample.point.clone();
  medicalPoint.y = 0.3;

  return {
    crashPoint,
    medicalPoint,
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

function makeMedicalSign() {
  const sign = new THREE.Group();
  sign.name = 'Airport terminal medical H';
  sign.userData.turnAirportMedical = true;

  const panel = outlinedPrimitive(
    new THREE.BoxGeometry(10.5, 8.5, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.86 }),
    1.045
  );
  sign.add(panel);

  const red = new THREE.MeshBasicMaterial({ color: 0xd92d20, toneMapped: false });
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.25, 5.6, 0.35), red);
  const right = left.clone();
  const middle = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 0.35), red);
  left.position.set(-1.75, 0, -0.58);
  right.position.set(1.75, 0, -0.58);
  middle.position.set(0, 0, -0.58);
  sign.add(left, right, middle);

  sign.position.set(104, 11.1, 144.8);
  return sign;
}

function makeCrashScene() {
  const root = new THREE.Group();
  root.name = 'Airport emergency crash site';
  root.userData.turnAirportCrashSite = true;

  const cream = new THREE.MeshStandardMaterial({ color: 0xe7e3da, roughness: 0.86 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x34383d, roughness: 0.92 });
  const red = new THREE.MeshBasicMaterial({ color: 0xd92d20, toneMapped: false });
  const orange = new THREE.MeshBasicMaterial({ color: 0xff922b, toneMapped: false });

  const fuselage = outlinedPrimitive(new THREE.CylinderGeometry(2.5, 2.15, 18, 8), cream, 1.035);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 3.1, 0);
  root.add(fuselage);

  const nose = outlinedPrimitive(new THREE.ConeGeometry(2.5, 4.8, 8), cream, 1.035);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 3.1, -11.2);
  root.add(nose);

  const wing = outlinedPrimitive(new THREE.BoxGeometry(17, 0.55, 4.2), cream, 1.03);
  wing.position.set(-2.8, 3, -1.4);
  wing.rotation.y = 0.3;
  root.add(wing);

  const brokenTail = outlinedPrimitive(new THREE.BoxGeometry(7.5, 0.5, 3.2), dark, 1.035);
  brokenTail.position.set(5.8, 1.1, 10.5);
  brokenTail.rotation.set(0.08, -0.55, 0.18);
  root.add(brokenTail);

  for (const [x, z, rotation] of [[-8, 7, 0.4], [7, 5, -0.3], [-5, -9, 0.8], [9, -5, -0.7]]) {
    const debris = outlinedPrimitive(new THREE.BoxGeometry(3.8, 0.7, 1.8), dark, 1.04);
    debris.position.set(x, 0.75, z);
    debris.rotation.set(0.15, rotation, 0.18);
    root.add(debris);
  }

  const flameBack = new THREE.Mesh(new THREE.ConeGeometry(2.8, 7.2, 7), red);
  flameBack.position.set(2.8, 4.1, 1.3);
  flameBack.rotation.z = -0.12;
  root.add(flameBack);

  const flameFront = new THREE.Mesh(new THREE.ConeGeometry(1.8, 5.4, 7), orange);
  flameFront.position.set(2.5, 3.3, 0.7);
  flameFront.rotation.z = 0.14;
  root.add(flameFront);

  const smokeGeometry = new THREE.DodecahedronGeometry(2.2, 0);
  const smokeMaterials = [0x4b5563, 0x59636f, 0x69737d].map((color) => (
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false })
  ));
  const smoke = [
    [2.5, 8, 1.3, 1.2],
    [1.3, 11.4, 1.6, 1.55],
    [3.2, 14.6, 0.8, 1.8],
    [0.5, 17.3, 1.7, 2.05]
  ];
  smoke.forEach(([x, y, z, scale], index) => {
    const cloud = new THREE.Mesh(smokeGeometry, smokeMaterials[index % smokeMaterials.length]);
    cloud.position.set(x, y, z);
    cloud.scale.set(scale, scale * 0.9, scale);
    root.add(cloud);
  });

  return { scene: root, renderAnchor: flameFront };
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
