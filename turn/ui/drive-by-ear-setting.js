export const DRIVE_BY_EAR_STORAGE_KEY = 'turn-drive-by-ear-v1';

export function driveByEarEnabled(storage = getStorage()) {
  try {
    return storage?.getItem(DRIVE_BY_EAR_STORAGE_KEY) !== 'off';
  } catch (_) {
    return true;
  }
}

export function saveDriveByEarEnabled(enabled, storage = getStorage()) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(DRIVE_BY_EAR_STORAGE_KEY, enabled ? 'on' : 'off');
    return true;
  } catch (_) {
    return false;
  }
}

export function installDriveByEarSetting({ reload = reloadPage } = {}) {
  const enabled = driveByEarEnabled();
  globalThis.__turnDriveByEarEnabled = enabled;
  if (typeof document === 'undefined') return enabled;

  installStylesheet();
  const startCard = document.querySelector('#intro .start-card');
  if (!startCard || startCard.querySelector('.drive-by-ear-card')) return enabled;

  const card = document.createElement('section');
  card.className = 'drive-by-ear-card';
  card.dataset.enabled = String(enabled);
  card.setAttribute('aria-labelledby', 'driveByEarTitle');
  card.innerHTML = `
    <div class="drive-by-ear-copy">
      <h2 id="driveByEarTitle">DRIVE BY EAR<sup>™</sup></h2>
      <p>Spatial sound turns the track into something you can follow by ear: corner pace notes, road-edge feedback, recovery guidance, drift direction and nearby rivals.</p>
    </div>
    <label class="drive-by-ear-toggle" for="driveByEarToggle">
      <input id="driveByEarToggle" type="checkbox">
      <span>
        <strong>Use Drive By Ear</strong>
        <small id="driveByEarHint">On by default for every player. Turning it off removes DBE processing and may improve performance on older devices.</small>
      </span>
    </label>
    <p class="drive-by-ear-status" role="status" aria-live="polite"></p>`;

  const checkbox = card.querySelector('input');
  const status = card.querySelector('.drive-by-ear-status');
  checkbox.checked = enabled;
  checkbox.setAttribute('aria-describedby', 'driveByEarHint');
  checkbox.addEventListener('change', () => {
    const nextEnabled = checkbox.checked;
    if (!saveDriveByEarEnabled(nextEnabled)) {
      checkbox.checked = enabled;
      card.dataset.enabled = String(enabled);
      status.textContent = 'Drive By Ear could not be changed because this browser blocked local storage.';
      return;
    }

    globalThis.__turnDriveByEarEnabled = nextEnabled;
    card.dataset.enabled = String(nextEnabled);
    checkbox.disabled = true;
    status.textContent = `Drive By Ear ${nextEnabled ? 'enabled' : 'disabled'}. Reloading TURN.`;
    requestAnimationFrame(reload);
  });

  const tagline = startCard.querySelector('.tagline');
  if (tagline) tagline.after(card);
  else startCard.appendChild(card);
  return enabled;
}

function installStylesheet() {
  if (document.querySelector('link[data-turn-drive-by-ear]')) return;
  const href = new URL('../drive-by-ear-setting.css', import.meta.url);
  const buildKey = globalThis.__TURN_BUILD__?.cacheKey;
  if (buildKey) href.searchParams.set('build', buildKey);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href.href;
  link.dataset.turnDriveByEar = '';
  document.head.appendChild(link);
}

function getStorage() {
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

function reloadPage() {
  globalThis.location?.reload();
}
