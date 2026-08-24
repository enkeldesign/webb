import {
  FLOW_STAGES,
  createRunSnapshot,
  createRunState,
  formatRunTime,
  getModeConfig,
  stepBalance
} from './game-core.mjs';
import { NoTiltInput } from './input.mjs';
import { NoTiltAudio } from './audio.mjs';
import { NoTiltView } from './game-view.mjs';

const BEST_RUNS_KEY = 'notilt.best-runs.v1';
const RECORD_INTERVAL_SECONDS = 1 / 15;
const $ = (selector) => document.querySelector(selector);

const elements = {
  scene: $('#scene'),
  home: $('#home'),
  hud: $('#hud'),
  time: $('#timeValue'),
  score: $('#scoreValue'),
  best: $('#bestValue'),
  flowCard: $('#flowCard'),
  flowName: $('#flowName'),
  combo: $('#comboValue'),
  flowProgress: $('#flowProgress'),
  flowFill: $('#flowFill'),
  callout: $('#callout'),
  startStatus: $('#startStatus'),
  startTilt: $('#startTilt'),
  startTouch: $('#startTouch'),
  countdown: $('#countdown'),
  countdownTitle: $('#countdownTitle'),
  countdownHint: $('#countdownHint'),
  countdownMode: $('#countdownMode'),
  balanceControl: $('#balanceControl'),
  balanceOrb: $('#balanceOrb'),
  leanDot: $('#leanDot'),
  inputDot: $('#inputDot'),
  controlHint: $('#controlHint'),
  controls: $('#gameControls'),
  calibrate: $('#calibrateButton'),
  pause: $('#pauseButton'),
  sound: $('#soundButton'),
  jump: $('#jumpButton'),
  pauseDialog: $('#pauseDialog'),
  resume: $('#resumeButton'),
  pauseRecenter: $('#pauseRecenterButton'),
  leave: $('#leaveButton'),
  resultDialog: $('#resultDialog'),
  resultKicker: $('#resultKicker'),
  resultTitle: $('#resultTitle'),
  resultTime: $('#resultTime'),
  resultScore: $('#resultScore'),
  resultCombo: $('#resultCombo'),
  resultCopy: $('#resultCopy'),
  again: $('#againButton'),
  changeMode: $('#changeModeButton'),
  srStatus: $('#screenReaderStatus')
};

const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const audio = new NoTiltAudio();
const input = new NoTiltInput({
  onModeChange: syncControlMode,
  onJumpSignal: (source) => {
    if (phase === 'playing' && selectedMode === 'hard' && source === 'lift') {
      showCallout('LIFT!');
    }
  }
});
let view = null;

try {
  view = new NoTiltView(elements.scene, { reducedMotion });
} catch (error) {
  elements.startStatus.textContent = 'This browser could not start the 3D arena. Try current Safari, Chrome, Edge or Firefox.';
  elements.startStatus.classList.add('is-warning');
  elements.startTilt.disabled = true;
  elements.startTouch.disabled = true;
  console.error(error);
}

let phase = 'home';
let selectedMode = 'easy';
let controlMode = 'motion';
let runState = null;
let runFrames = [];
let lastFrameAt = performance.now();
let lastRecordAt = -Infinity;
let lastHudAt = -Infinity;
let lastScreenReaderAt = -Infinity;
let calloutTimer = 0;
let countdownToken = 0;
let pausedByOrientation = false;
let pointerActive = false;
let bestRuns = readBestRuns();
const heldKeys = new Set();

bindEvents();
syncModeCards();
syncControlMode('motion');
syncMotionAvailability();
view?.setMode(selectedMode);
document.documentElement.dataset.notiltReady = 'true';
requestAnimationFrame(frame);

