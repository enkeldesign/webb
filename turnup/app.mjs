import { createWebPlatform } from '/turn/platform/web-platform.js';
import { installTurnPlatform } from '/turn/platform/platform-context.js';
import {
  motionPoseFromGravity,
  resolveMotionSteeringProfile,
  updateMotionInputState
} from '/turn/input/motion.js';
import { createFlightAudio } from './audio.mjs';
import {
  checkpointReached,
  controlFromAngle,
  createFlightState,
  degreesToRadians,
  distanceBetween,
  formatCourseTime,
  headingToTarget,
  metresPerSecondToKnots,
  radiansToDegrees,
  shortestAngle,
  updateFlightState
} from './flight-model.mjs';
import { COURSE_POINTS, createFlightScene } from './scene.mjs?build=20260822-r4';

const BUILD = '2026.08.22-r4';
const BEST_TIME_KEY = 'turnup.bestCourseSeconds.v1';
const SETTINGS_KEY = 'turnup.settings.v1';
const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const elements = {
  body: document.body,
  game: requireElement('#game'),
  intro: requireElement('#intro'),
  takeOff: requireElement('#takeOffButton'),
  manualStart: requireElement('#manualStartButton'),
  how: requireElement('#howButton'),
  about: requireElement('#aboutButton'),
  loadingStatus: requireElement('#loadingStatus'),
  modelStatus: requireElement('#modelStatus'),
  hud: requireElement('#hud'),
  controls: requireElement('#controls'),
  manualControls: requireElement('#manualControls'),
  recalibrate: requireElement('#recalibrateButton'),
  pause: requireElement('#pauseButton'),
  gate: requireElement('#gateValue'),
  altitude: requireElement('#altitudeValue'),
  speed: requireElement('#speedValue'),
  throttle: requireElement('#throttleValue'),
  time: requireElement('#timeValue'),
  targetName: requireElement('#targetNameValue'),
  distance: requireElement('#distanceValue'),
  courseNeedle: requireElement('#courseNeedle'),
  attitude: requireElement('#attitudeIndicator'),
  throttleFill: requireElement('#throttleFill'),
  flightMessage: requireElement('#flightMessage'),
  rotateTitle: requireElement('#rotateTitle'),
  pauseDialog: requireElement('#pauseDialog'),
  resume: requireElement('#resumeButton'),
  restart: requireElement('#restartButton'),
  switchControls: requireElement('#switchControlsButton'),
  leave: requireElement('#leaveButton'),
  soundToggle: requireElement('#soundToggle'),
  invertPitch: requireElement('#invertPitchToggle'),
  pauseMode: requireElement('#pauseMode'),
  resultDialog: requireElement('#resultDialog'),
  resultTime: requireElement('#resultTime'),
  resultBest: requireElement('#resultBest'),
  flyAgain: requireElement('#flyAgainButton'),
  resultLeave: requireElement('#resultLeaveButton'),
  howDialog: requireElement('#howDialog'),
  howClose: requireElement('#howCloseButton'),
  aboutDialog: requireElement('#aboutDialog'),
  aboutClose: requireElement('#aboutCloseButton'),
  thrust: requireElement('#thrustButton'),
  airBrake: requireElement('#airBrakeButton'),
  bankLeft: requireElement('#bankLeftButton'),
  bankRight: requireElement('#bankRightButton'),
  pitchUp: requireElement('#pitchUpButton'),
  pitchDown: requireElement('#pitchDownButton'),
  build: requireElement('#buildLabel')
};

const settings = loadSettings();
elements.soundToggle.checked = settings.sound;
elements.invertPitch.checked = settings.invertPitch;
elements.build.textContent = `TURN UP · BUILD ${BUILD.toUpperCase()}`;

const platform = createWebPlatform();
installTurnPlatform(platform);
const audio = createFlightAudio();
if (!settings.sound) void audio.setEnabled(false);

