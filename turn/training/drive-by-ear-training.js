import * as THREE from 'three';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import {
  DEFAULT_VEHICLE_COLOR,
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  VEHICLE_SELECTION_KEY
} from '/turn/vehicle/catalog.js?build=20260720-r19';
import { buildTrainingCourse, disposeTrainingWorld } from './course.js';
import {
  FINISH_PROGRESS,
  RAIL_ASSIST_START,
  ROAD_HALF_WIDTH,
  SAFETY_ASSIST_START,
  TRAINING_BALANCE,
  TRAINING_CAR_ID,
  TRAINING_STAGES
} from './stages.js';
import {
  closeSourceDialog,
  hideTrainingDialog,
  installTrainingView,
  renderTrainingHud,
  renderTrainingNavigation,
  showTrainingDialog,
  updatePartDialog
} from './view.js';

const TRAINING_REVISION = 'r150-dbe-training-refinement';
const AUDIO_ENABLED_STORAGE_KEY = 'turn-audio-enabled-v1';
const AUDIO_BALANCE_STORAGE_KEY = 'turn-audio-balance-v1';
const DRIVE_BY_EAR_STORAGE_KEY = 'turn-drive-by-ear-v1';
const MAX_PROGRESS_ADVANCE = 0.12;
const HARD_BOUNDARY_OVERSHOOT = 4;
let installed = false;

