import {
  applyColorCuesState,
  describeColorCue,
  loadColorCuesEnabled,
  saveColorCuesEnabled,
  trackColorCue
} from './color-cues.js?revision=r163';

const RUNTIME_ID = 'color-accessibility-r163-focus-bridge';
let paintControlSerial = 0;
let scheduled = false;

function settingsStatus(dialog) {
  return dialog.querySelector('.m8-settings-status');
}

function isIOSFamily() {
  const navigatorObject = globalThis.navigator;
  if (!navigatorObject) return false;
  const platform = String(navigatorObject.platform || '');
  const userAgent = String(navigatorObject.userAgent || '');
  return /iPhone|iPad|iPod/i.test(platform)
    || /iPhone|iPad|iPod/i.test(userAgent)
    || (platform === 'MacIntel' && Number(navigatorObject.maxTouchPoints || 0) > 1);
}

function focusNativeColorInput(input) {
  try {
    input.focus({ preventScroll: true });
  } catch (_) {
    input.focus();
  }
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
    cue.setAttribute('aria-hidden', 'true');
    cue.textContent = `TRACK COLOR · ${colorName.toUpperCase()}`;
    summary.append(cue);
  }
}

function paintLabel(control) {
  return control.dataset.paintLabel || control.querySelector('span')?.textContent?.trim() || 'Paint';
}

function enhancePaintControl(control) {
  if (control.dataset.turnColorAccessibility === RUNTIME_ID) return;
  const input = control.querySelector('input[type="color"]');
  if (!input) return;

  const labelText = paintLabel(control);
  const replacement = document.createElement('div');
  replacement.className = control.className;
  replacement.dataset.paintLabel = labelText;
  replacement.dataset.turnColorAccessibility = RUNTIME_ID;

  const serial = ++paintControlSerial;
  const inputId = input.id || `turnPaintColor${serial}`;
  const labelId = `turnPaintColorLabel${serial}`;
  input.id = inputId;
  input.classList.add('lot-color-native');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  const copy = document.createElement('span');
  copy.className = 'lot-color-copy';

  // Use ordinary text to name the accessible trigger. A <label> here would
  // activate the broken native AXPress path again on affected iOS versions.
  const label = document.createElement('span');
  label.className = 'lot-color-label';
  label.id = labelId;
  label.textContent = labelText.toUpperCase();

  const cue = document.createElement('span');
  cue.className = 'turn-color-cue lot-color-cue';
  cue.setAttribute('aria-hidden', 'true');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lot-color-trigger';
  trigger.setAttribute('aria-labelledby', labelId);
  trigger.setAttribute('aria-description', 'Opens the system color picker.');

  const sync = () => {
    const color = input.value || '#ffcc00';
    trigger.style.setProperty('--lot-color-value', color);
    cue.textContent = `COLOR · ${describeColorCue(color).toUpperCase()}`;
  };

  // WebKit bug 312177 / rdar 172218114 prevents VoiceOver AXPress from
  // activating input[type="color"] before Safari 27. iOS still opens native
  // form pickers when their input receives DOM focus, so the real button uses
  // focus() on iPhone/iPad. Other platforms keep the normal click() route.
  // The native input remains the source of truth and the picker keeps the
  // platform's own semantic color names, including custom colors.
  trigger.addEventListener('click', () => {
    if (isIOSFamily()) {
      focusNativeColorInput(input);
      return;
    }
    input.click();
  });
  input.addEventListener('input', () => requestAnimationFrame(sync));
  input.addEventListener('change', sync);

  copy.append(label, cue);
  replacement.append(copy, input, trigger);
  control.replaceWith(replacement);
  sync();
}

function installAccessiblePaintControls() {
  for (const control of document.querySelectorAll('.lot-color-control:not(.lot-fixed-livery)')) {
    enhancePaintControl(control);
  }
}

function sync() {
  scheduled = false;
  installColorCueSetting();
  installTrackColorCues();
  installAccessiblePaintControls();
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(sync);
}

export function installColorAccessibility() {
  if (globalThis.__turnColorAccessibility) return globalThis.__turnColorAccessibility;
  applyColorCuesState();

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true });
  globalThis.addEventListener('turn:home-ready', scheduleSync);
  globalThis.addEventListener('turn:color-cues-changed', scheduleSync);
  sync();

  const api = Object.freeze({
    id: RUNTIME_ID,
    sync,
    disconnect() {
      observer.disconnect();
      globalThis.removeEventListener('turn:home-ready', scheduleSync);
      globalThis.removeEventListener('turn:color-cues-changed', scheduleSync);
      globalThis.__turnColorAccessibility = null;
    }
  });
  globalThis.__turnColorAccessibility = api;
  document.documentElement.dataset.turnColorAccessibility = RUNTIME_ID;
  return api;
}

if (typeof document !== 'undefined' && document.body) installColorAccessibility();