const steeringProfile = resolveMotionSteeringProfile();
const motionState = {
  sensorMode: true,
  roll: 0,
  targetRoll: 0,
  neutralRoll: 0,
  pitch: 0,
  targetPitch: 0,
  neutralPitch: 0,
  steering: 0,
  manualSteering: 0,
  tiltDrive: 0,
  steeringEngaged: false
};

let latestMotionPose = null;
let pendingCalibration = true;
let unsubscribeMotion = null;
let motionPermissionGranted = false;
let controlMode = platform.motion.isAvailable() ? 'tilt' : 'manual';
let flightState = createFlightState();
let flightScene = null;
let gateIndex = 0;
let playing = false;
let paused = false;
let animationFrame = 0;
let previousFrameTime = 0;
let messageTimer = 0;
let crashCooldown = 0;
let announcedStall = false;
const activeKeys = new Set();
const activePointers = new Set();
const clickImpulseTimers = new Map();

setLaunchEnabled(false);
const slowLoadingTimer = globalThis.setTimeout(() => {
  elements.loadingStatus.textContent = 'Still loading TURN UP. First start can take a little longer.';
}, 5000);

const scenePromise = createFlightScene(elements.game, {
  reducedMotion,
  onModelStatus(message) {
    elements.modelStatus.textContent = message;
  }
}).then((scene) => {
  flightScene = scene;
  flightState = createFlightState(scene.startPose);
  scene.render(flightState, 0);
  setLaunchEnabled(true);
  globalThis.clearTimeout(slowLoadingTimer);
  elements.loadingStatus.textContent = platform.motion.isAvailable()
    ? 'Ready. Take off with tilt controls or choose buttons.'
    : 'Ready. Motion sensors are unavailable here, so button controls will be used.';
  document.documentElement.dataset.turnUpReady = 'true';
  return scene;
}).catch((error) => {
  console.error('TURN UP could not start.', error);
  globalThis.clearTimeout(slowLoadingTimer);
  elements.loadingStatus.textContent = /WebGL2/i.test(String(error?.message))
    ? 'TURN UP needs WebGL2 for its 3D map. Try a current Safari, Chrome or Firefox browser.'
    : 'TURN UP could not load. Check your connection and try again.';
  elements.modelStatus.textContent = 'The map and aircraft could not start on this device.';
  document.documentElement.dataset.turnUpReady = 'unsupported';
  setLaunchEnabled(false);
  return null;
});

elements.takeOff.addEventListener('click', () => startFlight('tilt'));
elements.manualStart.addEventListener('click', () => startFlight('manual'));
elements.how.addEventListener('click', () => openDialog(elements.howDialog));
elements.about.addEventListener('click', () => openDialog(elements.aboutDialog));
elements.howClose.addEventListener('click', () => elements.howDialog.close());
elements.aboutClose.addEventListener('click', () => elements.aboutDialog.close());
elements.pause.addEventListener('click', pauseFlight);
elements.resume.addEventListener('click', resumeFlight);
elements.restart.addEventListener('click', () => {
  closeDialog(elements.pauseDialog);
  resetCourse();
  paused = false;
  void audio.resume();
});
elements.switchControls.addEventListener('click', switchControlMode);
elements.leave.addEventListener('click', leaveFlight);
elements.flyAgain.addEventListener('click', () => {
  closeDialog(elements.resultDialog);
  resetCourse();
  paused = false;
  playing = true;
  previousFrameTime = performance.now();
  void audio.resume();
});
elements.resultLeave.addEventListener('click', leaveFlight);
elements.recalibrate.addEventListener('click', () => calibrateMotion(true));
elements.soundToggle.addEventListener('change', () => {
  settings.sound = elements.soundToggle.checked;
  saveSettings();
  void audio.setEnabled(settings.sound);
});
elements.invertPitch.addEventListener('change', () => {
  settings.invertPitch = elements.invertPitch.checked;
  saveSettings();
  announce(settings.invertPitch ? 'Pitch controls inverted.' : 'Pitch controls use the standard direction.');
});

