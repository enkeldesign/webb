import * as THREE from 'three';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import { trackSurfaceY, trackPitch } from '/turn/tracks/elevation.js?build=20260725-r67';

const TRACKS = Object.freeze({
  countryside: Object.freeze({ label: 'COUNTRYSIDE', accent: 0xff4fa3 }),
  airport: Object.freeze({ label: 'AIRPORT', accent: 0xffd43b }),
  cliffside: Object.freeze({ label: 'CLIFFSIDE', accent: 0x26c7c3 }),
  harbor: Object.freeze({ label: 'HARBOR', accent: 0xff8f3d }),
  'midnight-city': Object.freeze({ label: 'MIDNIGHT CITY', accent: 0x9d7cff }),
  mountain: Object.freeze({ label: 'MOUNTAIN', accent: 0x4dabf7 })
});

const CONNECTIONS = Object.freeze([
  Object.freeze({
    id: 'harbor-cliffside',
    a: Object.freeze({ trackId: 'harbor', progress: 0.935 }),
    b: Object.freeze({ trackId: 'cliffside', progress: 0.860 })
  }),
  Object.freeze({
    id: 'cliffside-mountain',
    a: Object.freeze({ trackId: 'cliffside', progress: 0.934 }),
    b: Object.freeze({ trackId: 'mountain', progress: 0.850 })
  }),
  Object.freeze({
    id: 'mountain-countryside',
    a: Object.freeze({ trackId: 'mountain', progress: 0.927 }),
    b: Object.freeze({ trackId: 'countryside', progress: 0.840 })
  }),
  Object.freeze({
    id: 'countryside-midnight-city',
    a: Object.freeze({ trackId: 'countryside', progress: 0.900 }),
    b: Object.freeze({ trackId: 'midnight-city', progress: 0.830 })
  }),
  Object.freeze({
    id: 'midnight-city-airport',
    a: Object.freeze({ trackId: 'midnight-city', progress: 0.890 }),
    b: Object.freeze({ trackId: 'airport', progress: 0.850 })
  }),
  Object.freeze({
    id: 'airport-harbor',
    a: Object.freeze({ trackId: 'airport', progress: 0.931 }),
    b: Object.freeze({ trackId: 'harbor', progress: 0.860 })
  })
]);

const LAP_CHECKPOINTS = Object.freeze([
  0.08, 0.16, 0.24, 0.32, 0.40, 0.48,
  0.56, 0.64, 0.72, 0.80, 0.88, 0.94
]);

const BRANCH_WIDTH = 10;
const BRANCH_VISUAL_LENGTH = 30;
const PORTAL_DISTANCE_FROM_CENTER = 19;
const PORTAL_TRIGGER_RADIUS = 5.5;
const PORTAL_HINT_RADIUS = 54;
const ARRIVAL_ADVANCE_SAMPLES = 8;
const TRANSITION_LOCK_MS = 2400;

const reusableCenter = new THREE.Vector3();
const reusableDirection = new THREE.Vector3();
const reusableCross = new THREE.Vector3();
const reusableArrivalVelocity = new THREE.Vector3();

function waitForRuntime() {
  if (globalThis.__turnRuntime) return Promise.resolve(globalThis.__turnRuntime);
  return new Promise((resolve) => {
    window.addEventListener('turn:runtime-ready', (event) => {
      resolve(event.detail || globalThis.__turnRuntime);
    }, { once: true });
  });
}

function labelFor(trackId) {
  return TRACKS[trackId]?.label || String(trackId || '').toUpperCase();
}

function otherEnd(connection, trackId) {
  if (connection.a.trackId === trackId) return { local: connection.a, remote: connection.b };
  if (connection.b.trackId === trackId) return { local: connection.b, remote: connection.a };
  return null;
}

