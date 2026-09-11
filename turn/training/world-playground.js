import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import {
  DEFAULT_VEHICLE_COLOR,
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  VEHICLE_SELECTION_KEY
} from '/turn/vehicle/catalog.js?build=20260720-r19';
import { TRAINING_CAR_ID } from './stages.js';
import {
  WORLD_PLAYGROUND_TRACK_ID,
  buildWorldPlayground,
  disposeWorldPlayground
} from './world-playground-course.js?revision=r1-map-layout';

const REVISION = 'r1-map-layout';
let installed = false;

export async function installWorldPlayground(runtime = globalThis.__turnRuntime) {
  if (installed) return globalThis.__turnWorldPlayground;
  const home = globalThis.__turnHome;
  const raceSession = globalThis.__turnRaceSession;
  if (!runtime || !home || !raceSession) {
    throw new Error('TURN World Playground requires the Home and race-session runtime.');
  }

  const entry = document.querySelector('[data-turn-world-playground-entry]');
  const resetButton = document.querySelector('#resetButton');
  const leaveButton = document.querySelector('.back-to-lot-button');
  const mapWrap = document.querySelector('.map-wrap');
  if (!entry || !resetButton || !leaveButton || !mapWrap) {
    throw new Error('TURN World Playground could not find its HOW TO PLAY entry or race utilities.');
  }

  installed = true;
  const session = {
    active: false,
    starting: false,
    world: null,
    course: null,
    frame: 0,
    returnFocus: null,
    snapshot: null,
    preparedAccess: null
  };

  entry.addEventListener('click', () => void start(entry));
  resetButton.addEventListener('click', restart, true);

  const api = Object.freeze({
    revision: REVISION,
    entry,
    start,
    leave,
    restart,
    getState: () => Object.freeze({ active: session.active, trackId: session.active ? WORLD_PLAYGROUND_TRACK_ID : null })
  });
  globalThis.__turnWorldPlayground = api;
  return api;

  async function start(trigger = entry) {
    if (session.active || session.starting) return false;
    session.starting = true;
    session.returnFocus = trigger;
    trigger.setAttribute('aria-busy', 'true');
    try {
      session.snapshot = captureSnapshot();
      closeSourceDialog(trigger);
      if (runtime.state.running) {
        raceSession.leaveRace();
        home.showHome();
      }

      session.preparedAccess = await prepareAccess();
      await raceSession.selectVehicle({
        carId: TRAINING_CAR_ID,
        color: DEFAULT_VEHICLE_COLOR,
        secondaryColor: DEFAULT_VEHICLE_SECONDARY_COLOR
      });
      restoreStorage(VEHICLE_SELECTION_KEY, session.snapshot.storage.vehicle);

      session.course = buildWorldPlayground(runtime.trackWidth || 38);
      overrideRuntimeTrack(session.course);
      positionStart();
      session.active = true;

      home.hideHome();
      document.body.classList.add('turn-world-playground-active');
      mapWrap.hidden = true;
      resetButton.textContent = 'Restart Playground';
      leaveButton.textContent = 'Leave Playground';
      leaveButton.setAttribute('aria-label', 'Leave the TURN world playground and return Home');
      runtime.openLot = leave;

      const fullscreenPromise = session.preparedAccess?.fullscreenPromise || Promise.resolve(false);
      await raceSession.startGame(fullscreenPromise, { announceStart: false });
      runtime.state.freeRoam = true;
      positionStart();
      globalThis.__turnShowMessage?.('EXPLORE TURN', 1800);
      if (!session.frame) session.frame = requestAnimationFrame(playgroundFrame);
      window.dispatchEvent(new CustomEvent('turn:world-playground-started', {
        detail: Object.freeze({ trackId: WORLD_PLAYGROUND_TRACK_ID })
      }));
      return true;
    } catch (error) {
      console.warn('TURN: World Playground could not start.', error);
      if (session.snapshot) await restoreSession();
      return false;
    } finally {
      session.starting = false;
      trigger.removeAttribute('aria-busy');
    }
  }

  async function prepareAccess() {
    const steeringMode = home.getSteeringMode?.() || 'manual';
    if (steeringMode === 'motion' && runtime.state.sensorMode) {
      return Object.freeze({
        mode: 'motion',
        fullscreenPromise: raceSession.requestGameFullscreen()
      });
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
    runtime.trackId = WORLD_PLAYGROUND_TRACK_ID;
    runtime.state.trackId = WORLD_PLAYGROUND_TRACK_ID;
    runtime.state.trackSampleCount = runtime.samples.length;
    runtime.activeTrack = Object.freeze({
      id: WORLD_PLAYGROUND_TRACK_ID,
      name: 'TURN WORLD',
      collisionProfile: null,
      freeRoamDistance: 1000
    });
    runtime.scene.background?.setHex?.(0x78c8e5);
    if (runtime.scene.fog?.color) {
      runtime.scene.fog.color.setHex(0xb9d9df);
      runtime.scene.fog.near = 300;
      runtime.scene.fog.far = 1250;
    }
    runtime.scene.add(course.world);
    runtime.activeWorld = course.world;
    session.world = course.world;
    globalThis.__turnGetTrackId = () => WORLD_PLAYGROUND_TRACK_ID;
    globalThis.__turnGetCollisionProfile = () => null;
    globalThis.__turnIsForgivingSurface = () => true;
    window.dispatchEvent(new CustomEvent('turn:track-changed', {
      detail: { trackId: WORLD_PLAYGROUND_TRACK_ID, track: runtime.activeTrack, playground: true }
    }));
  }

  function positionStart() {
    const course = session.course;
    if (!course?.samples?.length) return;
    const start = course.samples[course.startIndex];
    runtime.setGameMode(runtime.GAME_MODE.STAGED);
    runtime.state.freeRoam = true;
    runtime.state.position.copy(start.point);
    runtime.state.position.y = start.point.y;
    runtime.state.velocity.set(0, 0, 0);
    runtime.state.heading = Math.atan2(start.tangent.x, start.tangent.z);
    runtime.state.speed = 0;
    runtime.state.driftAmount = 0;
    runtime.state.offRoad = false;
    runtime.state.trackDistance = 0;
    runtime.state.progress = course.startIndex / runtime.samples.length;
    runtime.state.lastProgress = runtime.state.progress;
    runtime.state.nearestTrackIndex = course.startIndex;
    runtime.state.lapCheckpointIndex = 0;
    runtime.state.lapInvalid = false;
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
    globalThis.__turnShowMessage?.('PLAYGROUND RESTARTED', 1200);
  }

  function playgroundFrame() {
    if (!session.active) {
      session.frame = 0;
      return;
    }
    if (runtime.state.running) constrainToWorld(session.course?.boundary || []);
    session.frame = requestAnimationFrame(playgroundFrame);
  }

  function constrainToWorld(boundary) {
    if (!boundary.length || pointInsideBoundary(runtime.state.position, boundary)) return;
    const nearest = nearestBoundaryPoint(runtime.state.position, boundary);
    if (!nearest) return;
    const center = boundaryCenter(boundary);
    const inwardX = center.x - nearest.x;
    const inwardZ = center.z - nearest.z;
    const inwardLength = Math.hypot(inwardX, inwardZ) || 1;
    runtime.state.position.x = nearest.x + inwardX / inwardLength * 3;
    runtime.state.position.z = nearest.z + inwardZ / inwardLength * 3;

    // Keep motion along the invisible wall and remove only outward travel. The result
    // behaves like a broad theme-park boundary rather than a teleport/reset volume.
    const tangentX = nearest.bx - nearest.ax;
    const tangentZ = nearest.bz - nearest.az;
    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
    const tx = tangentX / tangentLength;
    const tz = tangentZ / tangentLength;
    const along = runtime.state.velocity.x * tx + runtime.state.velocity.z * tz;
    runtime.state.velocity.x = tx * along * 0.82 + inwardX / inwardLength * 3;
    runtime.state.velocity.z = tz * along * 0.82 + inwardZ / inwardLength * 3;
    runtime.state.speed = runtime.state.velocity.length();
  }

  async function leave() {
    if (!session.active && !session.snapshot) return false;
    await restoreSession();
    session.returnFocus?.focus?.();
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
      await activateTrack(snapshot.trackId, runtime);
      await raceSession.selectVehicle(snapshot.vehicle);
      restoreStorage(VEHICLE_SELECTION_KEY, snapshot.storage.vehicle);
      runtime.openLot = snapshot.openLot;
      resetButton.textContent = snapshot.resetLabel;
      leaveButton.textContent = snapshot.leaveLabel;
      if (snapshot.leaveAriaLabel == null) leaveButton.removeAttribute('aria-label');
      else leaveButton.setAttribute('aria-label', snapshot.leaveAriaLabel);
      mapWrap.hidden = snapshot.mapHidden;
      runtime.state.freeRoam = snapshot.freeRoam;
    }
    document.body.classList.remove('turn-world-playground-active');
    Object.assign(session, {
      active: false,
      starting: false,
      world: null,
      course: null,
      snapshot: null,
      preparedAccess: null
    });
    home.showHome({ focus: true });
    window.dispatchEvent(new CustomEvent('turn:world-playground-left'));
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
      freeRoam: runtime.state.freeRoam === true,
      openLot: runtime.openLot,
      resetLabel: resetButton.textContent,
      leaveLabel: leaveButton.textContent,
      leaveAriaLabel: leaveButton.getAttribute('aria-label'),
      mapHidden: mapWrap.hidden
    });
  }

  function clearWorld() {
    disposeWorldPlayground(session.world);
    session.world = null;
  }

  function stopFrameLoop() {
    if (session.frame) cancelAnimationFrame(session.frame);
    session.frame = 0;
  }
}

function closeSourceDialog(trigger) {
  const dialog = trigger?.closest?.('dialog');
  if (!dialog) return;
  try {
    dialog.close();
  } catch (_) {
    dialog.removeAttribute('open');
  }
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
    if (!best || distanceSquared < best.distanceSquared) {
      best = { x, z, ax, az, bx, bz, distanceSquared };
    }
  }
  return best;
}

function boundaryCenter(boundary) {
  const total = boundary.reduce((result, [x, z]) => ({ x: result.x + x, z: result.z + z }), { x: 0, z: 0 });
  return { x: total.x / boundary.length, z: total.z / boundary.length };
}
