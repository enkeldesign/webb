import { updateRaceCameraState } from '/turn/render/camera.js?build=20260720-r19&revision=r270-camera-hotpath';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import { disposeSemanticWorld, loadSemanticWorld } from '/turn-next/world-data.js';

const WORLD_TRACK_ID = 'turn-next-world';
const DEFAULT_RADIUS = 900;
const DEMO_LOCATION = Object.freeze({ lat: 45.9237, lon: 6.8694 });
let installed = false;

export async function installWorldMode() {
  if (installed) return globalThis.__turnNextWorldMode;

  const runtime = globalThis.__turnRuntime;
  const raceSession = globalThis.__turnNextRaceSession;
  const home = globalThis.__turnNextHome || globalThis.__turnHome;
  const menu = globalThis.__turnHomeLayout?.menu || document.querySelector('.m8-home-menu');
  if (!runtime || !raceSession || !home || !menu) return null;

  installed = true;
  installStylesheet();
  const view = createView();
  const launcher = createLauncher(menu, view.dialog);
  const session = {
    active: false,
    loading: false,
    worldData: null,
    snapshot: null,
    frame: 0,
    returnFocus: launcher,
    controller: null,
    lastHudUpdate: 0
  };

  bindView(view, session, { runtime, raceSession, home });

  const api = Object.freeze({
    open: () => openDialog(view.dialog, launcher),
    leave: () => leaveWorld(session, { runtime, raceSession, home }, view),
    getState: () => Object.freeze({ active: session.active, loading: session.loading })
  });
  globalThis.__turnNextWorldMode = api;
  return api;
}

