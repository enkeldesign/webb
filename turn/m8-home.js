import {
  TRACK_CATALOG,
  loadTrackSelection,
  normalizeTrackId
} from '/turn/tracks/catalog.js?source=20260729-r118-m8';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import { showTrackIntro } from '/turn/ui/track-intro.js?source=20260729-r118-m8';
import { installRoadbook } from '/turn/roadbook/roadbook.js';
import { createRewardPreviewSession } from './race/reward-preview.js';
import { TURN_TUTORIAL, createTutorialProgress } from './tutorial/tutorial-progress.js';
import { createTutorialSession } from './tutorial/tutorial-session.js';
import { installTutorialEntry } from './tutorial/tutorial-entry.js';
import { startTurnTutorialCoach } from './tutorial/tutorial-prompt.js';
import { trackIconMarkup } from '/turn/ui/track-icons.js';
import { saveDriveByEarEnabled } from '/turn/ui/drive-by-ear-setting.js?source=20260729-r118-m8';
import {
  CONTROL_HANDEDNESS,
  controlHandednessDescription,
  loadControlHandedness,
  saveControlHandedness
} from './ui/control-handedness.js';

const STEERING_MODE_KEY = 'turn-steering-mode-v1';
const STEERING_MODE = Object.freeze({ MOTION: 'motion', MANUAL: 'manual' });
const ICON_REVISION = '20260803-profile-512';
const SETUP_RESUME_KEY = 'turn-setup-resume';
const SETUP_RELOADED_KEY = 'turn-setup-reloaded-at';
const SETUP_RELOAD_WINDOW_MS = 60000;

let installed = false;

function waitForRuntime() {
  if (globalThis.__turnRuntime && globalThis.__turnNextRaceSession) {
    return Promise.resolve({
      runtime: globalThis.__turnRuntime,
      raceSession: globalThis.__turnNextRaceSession
    });
  }

  return new Promise((resolve) => {
    const check = () => {
      if (!globalThis.__turnRuntime || !globalThis.__turnNextRaceSession) return false;
      resolve({
        runtime: globalThis.__turnRuntime,
        raceSession: globalThis.__turnNextRaceSession
      });
      return true;
    };
    if (check()) return;
    window.addEventListener('turn:runtime-ready', () => {
      if (check()) return;
      requestAnimationFrame(check);
    }, { once: true });
  });
}

function motionAvailable() {
  return typeof globalThis.DeviceMotionEvent !== 'undefined';
}

function motionPermissionWasDismissed(error) {
  return error instanceof Error && error.message === 'Motion permission was not granted.';
}

function loadSteeringMode() {
  const fallback = motionAvailable() ? STEERING_MODE.MOTION : STEERING_MODE.MANUAL;
  try {
    const stored = localStorage.getItem(STEERING_MODE_KEY);
    if (stored === STEERING_MODE.MOTION && motionAvailable()) return stored;
    if (stored === STEERING_MODE.MANUAL) return stored;
  } catch (_) {}
  return fallback;
}

function saveSteeringMode(mode) {
  const normalized = mode === STEERING_MODE.MOTION && motionAvailable()
    ? STEERING_MODE.MOTION
    : STEERING_MODE.MANUAL;
  try {
    localStorage.setItem(STEERING_MODE_KEY, normalized);
  } catch (_) {}
  return normalized;
}

function selectedVehicle(runtime) {
  return {
    carId: runtime.state.vehicleId,
    color: runtime.state.vehicleColor,
    secondaryColor: runtime.state.vehicleSecondaryColor
  };
}

function openDialog(dialog, trigger) {
  dialog.__turnReturnFocus = trigger;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  dialog.querySelector('[data-dialog-close]')?.focus();
}

function closeDialog(dialog) {
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
  dialog.__turnReturnFocus?.focus?.();
}

function installDialogDismissal(dialog) {
  dialog.querySelector('[data-dialog-close]')?.addEventListener('click', () => closeDialog(dialog));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.addEventListener('close', () => dialog.__turnReturnFocus?.focus?.());
}

function createHowToPlayDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog m8-how-dialog';
  dialog.setAttribute('aria-labelledby', 'm8HowTitle');
  dialog.innerHTML = `
    <article class="m8-dialog-card">
      <header class="m8-dialog-head">
        <div><span>QUICK GUIDE</span><h2 id="m8HowTitle">HOW TO PLAY</h2></div>
        <button type="button" data-dialog-close aria-label="Close How to Play">×</button>
      </header>
      <div class="m8-guide-grid">
        <section><strong>1</strong><div><h3>Choose a track and car</h3><p>Use SHOW RECORDS to compare your saved time, DRIFT and FLOW records on every track. TURN races you against recordings of your own fastest laps, not computer drivers.</p></div></section>
        <section><strong>2</strong><div><h3>Turn the device to steer</h3><p>Hold the phone or tablet in landscape and rotate it like a steering wheel. Recalibrate at the start line whenever your resting angle changes.</p></div></section>
        <section><strong>3</strong><div><h3>Drive with one thumb</h3><p>Keep one thumb on the drive pad and slide between GAS, DRIFT, BOOST and BRAKE. BRAKE stops at zero; hold it and slide outward into REVERSE to back up. While using DRIFT, slide outward past it into LOCK for a stronger slide.</p></div></section>
        <section><strong>4</strong><div><h3>Build and use OVERCHARGE</h3><p>DRIFT charges BOOST as you slide. With BOOST full, keep using DRIFT to build purple OVERCHARGE. GAS catches it; BOOST spends it first as a short stronger burst before normal BOOST.</p></div></section>
        <section class="m8-guide-wide"><strong>♪</strong><div><h3>Drive By Ear™</h3><p>Drive By Ear turns the racing line, upcoming corners, grip, off-road recovery and nearby rivals into spatial sound. Steer toward the warm guiding hum. Headphones provide the clearest left and right information. Together with a screen reader, it is designed to support complete non-visual play.</p></div></section>
      </div>
    </article>`;
  document.body.appendChild(dialog);
  installDialogDismissal(dialog);
  return dialog;
}

