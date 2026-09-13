import * as THREE from 'three';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import {
  DEFAULT_VEHICLE_COLOR,
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  VEHICLE_SELECTION_KEY
} from '/turn/vehicle/catalog.js?build=20260720-r19';
import { TRAINING_CAR_ID } from './stages.js';
import {
  WORLD_PLAYGROUND_V2_TRACK_ID
} from './world-playground-v2-map.js?revision=r1-environment';
import {
  buildWorldPlaygroundV2Environment,
  disposeWorldPlaygroundV2Environment
} from './world-playground-v2-environment.js?revision=r1-environment';

const REVISION = 'r1-environment';
let installed = false;

export async function installWorldPlaygroundV2Lab(runtime = globalThis.__turnRuntime) {
  if (installed) return globalThis.__turnWorldPlaygroundV2;
  if (!globalThis.__TURN_LAB__) throw new Error('World Playground V2 is currently TURN LAB only.');

  const home = globalThis.__turnHome;
  const raceSession = globalThis.__turnRaceSession;
  if (!runtime || !home || !raceSession) throw new Error('World Playground V2 requires TURN Home and race-session runtime.');

  const trigger = makeLabTrigger();
  const resetButton = document.querySelector('#resetButton');
  const leaveButton = document.querySelector('.back-to-lot-button');
  if (!resetButton || !leaveButton) throw new Error('World Playground V2 could not find race utilities.');

  installed = true;
  const session = {
    active: false,
    starting: false,
    world: null,
    course: null,
    frame: 0,
    snapshot: null,
    preparedAccess: null,
    uiSnapshot: []
  };

  trigger.addEventListener('click', () => void start());
  resetButton.addEventListener('click', restart, true);

  const api = Object.freeze({
    revision: REVISION,
    start,
    leave,
    restart,
    getState: () => Object.freeze({ active: session.active, trackId: session.active ? WORLD_PLAYGROUND_V2_TRACK_ID : null })
  });
  globalThis.__turnWorldPlaygroundV2 = api;
  return api;

  async function start() {
    if (session.active || session.starting) return false;
    session.starting = true;
    trigger.disabled = true;
    trigger.setAttribute('aria-busy', 'true');

    try {
      session.snapshot = captureSnapshot();
      session.preparedAccess = await prepareAccess();
      if (runtime.state.running) {
        raceSession.leaveRace();
        home.showHome();
      }

      await raceSession.selectVehicle({
        carId: TRAINING_CAR_ID,
        color: DEFAULT_VEHICLE_COLOR,
        secondaryColor: DEFAULT_VEHICLE_SECONDARY_COLOR
      });
      restoreStorage(VEHICLE_SELECTION_KEY, session.snapshot.storage.vehicle);

      session.course = buildWorldPlaygroundV2Environment();
      overrideRuntimeTrack(session.course);
      positionStart();
      session.active = true;

      home.hideHome();
      document.body.classList.add('turn-world-playground-v2-active');
      trigger.hidden = true;
      configurePrototypeUi(true);
      resetButton.textContent = 'Restart World V2';
      leaveButton.textContent = 'Leave World V2';
      leaveButton.setAttribute('aria-label', 'Leave the TURN world environment prototype and return Home');
      runtime.openLot = leave;

      const fullscreenPromise = session.preparedAccess?.fullscreenPromise || Promise.resolve(false);
      await raceSession.startGame(fullscreenPromise, { announceStart: false });
      runtime.state.freeRoam = true;
      positionStart();
      globalThis.__turnShowMessage?.('TURN WORLD V2 · ENVIRONMENT', 1800);
      if (!session.frame) session.frame = requestAnimationFrame(prototypeFrame);
      window.dispatchEvent(new CustomEvent('turn:world-playground-v2-started', {
        detail: Object.freeze({ trackId: WORLD_PLAYGROUND_V2_TRACK_ID, environmentOnly: true })
      }));
      return true;
    } catch (error) {
      console.warn('TURN LAB: World Playground V2 could not start.', error);
      if (session.snapshot) await restoreSession();
      return false;
    } finally {
      session.starting = false;
      trigger.disabled = false;
      trigger.removeAttribute('aria-busy');
    }
  }

  async function prepareAccess() {
    const steeringMode = home.getSteeringMode?.() || 'manual';
    if (steeringMode === 'motion' && runtime.state.sensorMode) {
      return Object.freeze({ mode: 'motion', fullscreenPromise: raceSession.requestGameFullscreen() });
    }
    return steeringMode === 'motion'
      ? raceSession.prepareMotionAccess()
      : raceSession.prepareManualAccess();
  }

  function overrideRuntimeTrack(course) {
    clearWorld();
    if (runtime.activeWorld) runtime.activeWorld.visible = false;
    runtime.samples.splice(0, runtime.samples.length, ...course.samples);
    runtime.trackSpatialIndex.replaceSamples(runtime.samples);
    runtime.trackId = WORLD_PLAYGROUND_V2_TRACK_ID;
    runtime.state.trackId = WORLD_PLAYGROUND_V2_TRACK_ID;
    runtime.state.trackSampleCount = runtime.samples.length;
    runtime.activeTrack = Object.freeze({
      id: WORLD_PLAYGROUND_V2_TRACK_ID,
      name: 'TURN WORLD V2',
      collisionProfile: null,
      freeRoamDistance: 1800
    });

    runtime.scene.background = new THREE.Color(0x9fc7d4);
    runtime.scene.fog = new THREE.Fog(0xb8d4d8, 560, 2180);
    runtime.scene.add(course.world);
    runtime.activeWorld = course.world;
    session.world = course.world;
    globalThis.__turnGetTrackId = () => WORLD_PLAYGROUND_V2_TRACK_ID;
    globalThis.__turnGetCollisionProfile = () => null;
    globalThis.__turnIsForgivingSurface = () => true;
    window.dispatchEvent(new CustomEvent('turn:track-changed', {
      detail: { trackId: WORLD_PLAYGROUND_V2_TRACK_ID, track: runtime.activeTrack, playground: true, environmentOnly: true }
    }));
  }

  function positionStart() {
    if (!session.course?.samples?.length) return;
    const start = session.course.samples[session.course.startIndex];
    runtime.setGameMode(runtime.GAME_MODE.STAGED);
    runtime.state.freeRoam = true;
    runtime.state.position.copy(start.point);
    runtime.state.position.y = start.point.y;
    runtime.state.velocity.set(0, 0, 0);
    runtime.state.heading = Math.atan2(start.tangent.x, start.tangent.z);
    runtime.state.speed = 0;
    runtime.state.driftAmount = 0;
    runtime.state.offRoad = false;
    runtime.state.trackDistance = start.distance;
    runtime.state.progress = start.progress;
    runtime.state.lastProgress = start.progress;
    runtime.state.nearestTrackIndex = session.course.startIndex;
    runtime.state.lapCheckpointIndex = 0;
    runtime.state.lapInvalid = false;
    runtime.state.lapActive = false;
    runtime.state.lapStartedAt = 0;
    runtime.state.lapElapsed = 0;
    runtime.state.lapPreviousPosition = { x: runtime.state.position.x, z: runtime.state.position.z };
    runtime.state.recording = [];
    runtime.playerCar.position.copy(runtime.state.position);
    runtime.playerCar.rotation.y = runtime.state.heading + Math.PI;
    runtime.setRacePosition?.(null, 1);
  }

  function restart(event) {
    if (!session.active) return;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    positionStart();
    globalThis.__turnShowMessage?.('WORLD V2 RESTARTED', 1100);
  }

  function prototypeFrame() {
    if (!session.active) {
      session.frame = 0;
      return;
    }
    if (runtime.state.running) {
      constrainToWorld(session.course?.boundary || []);
      runtime.state.lapActive = false;
      runtime.state.lapInvalid = false;
      runtime.state.lapElapsed = 0;
      runtime.state.lapCheckpointIndex = 0;
      runtime.state.recording = [];
      runtime.state.suppressNextLapStartMessage = true;
    }
    session.frame = requestAnimationFrame(prototypeFrame);
  }

  async function leave() {
    if (!session.active && !session.snapshot) return false;
    await restoreSession();
    return true;
  }

  async function restoreSession() {
    stopFrameLoop();
    raceSession.leaveRace();
    runtime.state.freeRoam = false;
    clearWorld();
    const snapshot = session.snapshot;
    if (snapshot) {
      globalThis.__turnGetTrackId = snapshot.globals.getTrackId;
      globalThis.__turnGetCollisionProfile = snapshot.globals.collisionProfile;
      globalThis.__turnIsForgivingSurface = snapshot.globals.forgivingSurface;
      runtime.scene.background = snapshot.scene.background;
      runtime.scene.fog = snapshot.scene.fog;
      await activateTrack(snapshot.trackId, runtime);
      await raceSession.selectVehicle(snapshot.vehicle);
      restoreStorage(VEHICLE_SELECTION_KEY, snapshot.storage.vehicle);
      runtime.openLot = snapshot.openLot;
      resetButton.textContent = snapshot.resetLabel;
      leaveButton.textContent = snapshot.leaveLabel;
      if (snapshot.leaveAriaLabel == null) leaveButton.removeAttribute('aria-label');
      else leaveButton.setAttribute('aria-label', snapshot.leaveAriaLabel);
      runtime.state.freeRoam = snapshot.freeRoam;
    }
    configurePrototypeUi(false);
    document.body.classList.remove('turn-world-playground-v2-active');
    trigger.hidden = false;
    Object.assign(session, {
      active: false,
      starting: false,
      world: null,
      course: null,
      snapshot: null,
      preparedAccess: null,
      uiSnapshot: []
    });
    home.showHome({ focus: true });
    trigger.focus();
    window.dispatchEvent(new CustomEvent('turn:world-playground-v2-left'));
  }

  function captureSnapshot() {
    return Object.freeze({
      trackId: home.getSelectedTrackId?.() || runtime.state.trackId || 'countryside',
      vehicle: Object.freeze({
        carId: runtime.state.vehicleId,
        color: runtime.state.vehicleColor,
        secondaryColor: runtime.state.vehicleSecondaryColor
      }),
      storage: Object.freeze({ vehicle: storageSnapshot(VEHICLE_SELECTION_KEY) }),
      globals: Object.freeze({
        getTrackId: globalThis.__turnGetTrackId,
        collisionProfile: globalThis.__turnGetCollisionProfile,
        forgivingSurface: globalThis.__turnIsForgivingSurface
      }),
      scene: Object.freeze({
        background: runtime.scene.background,
        fog: runtime.scene.fog
      }),
      freeRoam: runtime.state.freeRoam === true,
      openLot: runtime.openLot,
      resetLabel: resetButton.textContent,
      leaveLabel: leaveButton.textContent,
      leaveAriaLabel: leaveButton.getAttribute('aria-label')
    });
  }

  function configurePrototypeUi(active) {
    const selectors = ['#lap', '#lapTime', '#bestTime', '.map-wrap', '#scoreFeedback', '.position-hud'];
    if (active) {
      session.uiSnapshot = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((node) => ({
        node,
        hidden: node.hidden,
        parent: node.closest('.chip') !== null && ['lap', 'lapTime', 'bestTime'].includes(node.id) ? node.closest('.chip') : null,
        parentHidden: node.closest('.chip')?.hidden
      })));
      for (const entry of session.uiSnapshot) {
        if (entry.parent) entry.parent.hidden = true;
        else entry.node.hidden = true;
      }
      return;
    }
    for (const entry of session.uiSnapshot) {
      entry.node.hidden = entry.hidden;
      if (entry.parent) entry.parent.hidden = entry.parentHidden;
    }
  }

  function clearWorld() {
    disposeWorldPlaygroundV2Environment(session.world);
    session.world = null;
  }

  function stopFrameLoop() {
    if (session.frame) cancelAnimationFrame(session.frame);
    session.frame = 0;
  }
}

