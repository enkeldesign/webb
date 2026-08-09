import {
  applyColorCuesState,
  describeColorCue,
  loadColorCuesEnabled,
  saveColorCuesEnabled,
  trackColorCue
} from './color-cues.js?revision=r163';

const RUNTIME_ID = 'color-cues-r163-native-input';
let scheduled = false;

function settingsStatus(dialog) {
  return dialog.querySelector('.m8-settings-status');
}

function installColorCueSetting() {
  const dialog = document.querySelector('.m8-settings-dialog');
  const list = dialog?.querySelector('.m8-settings-list');
  if (!dialog || !list || dialog.querySelector('[data-turn-color-cues-setting]')) return;

  const section = document.createElement('section');
  section.className = 'm8-setting-card m8-color-cues-setting';
  section.dataset.turnColorCuesSetting = '';
  section.setAttribute('aria-labelledby', 'm8ColorCuesTitle');
  section.innerHTML = `
    <h3 id="m8ColorCuesTitle">Accessibility</h3>
    <label class="m8-toggle-row">
      <input id="m8ColorCuesEnabled" type="checkbox">
      <span>
        <strong>Color cues</strong>
        <small>Add text and pattern cues wherever TURN uses color to communicate.</small>
      </span>
    </label>`;

  const records = list.querySelector('.m8-record-setting');
  if (records) list.insertBefore(section, records);
  else list.append(section);

  const toggle = section.querySelector('#m8ColorCuesEnabled');
  const sync = () => {
    toggle.checked = loadColorCuesEnabled();
    applyColorCuesState(toggle.checked);
  };

  toggle.addEventListener('change', () => {
    const requested = toggle.checked;
    if (!saveColorCuesEnabled(requested)) {
      toggle.checked = !requested;
      settingsStatus(dialog).textContent = 'Color cues could not be changed because local storage is unavailable.';
      return;
    }
    settingsStatus(dialog).textContent = `Color cues ${requested ? 'on' : 'off'}.`;
  });
  dialog.addEventListener('toggle', sync);
  sync();
}

function installTrackColorCues() {
  for (const card of document.querySelectorAll('.m8-home .track-card[data-track-id]')) {
    if (card.querySelector('.track-card-color-cue')) continue;
    const colorName = trackColorCue(card.dataset.trackId);
    const summary = card.querySelector('.track-card-summary');
    if (!colorName || !summary) continue;

    const cue = document.createElement('span');
    cue.className = 'turn-color-cue track-card-color-cue';
    cue.textContent = `TRACK COLOR · ${colorName.toUpperCase()}`;
    summary.append(cue);
  }
}

function syncNativePaintControl(control) {
  const input = control?.querySelector('input[type="color"]');
  if (!input) return;

  // The visible swatch and the interactive control are the same native input.
  // Earlier r163 device-tested bridges added a second button to work around an
  // iOS VoiceOver/WebKit activation defect, but neither synthetic label clicks
  // nor focus forwarding opened the picker reliably. Do not replace the native
  // control with another swatch: expose it directly and let the platform own it.
  control.querySelector('.lot-color-trigger')?.remove();
  input.removeAttribute('aria-hidden');
  input.removeAttribute('tabindex');
  input.classList.remove('lot-color-native');

  const label = control.dataset.paintLabel || control.querySelector('.lot-color-label')?.textContent?.trim() || 'Paint';
  const colorName = describeColorCue(input.value);
  const cuesEnabled = document.documentElement.dataset.turnColorCues === 'on';
  input.setAttribute('aria-label', cuesEnabled
    ? `${label} colour. ${colorName}.`
    : `${label} colour.`);
}

function installNativePaintInputs() {
  for (const control of document.querySelectorAll('.lot-color-control:not(.lot-fixed-livery)')) {
    syncNativePaintControl(control);
  }
}

function sync() {
  scheduled = false;
  installColorCueSetting();
  installTrackColorCues();
  installNativePaintInputs();
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(sync);
}

function onPaintValueChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'color') return;
  const control = input.closest('.lot-color-control');
  if (control) syncNativePaintControl(control);
}

export function installColorAccessibility() {
  if (globalThis.__turnColorAccessibility) return globalThis.__turnColorAccessibility;
  applyColorCuesState();

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true });
  globalThis.addEventListener('turn:home-ready', scheduleSync);
  globalThis.addEventListener('turn:color-cues-changed', scheduleSync);
  document.addEventListener('input', onPaintValueChange, true);
  document.addEventListener('change', onPaintValueChange, true);
  sync();

  const api = Object.freeze({
    id: RUNTIME_ID,
    sync,
    disconnect() {
      observer.disconnect();
      globalThis.removeEventListener('turn:home-ready', scheduleSync);
      globalThis.removeEventListener('turn:color-cues-changed', scheduleSync);
      document.removeEventListener('input', onPaintValueChange, true);
      document.removeEventListener('change', onPaintValueChange, true);
      globalThis.__turnColorAccessibility = null;
    }
  });
  globalThis.__turnColorAccessibility = api;
  document.documentElement.dataset.turnColorAccessibility = RUNTIME_ID;
  return api;
}

if (typeof document !== 'undefined' && document.body) installColorAccessibility();