bindHoldControl(elements.thrust, 'thrust');
bindHoldControl(elements.airBrake, 'brake');
bindHoldControl(elements.bankLeft, 'left');
bindHoldControl(elements.bankRight, 'right');
bindHoldControl(elements.pitchUp, 'up');
bindHoldControl(elements.pitchDown, 'down');

globalThis.addEventListener('keydown', onKeyDown, { passive: false });
globalThis.addEventListener('keyup', onKeyUp, { passive: false });
globalThis.addEventListener('resize', onResize, { passive: true });
globalThis.screen?.orientation?.addEventListener?.('change', onResize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing && !paused) pauseFlight();
});

const portraitQuery = globalThis.matchMedia?.('(orientation: portrait)');
portraitQuery?.addEventListener?.('change', (event) => {
  if (playing && event.matches) {
    elements.rotateTitle.focus();
    announce('Rotate your device to landscape to keep flying.');
  }
});

async function startFlight(requestedMode) {
  setLaunchEnabled(false);
  elements.loadingStatus.textContent = 'Preparing your flight…';
  const readyScene = await scenePromise;
  if (!readyScene) return;

  let resolvedMode = requestedMode;
  if (requestedMode === 'tilt') {
    resolvedMode = await prepareTiltControls() ? 'tilt' : 'manual';
  } else {
    void platform.display.requestFullscreen();
    void platform.display.lockLandscape();
  }

  controlMode = resolvedMode;
  motionState.sensorMode = resolvedMode === 'tilt';
  applyControlModePresentation();
  resetCourse();
  elements.intro.hidden = true;
  elements.intro.setAttribute('aria-hidden', 'true');
  elements.hud.hidden = false;
  elements.controls.hidden = false;
  elements.body.classList.add('is-flying');
  playing = true;
  paused = false;
  previousFrameTime = performance.now();
  setLaunchEnabled(true);
  void audio.start();

  announce(resolvedMode === 'tilt'
    ? `Flight started. Tilt left and right to bank. Tilt up or down to climb and dive. First gate: ${flightScene.getGate(0).label}.`
    : `Flight started with button controls. First gate: ${flightScene.getGate(0).label}.`);
  if (!animationFrame) animationFrame = requestAnimationFrame(frame);
}

async function prepareTiltControls() {
  if (!platform.motion.isAvailable()) {
    elements.loadingStatus.textContent = 'Motion sensors are unavailable. Using button controls.';
    return false;
  }

  const permissionRequest = platform.motion.requestPermission();
  const fullscreenRequest = platform.display.requestFullscreen();
  const landscapeRequest = platform.display.lockLandscape();
  const [permission] = await Promise.allSettled([
    permissionRequest,
    fullscreenRequest,
    landscapeRequest
  ]);

  if (permission.status !== 'fulfilled') {
    elements.loadingStatus.textContent = 'Motion access was not granted. Using button controls instead.';
    announce('Motion access was not granted. Button controls are ready.');
    return false;
  }

  motionPermissionGranted = true;
  ensureMotionSubscription();
  pendingCalibration = true;
  return true;
}

function ensureMotionSubscription() {
  if (unsubscribeMotion) return;
  unsubscribeMotion = platform.motion.subscribe((event) => {
    const pose = motionPoseFromGravity(event);
    if (!pose) return;
    latestMotionPose = pose;
    motionState.targetRoll = pose.roll;
    motionState.targetPitch = pose.pitch;
    if (pendingCalibration) calibrateMotion(false);
  });
}

function calibrateMotion(withAnnouncement) {
  const pose = latestMotionPose;
  if (!pose) {
    pendingCalibration = true;
    if (withAnnouncement) announce('Hold your device comfortably. Calibration will finish when motion data arrives.');
    return false;
  }

  motionState.roll = pose.roll;
  motionState.targetRoll = pose.roll;
  motionState.neutralRoll = pose.roll;
  motionState.pitch = pose.pitch;
  motionState.targetPitch = pose.pitch;
  motionState.neutralPitch = pose.pitch;
  motionState.steering = 0;
  motionState.steeringEngaged = false;
  pendingCalibration = false;
  if (withAnnouncement) announce('Flight controls recalibrated.');
  return true;
}