function makeLabTrigger() {
  const existing = document.querySelector('[data-turn-world-v2-lab-trigger]');
  if (existing) return existing;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.turnWorldV2LabTrigger = 'true';
  button.textContent = 'ENTER WORLD V2 ENVIRONMENT';
  button.setAttribute('aria-label', 'Enter the TURN World V2 environment prototype in the Learner Car');
  Object.assign(button.style, {
    position: 'fixed',
    left: '16px',
    bottom: '16px',
    zIndex: '10000',
    padding: '10px 14px',
    border: '3px solid #08090a',
    borderRadius: '999px',
    background: '#fff8e8',
    color: '#08090a',
    font: '800 13px/1.1 system-ui, sans-serif',
    boxShadow: '0 5px 0 #08090a'
  });
  document.body.appendChild(button);
  return button;
}

function storageSnapshot(key) {
  try {
    return Object.freeze({ available: true, value: globalThis.localStorage?.getItem(key) ?? null });
  } catch (_) {
    return Object.freeze({ available: false, value: null });
  }
}

function restoreStorage(key, snapshot) {
  if (!snapshot?.available) return;
  try {
    if (snapshot.value == null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, snapshot.value);
  } catch (_) {}
}

function constrainToWorld(boundary) {
  const runtime = globalThis.__turnRuntime;
  if (!runtime || !boundary.length || pointInsideBoundary(runtime.state.position, boundary)) return;
  const nearest = nearestBoundaryPoint(runtime.state.position, boundary);
  if (!nearest) return;
  const center = boundaryCenter(boundary);
  const inwardX = center.x - nearest.x;
  const inwardZ = center.z - nearest.z;
  const inwardLength = Math.hypot(inwardX, inwardZ) || 1;
  runtime.state.position.x = nearest.x + inwardX / inwardLength * 5;
  runtime.state.position.z = nearest.z + inwardZ / inwardLength * 5;

  const tangentX = nearest.bx - nearest.ax;
  const tangentZ = nearest.bz - nearest.az;
  const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
  const tx = tangentX / tangentLength;
  const tz = tangentZ / tangentLength;
  const along = runtime.state.velocity.x * tx + runtime.state.velocity.z * tz;
  runtime.state.velocity.x = tx * along * 0.86 + inwardX / inwardLength * 2.4;
  runtime.state.velocity.z = tz * along * 0.86 + inwardZ / inwardLength * 2.4;
  runtime.state.speed = runtime.state.velocity.length();
}

function pointInsideBoundary(position, boundary) {
  let inside = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const [xi, zi] = boundary[i];
    const [xj, zj] = boundary[j];
    const crosses = ((zi > position.z) !== (zj > position.z))
      && (position.x < (xj - xi) * (position.z - zi) / ((zj - zi) || 1e-9) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

function nearestBoundaryPoint(position, boundary) {
  let best = null;
  for (let index = 0; index < boundary.length; index += 1) {
    const [ax, az] = boundary[index];
    const [bx, bz] = boundary[(index + 1) % boundary.length];
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSquared = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((position.x - ax) * dx + (position.z - az) * dz) / lengthSquared));
    const x = ax + dx * t;
    const z = az + dz * t;
    const distanceSquared = (position.x - x) ** 2 + (position.z - z) ** 2;
    if (!best || distanceSquared < best.distanceSquared) best = { x, z, ax, az, bx, bz, distanceSquared };
  }
  return best;
}

function boundaryCenter(boundary) {
  const total = boundary.reduce((result, [x, z]) => ({ x: result.x + x, z: result.z + z }), { x: 0, z: 0 });
  return { x: total.x / boundary.length, z: total.z / boundary.length };
}