function installStylesheet() {
  if (document.querySelector('link[data-turn-next-world-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/turn-next/world-mode.css';
  link.dataset.turnNextWorldStyle = '';
  document.head.appendChild(link);
}

function createLauncher(menu, dialog) {
  const existing = menu.querySelector('[data-turn-next-world-launcher]');
  if (existing) return existing;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'turn-next-world-launcher';
  button.dataset.turnNextWorldLauncher = '';
  button.textContent = 'WORLD';
  button.setAttribute('aria-label', 'Open the TURN NEXT real-world driving experiment');
  const status = menu.querySelector('.m8-home-status');
  menu.insertBefore(button, status || menu.querySelector('.m8-race-button'));
  button.addEventListener('click', () => openDialog(dialog, button));
  return button;
}

function createView() {
  const dialog = document.createElement('dialog');
  dialog.className = 'turn-next-world-dialog';
  dialog.setAttribute('aria-labelledby', 'turnNextWorldTitle');
  dialog.innerHTML = `
    <form method="dialog" class="turn-next-world-card">
      <header class="turn-next-world-header">
        <div>
          <span>TURN NEXT EXPERIMENT</span>
          <h2 id="turnNextWorldTitle">WORLD</h2>
        </div>
        <button type="submit" class="turn-next-world-close" aria-label="Close real-world driving experiment">×</button>
      </header>
      <p class="turn-next-world-copy">Drive a low-poly 3D version of a real place using TURN. Roads, buildings, water, land use and terrain are generated from open map semantics. No satellite imagery.</p>
      <div class="turn-next-world-fields">
        <label>Latitude
          <input name="latitude" inputmode="decimal" type="number" min="-85" max="85" step="0.0001" required>
        </label>
        <label>Longitude
          <input name="longitude" inputmode="decimal" type="number" min="-180" max="180" step="0.0001" required>
        </label>
        <label>World radius
          <select name="radius">
            <option value="650">650 m · lighter</option>
            <option value="900" selected>900 m · default</option>
            <option value="1250">1.25 km · heavier</option>
          </select>
        </label>
      </div>
      <div class="turn-next-world-presets" aria-label="Location helpers">
        <button type="button" data-world-location>USE MY LOCATION</button>
        <button type="button" data-world-demo>ALPINE DEMO</button>
      </div>
      <p class="turn-next-world-status" role="status" aria-live="polite"></p>
      <button type="button" class="turn-next-world-drive" data-world-drive>DRIVE HERE</button>
      <p class="turn-next-world-note">This is a live experiment using public open-data services. Small areas are intentional.</p>
      <p class="turn-next-world-credits">
        Map data <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> ·
        Terrain <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Mapzen/Tilezen open elevation tiles</a>
      </p>
    </form>`;
  document.body.appendChild(dialog);

  const hud = document.createElement('section');
  hud.className = 'turn-next-world-hud';
  hud.hidden = true;
  hud.setAttribute('aria-label', 'TURN NEXT World status');
  hud.innerHTML = `
    <div class="turn-next-world-hud-copy">
      <strong>WORLD</strong>
      <span data-world-coordinates></span>
      <span data-world-stats></span>
    </div>
    <button type="button" data-world-leave>LEAVE WORLD</button>
    <div class="turn-next-world-hud-credit">
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      <span aria-hidden="true">·</span>
      <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">terrain data</a>
    </div>`;
  document.body.appendChild(hud);

  return {
    dialog,
    hud,
    latitude: dialog.querySelector('[name="latitude"]'),
    longitude: dialog.querySelector('[name="longitude"]'),
    radius: dialog.querySelector('[name="radius"]'),
    locationButton: dialog.querySelector('[data-world-location]'),
    demoButton: dialog.querySelector('[data-world-demo]'),
    driveButton: dialog.querySelector('[data-world-drive]'),
    status: dialog.querySelector('.turn-next-world-status'),
    leaveButton: hud.querySelector('[data-world-leave]'),
    coordinates: hud.querySelector('[data-world-coordinates]'),
    stats: hud.querySelector('[data-world-stats]')
  };
}

function bindView(view, session, context) {
  view.demoButton.addEventListener('click', () => {
    view.latitude.value = DEMO_LOCATION.lat.toFixed(4);
    view.longitude.value = DEMO_LOCATION.lon.toFixed(4);
    view.radius.value = String(DEFAULT_RADIUS);
    setStatus(view, 'Alpine demo coordinates loaded. Press Drive Here to start.');
    view.driveButton.focus();
  });

  view.locationButton.addEventListener('click', () => useBrowserLocation(view));
  view.driveButton.addEventListener('click', () => void startWorld(session, context, view));
  view.leaveButton.addEventListener('click', () => void leaveWorld(session, context, view));
  view.dialog.addEventListener('cancel', () => session.controller?.abort());
  view.dialog.addEventListener('close', () => {
    if (session.loading && !session.active) session.controller?.abort();
  });
}

function useBrowserLocation(view) {
  if (!globalThis.navigator?.geolocation) {
    setStatus(view, 'Location is not available in this browser. Enter coordinates instead.');
    return;
  }

  view.locationButton.disabled = true;
  setStatus(view, 'Requesting your location…');
  globalThis.navigator.geolocation.getCurrentPosition(
    (position) => {
      view.latitude.value = position.coords.latitude.toFixed(5);
      view.longitude.value = position.coords.longitude.toFixed(5);
      setStatus(view, 'Location loaded. Press Drive Here to start.');
      view.locationButton.disabled = false;
      view.driveButton.focus();
    },
    (error) => {
      setStatus(view, error?.message || 'Location could not be read. Enter coordinates instead.');
      view.locationButton.disabled = false;
    },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 }
  );
}

async function startWorld(session, context, view) {
  if (session.active || session.loading) return false;

  const latitude = Number(view.latitude.value);
  const longitude = Number(view.longitude.value);
  const radiusMeters = Number(view.radius.value) || DEFAULT_RADIUS;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    setStatus(view, 'Enter a latitude and longitude, or use one of the location helpers.');
    return false;
  }

  session.loading = true;
  session.controller = new globalThis.AbortController();
  view.driveButton.disabled = true;
  view.driveButton.setAttribute('aria-busy', 'true');
  setStatus(view, 'Preparing controls…');

  try {
    const access = await prepareAccess(context.home, context.raceSession);
    const worldData = await loadSemanticWorld({
      latitude,
      longitude,
      radiusMeters,
      signal: session.controller.signal,
      onStatus: (message) => setStatus(view, message)
    });
    session.snapshot = captureSnapshot(context.runtime, context.home);
    session.worldData = worldData;
    await enterWorld(session, context, view, access);
    closeDialog(view.dialog, { restoreFocus: false });
    return true;
  } catch (error) {
    if (session.snapshot) {
      try {
        await leaveWorld(session, context, view);
      } catch (restoreError) {
        console.warn('TURN NEXT WORLD could not fully restore the previous track.', restoreError);
      }
    } else if (session.worldData) {
      disposeSemanticWorld(session.worldData.world);
      session.worldData = null;
    }

    if (error?.name !== 'AbortError') {
      console.warn('TURN NEXT WORLD could not start.', error);
      setStatus(view, error instanceof Error ? error.message : 'The real-world experiment could not start.');
      if (!view.dialog.open) openDialog(view.dialog, session.returnFocus);
    }
    return false;
  } finally {
    session.loading = false;
    session.controller = null;
    view.driveButton.disabled = false;
    view.driveButton.removeAttribute('aria-busy');
  }
}

async function prepareAccess(home, raceSession) {
  const steeringMode = home.getSteeringMode?.() || 'manual';
  return steeringMode === 'motion'
    ? raceSession.prepareMotionAccess()
    : raceSession.prepareManualAccess();
}

