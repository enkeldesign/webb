import {
  applyColorCuesState,
  describeColorCue,
  loadColorCuesEnabled,
  saveColorCuesEnabled,
  trackColorCue
} from './color-cues.js?revision=r163';
import {
  getVehicleDefaultColor
} from '../vehicle/catalog.js?build=20260804-r157-factory-colors';

const RUNTIME_ID = 'color-cues-r163';
let scheduled = false;
const lotCueBindings = new Map();

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

function selectedLotCarId(screen) {
  return screen.querySelector('.lot-car-option[aria-checked="true"]')?.dataset.carId || '';
}

function selectedLotBodyColor(screen, carId) {
  const bodyControl = [...screen.querySelectorAll('.lot-color-control')]
    .find((control) => String(control.dataset.paintLabel || '').toLowerCase() === 'body');
  const input = bodyControl?.querySelector('input[type="color"]');
  return input?.value || getVehicleDefaultColor(carId);
}

function bindLotColorCueUpdates(screen) {
  if (lotCueBindings.has(screen)) return;
  const picker = screen.querySelector('.lot-car-picker');
  const selectionObserver = new MutationObserver(scheduleSync);
  if (picker) {
    selectionObserver.observe(picker, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-checked']
    });
  }
  const handleInput = (event) => {
    if (event.target?.matches?.('input[type="color"]')) scheduleSync();
  };
  screen.addEventListener('input', handleInput);
  lotCueBindings.set(screen, { selectionObserver, handleInput });
}

function cleanupLotColorCueBindings() {
  for (const [screen, binding] of lotCueBindings) {
    if (screen.isConnected) continue;
    binding.selectionObserver.disconnect();
    screen.removeEventListener('input', binding.handleInput);
    lotCueBindings.delete(screen);
  }
}

function installLotCarColorCues() {
  for (const screen of document.querySelectorAll('.lot-screen')) {
    const description = screen.querySelector('.lot-car-description');
    const carId = selectedLotCarId(screen);
    if (!description || !carId) continue;

    let cue = screen.querySelector('.lot-selected-car-color-cue');
    if (!cue) {
      cue = document.createElement('span');
      cue.className = 'turn-color-cue lot-color-cue lot-selected-car-color-cue';
      description.after(cue);
    }

    const text = `CAR COLOR · ${describeColorCue(selectedLotBodyColor(screen, carId)).toUpperCase()}`;
    if (cue.textContent !== text) cue.textContent = text;
    bindLotColorCueUpdates(screen);
  }
}

function mutationTouchesColorCueUi(mutation) {
  const selector = [
    '.m8-home',
    '.m8-settings-dialog',
    '.track-card[data-track-id]',
    '.lot-screen',
    '.lot-color-control'
  ].join(',');
  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
    node?.nodeType === 1
      && (node.matches?.(selector) || node.querySelector?.(selector))
  ));
}

function sync() {
  scheduled = false;
  cleanupLotColorCueBindings();
  installColorCueSetting();
  installTrackColorCues();
  installLotCarColorCues();
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
      for (const [screen, binding] of lotCueBindings) {
        binding.selectionObserver.disconnect();
        screen.removeEventListener('input', binding.handleInput);
      }
      lotCueBindings.clear();
      globalThis.__turnColorAccessibility = null;
    }
  });
  globalThis.__turnColorAccessibility = api;
  document.documentElement.dataset.turnColorAccessibility = RUNTIME_ID;
  return api;
}

if (typeof document !== 'undefined' && document.body) installColorAccessibility();
