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
  ROAD_HALF_WIDTH,
  TRAINING_BALANCE,
  TRAINING_CAR_ID,
  TRAINING_STAGES
} from './stages.js';
import {
  closeSourceDialog,
  hideTrainingDialog,
  installTrainingView,
  renderTrainingHud,
  showTrainingDialog,
  updatePartDialog
} from './view.js';

const TRAINING_REVISION = 'r149-dbe-training';
const AUDIO_ENABLED_STORAGE_KEY = 'turn-audio-enabled-v1';
const AUDIO_BALANCE_STORAGE_KEY = 'turn-audio-balance-v1';
const DRIVE_BY_EAR_STORAGE_KEY = 'turn-drive-by-ear-v1';
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
    stageIndex: 0,
    stage: null,
    world: null,
    notesFired: new Set(),
    previousProgress: 0,
    finishing: false,
    frame: 0,
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
    getState: () => Object.freeze({
      active: session.active,
      stage: session.stageIndex + 1,
      stageId: session.stage?.id || null
    })
  });
  globalThis.__turnDriveByEarTraining = api;
  return api;

  function bindView() {
    view.introDialog.querySelector('[data-training-start]').addEventListener('click', prepareFirstStart);
    for (const button of view.introDialog.querySelectorAll('[data-training-cancel]')) {
      button.addEventListener('click', cancelIntro);
    }
    for (const button of view.partDialog.querySelectorAll('[data-training-leave]')) {
      button.addEventListener('click', () => void leaveTraining());
    }
    view.partDialog.querySelector('[data-training-next]').addEventListener('click', () => {
      void startStage(session.stageIndex + 1);
    });
    for (const button of view.completeDialog.querySelectorAll('[data-training-return]')) {
      button.addEventListener('click', () => void leaveTraining());
    }
    view.completeDialog.querySelector('[data-training-again]').addEventListener('click', () => {
      void startStage(0);
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
      "Learn TURN's spatial guidance one layer at a time. Training temporarily uses the Training Car and puts Drive By Ear at 95% of the sound mix. Your car and audio choices return when you leave.";
    showTrainingDialog(view.introDialog, '[data-training-start]');
  }

  async function prepareFirstStart() {
    if (session.starting || session.active) return;
    session.starting = true;
    const startButton = view.introDialog.querySelector('[data-training-start]');
    startButton.disabled = true;
    startButton.setAttribute('aria-busy', 'true');
    try {
      session.snapshot = captureSnapshot();
      session.preparedAccess = await prepareAccess();
      await applyTemporaryPreferences();
      await applyTrainingCar();
      session.active = true;
      await startStage(0, { first: true });
    } catch (error) {
      const message = error instanceof Error
        ? `${error.message} Choose on-screen steering in Settings and try again.`
        : 'Training could not start. Choose on-screen steering in Settings and try again.';
      if (session.snapshot) await restoreSession();
      session.active = false;
      view.introDialog.querySelector('[data-training-intro-copy]').textContent = message;
      showTrainingDialog(view.introDialog, '[data-training-start]');
    } finally {
      session.starting = false;
      startButton.disabled = false;
      startButton.removeAttribute('aria-busy');
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
    const stage = TRAINING_STAGES[index];
    session.stageIndex = index;
    session.stage = stage;
    session.notesFired.clear();
    session.finishing = false;
    silencePaceNotes();

    const course = buildTrainingCourse(stage, runtime.trackWidth || ROAD_HALF_WIDTH * 2);
    overrideRuntimeTrack(stage, course);
    positionStageStart(stage);
    renderTrainingHud(view.visualHud, stage, index);
    hideTrainingDialog(view.introDialog);
    hideTrainingDialog(view.partDialog);
    hideTrainingDialog(view.completeDialog);
    home.hideHome();
    document.body.classList.add('turn-dbe-training-active');
    mapWrap.classList.add('turn-dbe-training-hidden-map');
    resetButton.textContent = 'Restart Part';
    leaveButton.textContent = 'Leave Training';
    leaveButton.setAttribute('aria-label', 'Leave Drive By Ear training and return Home');
    runtime.openLot = leaveTraining;

    const fullscreenPromise = first ? session.preparedAccess?.fullscreenPromise : Promise.resolve(false);
    await raceSession.startGame(fullscreenPromise || Promise.resolve(false));
    positionStageStart(stage);
    session.previousProgress = runtime.state.progress;
    if (!session.frame) session.frame = requestAnimationFrame(trainingFrame);
  }

  function overrideRuntimeTrack(stage, course) {
    clearTrainingWorld();
    if (runtime.activeWorld) runtime.activeWorld.visible = false;
    runtime.samples.splice(0, runtime.samples.length, ...course.samples);
    runtime.trackSpatialIndex.replaceSamples(runtime.samples);
    runtime.trackId = stage.id;
    runtime.state.trackId = stage.id;
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
      runtime.scene.fog.far = 700;
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
  }

  function restartPart(event) {
    if (!session.active) return;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    positionStageStart(session.stage);
    session.notesFired.clear();
    session.previousProgress = runtime.state.progress;
    silencePaceNotes();
  }

  function trainingFrame() {
    if (!session.active || !session.stage || !runtime.state.running) {
      session.frame = requestAnimationFrame(trainingFrame);
      return;
    }
    const nearest = runtime.trackSpatialIndex.find(runtime.state.position);
    constrainToCourse(nearest, session.stage);
    const progress = nearest.index / Math.max(1, runtime.samples.length - 1);
    fireScheduledNotes(session.stage, progress);
    session.previousProgress = progress;
    const tangent = nearest.sample?.tangent || new THREE.Vector3();
    const forwardSpeed = runtime.state.velocity.dot(tangent);
    if (!session.finishing && progress >= FINISH_PROGRESS && forwardSpeed > 0.8) {
      session.finishing = true;
      void completePart();
    }
    session.frame = requestAnimationFrame(trainingFrame);
  }

  function constrainToCourse(nearest, stage) {
    if (!nearest?.sample || nearest.distance <= stage.outerLimit) return;
    const sample = nearest.sample;
    const dx = runtime.state.position.x - sample.point.x;
    const dz = runtime.state.position.z - sample.point.z;
    const lateralSign = Math.sign(dx * sample.normal.x + dz * sample.normal.z) || 1;
    runtime.state.position.copy(sample.point).addScaledVector(sample.normal, lateralSign * stage.outerLimit);
    runtime.state.position.y = sample.point.y;
    const outward = runtime.state.velocity.dot(sample.normal) * lateralSign;
    if (outward > 0) runtime.state.velocity.addScaledVector(sample.normal, -outward * lateralSign);
    runtime.state.velocity.multiplyScalar(stage.guideRails ? 0.38 : 0.62);
    runtime.state.speed *= stage.guideRails ? 0.42 : 0.68;
  }

  function fireScheduledNotes(stage, progress) {
    stage.notes.forEach((note, index) => {
      const id = `${stage.id}-note-${index + 1}`;
      if (session.notesFired.has(id)) return;
      if (!(session.previousProgress < note.progress && progress >= note.progress)) return;
      session.notesFired.add(id);
      globalThis.dispatchEvent(new CustomEvent('turn:pace-note-priority', {
        detail: {
          id,
          passageKey: `${stage.id}:${id}`,
          trackId: stage.id,
          progress,
          groups: [Object.freeze({
            direction: note.direction,
            severity: note.severity,
            finalBeepDurationSeconds: note.long ? 0.17 : 0.055
          })]
        }
      }));
    });
  }

  async function completePart() {
    raceSession.leaveRace();
    silencePaceNotes();
    if (session.stageIndex >= TRAINING_STAGES.length - 1) {
      view.visualHud.hidden = true;
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
    Object.assign(session, {
      active: false,
      starting: false,
      stage: null,
      world: null,
      finishing: false,
      snapshot: null,
      preparedAccess: null
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
