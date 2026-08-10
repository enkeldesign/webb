import { saveDriveByEarEnabled } from '/turn/ui/drive-by-ear-setting.js';
import {
  loadColorCuesEnabled,
  saveColorCuesEnabled
} from '/turn/accessibility/color-cues.js?revision=r163';

const STEERING_MODE_KEY = 'turn-steering-mode-v1';
const STEERING_MODE = Object.freeze({ MOTION: 'motion', MANUAL: 'manual' });

function saveSteeringMode(mode) {
  const value = mode === STEERING_MODE.MOTION ? STEERING_MODE.MOTION : STEERING_MODE.MANUAL;
  try {
    localStorage.setItem(STEERING_MODE_KEY, value);
  } catch (_) {}
  return value;
}

function balanceLabel(value) {
  if (value < 45) return `${100 - value}% other sounds`;
  if (value > 55) return `${value}% Drive By Ear`;
  return 'Balanced';
}

function createSettingsDialog({ runtime, raceSession, trigger }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'yourturn-settings-dialog';
  dialog.setAttribute('aria-labelledby', 'yourTurnSettingsTitle');
  dialog.innerHTML = `
    <article class="yourturn-settings-card">
      <header class="yourturn-settings-head">
        <div><span>YOUR TURN</span><h2 id="yourTurnSettingsTitle">SETTINGS</h2></div>
        <button class="yourturn-settings-close" type="button" aria-label="Close settings">×</button>
      </header>

      <div class="yourturn-settings-list">
        <fieldset class="yourturn-setting-card yourturn-steering-setting">
          <legend>Steering</legend>
          <label><input type="radio" name="yourTurnSteering" value="motion"><span><strong>Device rotation</strong><small>Turn the whole device like a steering wheel.</small></span></label>
          <label><input type="radio" name="yourTurnSteering" value="manual"><span><strong>On-screen steering</strong><small>Use the steering control on the left.</small></span></label>
          <p class="yourturn-motion-note" hidden>Device rotation is not available in this browser.</p>
        </fieldset>

        <section class="yourturn-setting-card" aria-labelledby="yourTurnAudioTitle">
          <h3 id="yourTurnAudioTitle">Audio</h3>
          <label class="yourturn-toggle-row"><input id="yourTurnAudioEnabled" type="checkbox"><span><strong>Sound</strong><small>Turn every TURN sound on or off.</small></span></label>
          <label class="yourturn-toggle-row"><input id="yourTurnDbeEnabled" type="checkbox"><span><strong>Drive By Ear™</strong><small>Spatial steering guidance, pace notes, recovery cues and rival warnings.</small></span></label>
          <label class="yourturn-balance-row" for="yourTurnAudioBalance"><strong>Sound balance</strong><small>Choose between car and world sounds or Drive By Ear guidance.</small></label>
          <input id="yourTurnAudioBalance" type="range" min="0" max="100" step="1" value="50" aria-describedby="yourTurnAudioBalanceValue">
          <div class="yourturn-balance-labels" aria-hidden="true"><span>Other sounds</span><span>Drive By Ear</span></div>
          <output id="yourTurnAudioBalanceValue" for="yourTurnAudioBalance">Balanced</output>
        </section>

        <section class="yourturn-setting-card" aria-labelledby="yourTurnAccessibilityTitle">
          <h3 id="yourTurnAccessibilityTitle">Accessibility</h3>
          <label class="yourturn-toggle-row"><input id="yourTurnColorCuesEnabled" type="checkbox"><span><strong>Color cues</strong><small>Add text and pattern cues wherever TURN uses color to communicate.</small></span></label>
        </section>
      </div>
      <p class="yourturn-settings-status" role="status" aria-live="polite"></p>
    </article>`;
  document.body.appendChild(dialog);

  const closeButton = dialog.querySelector('.yourturn-settings-close');
  const motionRadio = dialog.querySelector('input[value="motion"]');
  const manualRadio = dialog.querySelector('input[value="manual"]');
  const motionNote = dialog.querySelector('.yourturn-motion-note');
  const soundToggle = dialog.querySelector('#yourTurnAudioEnabled');
  const dbeToggle = dialog.querySelector('#yourTurnDbeEnabled');
  const balanceSlider = dialog.querySelector('#yourTurnAudioBalance');
  const balanceOutput = dialog.querySelector('#yourTurnAudioBalanceValue');
  const colorCuesToggle = dialog.querySelector('#yourTurnColorCuesEnabled');
  const status = dialog.querySelector('.yourturn-settings-status');

  function audioPreferences() {
    return globalThis.__turnAudioPreferences;
  }

  function sync() {
    const motionAvailable = typeof globalThis.DeviceMotionEvent !== 'undefined';
    motionRadio.disabled = !motionAvailable;
    motionRadio.checked = runtime.state.sensorMode === true;
    manualRadio.checked = runtime.state.sensorMode !== true;
    motionNote.hidden = motionAvailable;

    const audio = audioPreferences()?.getSettings?.() || {
      audioEnabled: true,
      dbeEnabled: globalThis.__turnDriveByEarEnabled !== false,
      balance: 0.5
    };
    soundToggle.checked = audio.audioEnabled !== false;
    dbeToggle.checked = audio.dbeEnabled !== false;
    const storedBalance = Number(audio.balance);
    const percent = Math.round((Number.isFinite(storedBalance) ? storedBalance : 0.5) * 100);
    balanceSlider.value = String(percent);
    balanceOutput.value = balanceLabel(percent);
    balanceOutput.textContent = balanceOutput.value;
    colorCuesToggle.checked = loadColorCuesEnabled();
    status.textContent = '';
  }

  async function setSteering(mode) {
    if (mode === STEERING_MODE.MANUAL) {
      saveSteeringMode(mode);
      runtime.state.sensorMode = false;
      runtime.state.roll = 0;
      runtime.state.targetRoll = 0;
      runtime.state.neutralRoll = 0;
      runtime.state.horizonRollReference = 0;
      runtime.state.pitch = 0;
      runtime.state.targetPitch = 0;
      runtime.state.neutralPitch = 0;
      document.querySelector('#manualSteer')?.removeAttribute('hidden');
      status.textContent = 'Steering set to the on-screen control.';
      sync();
      return;
    }

    if (runtime.state.sensorMode === true) {
      saveSteeringMode(mode);
      document.querySelector('#manualSteer')?.setAttribute('hidden', '');
      status.textContent = 'Steering set to device rotation.';
      sync();
      return;
    }

    motionRadio.disabled = true;
    try {
      await raceSession.prepareMotionAccess();
      saveSteeringMode(mode);
      document.querySelector('#manualSteer')?.setAttribute('hidden', '');
      document.querySelector('#calibrateButton')?.click();
      status.textContent = 'Steering set to device rotation.';
    } catch (error) {
      runtime.state.sensorMode = false;
      saveSteeringMode(STEERING_MODE.MANUAL);
      status.textContent = error instanceof Error ? error.message : 'Motion steering could not be enabled.';
    } finally {
      motionRadio.disabled = false;
      sync();
    }
  }

  motionRadio.addEventListener('change', () => {
    if (motionRadio.checked) void setSteering(STEERING_MODE.MOTION);
  });
  manualRadio.addEventListener('change', () => {
    if (manualRadio.checked) void setSteering(STEERING_MODE.MANUAL);
  });
  soundToggle.addEventListener('change', () => {
    const enabled = audioPreferences()?.setAudioEnabled?.(soundToggle.checked) ?? soundToggle.checked;
    soundToggle.checked = enabled;
    status.textContent = `Sound ${enabled ? 'on' : 'off'}.`;
  });
  dbeToggle.addEventListener('change', () => {
    const enabled = dbeToggle.checked;
    if (!saveDriveByEarEnabled(enabled)) {
      dbeToggle.checked = !enabled;
      status.textContent = 'Drive By Ear could not be changed because local storage is unavailable.';
      return;
    }
    audioPreferences()?.setDriveByEarEnabled?.(enabled);
    status.textContent = enabled ? 'Drive By Ear on.' : 'Drive By Ear off.';
  });
  balanceSlider.addEventListener('input', () => {
    const value = Number(balanceSlider.value);
    audioPreferences()?.setBalance?.(value / 100);
    balanceOutput.value = balanceLabel(value);
    balanceOutput.textContent = balanceOutput.value;
  });
  balanceSlider.addEventListener('change', () => {
    status.textContent = `Sound balance: ${balanceLabel(Number(balanceSlider.value))}.`;
  });
  colorCuesToggle.addEventListener('change', () => {
    const enabled = colorCuesToggle.checked;
    if (!saveColorCuesEnabled(enabled)) {
      colorCuesToggle.checked = !enabled;
      status.textContent = 'Color cues could not be changed because local storage is unavailable.';
      return;
    }
    status.textContent = `Color cues ${enabled ? 'on' : 'off'}.`;
  });

  function close() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    trigger.focus({ preventScroll: true });
  }

  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  return Object.freeze({
    open() {
      sync();
      if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
      else dialog.setAttribute('open', '');
      closeButton.focus();
    },
    sync
  });
}