function frame(now) {
  animationFrame = requestAnimationFrame(frame);
  if (!flightScene) return;

  if (!playing || paused) {
    flightScene.render(flightState, now / 1000);
    previousFrameTime = now;
    return;
  }

  const elapsed = Math.min(0.12, Math.max(0, (now - previousFrameTime) / 1000));
  previousFrameTime = now;
  const manual = readManualControls();
  motionState.manualSteering = manual.steering;
  motionState.sensorMode = controlMode === 'tilt';
  updateMotionInputState({
    state: motionState,
    dt: Math.min(elapsed, 0.05),
    maxSteerRoll: degreesToRadians(24),
    steeringProfile
  });

  const pitchControl = controlMode === 'tilt'
    ? controlFromAngle(motionState.pitch - motionState.neutralPitch, {
      limitRadians: degreesToRadians(19),
      deadZoneRadians: degreesToRadians(1.7),
      invert: settings.invertPitch
    })
    : manual.pitch;

  let remaining = elapsed;
  while (remaining > 0) {
    const step = Math.min(remaining, 0.05);
    updateFlightState(flightState, {
      turn: motionState.steering,
      pitch: pitchControl,
      thrust: manual.thrust,
      brake: manual.brake
    }, step);
    remaining -= step;
  }

  crashCooldown = Math.max(0, crashCooldown - elapsed);
  handleFlightEvents();
  updateHud(pitchControl);
  audio.update(flightState);
  flightScene.render(flightState, now / 1000);
}

function handleFlightEvents() {
  const groundElevation = flightScene.groundElevationAt(flightState.position);
  const tooFar = Math.hypot(flightState.position.x, flightState.position.z) > 30000;
  if ((
    flightState.position.y < groundElevation + 10
    || flightState.position.y > 1400
    || tooFar
  ) && !crashCooldown) {
    respawnAtCurrentGate();
    crashCooldown = 2.5;
    audio.warning();
    announce(tooFar
      ? 'Returning you to the course.'
      : 'Aircraft recovered at the last gate.');
  }

  if (flightState.stalled && !announcedStall) {
    announcedStall = true;
    elements.body.classList.add('is-stalling');
    audio.warning();
    announce('Stall warning. Lower the nose or add thrust.');
  } else if (!flightState.stalled && announcedStall) {
    announcedStall = false;
    elements.body.classList.remove('is-stalling');
    announce('Airspeed recovered.');
  }

  const target = flightScene.getGate(gateIndex);
  if (target && checkpointReached(flightState.position, target, flightScene.gateRadius)) {
    gateIndex += 1;
    flightScene.setActiveGate(gateIndex);
    audio.checkpoint();
    if (gateIndex >= COURSE_POINTS.length) finishCourse();
    else announce(`Gate ${gateIndex} clear. Next: ${flightScene.getGate(gateIndex).label}.`);
  }
}

function finishCourse() {
  paused = true;
  const courseTime = flightState.elapsed;
  const previousBest = loadBestTime();
  const isBest = !Number.isFinite(previousBest) || courseTime < previousBest;
  if (isBest) saveBestTime(courseTime);
  elements.resultTime.textContent = formatCourseTime(courseTime);
  elements.resultBest.textContent = isBest
    ? 'New best flight!'
    : `Best: ${formatCourseTime(previousBest)}`;
  audio.complete();
  announce(`Course complete in ${formatCourseTime(courseTime)}.`);
  openDialog(elements.resultDialog);
}

function resetCourse() {
  flightState = createFlightState(flightScene?.startPose || {});
  gateIndex = 0;
  crashCooldown = 0;
  announcedStall = false;
  elements.body.classList.remove('is-stalling');
  flightScene?.setActiveGate(0);
  if (controlMode === 'tilt') pendingCalibration = true;
  updateHud(0);
  flightScene?.render(flightState, performance.now() / 1000);
}