function portalsForTrack(trackId) {
  return CONNECTIONS
    .map((connection) => {
      const ends = otherEnd(connection, trackId);
      if (!ends) return null;
      return {
        connectionId: connection.id,
        trackId,
        progress: ends.local.progress,
        destinationTrackId: ends.remote.trackId,
        destinationProgress: ends.remote.progress
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.progress - b.progress);
}

function requiredCheckpointCount(progress) {
  return LAP_CHECKPOINTS.filter((checkpoint) => checkpoint < progress - 0.005).length;
}

function portalIsEligible(runtime, portal) {
  const state = runtime.state;
  return Boolean(
    state.running
    && state.lapActive
    && !state.lapInvalid
    && state.lapCheckpointIndex >= requiredCheckpointCount(portal.progress)
  );
}

function sampleAtProgress(samples, progress) {
  if (!Array.isArray(samples) || !samples.length) return null;
  const wrapped = ((Number(progress) % 1) + 1) % 1;
  const index = Math.round(wrapped * samples.length) % samples.length;
  return { sample: samples[index], index };
}

function computeTrackCenter(samples) {
  reusableCenter.set(0, 0, 0);
  if (!samples.length) return reusableCenter;
  for (const sample of samples) reusableCenter.add(sample.point);
  reusableCenter.multiplyScalar(1 / samples.length);
  return reusableCenter;
}

function outwardDirection(sample, center) {
  reusableDirection.copy(sample.normal || new THREE.Vector3(1, 0, 0));
  reusableDirection.y = 0;
  if (reusableDirection.lengthSq() < 0.0001) {
    reusableDirection.set(-sample.tangent.z, 0, sample.tangent.x);
  }
  reusableDirection.normalize();
  const fromCenterX = sample.point.x - center.x;
  const fromCenterZ = sample.point.z - center.z;
  if (fromCenterX * reusableDirection.x + fromCenterZ * reusableDirection.z < 0) {
    reusableDirection.multiplyScalar(-1);
  }
  return reusableDirection.clone();
}

function disposeObject(root) {
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.map?.dispose?.();
      material.dispose?.();
    }
  });
  root?.removeFromParent?.();
}

function makeLabelTexture(text, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const context = canvas.getContext('2d');
  context.fillStyle = '#08090a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = `#${accent.toString(16).padStart(6, '0')}`;
  context.lineWidth = 12;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  context.fillStyle = '#fff8e8';
  context.font = '900 50px system-ui, -apple-system, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function buildPortalVisual(runtime, portal, center) {
  const sampleResult = sampleAtProgress(runtime.samples, portal.progress);
  if (!sampleResult?.sample) return null;

  const { sample, index } = sampleResult;
  const direction = outwardDirection(sample, center);
  const cross = reusableCross.copy(sample.tangent);
  cross.y = 0;
  if (cross.lengthSq() < 0.0001) cross.set(direction.z, 0, -direction.x);
  cross.normalize();

  const group = new THREE.Group();
  group.name = `TURN LAB roadtrip ${portal.trackId} to ${portal.destinationTrackId}`;

  const roadStart = sample.point.clone().addScaledVector(direction, runtime.trackWidth * 0.24);
  const roadEnd = sample.point.clone().addScaledVector(direction, runtime.trackWidth * 0.5 + BRANCH_VISUAL_LENGTH);
  const roadVector = roadEnd.clone().sub(roadStart);
  roadVector.y = 0;
  const roadLength = Math.max(1, roadVector.length());
  const roadDirection = roadVector.clone().normalize();
  const roadMidpoint = roadStart.clone().add(roadEnd).multiplyScalar(0.5);
  roadMidpoint.y = sample.point.y + 0.16;

  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x3e4348,
    roughness: 0.98,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const road = new THREE.Mesh(new THREE.BoxGeometry(BRANCH_WIDTH, 0.16, roadLength), asphalt);
  road.position.copy(roadMidpoint);
  road.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), roadDirection);
  road.receiveShadow = true;
  group.add(road);

  const curbGeometry = new THREE.BoxGeometry(0.72, 0.24, roadLength);
  const curbMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.9 })
  ];
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(curbGeometry, curbMaterials[side > 0 ? 0 : 1]);
    curb.position.copy(roadMidpoint).addScaledVector(cross, side * (BRANCH_WIDTH / 2 + 0.25));
    curb.position.y += 0.08;
    curb.quaternion.copy(road.quaternion);
    curb.receiveShadow = true;
    group.add(curb);
  }

  const destinationAccent = TRACKS[portal.destinationTrackId]?.accent ?? 0xffd43b;
  const gateMaterial = new THREE.MeshStandardMaterial({
    color: destinationAccent,
    emissive: destinationAccent,
    emissiveIntensity: 0.12,
    roughness: 0.62,
    metalness: 0.12
  });
  const gateCenter = sample.point.clone().addScaledVector(direction, PORTAL_DISTANCE_FROM_CENTER);
  gateCenter.y = sample.point.y + 0.18;

  const postGeometry = new THREE.BoxGeometry(0.72, 4.6, 0.72);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, gateMaterial);
    post.position.copy(gateCenter).addScaledVector(cross, side * (BRANCH_WIDTH / 2 - 0.65));
    post.position.y += 2.3;
    post.castShadow = true;
    group.add(post);
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(BRANCH_WIDTH - 0.6, 0.7, 0.72), gateMaterial);
  beam.position.copy(gateCenter);
  beam.position.y += 4.55;
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), cross);
  beam.castShadow = true;
  group.add(beam);

  const labelTexture = makeLabelTexture(`TO ${labelFor(portal.destinationTrackId)}`, destinationAccent);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false
  }));
  label.position.copy(gateCenter).addScaledVector(direction, -1.2);
  label.position.y += 6.8;
  label.scale.set(17, 4.8, 1);
  group.add(label);

  runtime.scene.add(group);

  return {
    ...portal,
    sampleIndex: index,
    sample,
    direction,
    cross: cross.clone(),
    gateCenter,
    group,
    gateMaterial,
    eligible: false
  };
}

