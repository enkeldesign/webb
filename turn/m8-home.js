import {
  TRACK_CATALOG,
  TRACK_SELECTION_CATALOG,
  getTrackPreviewPoints,
  loadTrackSelection,
  normalizeTrackId
} from '/turn/tracks/catalog.js?source=20260729-r118-m8';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import { showTheLot } from '/turn/garage/lot-r10.js?source=20260729-r118-m8';
import { showTrackIntro } from '/turn/ui/track-intro.js?source=20260729-r118-m8';
import { getStoredBestLap } from '/turn/race/rival-storage.js?source=20260729-r118-m8';
import { getCarDefinition } from '/turn/vehicle/catalog.js?source=20260729-r118-m8';
import { renderBestCarThumbnail } from '/turn/ui/track-best-car.js?source=20260729-r118-m8';
import { saveDriveByEarEnabled } from '/turn/ui/drive-by-ear-setting.js?source=20260729-r118-m8';

const STEERING_MODE_KEY = 'turn-steering-mode-v1';
const STEERING_MODE = Object.freeze({ MOTION: 'motion', MANUAL: 'manual' });
const ICON_REVISION = '20260803-profile-512';

let installed = false;
let previewGeneration = 0;

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

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return 'NO TIME YET';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}

function makePreviewSvg(trackId, accent) {
  const points = getTrackPreviewPoints(trackId, 110);
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxZ - minZ);
  const scale = Math.min(270 / width, 135 / height);
  const offsetX = (320 - width * scale) / 2;
  const offsetY = (185 - height * scale) / 2;
  const path = points.map((point, index) => {
    const x = offsetX + (point.x - minX) * scale;
    const y = offsetY + (point.z - minZ) * scale;
    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const startX = offsetX + (points[0].x - minX) * scale;
  const startY = offsetY + (points[0].z - minZ) * scale;

  return `
    <svg viewBox="0 0 320 185" focusable="false">
      <path class="track-preview-shadow" d="${path} Z"></path>
      <path class="track-preview-road" d="${path} Z"></path>
      <path class="track-preview-line" d="${path} Z" style="stroke:${accent}"></path>
      <circle class="track-preview-start" cx="${startX.toFixed(1)}" cy="${startY.toFixed(1)}" r="7"></circle>
    </svg>`;
}

function makeLockedPreviewSvg() {
  return `
    <svg viewBox="0 0 320 185" focusable="false">
      <path class="track-preview-shadow" d="M48 136 L48 62 Q50 28 84 40 L126 82 L174 42 Q194 28 216 44 L270 74 L270 142 L214 142 L177 116 L137 150 L76 150 Z"></path>
      <path class="track-preview-road" d="M48 136 L48 62 Q50 28 84 40 L126 82 L174 42 Q194 28 216 44 L270 74 L270 142 L214 142 L177 116 L137 150 L76 150 Z"></path>
    </svg>`;
}

function renderTrackCard(track) {
  if (track.locked) {
    return `
      <button
        class="track-card track-card-locked is-locked"
        type="button"
        data-track-id="${track.id}"
        aria-label="${track.eyebrow}, ${track.name}, locked"
        disabled
        style="--track-accent:${track.accent};--track-accent-soft:${track.accentSoft}"
      >
        <span class="track-card-summary">
          <span class="track-card-choice">
            <span class="track-card-choice-marker" aria-hidden="true"></span>
            <strong class="track-card-name">${track.name}</strong>
          </span>
          <span class="track-card-best track-card-coming-soon">
            <span class="track-card-best-copy"><span>BEST:</span><strong>COMING SOON</strong></span>
          </span>
          <strong class="track-card-difficulty">LOCKED</strong>
        </span>
        <span class="track-card-preview" aria-hidden="true">${makeLockedPreviewSvg()}</span>
      </button>`;
  }

  return `
    <button
      class="track-card track-card-${track.id}"
      type="button"
      data-track-id="${track.id}"
      aria-label="${track.name}, ${track.difficulty} track"
      aria-pressed="false"
      style="--track-accent:${track.accent};--track-accent-soft:${track.accentSoft}"
    >
      <span class="track-card-summary">
        <span class="track-card-choice">
          <span class="track-card-choice-marker" aria-hidden="true"></span>
          <strong class="track-card-name">${track.name.toUpperCase()}</strong>
        </span>
        <span class="track-card-best" data-track-best="${track.id}">
          <span class="track-card-best-copy">
            <span>BEST:</span>
            <strong class="track-card-best-time">--:--.---</strong>
            <small class="track-card-best-car" hidden></small>
          </span>
          <img class="track-card-best-model" alt="" aria-hidden="true" draggable="false" hidden>
        </span>
        <strong class="track-card-difficulty">${track.difficulty}</strong>
      </span>
      <span class="track-card-preview" aria-hidden="true">${makePreviewSvg(track.id, track.accent)}</span>
    </button>`;
}

function refreshTrackRecords(root) {
  const generation = ++previewGeneration;
  for (const track of TRACK_CATALOG) {
    const bestLap = getStoredBestLap(track.id);
    const bestBox = root.querySelector(`[data-track-best="${track.id}"]`);
    const time = bestBox?.querySelector('.track-card-best-time');
    const car = bestBox?.querySelector('.track-card-best-car');
    const model = bestBox?.querySelector('.track-card-best-model');

    if (time) time.textContent = formatTime(bestLap?.time ?? Infinity);
    if (car) {
      car.textContent = bestLap ? getCarDefinition(bestLap.carId).name.toUpperCase() : '';
      car.hidden = !bestLap;
    }
    if (model) {
      model.hidden = true;
      model.removeAttribute('src');
      delete model.dataset.previewKey;
    }
    if (!bestLap || !model) continue;

    const previewKey = [track.id, bestLap.carId, bestLap.carColor, bestLap.carSecondaryColor].join(':');
    model.dataset.previewKey = previewKey;
    renderBestCarThumbnail(bestLap).then((source) => {
      if (generation !== previewGeneration || model.dataset.previewKey !== previewKey) return;
      model.src = source;
      model.hidden = false;
    }).catch((error) => {
      console.warn(`TURN: could not render the ${track.name} record car.`, error);
    });
  }
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
        <section><strong>1</strong><div><h3>Choose a track and car</h3><p>Your saved best lap appears on each track card. TURN races you against recordings of your own fastest laps, not computer drivers.</p></div></section>
        <section><strong>2</strong><div><h3>Turn the device to steer</h3><p>Hold the phone or tablet in landscape and rotate it like a steering wheel. Recalibrate at the start line whenever your resting angle changes.</p></div></section>
        <section><strong>3</strong><div><h3>Drive with one thumb</h3><p>Keep one thumb on the drive area and slide between Gas, Drift and Boost. Brake and Reverse share the separate brake control.</p></div></section>
        <section><strong>4</strong><div><h3>Use Drift and Boost wisely</h3><p>Drift helps the car rotate but costs grip. Boost gives speed but can make the next corner harder. Fast laps come from balancing both.</p></div></section>
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
          <p class="m8-motion-note" hidden>Device rotation is not available in this browser.</p>
        </fieldset>

        <section class="m8-setting-card" aria-labelledby="m8AudioTitle">
          <h3 id="m8AudioTitle">Audio</h3>
          <label class="m8-toggle-row"><input id="m8AudioEnabled" type="checkbox"><span><strong>Sound</strong><small>Turn every TURN sound on or off.</small></span></label>
          <label class="m8-toggle-row"><input id="m8DbeEnabled" type="checkbox"><span><strong>Drive By Ear™</strong><small>Spatial steering guidance, pace notes, recovery cues and rival warnings.</small></span></label>
          <label class="m8-balance-row" for="m8AudioBalance"><strong>Sound balance</strong><small>Choose between car and world sounds or Drive By Ear guidance.</small></label>
          <input id="m8AudioBalance" type="range" min="0" max="100" step="1" value="50" aria-describedby="m8AudioBalanceValue">
          <div class="m8-balance-labels" aria-hidden="true"><span>Other sounds</span><span>Drive By Ear</span></div>
          <output id="m8AudioBalanceValue" for="m8AudioBalance">Balanced</output>
        </section>

        <section class="m8-setting-card m8-record-setting" aria-labelledby="m8RecordsTitle">
          <h3 id="m8RecordsTitle">Personal rivals</h3>
          <p>Remove the recorded laps for the currently selected track.</p>
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
    motionRadio.disabled = !motionAvailable();
    motionRadio.checked = steering === STEERING_MODE.MOTION;
    manualRadio.checked = steering === STEERING_MODE.MANUAL;
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

function installLotRaceGate({ raceSession, getSteeringMode, onAccessReady }) {
  const raceButton = document.querySelector('.lot-race');
  if (!raceButton) throw new Error('TURN M8 could not find the Race This Car button.');

  let status = document.querySelector('.lot-race-status');
  if (!status) {
    status = document.createElement('p');
    status.className = 'lot-race-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    raceButton.insertAdjacentElement('beforebegin', status);
  }

  const gate = async (event) => {
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

  const home = document.createElement('section');
  home.className = 'm8-home';
  home.setAttribute('aria-labelledby', 'm8HomeTitle');
  home.innerHTML = `
    <div class="m8-home-shell">
      <header class="m8-home-head">
        <img class="m8-home-logo" src="/turn/TURNicon.PNG?icon=${ICON_REVISION}" alt="TURN">
        <div class="m8-home-pitch">
          <p>TILT. DRIFT.<br>BEAT YOUR BEST.</p>
          <button class="m8-how-button" type="button">HOW TO PLAY</button>
        </div>
        <span class="m8-home-build">TURN NEXT · M8 · SOURCE 2026.07.29-R118</span>
        <button class="m8-home-settings" type="button"><span aria-hidden="true">⚙</span> SETTINGS</button>
      </header>

      <main class="m8-home-main">
        <div class="m8-track-heading-row">
          <h1 id="m8HomeTitle" tabindex="-1">CHOOSE YOUR TRACK</h1>
          <div class="m8-track-scroll-buttons" aria-label="Scroll tracks">
            <button class="m8-track-previous" type="button" aria-label="Scroll to previous tracks">‹</button>
            <button class="m8-track-next" type="button" aria-label="Scroll to more tracks">›</button>
          </div>
        </div>
        <div class="m8-track-rail" aria-label="Available tracks">
          ${TRACK_SELECTION_CATALOG.map(renderTrackCard).join('')}
        </div>
        <button class="m8-track-continue" type="button">CONTINUE</button>
        <p class="m8-home-status" role="status" aria-live="polite"></p>
      </main>
    </div>`;
  document.body.appendChild(home);

  const rail = home.querySelector('.m8-track-rail');
  const cards = [...rail.querySelectorAll('.track-card:not([disabled])')];
  const continueButton = home.querySelector('.m8-track-continue');
  const previousButton = home.querySelector('.m8-track-previous');
  const nextButton = home.querySelector('.m8-track-next');
  const howButton = home.querySelector('.m8-how-button');
  const homeSettingsButton = home.querySelector('.m8-home-settings');
  const homeStatus = home.querySelector('.m8-home-status');
  const howDialog = createHowToPlayDialog();

  const settings = createSettingsDialog({
    getSelectedTrackId: () => selectedTrackId,
    async onRivalsReset() {
      await activateTrack(selectedTrackId, runtime);
      globalThis.__turnResetRivals?.();
      refreshTrackRecords(home);
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

  function syncSelection({ scroll = false } = {}) {
    for (const card of cards) {
      const selected = card.dataset.trackId === selectedTrackId;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    }
    const track = selectedTrack();
    continueButton.textContent = `CONTINUE TO ${track.name.toUpperCase()}`;
    continueButton.style.setProperty('--selected-track-accent', track.accent || '#ff4fa3');
    if (scroll) {
      rail.querySelector(`[data-track-id="${selectedTrackId}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  function syncScrollButtons() {
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    previousButton.disabled = rail.scrollLeft <= 4;
    nextButton.disabled = rail.scrollLeft >= max - 4;
  }

  function syncRaceSettingsVisibility() {
    raceSettingsButton.hidden = utilityGroup?.dataset.menuState !== 'staged';
  }

  function showHome({ focus = false } = {}) {
    intro.hidden = true;
    home.hidden = false;
    document.body.classList.add('turn-m8-active', 'turn-home-open');
    refreshTrackRecords(home);
    syncSelection();
    requestAnimationFrame(() => {
      syncScrollButtons();
      if (focus) home.querySelector('#m8HomeTitle')?.focus?.();
    });
  }

  function hideHome() {
    home.hidden = true;
    document.body.classList.remove('turn-home-open');
  }

  async function continueToTrack() {
    if (setupPending) return;
    setupPending = true;
    continueButton.disabled = true;
    homeStatus.textContent = '';
    pendingAccess = null;

    try {
      await activateTrack(selectedTrackId, runtime);
      hideHome();
      const lotPromise = showTheLot({ initialSelection: selectedVehicle(runtime) });
      const removeRaceGate = installLotRaceGate({
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

      await raceSession.selectVehicle(selection);
      await showTrackIntro(selectedTrackId);
      await raceSession.startGame(pendingAccess?.fullscreenPromise);
      return true;
    } catch (error) {
      showHome();
      homeStatus.textContent = error instanceof Error ? error.message : 'The race setup could not be opened.';
      continueButton.focus();
      return false;
    } finally {
      setupPending = false;
      continueButton.disabled = false;
    }
  }

  async function leaveRaceForHome() {
    raceSession.leaveRace();
    showHome({ focus: true });
    return true;
  }

  for (const card of cards) {
    card.addEventListener('click', () => {
      selectedTrackId = normalizeTrackId(card.dataset.trackId);
      syncSelection({ scroll: true });
    });
  }
  continueButton.addEventListener('click', continueToTrack);
  previousButton.addEventListener('click', () => rail.scrollBy({ left: -rail.clientWidth * 0.82, behavior: 'smooth' }));
  nextButton.addEventListener('click', () => rail.scrollBy({ left: rail.clientWidth * 0.82, behavior: 'smooth' }));
  rail.addEventListener('scroll', syncScrollButtons, { passive: true });
  window.addEventListener('resize', syncScrollButtons, { passive: true });
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
  window.addEventListener('turn:rivals-reset', () => refreshTrackRecords(home));

  runtime.openLot = leaveRaceForHome;
  runtime.openHome = leaveRaceForHome;
  document.documentElement.dataset.turnHomeLifecycle = 'home-m8';
  globalThis.__turnNextHome = Object.freeze({
    route: 'home-m8',
    showHome,
    hideHome,
    continueToTrack,
    leaveRaceForHome,
    getSelectedTrackId: () => selectedTrackId,
    getSteeringMode: loadSteeringMode
  });

  syncSelection();
  syncRaceSettingsVisibility();
  showHome();
  return globalThis.__turnNextHome;
}