function respawnAtCurrentGate() {
  const respawn = flightScene.getRespawnPose(gateIndex);
  flightState = createFlightState({
    ...respawn,
    speed: Math.max(82, flightState.speed),
    throttle: Math.max(0.7, flightState.throttle)
  });
}

function pauseFlight() {
  if (!playing || paused) return;
  paused = true;
  applyControlModePresentation();
  void audio.suspend();
  openDialog(elements.pauseDialog);
}

function resumeFlight() {
  if (!playing) return;
  closeDialog(elements.pauseDialog);
  paused = false;
  previousFrameTime = performance.now();
  void audio.resume();
  elements.pause.focus();
}

async function switchControlMode() {
  if (controlMode === 'tilt') {
    controlMode = 'manual';
    motionState.sensorMode = false;
    applyControlModePresentation();
    announce('Button controls selected.');
    return;
  }

  const ready = motionPermissionGranted || await prepareTiltControls();
  if (!ready) {
    controlMode = 'manual';
    applyControlModePresentation();
    return;
  }
  ensureMotionSubscription();
  controlMode = 'tilt';
  motionState.sensorMode = true;
  pendingCalibration = true;
  applyControlModePresentation();
  announce('Tilt controls selected. Hold your device comfortably for calibration.');
}

function leaveFlight() {
  closeDialog(elements.pauseDialog);
  closeDialog(elements.resultDialog);
  playing = false;
  paused = false;
  activeKeys.clear();
  activePointers.clear();
  elements.body.classList.remove('is-flying', 'is-stalling');
  elements.hud.hidden = true;
  elements.controls.hidden = true;
  elements.intro.hidden = false;
  elements.intro.setAttribute('aria-hidden', 'false');
  resetCourse();
  void audio.suspend();
  setLaunchEnabled(true);
  elements.takeOff.focus();
}

function applyControlModePresentation() {
  const tilt = controlMode === 'tilt';
  elements.manualControls.hidden = tilt;
  elements.recalibrate.hidden = !tilt;
  elements.switchControls.textContent = tilt ? 'Use button controls' : 'Use tilt controls';
  elements.pauseMode.textContent = tilt ? 'Tilt controls' : 'Button controls';
  elements.body.dataset.controlMode = controlMode;
}

function updateHud(pitchControl) {
  if (!flightScene) return;
  const target = flightScene.getGate(gateIndex);
  elements.gate.textContent = gateIndex >= COURSE_POINTS.length
    ? 'COMPLETE'
    : `${gateIndex + 1} / ${COURSE_POINTS.length}`;
  elements.altitude.textContent = `${Math.max(0, Math.round(flightState.position.y))} m`;
  elements.speed.textContent = `${Math.round(metresPerSecondToKnots(flightState.speed))} kt`;
  elements.throttle.textContent = `${Math.round(flightState.throttle * 100)}%`;
  elements.time.textContent = formatCourseTime(flightState.elapsed);
  elements.targetName.textContent = target?.label || 'COURSE COMPLETE';
  elements.distance.textContent = target
    ? `${Math.round(distanceBetween(flightState.position, target))} m`
    : '—';
  elements.throttleFill.style.setProperty('--throttle', `${Math.round(flightState.throttle * 100)}%`);
  elements.attitude.style.setProperty('--bank-angle', `${-radiansToDegrees(flightState.bank)}deg`);
  elements.attitude.style.setProperty('--pitch-offset', `${Math.round(pitchControl * 28)}px`);

  if (target) {
    const bearing = headingToTarget(flightState.position, target);
    const relative = radiansToDegrees(shortestAngle(flightState.heading, bearing));
    elements.courseNeedle.style.setProperty('--course-angle', `${relative}deg`);
  }
}