export async function installDriveByEarTraining(runtime = globalThis.__turnRuntime) {
  if (installed) return globalThis.__turnDriveByEarTraining;
  const home = globalThis.__turnHome;
  const raceSession = globalThis.__turnRaceSession;
  if (!runtime || !home || !raceSession) {
    throw new Error('TURN Drive By Ear training requires the M8 Home and race-session runtime.');
  }

  const resetButton = document.querySelector('#resetButton');
  const leaveButton = document.querySelector('.back-to-lot-button');
  const mapWrap = document.querySelector('.map-wrap');
  if (!resetButton || !leaveButton || !mapWrap) {
    throw new Error('TURN Drive By Ear training could not find the complete race utility interface.');
  }
  installed = true;

  const session = {
    active: false,
    starting: false,
    switching: false,
    stageIndex: 0,
    stage: null,
    world: null,
    notesFired: new Set(),
    previousProgress: 0,
    previousPosition: null,
    finishing: false,
    frame: 0,
    lastFrameAt: 0,
    returnFocus: null,
    snapshot: null,
    preparedAccess: null
  };
  let entryPoints = null;

  const view = installTrainingView({
    revision: TRAINING_REVISION,
    openTraining,
    isTrainingActive: () => session.active
  });
  entryPoints = view.entryPoints;
  bindView();
  resetButton.addEventListener('click', restartPart, true);
  globalThis.addEventListener('pagehide', restorePreferencesForPageExit);

  const api = Object.freeze({
    revision: TRAINING_REVISION,
    stages: TRAINING_STAGES,
    entryPoints,
    ...view,
    open: openTraining,
    leave: leaveTraining,
    restart: restartPart,
    startPart: (index) => startStage(index),
    getState: () => Object.freeze({
      active: session.active,
      stage: session.stageIndex + 1,
      stageId: session.stage?.id || null
    })
  });
  globalThis.__turnDriveByEarTraining = api;
  return api;

  function bindView() {
    for (const button of view.introDialog.querySelectorAll('[data-training-stage]')) {
      button.addEventListener('click', () => {
        void prepareFirstStart(Number(button.dataset.trainingStage) || 0);
      });
    }
    for (const button of view.introDialog.querySelectorAll('[data-training-cancel]')) {
      button.addEventListener('click', cancelIntro);
    }
    for (const button of view.partDialog.querySelectorAll('[data-training-leave]')) {
      button.addEventListener('click', () => void leaveTraining());
    }
    view.partDialog.querySelector('[data-training-repeat]').addEventListener('click', (event) => {
      void startStage(Number(event.currentTarget.dataset.trainingRepeat) || 0);
    });
    view.partDialog.querySelector('[data-training-next]').addEventListener('click', (event) => {
      void startStage(Number(event.currentTarget.dataset.trainingNext) || session.stageIndex + 1);
    });
    for (const button of view.completeDialog.querySelectorAll('[data-training-return]')) {
      button.addEventListener('click', () => void leaveTraining());
    }
    view.completeDialog.querySelector('[data-training-again]').addEventListener('click', () => {
      void startStage(0);
    });

    const previous = view.raceNavigation.querySelector('[data-training-race-previous]');
    const restart = view.raceNavigation.querySelector('[data-training-race-restart]');
    const next = view.raceNavigation.querySelector('[data-training-race-next]');
    previous.addEventListener('click', () => {
      if (!previous.disabled) void startStage(Number(previous.dataset.trainingTarget));
    });
    restart.addEventListener('click', restartPart);
    next.addEventListener('click', () => {
      if (!next.disabled) void startStage(Number(next.dataset.trainingTarget));
    });

    view.introDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      cancelIntro();
    });
    for (const dialog of [view.partDialog, view.completeDialog]) {
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        void leaveTraining();
      });
    }
  }

  function cancelIntro() {
    hideTrainingDialog(view.introDialog);
    session.returnFocus?.focus?.();
  }

  function openTraining(trigger) {
    if (session.active) return;
    session.returnFocus = trigger;
    closeSourceDialog(trigger);
    if (runtime.state.running) {
      raceSession.leaveRace();
      home.showHome();
      session.returnFocus = entryPoints?.homeButton || trigger;
    }
    view.introDialog.querySelector('[data-training-intro-copy]').textContent =
      "Learn TURN's spatial guidance one layer at a time. Choose any part below. Training temporarily uses the Training Car and puts Drive By Ear at 95% of the sound mix. Your car and audio choices return when you leave.";
    showTrainingDialog(view.introDialog, '[data-training-stage="0"]');
  }

  async function prepareFirstStart(stageIndex = 0) {
    if (session.starting || session.active) return;
    session.starting = true;
    setIntroBusy(true);
    try {
      session.snapshot = captureSnapshot();
      session.preparedAccess = await prepareAccess();
      await applyTemporaryPreferences();
      await applyTrainingCar();
      session.active = true;
      await startStage(stageIndex, { first: true });
    } catch (error) {
      const message = error instanceof Error
        ? `${error.message} Choose on-screen steering in Settings and try again.`
        : 'Training could not start. Choose on-screen steering in Settings and try again.';
      if (session.snapshot) await restoreSession();
      session.active = false;
      view.introDialog.querySelector('[data-training-intro-copy]').textContent = message;
      showTrainingDialog(view.introDialog, '[data-training-stage="0"]');
    } finally {
      session.starting = false;
      setIntroBusy(false);
    }
  }

  function setIntroBusy(busy) {
    for (const button of view.introDialog.querySelectorAll('[data-training-stage]')) {
      button.disabled = busy;
      if (busy) button.setAttribute('aria-busy', 'true');
      else button.removeAttribute('aria-busy');
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

  async function startStage(index, { first = false } = {}) {
    const stageIndex = clamp(Math.round(Number(index) || 0), 0, TRAINING_STAGES.length - 1);
    const stage = TRAINING_STAGES[stageIndex];
    if (!session.active || session.switching) return false;
    session.switching = true;

    try {
      if (runtime.state.running) raceSession.leaveRace();
      session.stageIndex = stageIndex;
      session.stage = stage;
      session.notesFired.clear();
      session.finishing = false;
      silencePaceNotes();

      const course = buildTrainingCourse(stage, runtime.trackWidth || ROAD_HALF_WIDTH * 2);
      overrideRuntimeTrack(stage, course);
      positionStageStart(stage);
      renderTrainingHud(view.visualHud, stage, stageIndex);
      renderTrainingNavigation(view.raceNavigation, stageIndex);
      hideTrainingDialog(view.introDialog);
      hideTrainingDialog(view.partDialog);
      hideTrainingDialog(view.completeDialog);
      home.hideHome();
      document.body.classList.add('turn-dbe-training-active');
      mapWrap.classList.add('turn-dbe-training-hidden-map');
      resetButton.textContent = 'Restart Part';
      leaveButton.textContent = 'Leave Training';
      leaveButton.setAttribute('aria-label', 'Leave Drive By Ear 101 and return Home');
      runtime.openLot = leaveTraining;

      const fullscreenPromise = first ? session.preparedAccess?.fullscreenPromise : Promise.resolve(false);
      await raceSession.startGame(fullscreenPromise || Promise.resolve(false));
      positionStageStart(stage);
      session.previousProgress = runtime.state.progress;
      session.previousPosition = snapshotPosition(runtime.state.position);
      session.lastFrameAt = globalThis.performance?.now?.() || 0;
      if (!session.frame) session.frame = requestAnimationFrame(trainingFrame);
      return true;
    } finally {
      session.switching = false;
    }
  }

  function overrideRuntimeTrack(stage, course) {
    clearTrainingWorld();
    if (runtime.activeWorld) runtime.activeWorld.visible = false;
    runtime.samples.splice(0, runtime.samples.length, ...course.samples);
    runtime.trackSpatialIndex.replaceSamples(runtime.samples);
    runtime.trackId = stage.id;
    runtime.state.trackId = stage.id;
    runtime.state.trackSampleCount = runtime.samples.length;
    runtime.activeTrack = Object.freeze({
      id: stage.id,
      name: stage.title,
      collisionProfile: null,
      freeRoamDistance: stage.outerLimit
    });
    runtime.scene.background = new THREE.Color(0x38d9ff);
    if (runtime.scene.fog?.color) {
      runtime.scene.fog.color.setHex(0x74c0fc);
      runtime.scene.fog.near = 180;
      runtime.scene.fog.far = 900;
    }
    runtime.scene.add(course.world);
    runtime.activeWorld = course.world;
    session.world = course.world;
    globalThis.__turnGetTrackId = () => stage.id;
    globalThis.__turnGetCollisionProfile = () => null;
    globalThis.__turnIsForgivingSurface = () => false;
    window.dispatchEvent(new CustomEvent('turn:track-changed', {
      detail: { trackId: stage.id, track: runtime.activeTrack, training: true }
    }));
  }

  function positionStageStart(stage) {
    const startIndex = 8;
    const start = runtime.samples[startIndex];
    runtime.setGameMode(runtime.GAME_MODE.STAGED);
    runtime.state.position.copy(start.point).addScaledVector(start.normal, stage.startOffset);
    runtime.state.position.y = start.point.y;
    runtime.state.velocity.set(0, 0, 0);
    runtime.state.heading = Math.atan2(start.tangent.x, start.tangent.z);
    runtime.state.speed = 0;
    runtime.state.driftAmount = 0;
    runtime.state.offRoad = Math.abs(stage.startOffset) > ROAD_HALF_WIDTH;
    runtime.state.trackDistance = Math.abs(stage.startOffset);
    runtime.state.progress = startIndex / runtime.samples.length;
    runtime.state.lastProgress = runtime.state.progress;
    runtime.state.nearestTrackIndex = startIndex;
    runtime.state.lapCheckpointIndex = 0;
    runtime.state.lapInvalid = false;
    runtime.state.lapStartedAt = 0;
    runtime.state.lapElapsed = 0;
    runtime.state.lapPreviousPosition = { x: runtime.state.position.x, z: runtime.state.position.z };
    runtime.state.recording = [];
    runtime.playerCar.position.copy(runtime.state.position);
    runtime.playerCar.rotation.y = runtime.state.heading + Math.PI;
    runtime.setRacePosition?.(null, 1);
    session.previousPosition = snapshotPosition(runtime.state.position);
  }

  function restartPart(event) {
    if (!session.active || !session.stage || session.switching) return;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    positionStageStart(session.stage);
    session.notesFired.clear();
    session.previousProgress = runtime.state.progress;
    session.previousPosition = snapshotPosition(runtime.state.position);
    session.finishing = false;
    silencePaceNotes();
  }

  function trainingFrame(timestamp) {
    if (!session.active || !session.stage || !runtime.state.running) {
      session.frame = requestAnimationFrame(trainingFrame);
      return;
    }

    const now = Number.isFinite(Number(timestamp))
      ? Number(timestamp)
      : globalThis.performance?.now?.() || 0;
    const dt = session.lastFrameAt
      ? clamp((now - session.lastFrameAt) / 1000, 1 / 240, 0.05)
      : 1 / 60;
    session.lastFrameAt = now;

    let nearest = runtime.trackSpatialIndex.find(runtime.state.position);
    if (constrainToCourse(nearest, session.stage, dt)) {
      nearest = runtime.trackSpatialIndex.find(runtime.state.position);
    }

    const progress = nearest.index / Math.max(1, runtime.samples.length - 1);
    fireScheduledNotes(session.stage, progress);
    const currentPosition = snapshotPosition(runtime.state.position);
    const finish = runtime.samples[Math.floor(runtime.samples.length * FINISH_PROGRESS)];
    const forwardSpeed = runtime.state.velocity.dot(finish.tangent);
    if (
      !session.finishing
      && forwardSpeed > 0.8
      && crossedForwardGate(
        session.previousPosition,
        currentPosition,
        finish,
        (runtime.trackWidth || ROAD_HALF_WIDTH * 2) * 0.62
      )
    ) {
      session.finishing = true;
      void completePart();
    }

    session.previousProgress = progress;
    session.previousPosition = currentPosition;
    session.frame = requestAnimationFrame(trainingFrame);
  }

  function constrainToCourse(nearest, stage, dt) {
    if (!nearest?.sample) return false;
    const distance = Number(nearest.distance) || 0;
    const sample = nearest.sample;
    const side = courseSide(runtime.state.position, sample);

    if (stage.guideRails && distance > RAIL_ASSIST_START) {
      applySlipperyAssist(sample, side, distance - RAIL_ASSIST_START, dt, {
        damping: 6,
        acceleration: 9
      });
    }

    if (distance > SAFETY_ASSIST_START) {
      applySlipperyAssist(sample, side, distance - SAFETY_ASSIST_START, dt, {
        damping: 12,
        acceleration: 24
      });
    }

    if (distance <= stage.outerLimit + HARD_BOUNDARY_OVERSHOOT) {
      runtime.state.speed = runtime.state.velocity.length();
      return false;
    }

    // This is a remote fail-safe beyond the soft rail and safety forces. It keeps
    // tangential motion instead of stopping or snapping the car back onto the road.
    runtime.state.position.copy(sample.point).addScaledVector(
      sample.normal,
      side * (stage.outerLimit + HARD_BOUNDARY_OVERSHOOT * 0.5)
    );
    runtime.state.position.y = sample.point.y;
    const along = runtime.state.velocity.dot(sample.tangent);
    runtime.state.velocity.copy(sample.tangent).multiplyScalar(along * 0.82);
    runtime.state.velocity.addScaledVector(sample.normal, -side * 4);
    runtime.state.speed = runtime.state.velocity.length();
    return true;
  }

  function applySlipperyAssist(sample, side, penetration, dt, profile) {
    const outwardSpeed = runtime.state.velocity.dot(sample.normal) * side;
    if (outwardSpeed > 0) {
      const damping = 1 - Math.exp(-profile.damping * dt);
      runtime.state.velocity.addScaledVector(
        sample.normal,
        -side * outwardSpeed * damping
      );
    }
    const inwardAcceleration = profile.acceleration + Math.min(28, penetration * 3.5);
    runtime.state.velocity.addScaledVector(
      sample.normal,
      -side * inwardAcceleration * dt
    );
  }

  function fireScheduledNotes(stage, progress) {
    const advance = progress - session.previousProgress;
    if (advance < 0 || advance > MAX_PROGRESS_ADVANCE) return;

    stage.notes.forEach((paceNote, index) => {
      const id = `${stage.id}-note-${index + 1}`;
      if (session.notesFired.has(id)) return;
      if (!(session.previousProgress < paceNote.progress && progress >= paceNote.progress)) return;
      session.notesFired.add(id);
      globalThis.dispatchEvent(new CustomEvent('turn:pace-note-priority', {
        detail: {
          id,
          passageKey: `${stage.id}:${id}`,
          trackId: stage.id,
          progress,
          groups: [Object.freeze({
            direction: paceNote.direction,
            severity: paceNote.severity,
            finalBeepDurationSeconds: paceNote.long ? 0.17 : 0.055
          })]
        }
      }));
    });
  }

  async function completePart() {
    raceSession.leaveRace();
    silencePaceNotes();
    view.raceNavigation.hidden = true;
    view.visualHud.hidden = true;
    if (session.stageIndex >= TRAINING_STAGES.length - 1) {
      showTrainingDialog(view.completeDialog, '[data-training-again]');
      return;
    }
    updatePartDialog(view.partDialog, session.stageIndex + 1);
    showTrainingDialog(view.partDialog, '[data-training-next]');
  }

  async function leaveTraining() {
    hideTrainingDialog(view.introDialog);
    hideTrainingDialog(view.partDialog);
    hideTrainingDialog(view.completeDialog);
    await restoreSession();
    session.returnFocus?.focus?.();
    return true;
  }

  async function restoreSession() {
    stopFrameLoop();
    silencePaceNotes();
    raceSession.leaveRace();
    clearTrainingWorld();
    const snapshot = session.snapshot;
    if (snapshot) {
      globalThis.__turnGetTrackId = snapshot.globals.getTrackId;
      globalThis.__turnGetCollisionProfile = snapshot.globals.collisionProfile;
      globalThis.__turnIsForgivingSurface = snapshot.globals.forgivingSurface;
      restoreAudio(snapshot);
      await activateTrack(snapshot.trackId, runtime);
      await raceSession.selectVehicle(snapshot.vehicle);
      restorePreferenceStorage(snapshot);
      runtime.openLot = snapshot.openLot;
      resetButton.textContent = snapshot.resetLabel;
      leaveButton.textContent = snapshot.leaveLabel;
      if (snapshot.leaveAriaLabel == null) leaveButton.removeAttribute('aria-label');
      else leaveButton.setAttribute('aria-label', snapshot.leaveAriaLabel);
    }
    document.body.classList.remove('turn-dbe-training-active');
    mapWrap.classList.remove('turn-dbe-training-hidden-map');
    view.visualHud.hidden = true;
    view.raceNavigation.hidden = true;
    Object.assign(session, {
      active: false,
      starting: false,
      switching: false,
      stage: null,
      world: null,
      finishing: false,
      previousPosition: null,
      snapshot: null,
      preparedAccess: null,
      lastFrameAt: 0
    });
    session.notesFired.clear();
    home.showHome({ focus: true });
  }

  function captureSnapshot() {
    const preferences = globalThis.__turnAudioPreferences?.getSettings?.() || {};
    return Object.freeze({
      trackId: home.getSelectedTrackId?.() || runtime.state.trackId || 'countryside',
      vehicle: Object.freeze({
        carId: runtime.state.vehicleId,
        color: runtime.state.vehicleColor,
        secondaryColor: runtime.state.vehicleSecondaryColor
      }),
      audio: Object.freeze({
        audioEnabled: preferences.audioEnabled !== false,
        dbeEnabled: preferences.dbeEnabled !== false,
        balance: Number.isFinite(Number(preferences.balance)) ? Number(preferences.balance) : 0.5
      }),
      storage: Object.freeze({
        audioEnabled: storageSnapshot(AUDIO_ENABLED_STORAGE_KEY),
        balance: storageSnapshot(AUDIO_BALANCE_STORAGE_KEY),
        dbe: storageSnapshot(DRIVE_BY_EAR_STORAGE_KEY),
        vehicle: storageSnapshot(VEHICLE_SELECTION_KEY)
      }),
      globals: Object.freeze({
        getTrackId: globalThis.__turnGetTrackId,
        collisionProfile: globalThis.__turnGetCollisionProfile,
        forgivingSurface: globalThis.__turnIsForgivingSurface
      }),
      openLot: runtime.openLot,
      resetLabel: resetButton.textContent,
      leaveLabel: leaveButton.textContent,
      leaveAriaLabel: leaveButton.getAttribute('aria-label')
    });
  }

  async function applyTemporaryPreferences() {
    await globalThis.__turnEnsureDriveByEarRuntime?.();
    const preferences = globalThis.__turnAudioPreferences;
    preferences?.setAudioEnabled?.(true);
    preferences?.setDriveByEarEnabled?.(true);
    preferences?.setBalance?.(TRAINING_BALANCE);
    restorePreferenceStorage(session.snapshot);
    await globalThis.__turnAudio?.unlock?.();
  }

  async function applyTrainingCar() {
    await raceSession.selectVehicle({
      carId: TRAINING_CAR_ID,
      color: DEFAULT_VEHICLE_COLOR,
      secondaryColor: DEFAULT_VEHICLE_SECONDARY_COLOR
    });
    restoreStorage(VEHICLE_SELECTION_KEY, session.snapshot?.storage?.vehicle);
  }

  function restoreAudio(snapshot) {
    const preferences = globalThis.__turnAudioPreferences;
    preferences?.setAudioEnabled?.(snapshot.audio.audioEnabled);
    preferences?.setDriveByEarEnabled?.(snapshot.audio.dbeEnabled);
    preferences?.setBalance?.(snapshot.audio.balance);
    restorePreferenceStorage(snapshot);
  }

  function restorePreferencesForPageExit() {
    if (!session.active || !session.snapshot) return;
    restoreAudio(session.snapshot);
  }

  function restorePreferenceStorage(snapshot) {
    const storage = snapshot?.storage;
    if (!storage) return;
    restoreStorage(AUDIO_ENABLED_STORAGE_KEY, storage.audioEnabled);
    restoreStorage(AUDIO_BALANCE_STORAGE_KEY, storage.balance);
    restoreStorage(DRIVE_BY_EAR_STORAGE_KEY, storage.dbe);
    restoreStorage(VEHICLE_SELECTION_KEY, storage.vehicle);
  }

  function clearTrainingWorld() {
    disposeTrainingWorld(session.world);
    session.world = null;
  }

  function stopFrameLoop() {
    if (session.frame) cancelAnimationFrame(session.frame);
    session.frame = 0;
  }

  function silencePaceNotes() {
    globalThis.dispatchEvent(new CustomEvent('turn:pace-note-silence'));
  }
}

function crossedForwardGate(previousPosition, currentPosition, sample, halfWidth) {
  if (!previousPosition || !currentPosition || !sample?.point || !sample?.tangent) return false;
  const tx = Number(sample.tangent.x) || 0;
  const tz = Number(sample.tangent.z) || 0;
  const length = Math.hypot(tx, tz);
  if (length <= 1e-6) return false;
  const tangentX = tx / length;
  const tangentZ = tz / length;
  const normalX = -tangentZ;
  const normalZ = tangentX;
  const centerX = Number(sample.point.x) || 0;
  const centerZ = Number(sample.point.z) || 0;
  const previousLongitudinal = (previousPosition.x - centerX) * tangentX
    + (previousPosition.z - centerZ) * tangentZ;
  const currentLongitudinal = (currentPosition.x - centerX) * tangentX
    + (currentPosition.z - centerZ) * tangentZ;
  if (!(previousLongitudinal <= 0 && currentLongitudinal > 0)) return false;
  const step = currentLongitudinal - previousLongitudinal;
  if (step <= 1e-6) return false;
  const crossingT = clamp(-previousLongitudinal / step, 0, 1);
  const crossingX = previousPosition.x + (currentPosition.x - previousPosition.x) * crossingT;
  const crossingZ = previousPosition.z + (currentPosition.z - previousPosition.z) * crossingT;
  const lateral = Math.abs((crossingX - centerX) * normalX + (crossingZ - centerZ) * normalZ);
  return lateral <= halfWidth;
}

function courseSide(position, sample) {
  const dx = (Number(position?.x) || 0) - (Number(sample?.point?.x) || 0);
  const dz = (Number(position?.z) || 0) - (Number(sample?.point?.z) || 0);
  return Math.sign(dx * sample.normal.x + dz * sample.normal.z) || 1;
}

function snapshotPosition(position) {
  return {
    x: Number(position?.x) || 0,
    z: Number(position?.z) || 0
  };
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