function bindEvents() {
  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      selectedMode = radio.value;
      syncModeCards();
      view?.setMode(selectedMode);
      syncMotionAvailability();
    });
  });

  elements.startTilt.addEventListener('click', () => startRun('motion'));
  elements.startTouch.addEventListener('click', () => startRun('manual'));
  elements.calibrate.addEventListener('click', recenter);
  elements.pause.addEventListener('click', () => pauseRun(false));
  elements.resume.addEventListener('click', resumeRun);
  elements.pauseRecenter.addEventListener('click', recenter);
  elements.leave.addEventListener('click', goHome);
  elements.again.addEventListener('click', () => {
    closeDialog(elements.resultDialog);
    startRun(controlMode);
  });
  elements.changeMode.addEventListener('click', goHome);
  elements.sound.addEventListener('click', () => {
    const muted = audio.toggleMuted();
    elements.sound.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    elements.sound.setAttribute('aria-pressed', String(!muted));
  });
  elements.jump.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    input.queueJump('button');
  });

  elements.balanceOrb.addEventListener('pointerdown', handlePadPointer);
  elements.balanceOrb.addEventListener('pointermove', handlePadPointer);
  elements.balanceOrb.addEventListener('pointerup', releasePadPointer);
  elements.balanceOrb.addEventListener('pointercancel', releasePadPointer);

  globalThis.addEventListener('keydown', handleKeyDown);
  globalThis.addEventListener('keyup', handleKeyUp);
  globalThis.addEventListener('blur', clearHeldControls);
  globalThis.addEventListener('orientationchange', scheduleOrientationCheck, { passive: true });
  globalThis.screen?.orientation?.addEventListener?.('change', scheduleOrientationCheck);
  globalThis.matchMedia?.('(orientation: portrait)')?.addEventListener?.('change', scheduleOrientationCheck);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'playing') pauseRun(false);
  });

  elements.pauseDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    resumeRun();
  });
  elements.resultDialog.addEventListener('cancel', (event) => event.preventDefault());
}

async function startRun(preferredControl) {
  if (!view || phase === 'countdown') return;
  const token = ++countdownToken;
  closeDialog(elements.pauseDialog);
  closeDialog(elements.resultDialog);
  phase = 'countdown';
  document.body.dataset.phase = phase;
  document.body.dataset.stage = '0';
  document.body.classList.remove('is-danger', 'is-hit');
  elements.startTilt.disabled = true;
  elements.startTouch.disabled = true;

  // Both calls happen from the initiating button gesture. iOS requires that for
  // motion permission, and browsers require it before Web Audio may start.
  const audioPromise = audio.start();
  let motionResult = { granted: false, reason: 'manual' };
  if (preferredControl === 'motion') {
    if (input.getMode() === 'motion' && input.motionPermission === 'granted') {
      motionResult = { granted: true, reason: 'existing' };
    } else {
      motionResult = await input.enableMotion();
    }
  } else {
    input.enableManual();
  }
  await audioPromise;
  if (token !== countdownToken) return;

  controlMode = motionResult.granted ? 'motion' : 'manual';
  if (!motionResult.granted && preferredControl === 'motion') {
    input.enableManual();
    elements.startStatus.textContent = motionResult.reason === 'denied'
      ? 'Motion access was not allowed, so TOUCH MODE is active instead.'
      : 'No motion signal was available, so TOUCH MODE is active instead.';
    elements.startStatus.classList.add('is-warning');
  }

  view.setMode(selectedMode);
  elements.home.hidden = true;
  elements.countdown.hidden = false;
  elements.countdownMode.textContent = controlMode === 'motion' ? 'CALIBRATING TILT' : 'TOUCH MODE';
  elements.countdownHint.textContent = controlMode === 'motion'
    ? 'HOLD YOUR PHONE COMFORTABLY'
    : 'DRAG THE BALANCE TARGET';

  await delay(260);
  if (controlMode === 'motion') input.calibrate();
  for (const count of ['3', '2', '1']) {
    if (token !== countdownToken) return;
    elements.countdownTitle.textContent = count;
    announce(`${count}.`);
    await delay(530);
  }
  if (token !== countdownToken) return;

  if (controlMode === 'motion') {
    if (!input.hasFreshPose(1500)) {
      input.enableManual();
      controlMode = 'manual';
      elements.countdownMode.textContent = 'TOUCH MODE';
      elements.countdownHint.textContent = 'NO SENSOR SIGNAL — DRAG THE TARGET';
      announce('No current sensor signal. Touch mode is active.');
      await delay(520);
    } else {
      input.calibrate();
    }
  }

  elements.countdownTitle.textContent = 'GO!';
  await delay(360);
  if (token !== countdownToken) return;
  beginPlaying();
}