function createSettingsDialog({ getSelectedTrackId, onRivalsReset }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'm8-dialog m8-settings-dialog';
  dialog.setAttribute('aria-labelledby', 'm8SettingsTitle');
  dialog.innerHTML = `
    <article class="m8-dialog-card">
      <header class="m8-dialog-head">
        <div><span>TURN</span><h2 id="m8SettingsTitle">SETTINGS</h2></div>
        <button type="button" data-dialog-close aria-label="Close settings">×</button>
      </header>

      <div class="m8-settings-list">
        <fieldset class="m8-setting-card m8-steering-setting">
          <legend>Steering</legend>
          <label><input type="radio" name="m8Steering" value="motion"><span><strong>Device rotation</strong><small>Turn the whole device like a steering wheel.</small></span></label>
          <label><input type="radio" name="m8Steering" value="manual"><span><strong>On-screen steering</strong><small>Use the steering control or a keyboard.</small></span></label>
          <label class="m8-toggle-row m8-handedness-setting"><input id="m8LeftHanded" type="checkbox" aria-describedby="m8LeftHandedDescription"><span><strong>Left-handed controls</strong><small id="m8LeftHandedDescription"></small></span></label>
          <p class="m8-motion-note" hidden>Device rotation is not available in this browser.</p>
        </fieldset>

        <section class="m8-setting-card" aria-labelledby="m8AudioTitle">
          <h3 id="m8AudioTitle">Audio</h3>
          <label class="m8-toggle-row"><input id="m8AudioEnabled" type="checkbox"><span><strong>Sound</strong><small>Turn all game audio on or off.</small></span></label>
          <label class="m8-toggle-row"><input id="m8DbeEnabled" type="checkbox"><span><strong>Drive By Ear™</strong><small>Spatial steering guidance, pace notes, recovery cues and rival warnings.</small></span></label>
          <label class="m8-balance-row" for="m8AudioBalance"><strong>Sound balance</strong><small>Balance car and world sounds against Drive By Ear guidance.</small></label>
          <input id="m8AudioBalance" type="range" min="0" max="100" step="1" value="50" aria-describedby="m8AudioBalanceValue">
          <div class="m8-balance-labels" aria-hidden="true"><span>Other sounds</span><span>Drive By Ear</span></div>
          <output id="m8AudioBalanceValue" for="m8AudioBalance">Balanced</output>
        </section>

        <div class="m8-visual-settings">
          <section class="m8-setting-card m8-interface-settings" data-turn-interface-settings aria-labelledby="m8InterfaceTitle">
            <h3 id="m8InterfaceTitle">Interface</h3>
            <div class="m8-interface-settings-content">
              <div class="m8-interface-slot" data-turn-player-marker-slot></div>
              <div class="m8-interface-slot" data-turn-color-cues-slot></div>
              <div class="m8-interface-slot" data-turn-scoring-slot></div>
            </div>
          </section>
        </div>

        <section class="m8-setting-card m8-record-setting" aria-labelledby="m8RecordsTitle">
          <h3 id="m8RecordsTitle">Personal rivals</h3>
          <p>Remove recorded rival laps for the selected track.</p>
          <button class="m8-reset-rivals" type="button">RESET RIVALS</button>
          <div class="m8-reset-confirm" hidden>
            <p>Reset rivals on <strong class="m8-reset-track"></strong>?</p>
            <button type="button" class="m8-reset-cancel">CANCEL</button>
            <button type="button" class="m8-reset-confirm-button">YES, RESET</button>
          </div>
        </section>
      </div>
      <p class="m8-settings-status" role="status" aria-live="polite"></p>
    </article>`;
  document.body.appendChild(dialog);
  installDialogDismissal(dialog);

  const motionRadio = dialog.querySelector('input[value="motion"]');
  const manualRadio = dialog.querySelector('input[value="manual"]');
  const leftHandedToggle = dialog.querySelector('#m8LeftHanded');
  const leftHandedDescription = dialog.querySelector('#m8LeftHandedDescription');
  const motionNote = dialog.querySelector('.m8-motion-note');
  const soundToggle = dialog.querySelector('#m8AudioEnabled');
  const dbeToggle = dialog.querySelector('#m8DbeEnabled');
  const balanceSlider = dialog.querySelector('#m8AudioBalance');
  const balanceOutput = dialog.querySelector('#m8AudioBalanceValue');
  const status = dialog.querySelector('.m8-settings-status');
  const resetButton = dialog.querySelector('.m8-reset-rivals');
  const resetConfirm = dialog.querySelector('.m8-reset-confirm');
  const resetTrack = dialog.querySelector('.m8-reset-track');
  const resetCancel = dialog.querySelector('.m8-reset-cancel');
  const resetConfirmButton = dialog.querySelector('.m8-reset-confirm-button');

  function audioPreferences() {
    return globalThis.__turnAudioPreferences;
  }

  function balanceLabel(value) {
    if (value < 45) return `${100 - value}% other sounds`;
    if (value > 55) return `${value}% Drive By Ear`;
    return 'Balanced';
  }

  function sync() {
    const steering = loadSteeringMode();
    const handedness = loadControlHandedness();
    motionRadio.disabled = !motionAvailable();
    motionRadio.checked = steering === STEERING_MODE.MOTION;
    manualRadio.checked = steering === STEERING_MODE.MANUAL;
    leftHandedToggle.checked = handedness === CONTROL_HANDEDNESS.LEFT;
    leftHandedDescription.textContent = controlHandednessDescription(handedness);
    motionNote.hidden = motionAvailable();

    const audio = audioPreferences()?.getSettings?.() || {
      audioEnabled: true,
      dbeEnabled: globalThis.__turnDriveByEarEnabled !== false,
      balance: 0.5
    };
    soundToggle.checked = audio.audioEnabled !== false;
    dbeToggle.checked = audio.dbeEnabled !== false;
    const percent = Math.round((Number.isFinite(Number(audio.balance)) ? Number(audio.balance) : 0.5) * 100);
    balanceSlider.value = String(percent);
    balanceOutput.value = balanceLabel(percent);
    balanceOutput.textContent = balanceOutput.value;
    resetConfirm.hidden = true;
    status.textContent = '';
  }

  dialog.addEventListener('toggle', sync);
  dialog.addEventListener('close', () => {
    resetConfirm.hidden = true;
  });

  for (const radio of [motionRadio, manualRadio]) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const mode = saveSteeringMode(radio.value);
      sync();
      status.textContent = mode === STEERING_MODE.MOTION
        ? 'Steering set to device rotation.'
        : 'Steering set to the on-screen control.';
    });
  }

  leftHandedToggle.addEventListener('change', () => {
    const handedness = saveControlHandedness(
      leftHandedToggle.checked ? CONTROL_HANDEDNESS.LEFT : CONTROL_HANDEDNESS.RIGHT
    );
    leftHandedToggle.checked = handedness === CONTROL_HANDEDNESS.LEFT;
    leftHandedDescription.textContent = controlHandednessDescription(handedness);
    status.textContent = handedness === CONTROL_HANDEDNESS.LEFT
      ? 'Left-handed controls on.'
      : 'Left-handed controls off.';
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
    const preferences = audioPreferences();
    preferences?.setDriveByEarEnabled?.(enabled);
    if (enabled && preferences?.driveByEarGraphAvailable === false) {
      dbeToggle.disabled = true;
      status.textContent = 'Drive By Ear enabled. Reloading TURN to build its audio system.';
      requestAnimationFrame(() => globalThis.location?.reload());
      return;
    }
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

  resetButton.addEventListener('click', () => {
    const track = TRACK_CATALOG.find((entry) => entry.id === getSelectedTrackId());
    resetTrack.textContent = track?.name || 'this track';
    resetConfirm.hidden = false;
    resetConfirmButton.focus();
  });
  resetCancel.addEventListener('click', () => {
    resetConfirm.hidden = true;
    resetButton.focus();
  });
  resetConfirmButton.addEventListener('click', async () => {
    resetConfirmButton.disabled = true;
    try {
      await onRivalsReset();
      resetConfirm.hidden = true;
      status.textContent = 'Personal rivals reset for the selected track.';
      resetButton.focus();
    } finally {
      resetConfirmButton.disabled = false;
    }
  });

  return { dialog, sync };
}

// GARAGE's RACE asks for motion access inside the tap itself (iOS only prompts from a
// user gesture), then lets the tap through.
function installGarageRaceGate({ raceSession, getSteeringMode, onAccessReady }) {
  const raceButton = document.querySelector('.garage-race');
  if (!raceButton) throw new Error('TURN M8 could not find the GARAGE RACE button.');

  let status = document.querySelector('.garage-race-status');
  if (!status) {
    status = document.createElement('p');
    status.className = 'garage-race-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    (raceButton.closest('.turn-pr-dock-inner') || raceButton.parentElement).prepend(status);
  }

  const gate = async (event) => {
    // A locked preview is not a race; GARAGE explains the lock itself.
    if (raceButton.getAttribute('aria-disabled') === 'true') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    raceButton.disabled = true;
    status.textContent = '';
    try {
      const access = getSteeringMode() === STEERING_MODE.MOTION
        ? await raceSession.prepareMotionAccess()
        : raceSession.prepareManualAccess();
      onAccessReady(access);
      raceButton.removeEventListener('click', gate, true);
      raceButton.disabled = false;
      raceButton.click();
    } catch (error) {
      if (!motionPermissionWasDismissed(error)) {
        status.textContent = `${error instanceof Error ? error.message : 'The race could not start.'} Choose on-screen steering in Settings to continue without motion.`;
      }
      raceButton.disabled = false;
      raceButton.focus();
    }
  };
  raceButton.addEventListener('click', gate, true);
  return () => raceButton.removeEventListener('click', gate, true);
}

export async function installM8HomeNavigation() {
  if (installed) return globalThis.__turnNextHome;
  installed = true;

  const { runtime, raceSession } = await waitForRuntime();
  const intro = document.querySelector('#intro');
  const utilityGroup = document.querySelector('.utility-group');
  const spectateButton = utilityGroup?.querySelector('.spectate-button');

  let selectedTrackId = normalizeTrackId(loadTrackSelection());
  let setupPending = false;
  let pendingAccess = null;
  let lotWarmupPromise = null;
  let lotWarmupScheduled = false;

  // Home is the app bar (logo, support challenge, ACHIEVEMENTS, ☰), the ☰ sheet's
  // menu and ROADBOOK. home-app-bar.js places the menu in its sheet.
  const home = document.createElement('section');
  home.className = 'm8-home';
  home.setAttribute('aria-labelledby', 'm8HomeTitle');
  home.innerHTML = `
    <div class="m8-home-shell">
      <header class="m8-home-head">
        <span class="m8-home-logo turn-pr-app-logo turn-logo-frame"><img src="/turn/TURNicon.PNG?icon=${ICON_REVISION}" alt="TURN"></span>
        <div class="m8-home-pitch"></div>
        <span class="m8-home-build">TURN NEXT · M8 · SOURCE 2026.07.29-R118</span>
      </header>
      <aside class="m8-home-menu" aria-labelledby="m8MenuTitle">
        <h2 id="m8MenuTitle">MENU</h2>
        <button class="m8-home-settings" type="button">SETTINGS</button>
        <button class="m8-how-button" type="button">HOW TO PLAY</button>
        <p class="m8-home-status" role="status" aria-live="polite"></p>
      </aside>
    </div>`;
  document.body.appendChild(home);

  const howButton = home.querySelector('.m8-how-button');
  const homeSettingsButton = home.querySelector('.m8-home-settings');
  const homeStatus = home.querySelector('.m8-home-status');
  const howDialog = createHowToPlayDialog();

  const roadbook = installRoadbook({
    home,
    getSelectedTrackId: () => selectedTrackId,
    onSelectTrack(trackId) {
      selectedTrackId = normalizeTrackId(trackId);
    },
    onChooseCar: () => continueToTrack(),
    // The Track sheet's reset: the same steps as Settings, for the track shown.
    async onResetRivals(trackId) {
      await activateTrack(normalizeTrackId(trackId), runtime);
      globalThis.__turnResetRivals?.();
    }
  });
  const continueButton = roadbook.chooseButton;

  const settings = createSettingsDialog({
    getSelectedTrackId: () => selectedTrackId,
    async onRivalsReset() {
      await activateTrack(selectedTrackId, runtime);
      globalThis.__turnResetRivals?.();
      roadbook.refreshRecords();
    }
  });

  const raceSettingsButton = document.createElement('button');
  raceSettingsButton.type = 'button';
  raceSettingsButton.className = 'utility m8-race-settings-button';
  raceSettingsButton.textContent = 'Settings';
  raceSettingsButton.setAttribute('aria-label', 'Open game settings');
  if (utilityGroup) {
    if (spectateButton) utilityGroup.insertBefore(raceSettingsButton, spectateButton);
    else utilityGroup.appendChild(raceSettingsButton);
  }

  function selectedTrack() {
    return TRACK_CATALOG.find((track) => track.id === selectedTrackId) || TRACK_CATALOG[0];
  }

  let garageModule = null;
  function prepareGarageOnce() {
    if (!lotWarmupPromise) {
      const preparation = import('/turn/garage/garage.js').then(async (module) => {
        await module.prepareGarage();
        garageModule = module;
      }).catch((error) => {
        if (lotWarmupPromise === preparation) lotWarmupPromise = null;
        throw error;
      });
      lotWarmupPromise = preparation;
    }
    return lotWarmupPromise;
  }

  function scheduleEnhancedLotWarmup() {
    if (lotWarmupPromise || lotWarmupScheduled) return;
    lotWarmupScheduled = true;
    requestAnimationFrame(() => {
      const beginWarmup = () => {
        lotWarmupScheduled = false;
        void prepareGarageOnce().catch((error) => {
          console.warn('TURN: GARAGE could not be prepared in the background.', error);
        });
      };

      if (typeof globalThis.requestIdleCallback === 'function') {
        globalThis.requestIdleCallback(beginWarmup, { timeout: 1800 });
        return;
      }
      globalThis.setTimeout(beginWarmup, 600);
    });
  }

  function waitForHomePaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function syncRaceSettingsVisibility() {
    raceSettingsButton.hidden = utilityGroup?.dataset.menuState !== 'staged';
  }

  function showHome({ focus = false } = {}) {
    intro.hidden = true;
    home.hidden = false;
    document.body.classList.add('turn-m8-active', 'turn-home-open');
    roadbook.sync();
    roadbook.refreshRecords();
    scheduleEnhancedLotWarmup();
    window.dispatchEvent(new CustomEvent('turn:home-shown', { detail: { focus } }));
    if (focus) requestAnimationFrame(() => home.querySelector('#m8HomeTitle')?.focus?.());
  }

  function hideHome() {
    roadbook.closeSheet();
    home.hidden = true;
    document.body.classList.remove('turn-home-open');
    window.dispatchEvent(new CustomEvent('turn:home-hidden'));
  }

  // A module that fails to load once stays failed until the page reloads, so a setup
  // that could not load (a dropped request on the very first start) reloads once and
  // carries on to the chosen track; a second failure soon after shows RESTART instead.
  function recoverSetup(trackId) {
    try {
      const last = Number(sessionStorage.getItem(SETUP_RELOADED_KEY)) || 0;
      if (Date.now() - last > SETUP_RELOAD_WINDOW_MS) {
        sessionStorage.setItem(SETUP_RELOADED_KEY, String(Date.now()));
        sessionStorage.setItem(SETUP_RESUME_KEY, JSON.stringify({ trackId, at: Date.now() }));
        location.reload();
        return true;
      }
    } catch {
      // No session storage: offer RESTART below.
    }
    showSetupFailure();
    return false;
  }

  function showSetupFailure() {
    document.querySelector('.turn-setup-failure')?.remove();
    const toast = document.createElement('div');
    toast.className = 'turn-update-toast turn-setup-failure';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <p class="turn-update-toast-text">The race setup didn’t load</p>
      <button class="turn-update-toast-restart" type="button">RESTART</button>
      <button class="turn-update-toast-later" type="button" aria-label="Close">×</button>`;
    toast.querySelector('.turn-update-toast-restart').addEventListener('click', () => location.reload());
    toast.querySelector('.turn-update-toast-later').addEventListener('click', () => toast.remove());
    (document.querySelector('.turn-toast-region') || document.body).appendChild(toast);
  }

  function resumeSetupAfterReload() {
    let resume = null;
    try {
      resume = JSON.parse(sessionStorage.getItem(SETUP_RESUME_KEY) || 'null');
      sessionStorage.removeItem(SETUP_RESUME_KEY);
    } catch {
      return;
    }
    if (!resume || Date.now() - resume.at > SETUP_RELOAD_WINDOW_MS) return;
    selectedTrackId = normalizeTrackId(resume.trackId);
    roadbook.sync();
    void continueToTrack();
  }

  async function continueToTrack() {
    if (setupPending || rewardPreview.active || tutorialSession.active) return false;
    document.querySelector('.turn-setup-failure')?.remove();
    let garageOpened = false;
    let reloading = false;
    const trackId = selectedTrackId;
    const trackName = selectedTrack().name.toUpperCase();
    const setupMessage = `PREPARING ${trackName} AND GARAGE…`;
    setupPending = true;
    roadbook.setBusy(`PREPARING ${trackName}…`);
    homeStatus.textContent = setupMessage;
    pendingAccess = null;

    try {
      // Let the pressed state and setup copy reach the screen before world
      // construction or module parsing can occupy the main thread.
      await waitForHomePaint();
      await Promise.all([
        activateTrack(trackId, runtime),
        prepareGarageOnce()
      ]);
      hideHome();
      garageOpened = true;
      const track = selectedTrack();
      const lotPromise = garageModule.showGarage({
        initialSelection: selectedVehicle(runtime),
        trackId,
        trackName: track.name,
        trackDifficulty: track.difficulty,
        trackIcon: trackIconMarkup(trackId)
      });
      const removeRaceGate = installGarageRaceGate({
        raceSession,
        getSteeringMode: loadSteeringMode,
        onAccessReady(access) {
          pendingAccess = access;
        }
      });
      const selection = await lotPromise;
      removeRaceGate();

      if (!selection) {
        showHome({ focus: true });
        return false;
      }

      // The track intro is already an intentional transition. Prepare the
      // selected race car behind it instead of making the player wait twice.
      await Promise.all([
        raceSession.selectVehicle(selection),
        showTrackIntro(trackId)
      ]);
      await raceSession.startGame(pendingAccess?.fullscreenPromise);
      return true;
    } catch (error) {
      if (!garageOpened) {
        console.warn('TURN: the race setup could not load.', error);
        reloading = recoverSetup(trackId);
        if (reloading) return false;
      }
      showHome();
      homeStatus.textContent = error instanceof Error ? error.message : 'The race setup could not be opened.';
      continueButton.focus();
      return false;
    } finally {
      // Reloading: the button keeps its busy label until the page goes.
      if (!reloading) {
        setupPending = false;
        roadbook.setBusy('');
      }
      if (homeStatus.textContent === setupMessage) homeStatus.textContent = '';
    }
  }

  const rewardPreview = createRewardPreviewSession({
    state: runtime.state,
    raceSession,
    activateTrack: (trackId, options) => activateTrack(trackId, runtime, options),
    prepareAccess: () => loadSteeringMode() === STEERING_MODE.MOTION
      ? raceSession.prepareMotionAccess()
      : raceSession.prepareManualAccess(),
    showTrackIntro,
    hideHome,
    showHome
  });

  async function startRewardPreview(challenge) {
    if (setupPending || rewardPreview.active || tutorialSession.active) return false;
    setupPending = true;
    try {
      return await rewardPreview.start(challenge);
    } finally {
      setupPending = false;
    }
  }

  const tutorialProgress = createTutorialProgress();
  const tutorialSession = createTutorialSession({
    state: runtime.state,
    raceSession,
    activateTrack: (trackId, options) => activateTrack(trackId, runtime, options),
    progress: tutorialProgress,
    syncRivals: () => runtime.syncCompetitorVisuals?.()
  });

  // TURN TUTORIAL (#1132): COUNTRYSIDE in the LEARNER CAR, then ordinary TURN.
  let tutorialCoach = null;
  function stopTutorialCoach() {
    tutorialCoach?.stop();
    tutorialCoach = null;
  }

  async function startTutorial() {
    if (setupPending || rewardPreview.active || tutorialSession.active || runtime.state.running) return false;
    setupPending = true;
    try {
      // Request iOS motion access in the START tap, before loading any content.
      const access = await (loadSteeringMode() === STEERING_MODE.MOTION
        ? raceSession.prepareMotionAccess()
        : raceSession.prepareManualAccess());
      hideHome();
      await tutorialSession.enter();
      await showTrackIntro(TURN_TUTORIAL.trackId);
      await raceSession.startGame(access.fullscreenPromise);
      tutorialCoach = startTurnTutorialCoach({ runtime });
      return true;
    } catch (error) {
      console.warn('TURN: TURN TUTORIAL could not start.', error);
      stopTutorialCoach();
      await tutorialSession.exit().catch(() => {});
      showHome({ focus: true });
      homeStatus.textContent = 'TURN TUTORIAL could not start. Try again from HOW TO PLAY.';
      return false;
    } finally {
      setupPending = false;
    }
  }

  async function leaveRaceForHome() {
    raceSession.leaveRace();
    if (rewardPreview.active) await rewardPreview.restore();
    stopTutorialCoach();
    if (tutorialSession.active) await tutorialSession.exit();
    showHome({ focus: true });
    return true;
  }

  const tutorialEntry = installTutorialEntry({
    howDialog,
    progress: tutorialProgress,
    startTutorial,
    announce(message) {
      homeStatus.textContent = message;
    }
  });

  howButton.addEventListener('click', () => openDialog(howDialog, howButton));
  homeSettingsButton.addEventListener('click', () => {
    settings.sync();
    openDialog(settings.dialog, homeSettingsButton);
  });
  raceSettingsButton.addEventListener('click', () => {
    settings.sync();
    openDialog(settings.dialog, raceSettingsButton);
  });

  const menuObserver = utilityGroup && typeof MutationObserver === 'function'
    ? new MutationObserver(syncRaceSettingsVisibility)
    : null;
  menuObserver?.observe(utilityGroup, { attributes: true, attributeFilter: ['data-menu-state'] });
  window.addEventListener('turn:ui-state-change', syncRaceSettingsVisibility);

  runtime.openGarage = leaveRaceForHome;
  runtime.openHome = leaveRaceForHome;
  document.documentElement.dataset.turnHomeLifecycle = 'home-m8';
  globalThis.__turnNextHome = Object.freeze({
    route: 'home-m8',
    roadbook,
    showHome,
    hideHome,
    continueToTrack,
    startRewardPreview,
    startTutorial,
    tutorial: Object.freeze({ progress: tutorialProgress, session: tutorialSession, entry: tutorialEntry }),
    leaveRaceForHome,
    getSelectedTrackId: () => selectedTrackId,
    getSteeringMode: loadSteeringMode
  });

  syncRaceSettingsVisibility();
  showHome();
  resumeSetupAfterReload();
  return globalThis.__turnNextHome;
}
