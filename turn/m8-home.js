import {
  TRACK_CATALOG,
  TRACK_SELECTION_CATALOG,
  getTrackPreviewPoints,
  loadTrackSelection,
  normalizeTrackId
} from '/turn/tracks/catalog.js?source=20260729-r118-m8';
import { activateTrack } from '/turn/tracks/track-manager.js?source=20260729-r118-m8';
import { prepareEnhancedLot, showEnhancedLot as showTheLot } from '/turn/garage/lot-track-select.js?revision=r200-production-candidate';
import { showTrackIntro } from '/turn/ui/track-intro.js?source=20260729-r118-m8';
import { getStoredBestLap } from '/turn/race/rival-storage.js?source=20260729-r118-m8';
import { getCarDefinition } from '/turn/vehicle/catalog.js?source=20260729-r118-m8';
import { renderBestCarThumbnail } from '/turn/ui/track-best-car.js?source=20260729-r118-m8';
import { saveDriveByEarEnabled } from '/turn/ui/drive-by-ear-setting.js?source=20260729-r118-m8';
import {
  CONTROL_HANDEDNESS,
  installControlHandedness,
  loadControlHandedness,
  saveControlHandedness
} from '/turn/ui/control-handedness.js?revision=r228-left-handed-controls';

const STEERING_MODE_KEY = 'turn-steering-mode-v1';
const STEERING_MODE = Object.freeze({ MOTION: 'motion', MANUAL: 'manual' });
const ICON_REVISION = '20260803-profile-512';

let installed = false;
let previewGeneration = 0;

installControlHandedness();

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
        <section><strong>3</strong><div><h3>Drive with one thumb</h3><p>Keep one thumb on the drive pad and slide between GAS, DRIFT, BOOST and BRAKE · REVERSE. While using DRIFT, slide farther left into LOCK for a stronger slide.</p></div></section>
        <section><strong>4</strong><div><h3>Build and use OVERCHARGE</h3><p>DRIFT charges BOOST as you slide. With BOOST full, keep using DRIFT to build purple OVERCHARGE. GAS catches it and BOOST spends it.</p></div></section>
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
          <label class="m8-toggle-row m8-handedness-setting"><input id="m8LeftHanded" type="checkbox"><span><strong>Left-handed controls</strong><small>Move the drive pad to the left. With on-screen steering, steering moves to the right.</small></span></label>
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
  const leftHandedToggle = dialog.querySelector('#m8LeftHanded');
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

function installLotRaceGate({ raceSession, getSteeringMode, onAccessReady }) {
  const raceButton = document.querySelector('.lot-race');
  if (!raceButton) throw new Error('TURN M8 could not find the Race This Car button.');

  let status = document.querySelector('.lot-race-status');
  if (!status) {
    status = document.createElement('p');
    status.className = 'lot-race-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    raceButton.insertAdjacentElement('afterend', status);
  }

  let pending = false;

  async function ensureAccess() {
    if (pending) return false;
    pending = true;
    status.textContent = '';
    try {
      const steeringMode = getSteeringMode();
      if (steeringMode === STEERING_MODE.MOTION) {
        await raceSession.requestMotion();
      } else {
        raceSession.useManualMode();
      }
      onAccessReady();
      return true;
    } catch (error) {
      if (motionPermissionWasDismissed(error)) {
        status.textContent = 'Motion access was not granted. Choose on-screen steering in Settings, or try again.';
        return false;
      }
      throw error;
    } finally {
      pending = false;
    }
  }

  raceButton.addEventListener('click', (event) => {
    event.preventDefault();
    void ensureAccess();
  });

  return { ensureAccess };
}

function focusTrackCard(root, trackId) {
  root.querySelector(`[data-track-id="${trackId}"]`)?.focus();
}