function beginPlaying() {
  runState = createRunState(selectedMode);
  runFrames = [];
  lastRecordAt = -Infinity;
  lastHudAt = -Infinity;
  lastScreenReaderAt = -Infinity;
  phase = 'playing';
  pausedByOrientation = false;
  document.body.dataset.phase = phase;
  elements.countdown.hidden = true;
  elements.hud.hidden = false;
  elements.controls.hidden = false;
  elements.balanceControl.hidden = false;
  elements.jump.hidden = selectedMode !== 'hard';
  syncControlMode(input.getMode());
  updateHud({ x: 0, y: 0 }, true);
  audio.resume();
  announce(`${getModeConfig(selectedMode).name} run started. Tilt against the fall${selectedMode === 'hard' ? ' and lift the phone to jump over incoming projectiles' : ''}.`);
  showCallout('KEEP IT UP!');
}

function frame(timestamp) {
  const dt = Math.min(0.05, Math.max(0, (timestamp - lastFrameAt) / 1000));
  lastFrameAt = timestamp;
  let vector = { x: 0, y: 0 };

  if (phase === 'playing' && isPortrait()) {
    updateKeyboardVector();
    vector = input.getVector(dt);
    const events = stepBalance(runState, {
      x: vector.x,
      y: vector.y,
      jump: input.consumeJump()
    }, dt);
    recordFrame(vector);
    handleRunEvents(events);
    if (runState && timestamp - lastHudAt >= 45) {
      lastHudAt = timestamp;
      updateHud(vector);
    }
    if (runState && timestamp - lastScreenReaderAt >= 5000) {
      lastScreenReaderAt = timestamp;
      announceRunStatus();
    }
    audio.update({
      stage: runState?.stage || 0,
      stability: runState?.stability || 0,
      danger: runState?.danger || 0
    });
  } else if (phase === 'paused' && runState) {
    vector = input.getVector(dt);
  }

  view?.render({
    state: phase === 'home' || phase === 'countdown' ? null : runState,
    input: vector,
    deltaSeconds: dt,
    phase
  });
  requestAnimationFrame(frame);
}

function handleRunEvents(events) {
  for (const event of events) {
    if (event.type === 'stage') {
      const stage = FLOW_STAGES[event.stage];
      audio.stageUp(event.stage);
      view?.pulse('flow');
      showCallout(`${stage.name}  ×${stage.multiplier}`);
      retriggerClass(elements.flowCard, 'stage-up');
      vibrate([18, 32, 24]);
    } else if (event.type === 'projectile') {
      audio.warning(event.side);
      showCallout(`INCOMING ${event.side < 0 ? 'LEFT' : 'RIGHT'} — LIFT!`);
    } else if (event.type === 'jump') {
      audio.jump();
      elements.jump.classList.add('is-airborne');
      elements.jump.querySelector('small').textContent = 'AIRBORNE';
      vibrate(12);
    } else if (event.type === 'land') {
      audio.land();
      elements.jump.classList.remove('is-airborne');
      elements.jump.querySelector('small').textContent = 'LIFT PHONE OR TAP';
    } else if (event.type === 'dodge') {
      audio.dodge(event.side);
      view?.pulse('flow');
      showCallout('CLEAN JUMP + FLOW');
      vibrate([10, 24, 10]);
    } else if (event.type === 'hit') {
      audio.hit(event.side);
      view?.pulse('hit');
      showCallout('HIT! SAVE THE BALANCE');
      retriggerClass(document.body, 'is-hit');
      vibrate(45);
    } else if (event.type === 'save') {
      audio.save();
      showCallout('CLUTCH SAVE + FLOW');
    } else if (event.type === 'fall') {
      endRun();
      break;
    }
  }
}