function install() {
  const runtime = globalThis.__turnRuntime;
  const raceSession = globalThis.__turnRaceSession;
  const session = globalThis.__yourTurnSession;
  const utilityGroup = document.querySelector('#controls .utility-group');
  const challengeButton = document.querySelector('#yourTurnChallengeButton');
  const blankButton = document.querySelector('.turn-screen-blank-control');
  const recalibrateButton = document.querySelector('#calibrateButton');
  const restartButton = document.querySelector('#resetButton');
  if (!runtime || !raceSession || !session || !utilityGroup || !challengeButton || !blankButton || !recalibrateButton || !restartButton) {
    return false;
  }
  if (utilityGroup.dataset.r411YourTurnControls === 'true') return true;
  utilityGroup.dataset.r411YourTurnControls = 'true';

  restartButton.hidden = true;

  const settingsButton = document.createElement('button');
  settingsButton.type = 'button';
  settingsButton.className = 'utility yourturn-settings-button';
  settingsButton.textContent = 'Settings';
  settingsButton.setAttribute('aria-label', 'Open YOUR TURN settings');

  const spectateButton = document.createElement('button');
  spectateButton.type = 'button';
  spectateButton.className = 'utility yourturn-spectate-button';
  spectateButton.textContent = 'Spectate';
  spectateButton.setAttribute('aria-label', 'Spectate a run to learn the track');

  utilityGroup.append(settingsButton, spectateButton);
  const settings = createSettingsDialog({ runtime, raceSession, trigger: settingsButton });
  let spectating = false;
  let syncing = false;
  let syncQueued = false;

  function setChallengeInvalidState() {
    const invalid = runtime.state.lapActive === true && runtime.state.lapInvalid === true;
    challengeButton.classList.toggle('is-lap-invalid', invalid);
  }

  function reorder(nodes) {
    for (const node of nodes) {
      if (!node || node.parentElement !== utilityGroup) continue;
      utilityGroup.appendChild(node);
    }
  }

  function sync() {
    if (syncing) return;
    syncing = true;
    try {
      restartButton.hidden = true;
      setChallengeInvalidState();

      const state = session.getState();
      const activeLap = runtime.state.lapActive === true || state.phase === 'racing';
      const accepted = state.accepted === true;

      if (!accepted) {
        settingsButton.hidden = true;
        spectateButton.hidden = true;
        return;
      }

      if (spectating) {
        challengeButton.hidden = true;
        recalibrateButton.hidden = true;
        settingsButton.hidden = true;
        if (blankButton.dataset.state !== 'active') blankButton.hidden = true;
        spectateButton.hidden = false;
        spectateButton.textContent = 'Stop Spectating';
        spectateButton.setAttribute('aria-label', 'Stop spectating and return to the starting line');
        reorder([spectateButton]);
        return;
      }

      spectateButton.textContent = 'Spectate';
      spectateButton.setAttribute('aria-label', 'Spectate a run to learn the track');
      challengeButton.hidden = false;
      recalibrateButton.hidden = false;

      if (activeLap) {
        settingsButton.hidden = true;
        spectateButton.hidden = true;
        if (blankButton.dataset.state !== 'active') blankButton.hidden = true;
        reorder([challengeButton, recalibrateButton]);
        return;
      }

      if (state.phase === 'staged') {
        settingsButton.hidden = false;
        spectateButton.hidden = false;
        if (blankButton.dataset.state !== 'active') blankButton.hidden = false;
        const ordered = [challengeButton];
        if (blankButton.dataset.state !== 'active') ordered.push(blankButton);
        ordered.push(recalibrateButton, settingsButton, spectateButton);
        reorder(ordered);
      }
    } finally {
      syncing = false;
    }
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      sync();
    });
  }

  function startSpectating() {
    const state = session.getState();
    if (spectating || state.phase !== 'staged' || runtime.state.lapActive) return;
    spectating = true;
    runtime.state.velocity.set(0, 0, 0);
    runtime.state.speed = 0;
    state.phase = 'preview';
    state.scene?.setPhase('preview');
    runtime.setGameMode(runtime.GAME_MODE.SPECTATING);
    queueSync();
  }

  function stopSpectating() {
    if (!spectating) return;
    const state = session.getState();
    spectating = false;
    state.phase = 'staged';
    state.scene?.setPhase('staged');
    runtime.setGameMode(runtime.GAME_MODE.STAGED);
    runtime.state.lastFrame = performance.now();
    queueSync();
  }

  settingsButton.addEventListener('click', () => settings.open());
  spectateButton.addEventListener('click', () => {
    if (spectating) stopSpectating();
    else startSpectating();
  });

  window.addEventListener('turn:ui-state-change', () => {
    if (runtime.state.lapActive && spectating) spectating = false;
    queueSync();
  });

  const lapTimeChip = document.querySelector('#lapTime')?.closest('.chip');
  const lapObserver = lapTimeChip && typeof MutationObserver === 'function'
    ? new MutationObserver(queueSync)
    : null;
  lapObserver?.observe(lapTimeChip, { attributes: true, attributeFilter: ['class'] });

  const controlsObserver = typeof MutationObserver === 'function'
    ? new MutationObserver(queueSync)
    : null;
  controlsObserver?.observe(utilityGroup, { childList: true });

  queueSync();
  return true;
}

function bootstrap(attempt = 0) {
  if (install()) return;
  if (attempt < 300) requestAnimationFrame(() => bootstrap(attempt + 1));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap(), { once: true });
} else {
  bootstrap();
}
