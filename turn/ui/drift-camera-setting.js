export const DRIFT_CAMERA_STORAGE_KEY = 'turn-drift-camera-v1';
export const SPEED_RESPONSIVE_CAMERA_STORAGE_KEY = 'turn-speed-responsive-camera-v1';
export const SPEED_RESPONSIVE_CAMERA_DEFAULT = false;

let installed = false;
let settingsObserver = null;

export function driftCameraEnabled(storage = getStorage()) {
  try {
    return storage?.getItem(DRIFT_CAMERA_STORAGE_KEY) === 'on';
  } catch (_) {
    return false;
  }
}

export function saveDriftCameraEnabled(enabled, storage = getStorage()) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(DRIFT_CAMERA_STORAGE_KEY, enabled ? 'on' : 'off');
    return true;
  } catch (_) {
    return false;
  }
}

export function speedResponsiveCameraEnabled(
  storage = getStorage(),
  defaultEnabled = SPEED_RESPONSIVE_CAMERA_DEFAULT
) {
  try {
    const preference = storage?.getItem(SPEED_RESPONSIVE_CAMERA_STORAGE_KEY);
    if (preference === 'on') return true;
    if (preference === 'off') return false;
    return defaultEnabled === true;
  } catch (_) {
    return defaultEnabled === true;
  }
}

export function saveSpeedResponsiveCameraEnabled(enabled, storage = getStorage()) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(SPEED_RESPONSIVE_CAMERA_STORAGE_KEY, enabled ? 'on' : 'off');
    return true;
  } catch (_) {
    return false;
  }
}

export function installDriftCameraSetting() {
  const driftEnabled = driftCameraEnabled();
  const speedResponsiveEnabled = speedResponsiveCameraEnabled();
  globalThis.__turnDriftCameraEnabled = driftEnabled;
  globalThis.__turnSpeedResponsiveCameraEnabled = speedResponsiveEnabled;
  if (typeof document === 'undefined') return driftEnabled;
  if (installed) {
    attachSettingsControl();
    return driftEnabled;
  }
  installed = true;

  const attach = () => {
    if (!attachSettingsControl()) return false;
    settingsObserver?.disconnect();
    settingsObserver = null;
    return true;
  };

  if (!attach() && document.body && typeof MutationObserver !== 'undefined') {
    settingsObserver = new MutationObserver(attach);
    settingsObserver.observe(document.body, { childList: true, subtree: true });
  }
  document.addEventListener('turn:home-ready', attach, { once: true });
  return driftEnabled;
}

function attachSettingsControl() {
  const dialog = document.querySelector('.m8-settings-dialog');
  const list = dialog?.querySelector('.m8-settings-list');
  if (!dialog || !list) return false;

  let section = list.querySelector('[data-turn-drift-camera-setting]');
  if (!section) {
    section = document.createElement('section');
    section.className = 'm8-setting-card';
    section.dataset.turnDriftCameraSetting = '';
    section.setAttribute('aria-labelledby', 'm8CameraTitle');
    section.innerHTML = `
      <h3 id="m8CameraTitle">Camera</h3>
      <label class="m8-toggle-row">
        <input id="m8DriftCameraEnabled" type="checkbox">
        <span>
          <strong>Drift camera</strong>
          <small>Follows the car’s actual direction of travel during slides. Experimental; the classic camera remains the default.</small>
        </span>
      </label>
      <label class="m8-toggle-row">
        <input id="m8SpeedResponsiveCameraEnabled" type="checkbox">
        <span>
          <strong>Speed-responsive camera</strong>
          <small>Keeps the car close while the view widens as speed builds. Experimental; the current camera remains the default.</small>
        </span>
      </label>`;
    const steering = list.querySelector('.m8-steering-setting');
    if (steering) steering.after(section);
    else list.prepend(section);

    const driftCheckbox = section.querySelector('#m8DriftCameraEnabled');
    driftCheckbox.addEventListener('change', () => {
      const previous = globalThis.__turnDriftCameraEnabled === true;
      const next = driftCheckbox.checked;
      if (!saveDriftCameraEnabled(next)) {
        driftCheckbox.checked = previous;
        announce(dialog, 'Drift camera could not be changed because local storage is unavailable.');
        return;
      }
      globalThis.__turnDriftCameraEnabled = next;
      announce(dialog, `Drift camera ${next ? 'on' : 'off'}.`);
    });

    const speedCheckbox = section.querySelector('#m8SpeedResponsiveCameraEnabled');
    speedCheckbox.addEventListener('change', () => {
      const previous = globalThis.__turnSpeedResponsiveCameraEnabled === true;
      const next = speedCheckbox.checked;
      if (!saveSpeedResponsiveCameraEnabled(next)) {
        speedCheckbox.checked = previous;
        announce(dialog, 'Speed-responsive camera could not be changed because local storage is unavailable.');
        return;
      }
      globalThis.__turnSpeedResponsiveCameraEnabled = next;
      announce(dialog, `Speed-responsive camera ${next ? 'on' : 'off'}.`);
    });
  }

  const sync = () => {
    const driftCheckbox = section.querySelector('#m8DriftCameraEnabled');
    if (driftCheckbox) driftCheckbox.checked = globalThis.__turnDriftCameraEnabled === true;
    const speedCheckbox = section.querySelector('#m8SpeedResponsiveCameraEnabled');
    if (speedCheckbox) {
      speedCheckbox.checked = globalThis.__turnSpeedResponsiveCameraEnabled === true;
    }
  };
  sync();
  if (!dialog.dataset.turnDriftCameraSync) {
    dialog.dataset.turnDriftCameraSync = 'true';
    dialog.addEventListener('toggle', sync);
  }
  return true;
}

function announce(dialog, message) {
  const status = dialog.querySelector('.m8-settings-status');
  if (status) status.textContent = message;
}

function getStorage() {
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}