function endRun() {
  if (!runState || phase !== 'playing') return;
  phase = 'result';
  document.body.dataset.phase = phase;
  elements.controls.hidden = true;
  elements.balanceControl.hidden = true;
  document.body.classList.remove('is-danger');
  audio.fall();
  vibrate([45, 45, 75]);

  const snapshot = createRunSnapshot(runState, runFrames);
  const previousBest = bestRuns[selectedMode];
  const isBest = !previousBest
    || snapshot.score > previousBest.score
    || (snapshot.score === previousBest.score && snapshot.time > previousBest.time);
  if (isBest) {
    bestRuns = { ...bestRuns, [selectedMode]: snapshot };
    writeBestRuns(bestRuns);
  }

  elements.resultKicker.textContent = isBest ? 'NEW BEST · GHOST SAVED' : 'RUN COMPLETE';
  elements.resultTitle.textContent = runState.maxStageReached >= 4 ? 'NO TILT!' : 'THAT TILTED.';
  elements.resultTime.textContent = formatRunTime(snapshot.time);
  elements.resultScore.textContent = formatScore(snapshot.score);
  elements.resultCombo.textContent = `×${snapshot.maxCombo}`;
  elements.resultCopy.textContent = isBest
    ? 'Your best try is saved on this device and already recorded for the future YOUR TURN challenge mode.'
    : `Your best remains ${formatScore(previousBest.score)} points. This run did not replace your saved ghost.`;
  updateHud({ x: 0, y: 0 }, true);
  announce(`${isBest ? 'New best. ' : ''}Run complete. ${formatRunTime(snapshot.time)}, ${snapshot.score} points, best combo times ${snapshot.maxCombo}.`);

  setTimeout(() => {
    audio.pause();
    showDialog(elements.resultDialog);
  }, reducedMotion ? 0 : 420);
}

function pauseRun(fromOrientation) {
  if (phase !== 'playing') return;
  phase = 'paused';
  document.body.dataset.phase = phase;
  pausedByOrientation = Boolean(fromOrientation);
  audio.pause();
  clearHeldControls();
  if (!fromOrientation) {
    showDialog(elements.pauseDialog);
    announce('Paused.');
  }
}

function resumeRun() {
  if (phase !== 'paused' || !isPortrait()) return;
  closeDialog(elements.pauseDialog);
  input.calibrate();
  phase = 'playing';
  pausedByOrientation = false;
  document.body.dataset.phase = phase;
  audio.resume();
  showCallout(input.getMode() === 'motion' ? 'RECENTERED' : 'GO!');
  announce('Run resumed.');
}

function goHome() {
  countdownToken += 1;
  phase = 'home';
  document.body.dataset.phase = phase;
  document.body.dataset.stage = '0';
  document.body.classList.remove('is-danger', 'is-hit');
  runState = null;
  runFrames = [];
  audio.pause();
  clearHeldControls();
  closeDialog(elements.pauseDialog);
  closeDialog(elements.resultDialog);
  elements.home.hidden = false;
  elements.hud.hidden = true;
  elements.controls.hidden = true;
  elements.balanceControl.hidden = true;
  elements.countdown.hidden = true;
  elements.startTilt.disabled = false;
  elements.startTouch.disabled = false;
  view?.setMode(selectedMode);
  syncMotionAvailability();
  elements.startTilt.focus({ preventScroll: true });
}

function recenter() {
  if (input.getMode() === 'motion') {
    if (input.calibrate()) {
      showCallout('CENTER RESET');
      announce('Tilt center reset.');
    } else {
      showCallout('HOLD PHONE UPRIGHT');
      announce('No motion sample yet. Hold the phone upright and try again.');
    }
  } else {
    input.setManualVector(0, 0);
    showCallout('TOUCH CENTER RESET');
  }
}