function readManualControls() {
  const left = controlActive('left', ['ArrowLeft', 'KeyA']);
  const right = controlActive('right', ['ArrowRight', 'KeyD']);
  const up = controlActive('up', ['ArrowUp', 'KeyW']);
  const down = controlActive('down', ['ArrowDown', 'KeyS']);
  return {
    steering: Number(right) - Number(left),
    pitch: Number(up) - Number(down),
    thrust: controlActive('thrust', ['Space', 'KeyR']),
    brake: controlActive('brake', ['ShiftLeft', 'ShiftRight', 'KeyF'])
  };
}

function controlActive(pointerName, keyCodes) {
  return activePointers.has(pointerName) || keyCodes.some((code) => activeKeys.has(code));
}

function bindHoldControl(button, controlName) {
  const release = () => {
    activePointers.delete(controlName);
    button.classList.remove('is-down');
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    activePointers.add(controlName);
    button.classList.add('is-down');
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('click', () => {
    // A short digital impulse makes activated buttons useful with switch control,
    // keyboard emulation and screen readers that do not emit a sustained pointer.
    activePointers.add(controlName);
    globalThis.clearTimeout(clickImpulseTimers.get(controlName));
    clickImpulseTimers.set(controlName, globalThis.setTimeout(() => {
      activePointers.delete(controlName);
      button.classList.remove('is-down');
    }, 280));
  });
}

function onKeyDown(event) {
  if (!playing) return;
  if (event.code === 'Escape') {
    event.preventDefault();
    if (paused && elements.pauseDialog.open) resumeFlight();
    else pauseFlight();
    return;
  }
  if (event.code === 'KeyC' && controlMode === 'tilt') {
    event.preventDefault();
    calibrateMotion(true);
    return;
  }
  if (isFlightKey(event.code)) event.preventDefault();
  activeKeys.add(event.code);
}

function onKeyUp(event) {
  if (isFlightKey(event.code)) event.preventDefault();
  activeKeys.delete(event.code);
}

function isFlightKey(code) {
  return [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyR', 'KeyF',
    'ShiftLeft', 'ShiftRight'
  ].includes(code);
}

function onResize() {
  flightScene?.resize();
  flightScene?.render(flightState, performance.now() / 1000);
}

function announce(message) {
  globalThis.clearTimeout(messageTimer);
  elements.flightMessage.textContent = '';
  requestAnimationFrame(() => {
    elements.flightMessage.textContent = message;
    elements.flightMessage.classList.add('show');
    messageTimer = globalThis.setTimeout(() => {
      elements.flightMessage.classList.remove('show');
    }, 3200);
  });
}

function setLaunchEnabled(enabled) {
  elements.takeOff.disabled = !enabled;
  elements.manualStart.disabled = !enabled;
}

function openDialog(dialog) {
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog) {
  if (!dialog.open && !dialog.hasAttribute('open')) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function loadBestTime() {
  try {
    const value = Number(localStorage.getItem(BEST_TIME_KEY));
    return value > 0 ? value : Infinity;
  } catch (_) {
    return Infinity;
  }
}

function saveBestTime(value) {
  try {
    localStorage.setItem(BEST_TIME_KEY, String(value));
  } catch (_) {
    // Progress remains available for the current flight when storage is restricted.
  }
}

function loadSettings() {
  const defaults = { sound: true, invertPitch: false };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return {
      sound: typeof saved?.sound === 'boolean' ? saved.sound : defaults.sound,
      invertPitch: typeof saved?.invertPitch === 'boolean'
        ? saved.invertPitch
        : defaults.invertPitch
    };
  } catch (_) {
    return defaults;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {
    // Settings remain active for this session when storage is restricted.
  }
}

function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`TURN UP is missing ${selector}.`);
  return element;
}

globalThis.__TURN_UP__ = Object.freeze({
  build: BUILD,
  source: 'TURN motion/platform engine + AMV Lab B737',
  get state() {
    return Object.freeze({
      playing,
      paused,
      controlMode,
      gateIndex,
      aircraftSource: flightScene?.aircraftSource || 'loading'
    });
  }
});