async function enterWorld(session, { runtime, raceSession, home }, view, access) {
  const worldData = session.worldData;
  if (!worldData) throw new Error('The real-world scene was not built.');

  if (runtime.activeWorld) runtime.activeWorld.visible = false;
  runtime.samples.splice(0, runtime.samples.length, ...worldData.samples);
  runtime.trackSpatialIndex.replaceSamples(runtime.samples);
  runtime.trackId = WORLD_TRACK_ID;
  runtime.activeTrack = Object.freeze({
    id: WORLD_TRACK_ID,
    name: 'WORLD',
    freeRoamDistance: worldData.radius * 3,
    collisionProfile: worldData.collisionProfile
  });
  runtime.state.trackId = WORLD_TRACK_ID;
  runtime.state.trackSampleCount = runtime.samples.length;
  runtime.scene.add(worldData.world);
  runtime.activeWorld = worldData.world;
  runtime.scene.background?.setHex?.(0x82c8df);
  if (runtime.scene.fog?.color) {
    runtime.scene.fog.color.setHex(0xaacbd2);
    runtime.scene.fog.near = worldData.radius * 0.45;
    runtime.scene.fog.far = worldData.radius * 1.85;
  }

  globalThis.__turnGetTrackId = () => WORLD_TRACK_ID;
  globalThis.__turnGetCollisionProfile = () => worldData.collisionProfile;
  globalThis.__turnIsForgivingSurface = () => false;
  runtime.openLot = () => leaveWorld(session, { runtime, raceSession, home }, view);

  home.hideHome();
  document.body.classList.add('turn-next-world-active');
  view.hud.hidden = false;
  view.stats.textContent = formatStats(worldData.stats);
  session.active = true;

  await raceSession.startGame(access?.fullscreenPromise || Promise.resolve(false), { announceStart: false });
  runtime.state.freeRoam = true;
  positionAtStart(runtime, worldData);
  runtime.setSceneOverride((dt) => renderWorldFrame(runtime, worldData, dt));
  if (!session.frame) session.frame = requestAnimationFrame(() => worldFrame(session, { runtime }, view));
  showMessage('EXPLORE THE REAL WORLD', 1700);
  window.dispatchEvent(new CustomEvent('turn:next-world-started', {
    detail: Object.freeze({
      latitude: worldData.center.lat,
      longitude: worldData.center.lon,
      radius: worldData.radius
    })
  }));
}

function captureSnapshot(runtime, home) {
  return Object.freeze({
    trackId: home.getSelectedTrackId?.() || runtime.state.trackId || 'countryside',
    openLot: runtime.openLot,
    getTrackId: globalThis.__turnGetTrackId,
    getCollisionProfile: globalThis.__turnGetCollisionProfile,
    isForgivingSurface: globalThis.__turnIsForgivingSurface
  });
}

function positionAtStart(runtime, worldData) {
  const sample = worldData.samples[worldData.startIndex] || worldData.samples[0];
  runtime.setGameMode(runtime.GAME_MODE.STAGED);
  runtime.state.freeRoam = true;
  runtime.state.position.copy(sample.point);
  runtime.state.position.y = worldData.terrain.heightAtWorld(sample.point.x, sample.point.z) + 0.18;
  runtime.state.velocity.set(0, 0, 0);
  runtime.state.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
  runtime.state.speed = 0;
  runtime.state.driftAmount = 0;
  runtime.state.driftSlipAngle = 0;
  runtime.state.offRoad = false;
  runtime.state.trackDistance = 0;
  runtime.state.progress = worldData.startIndex / runtime.samples.length;
  runtime.state.lastProgress = runtime.state.progress;
  runtime.state.nearestTrackIndex = worldData.startIndex;
  runtime.state.lapActive = false;
  runtime.state.lapStartedAt = 0;
  runtime.state.lapElapsed = 0;
  runtime.state.lapCheckpointIndex = 0;
  runtime.state.recording = [];
  runtime.playerCar.position.copy(runtime.state.position);
  runtime.playerCar.rotation.y = runtime.state.heading + Math.PI;
  for (const car of runtime.competitorCars || []) car.visible = false;
  runtime.setRacePosition?.(null, 1);
}