function updateHud(vector, force = false) {
  if (!runState) return;
  const config = getModeConfig(runState.modeId);
  const stage = FLOW_STAGES[runState.stage];
  const best = bestRuns[runState.modeId];
  elements.time.textContent = formatRunTime(runState.time);
  elements.score.textContent = formatScore(runState.score);
  elements.best.textContent = best ? formatScore(best.score) : '—';
  elements.flowName.textContent = stage.name;
  elements.combo.textContent = `×${stage.multiplier}`;
  document.body.dataset.stage = String(runState.stage);
  document.body.classList.toggle('is-danger', runState.danger > 0.48);

  const currentThreshold = stage.threshold;
  const nextThreshold = FLOW_STAGES[runState.stage + 1]?.threshold ?? 64;
  const progress = runState.stage >= FLOW_STAGES.length - 1
    ? 100
    : clamp((runState.flow - currentThreshold) / (nextThreshold - currentThreshold) * 100, 0, 100);
  elements.flowFill.style.width = `${progress.toFixed(1)}%`;
  elements.flowProgress.setAttribute('aria-valuenow', String(Math.round(progress)));

  const leanScale = 32 / config.failAngle;
  setDot(elements.leanDot, runState.angleX * leanScale, runState.angleY * leanScale);
  setDot(elements.inputDot, vector.x * 32, vector.y * 32);
  if (runState.modeId === 'hard') {
    elements.jump.classList.toggle('is-airborne', runState.jumpY > 0.02);
  }

  if (force) elements.hud.offsetWidth;
}

function recordFrame(vector) {
  if (!runState || runState.time - lastRecordAt < RECORD_INTERVAL_SECONDS) return;
  lastRecordAt = runState.time;
  runFrames.push([
    Math.round(runState.time * 1000),
    Math.round(vector.x * 1000),
    Math.round(vector.y * 1000),
    Math.round(runState.angleX * 10000),
    Math.round(runState.angleY * 10000),
    Math.round(runState.jumpY * 100)
  ]);
  if (runFrames.length > 4800) runFrames.shift();
}

function announceRunStatus() {
  if (!runState) return;
  const stage = FLOW_STAGES[runState.stage];
  const warning = runState.danger > 0.72 ? ' Danger. Counter the fall.' : '';
  announce(`${formatRunTime(runState.time)}, ${stage.name}, combo times ${stage.multiplier}, score ${Math.round(runState.score)}.${warning}`);
}

function handlePadPointer(event) {
  if (phase !== 'playing' || input.getMode() !== 'manual') return;
  if (event.type === 'pointerdown') {
    pointerActive = true;
    elements.balanceOrb.setPointerCapture?.(event.pointerId);
  }
  if (!pointerActive) return;
  event.preventDefault();
  const rect = elements.balanceOrb.getBoundingClientRect();
  const radius = Math.min(rect.width, rect.height) * 0.38;
  const x = (event.clientX - rect.left - rect.width / 2) / radius;
  const y = (event.clientY - rect.top - rect.height / 2) / radius;
  const length = Math.max(1, Math.hypot(x, y));
  input.setManualVector(x / length, y / length);
}

function releasePadPointer(event) {
  if (!pointerActive) return;
  pointerActive = false;
  elements.balanceOrb.releasePointerCapture?.(event.pointerId);
  input.setManualVector(0, 0);
}

function handleKeyDown(event) {
  if (phase !== 'playing' && event.key.toLowerCase() !== 'p') return;
  const key = event.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) {
    if (input.getMode() !== 'manual') return;
    heldKeys.add(key);
    event.preventDefault();
  } else if (key === ' ' && selectedMode === 'hard') {
    event.preventDefault();
    input.queueJump('keyboard');
  } else if (key === 'p' && phase === 'playing') {
    pauseRun(false);
  } else if (key === 'r') {
    recenter();
  }
}

function handleKeyUp(event) {
  heldKeys.delete(event.key.toLowerCase());
  if (input.getMode() === 'manual' && !pointerActive && heldKeys.size === 0) {
    input.setManualVector(0, 0);
  }
}

