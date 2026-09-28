import {
  applyColorCuesState,
  loadColorCuesEnabled,
  saveColorCuesEnabled
} from './color-cues.js?revision=r163';

const RUNTIME_ID = 'color-cues-r163';
let scheduled = false;

function settingsStatus(dialog) {
  return dialog.querySelector('.m8-settings-status');
}

function installColorCueSetting() {
  const dialog = document.querySelector('.m8-settings-dialog');
  const list = dialog?.querySelector('.m8-settings-list');
  if (!dialog || !list || dialog.querySelector('[data-turn-color-cues-setting]')) return;

  const section = document.createElement('div');
  section.className = 'm8-interface-group m8-color-cues-setting';
  section.dataset.turnColorCuesSetting = '';
  section.innerHTML = `
    <label class="m8-toggle-row">
      <input id="m8ColorCuesEnabled" type="checkbox">
      <span>
        <strong>Color cues</strong>
        <small>Add text and pattern cues wherever TURN uses color to communicate.</small>
      </span>
    </label>`;

  const interfaceSlot = list.querySelector('[data-turn-color-cues-slot]');
  const visualSettings = list.querySelector('.m8-visual-settings');
  const records = list.querySelector('.m8-record-setting');
  if (interfaceSlot) interfaceSlot.append(section);
  else if (visualSettings) {
    section.classList.add('m8-setting-card');
    visualSettings.append(section);
  } else if (records) {
    section.classList.add('m8-setting-card');
    list.insertBefore(section, records);
  } else {
    section.classList.add('m8-setting-card');
    list.append(section);
  }

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

function mutationTouchesColorCueUi(mutation) {
  const selector = [
    '.m8-home',
    '.m8-settings-dialog'
  ].join(',');
  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
    node?.nodeType === 1
      && (node.matches?.(selector) || node.querySelector?.(selector))
  ));
}

function sync() {
  scheduled = false;
  installColorCueSetting();
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(sync);
}

export function installColorAccessibility() {
  if (globalThis.__turnColorAccessibility) return globalThis.__turnColorAccessibility;
  applyColorCuesState();

  const observer = new MutationObserver((mutations) => {
    if (mutations.some(mutationTouchesColorCueUi)) scheduleSync();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  globalThis.addEventListener('turn:home-ready', scheduleSync);
  sync();

  const api = Object.freeze({
    id: RUNTIME_ID,
    sync,
    disconnect() {
      observer.disconnect();
      globalThis.removeEventListener('turn:home-ready', scheduleSync);
      globalThis.__turnColorAccessibility = null;
    }
  });
  globalThis.__turnColorAccessibility = api;
  document.documentElement.dataset.turnColorAccessibility = RUNTIME_ID;
  return api;
}

if (typeof document !== 'undefined' && document.body) installColorAccessibility();