function renderWorldFrame(runtime, worldData, dt) {
  const state = runtime.state;
  state.position.y = worldData.terrain.heightAtWorld(state.position.x, state.position.z) + 0.18;

  const forward = runtime.getForward();
  const probe = 3.8;
  const front = worldData.terrain.heightAtWorld(
    state.position.x + forward.x * probe,
    state.position.z + forward.z * probe
  );
  const back = worldData.terrain.heightAtWorld(
    state.position.x - forward.x * probe,
    state.position.z - forward.z * probe
  );
  const pitch = Math.atan2(front - back, probe * 2);
  state.surfacePitch = pitch;

  runtime.playerCar.position.copy(state.position);
  runtime.playerCar.rotation.x = pitch;
  runtime.playerCar.rotation.y = state.heading + Math.PI;
  runtime.playerCar.rotation.z = -state.steering * 0.035 - state.velocity.dot(runtime.getRight()) * 0.0025;
  runtime.animateWheels?.(runtime.playerCar, state.steering, state.speed, dt);

  updateRaceCameraState({
    state,
    camera: runtime.camera,
    cameraPosition: runtime.cameraPosition,
    cameraTarget: runtime.cameraTarget,
    getForward: runtime.getForward,
    getRight: runtime.getRight,
    samples: [],
    maxSpeed: runtime.maxSpeed,
    dt
  });
  return true;
}

function worldFrame(session, { runtime }, view) {
  if (!session.active) {
    session.frame = 0;
    return;
  }

  const worldData = session.worldData;
  if (runtime.state.running && worldData) {
    clampToWorld(runtime.state, worldData.radius * 1.04);
    suppressCompetitiveRaceState(runtime.state);
    const now = globalThis.performance.now();
    if (now - session.lastHudUpdate > 180) {
      const geo = worldData.toGeo(runtime.state.position.x, runtime.state.position.z);
      view.coordinates.textContent = `${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}`;
      session.lastHudUpdate = now;
    }
  }

  session.frame = requestAnimationFrame(() => worldFrame(session, { runtime }, view));
}

function suppressCompetitiveRaceState(state) {
  state.freeRoam = true;
  state.lapActive = false;
  state.lapInvalid = false;
  state.lapElapsed = 0;
  state.lapCheckpointIndex = 0;
  state.recording = [];
  state.suppressNextLapStartMessage = true;
}

function clampToWorld(state, limit) {
  const distance = Math.hypot(state.position.x, state.position.z);
  if (distance <= limit) return;

  const nx = state.position.x / distance;
  const nz = state.position.z / distance;
  state.position.x = nx * limit;
  state.position.z = nz * limit;
  const outwardSpeed = state.velocity.x * nx + state.velocity.z * nz;
  if (outwardSpeed > 0) {
    state.velocity.x -= nx * outwardSpeed * 1.15;
    state.velocity.z -= nz * outwardSpeed * 1.15;
  }
  state.speed = state.velocity.length();
}

async function leaveWorld(session, { runtime, raceSession, home }, view) {
  if (!session.active && !session.snapshot) return false;

  session.controller?.abort();
  if (session.frame) cancelAnimationFrame(session.frame);
  session.frame = 0;
  runtime.setSceneOverride(null);
  raceSession.leaveRace();
  runtime.state.freeRoam = false;
  document.body.classList.remove('turn-next-world-active');
  view.hud.hidden = true;

  const snapshot = session.snapshot;
  const worldData = session.worldData;
  if (worldData) disposeSemanticWorld(worldData.world);
  if (snapshot) {
    globalThis.__turnGetTrackId = snapshot.getTrackId;
    globalThis.__turnGetCollisionProfile = snapshot.getCollisionProfile;
    globalThis.__turnIsForgivingSurface = snapshot.isForgivingSurface;
    runtime.openLot = snapshot.openLot;
    await activateTrack(snapshot.trackId, runtime);
  }

  session.active = false;
  session.worldData = null;
  session.snapshot = null;
  session.lastHudUpdate = 0;
  home.showHome({ focus: true });
  session.returnFocus?.focus?.();
  window.dispatchEvent(new CustomEvent('turn:next-world-left'));
  return true;
}

function formatStats(stats) {
  const terrain = stats.terrain ? 'terrain' : 'flat terrain';
  return `${stats.roads} roads · ${stats.buildings} buildings · ${stats.semanticAreas} areas · ${terrain}`;
}

function setStatus(view, message) {
  view.status.textContent = message;
}

function showMessage(text, duration = 1600) {
  const message = document.querySelector('#message');
  if (!message) return;
  message.textContent = text;
  message.classList.add('show');
  globalThis.setTimeout(() => message.classList.remove('show'), duration);
}

function openDialog(dialog, returnFocus) {
  dialog.__turnReturnFocus = returnFocus;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog, { restoreFocus = true } = {}) {
  try {
    dialog.close();
  } catch (_) {
    dialog.removeAttribute('open');
  }
  if (restoreFocus) dialog.__turnReturnFocus?.focus?.();
}