function updateKeyboardVector() {
  if (input.getMode() !== 'manual' || pointerActive || heldKeys.size === 0) return;
  const left = heldKeys.has('arrowleft') || heldKeys.has('a');
  const right = heldKeys.has('arrowright') || heldKeys.has('d');
  const up = heldKeys.has('arrowup') || heldKeys.has('w');
  const down = heldKeys.has('arrowdown') || heldKeys.has('s');
  input.setManualVector(Number(right) - Number(left), Number(down) - Number(up));
}

function clearHeldControls() {
  heldKeys.clear();
  pointerActive = false;
  input.setManualVector(0, 0);
}

function syncControlMode(mode) {
  const manual = mode === 'manual';
  elements.balanceControl.classList.toggle('is-manual', manual);
  elements.controlHint.textContent = manual ? 'DRAG AGAINST THE FALL' : 'TILT AGAINST THE FALL';
  elements.calibrate.textContent = manual ? 'RESET PAD' : 'RECENTER';
}

function syncModeCards() {
  document.querySelectorAll('.mode-card').forEach((card) => {
    const radio = card.querySelector('input');
    card.classList.toggle('is-selected', radio.checked);
  });
}

function syncMotionAvailability() {
  if (!NoTiltInput.supportsMotion()) {
    elements.startStatus.textContent = 'Motion sensors were not detected here. TOUCH MODE gives you the same balance physics.';
    elements.startStatus.classList.add('is-warning');
    return;
  }
  elements.startStatus.classList.remove('is-warning');
  elements.startStatus.textContent = selectedMode === 'hard'
    ? 'Allow motion access, then hold portrait. A quick upward lift jumps; the JUMP button is always available too.'
    : 'For tilt play, allow motion access when your phone asks.';
}

function scheduleOrientationCheck() {
  setTimeout(handleOrientationChange, 100);
}

function handleOrientationChange() {
  if (!isPortrait()) {
    if (phase === 'playing') pauseRun(true);
    return;
  }
  if (phase === 'paused' && pausedByOrientation) {
    input.calibrate();
    phase = 'playing';
    pausedByOrientation = false;
    document.body.dataset.phase = phase;
    audio.resume();
    showCallout('PORTRAIT · RECENTERED');
    announce('Portrait restored. Tilt center reset and run resumed.');
  } else if (phase === 'countdown') {
    input.calibrate();
  }
}

function isPortrait() {
  return globalThis.matchMedia?.('(orientation: portrait)').matches
    ?? globalThis.innerHeight >= globalThis.innerWidth;
}

function showCallout(message, duration = 1050) {
  clearTimeout(calloutTimer);
  elements.callout.textContent = message;
  elements.callout.classList.add('show');
  calloutTimer = setTimeout(() => elements.callout.classList.remove('show'), duration);
}

function setDot(element, xPixels, yPixels) {
  element.style.left = `calc(50% + ${clamp(xPixels, -32, 32).toFixed(1)}px)`;
  element.style.top = `calc(50% + ${clamp(yPixels, -32, 32).toFixed(1)}px)`;
}

function announce(message) {
  elements.srStatus.textContent = '';
  requestAnimationFrame(() => { elements.srStatus.textContent = message; });
}

function showDialog(dialog) {
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog) {
  if (!dialog?.open) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function readBestRuns() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BEST_RUNS_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([mode, run]) => (
        ['easy', 'medium', 'hard'].includes(mode)
        && run
        && Number.isFinite(Number(run.score))
        && Array.isArray(run.frames)
      ))
    );
  } catch (_) {
    return {};
  }
}

function writeBestRuns(runs) {
  try {
    localStorage.setItem(BEST_RUNS_KEY, JSON.stringify(runs));
  } catch (_) {
    // A completed run must still be playable when private storage is unavailable.
  }
}

function retriggerClass(element, className) {
  element.classList.remove(className);
  element.offsetWidth;
  element.classList.add(className);
  setTimeout(() => element.classList.remove(className), 520);
}

function vibrate(pattern) {
  try { globalThis.navigator?.vibrate?.(pattern); } catch (_) {}
}

function formatScore(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-US');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
