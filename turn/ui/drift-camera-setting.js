export const DRIFT_CAMERA_STORAGE_KEY = 'turn-drift-camera-v1';

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

export function installDriftCameraSetting() {
  const enabled = driftCameraEnabled();
  globalThis.__turnDriftCameraEnabled = enabled;
  if (typeof document === 'undefined') return enabled;
  if (installed) {
    attachSettingsControl();
    return enabled;
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
  return enabled;
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
      </label>`;
    const steering = list.querySelector('.m8-steering-setting');
    if (steering) steering.after(section);
    else list.prepend(section);

    const checkbox = section.querySelector('#m8DriftCameraEnabled');
    checkbox.addEventListener('change', () => {
      const previous = globalThis.__turnDriftCameraEnabled === true;
      const next = checkbox.checked;
      if (!saveDriftCameraEnabled(next)) {
        checkbox.checked = previous;
        announce(dialog, 'Drift camera could not be changed because local storage is unavailable.');
        return;
      }
      globalThis.__turnDriftCameraEnabled = next;
      announce(dialog, `Drift camera ${next ? 'on' : 'off'}.`);
    });
  }

  const sync = () => {
    const checkbox = section.querySelector('#m8DriftCameraEnabled');
    if (checkbox) checkbox.checked = globalThis.__turnDriftCameraEnabled === true;
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