function updateTrackSelection(root, trackId) {
  const normalized = normalizeTrackId(trackId);
  for (const card of root.querySelectorAll('[data-track-id]')) {
    const selected = card.dataset.trackId === normalized;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
  return normalized;
}

function setVisible(home, visible) {
  home.hidden = !visible;
  home.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

export async function installM8HomeNavigation() {
  if (installed) return globalThis.__turnHome;
  installed = true;

  const { runtime, raceSession } = await waitForRuntime();
  const root = document.createElement('section');
  root.className = 'm8-home';
  root.setAttribute('aria-label', 'TURN home');

  const activeTrack = loadTrackSelection();
  let selectedTrackId = activeTrack.id;

  const trackCards = TRACK_SELECTION_CATALOG.map(renderTrackCard).join('');
  root.innerHTML = `
    <header class="m8-home-header">
      <div class="m8-home-brand"><img src="./TURNicon.PNG?icon=${ICON_REVISION}" alt=""><div><strong>TURN</strong><span>TILT · DRIFT · BOOST</span></div></div>
      <div class="m8-home-actions"><button type="button" data-home-settings>SETTINGS</button><button type="button" data-home-how>HOW TO PLAY</button></div>
    </header>
    <div class="m8-home-main">
      <section class="m8-track-panel" aria-label="Tracks">
        <div class="m8-track-list">${trackCards}</div>
      </section>
      <section class="m8-menu-panel" aria-label="Menu">
        <div class="m8-selected-track"><span>SELECTED</span><strong>${activeTrack.name}</strong></div>
        <button type="button" class="m8-race-track">RACE THIS TRACK</button>
        <button type="button" class="m8-lot-button">THE LOT</button>
      </section>
    </div>`;

  document.body.appendChild(root);
  refreshTrackRecords(root);
  updateTrackSelection(root, selectedTrackId);

  const settings = createSettingsDialog({
    getSelectedTrackId: () => selectedTrackId,
    onRivalsReset: async () => {
      globalThis.__turnResetRivals?.();
      refreshTrackRecords(root);
    }
  });
  const how = createHowToPlayDialog();
  const raceTrackButton = root.querySelector('.m8-race-track');
  const lotButton = root.querySelector('.m8-lot-button');
  const selectedName = root.querySelector('.m8-selected-track strong');

  function selectTrack(trackId, { focus = false } = {}) {
    selectedTrackId = updateTrackSelection(root, trackId);
    const track = TRACK_CATALOG.find((entry) => entry.id === selectedTrackId) || activeTrack;
    selectedName.textContent = track.name;
    if (focus) focusTrackCard(root, selectedTrackId);
    return track;
  }

  root.addEventListener('click', (event) => {
    const card = event.target.closest('[data-track-id]');
    if (card && !card.disabled) selectTrack(card.dataset.trackId);
  });

  root.querySelector('[data-home-settings]')?.addEventListener('click', (event) => {
    settings.sync();
    openDialog(settings.dialog, event.currentTarget);
  });
  root.querySelector('[data-home-how]')?.addEventListener('click', (event) => openDialog(how, event.currentTarget));

  const accessGate = installLotRaceGate({
    raceSession,
    getSteeringMode: loadSteeringMode,
    onAccessReady: () => setVisible(root, false)
  });

  raceTrackButton.addEventListener('click', async () => {
    const track = selectTrack(selectedTrackId);
    await activateTrack(track.id);
    await showTrackIntro(track);
    await prepareEnhancedLot({ selectedVehicle: selectedVehicle(runtime) });
    showTheLot();
  });

  lotButton.addEventListener('click', async () => {
    await prepareEnhancedLot({ selectedVehicle: selectedVehicle(runtime) });
    showTheLot();
  });

  const home = {
    root,
    show() {
      setVisible(root, true);
      refreshTrackRecords(root);
      settings.sync();
      selectTrack(loadTrackSelection().id);
    },
    hide() {
      setVisible(root, false);
    },
    getSelectedTrackId: () => selectedTrackId,
    ensureRaceAccess: accessGate.ensureAccess
  };

  setVisible(root, true);
  globalThis.__turnHome = home;
  return home;
}