function installDomUi() {
  const status = document.createElement('div');
  status.className = 'turn-lab-roadtrip-status';
  status.id = 'turnLabRoadtripStatus';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  const transition = document.createElement('div');
  transition.className = 'turn-lab-roadtrip-transition';
  transition.id = 'turnLabRoadtripTransition';
  transition.setAttribute('role', 'status');
  transition.setAttribute('aria-live', 'polite');
  transition.setAttribute('aria-atomic', 'true');

  document.body.append(status, transition);
  return { status, transition };
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function announceMessage(text, duration = 1900) {
  const message = document.querySelector('#message');
  if (!message) return;
  message.textContent = text;
  message.classList.add('show');
  window.setTimeout(() => message.classList.remove('show'), duration);
}

const runtime = await waitForRuntime();
const ui = installDomUi();
let activeTrackId = globalThis.__turnGetTrackId?.() || runtime.trackId || runtime.state.trackId || 'countryside';
let portalVisuals = [];
let transitioning = false;
let transitionLockedUntil = 0;
let lastStatusText = '';
let visitedTracks = new Set([activeTrackId]);
let transitionCount = 0;

function clearPortals() {
  for (const portal of portalVisuals) disposeObject(portal.group);
  portalVisuals = [];
}

function rebuildPortals(trackId = activeTrackId) {
  clearPortals();
  activeTrackId = trackId;
  const center = computeTrackCenter(runtime.samples).clone();
  portalVisuals = portalsForTrack(trackId)
    .map((portal) => buildPortalVisual(runtime, portal, center))
    .filter(Boolean);
}

function setStatus(text, visible) {
  if (text !== lastStatusText) {
    ui.status.textContent = text;
    lastStatusText = text;
  }
  ui.status.classList.toggle('is-visible', Boolean(visible));
}

function updateGateState(portal) {
  const eligible = portalIsEligible(runtime, portal);
  if (eligible === portal.eligible) return eligible;
  portal.eligible = eligible;
  portal.gateMaterial.emissiveIntensity = eligible ? 0.95 : 0.08;
  portal.gateMaterial.opacity = eligible ? 1 : 0.62;
  portal.gateMaterial.transparent = !eligible;
  portal.gateMaterial.needsUpdate = true;
  return eligible;
}

function nearestPortal() {
  let nearest = null;
  let distance = Infinity;
  for (const portal of portalVisuals) {
    const nextDistance = runtime.state.position.distanceTo(portal.gateCenter);
    if (nextDistance < distance) {
      nearest = portal;
      distance = nextDistance;
    }
  }
  return { portal: nearest, distance };
}

function reciprocalPortal(destinationTrackId, connectionId) {
  return portalsForTrack(destinationTrackId)
    .find((portal) => portal.connectionId === connectionId) || null;
}

async function travel(portal) {
  if (transitioning || performance.now() < transitionLockedUntil) return;
  transitioning = true;
  transitionLockedUntil = performance.now() + TRANSITION_LOCK_MS;

  const fromTrackId = activeTrackId;
  const toTrackId = portal.destinationTrackId;
  const destinationPortal = reciprocalPortal(toTrackId, portal.connectionId);
  const wasRunning = runtime.state.running;
  const carriedSpeed = Math.max(12, Math.min(
    Number(runtime.state.speed) || 0,
    (Number(runtime.maxSpeed) || 88) * 1.15
  ));

  ui.transition.innerHTML = `${labelFor(fromTrackId)} → ${labelFor(toTrackId)}<small>ROADTRIP</small>`;
  ui.transition.classList.add('is-active');
  setStatus('', false);
  runtime.state.running = false;

  window.dispatchEvent(new CustomEvent('turn:roadtrip-transition-start', {
    detail: { fromTrackId, toTrackId, connectionId: portal.connectionId, speed: carriedSpeed }
  }));

  try {
    await sleep(120);
    await activateTrack(toTrackId);

    const arrivalProgress = destinationPortal?.progress ?? 0.86;
    const baseResult = sampleAtProgress(runtime.samples, arrivalProgress);
    const arrivalIndex = baseResult
      ? (baseResult.index + ARRIVAL_ADVANCE_SAMPLES) % runtime.samples.length
      : runtime.samples.length - 24;
    const arrival = runtime.samples[arrivalIndex];
    const state = runtime.state;

    state.position.copy(arrival.point);
    state.position.y = trackSurfaceY(arrival);
    state.surfacePitch = trackPitch(arrival);
    state.heading = Math.atan2(arrival.tangent.x, arrival.tangent.z);
    reusableArrivalVelocity.copy(arrival.tangent).normalize().multiplyScalar(carriedSpeed);
    state.velocity.copy(reusableArrivalVelocity);
    state.speed = carriedSpeed;
    state.driftAmount = 0;
    state.offRoad = false;
    state.nearestTrackIndex = arrivalIndex;
    state.progress = arrivalIndex / runtime.samples.length;
    state.lastProgress = state.progress;
    state.trackDistance = Number(arrival.distance) || 0;
    state.lapActive = false;
    state.lapCheckpointIndex = 0;
    state.lapInvalid = false;
    state.lapStartedAt = 0;
    state.lapElapsed = 0;
    state.lapPreviousPosition = { x: state.position.x, z: state.position.z };
    state.recording = [];
    state.running = wasRunning;

    runtime.playerCar.position.copy(state.position);
    runtime.playerCar.rotation.x = state.surfacePitch;
    runtime.playerCar.rotation.y = state.heading + Math.PI;
    runtime.cameraPosition?.copy?.(state.position);
    runtime.cameraTarget?.copy?.(state.position);

    activeTrackId = toTrackId;
    visitedTracks.add(toTrackId);
    transitionCount += 1;
    rebuildPortals(toTrackId);

    const arrivalText = `${labelFor(toTrackId)} · FROM ${labelFor(fromTrackId)}`;
    announceMessage(arrivalText, 2200);
    window.dispatchEvent(new CustomEvent('turn:roadtrip-transition-complete', {
      detail: {
        fromTrackId,
        toTrackId,
        connectionId: portal.connectionId,
        arrivalProgress: state.progress,
        speed: carriedSpeed,
        transitionCount,
        visitedTrackIds: [...visitedTracks]
      }
    }));

    await sleep(160);
  } catch (error) {
    console.error('TURN LAB: roadtrip transition failed.', error);
    runtime.state.running = wasRunning;
    announceMessage('ROADTRIP TRANSITION FAILED', 2400);
  } finally {
    ui.transition.classList.remove('is-active');
    transitioning = false;
  }
}

function update() {
  const currentTrackId = globalThis.__turnGetTrackId?.() || runtime.trackId || runtime.state.trackId;
  if (currentTrackId && currentTrackId !== activeTrackId && !transitioning) {
    rebuildPortals(currentTrackId);
  }

  if (!runtime.state.running || transitioning) {
    setStatus('', false);
    requestAnimationFrame(update);
    return;
  }

  for (const portal of portalVisuals) updateGateState(portal);
  const { portal, distance } = nearestPortal();

  if (!portal || distance > PORTAL_HINT_RADIUS) {
    setStatus('', false);
    requestAnimationFrame(update);
    return;
  }

  const eligible = portalIsEligible(runtime, portal);
  const destination = labelFor(portal.destinationTrackId);
  if (eligible) {
    setStatus(`↔ ${destination} · TAKE THE EXIT`, true);
  } else {
    const needed = requiredCheckpointCount(portal.progress);
    const completed = Math.min(needed, Number(runtime.state.lapCheckpointIndex) || 0);
    const reason = runtime.state.lapInvalid
      ? 'LAP VOID'
      : !runtime.state.lapActive
        ? 'CROSS START / FINISH FIRST'
        : `ROUTE ${completed}/${needed}`;
    setStatus(`${destination} · EXIT LOCKED · ${reason}`, true);
  }

  if (
    eligible
    && distance <= PORTAL_TRIGGER_RADIUS
    && performance.now() >= transitionLockedUntil
    && Math.abs(Number(runtime.state.speed) || 0) > 3
  ) {
    void travel(portal);
  }

  requestAnimationFrame(update);
}

window.addEventListener('turn:track-changed', (event) => {
  const trackId = event.detail?.trackId;
  if (!trackId || transitioning) return;
  rebuildPortals(trackId);
});

rebuildPortals(activeTrackId);
requestAnimationFrame(update);

globalThis.__turnLabRoadtrip = Object.freeze({
  connections: CONNECTIONS,
  getActiveTrackId: () => activeTrackId,
  getPortals: () => portalVisuals.map((portal) => ({
    connectionId: portal.connectionId,
    trackId: portal.trackId,
    progress: portal.progress,
    destinationTrackId: portal.destinationTrackId,
    destinationProgress: portal.destinationProgress,
    eligible: portalIsEligible(runtime, portal)
  })),
  getSession: () => ({
    transitionCount,
    visitedTrackIds: [...visitedTracks]
  })
});

document.documentElement.dataset.turnLabExperiment = 'roadtrip-world-r1';
window.dispatchEvent(new CustomEvent('turn:roadtrip-ready', {
  detail: { trackId: activeTrackId, connections: CONNECTIONS.length }
}));
