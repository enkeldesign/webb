import {
  graphicsProfile,
  loadLowGraphicsEnabled,
  saveLowGraphicsEnabled
} from '../graphics-profile.js';

let observer = null;

function settingsStatus(dialog) {
  return dialog?.querySelector?.('.m8-settings-status');
}

function installLowGraphicsSetting() {
  const dialog = document.querySelector('.m8-settings-dialog');
  const list = dialog?.querySelector('.m8-settings-list');
  if (!dialog || !list) return false;
  if (dialog.querySelector('[data-turn-low-graphics-setting]')) return true;

  const section = document.createElement('section');
  section.className = 'm8-setting-card m8-low-graphics-setting';
  section.dataset.turnLowGraphicsSetting = '';
  section.setAttribute('aria-labelledby', 'm8LowGraphicsTitle');
  section.innerHTML = `
    <h3 id="m8LowGraphicsTitle">Graphics</h3>
    <label class="m8-toggle-row">
      <input id="m8LowGraphics" type="checkbox" aria-describedby="m8LowGraphicsDescription m8LowGraphicsRestartNote">
      <span>
        <strong>LOW GRAPHICS</strong>
        <small id="m8LowGraphicsDescription">Better performance on older devices</small>
      </span>
    </label>
    <p id="m8LowGraphicsRestartNote">Uses lower resolution, no contours and cheaper lighting. Restart TURN to apply changes.</p>
    <button type="button" class="m8-low-graphics-restart" hidden>RESTART TURN TO APPLY</button>`;

  const visualSettings = list.querySelector('.m8-visual-settings');
  const records = list.querySelector('.m8-record-setting');
  if (visualSettings) visualSettings.append(section);
  else if (records) list.insertBefore(section, records);
  else list.append(section);

  const toggle = section.querySelector('#m8LowGraphics');
  const restart = section.querySelector('.m8-low-graphics-restart');

  const sync = () => {
    toggle.checked = loadLowGraphicsEnabled();
    restart.hidden = toggle.checked === graphicsProfile.lowGraphics;
  };

  toggle.addEventListener('change', () => {
    const requested = toggle.checked;
    if (!saveLowGraphicsEnabled(requested)) {
      toggle.checked = !requested;
      const status = settingsStatus(dialog);
      if (status) status.textContent = 'LOW GRAPHICS could not be changed because local storage is unavailable.';
      return;
    }
    sync();
    const status = settingsStatus(dialog);
    if (status) {
      status.textContent = restart.hidden
        ? 'LOW GRAPHICS unchanged. No restart needed.'
        : `LOW GRAPHICS ${requested ? 'on' : 'off'} after restart.`;
    }
  });

  restart.addEventListener('click', () => {
    restart.disabled = true;
    globalThis.location?.reload?.();
  });

  dialog.addEventListener('toggle', sync);
  sync();
  return true;
}

function scheduleInstall() {
  if (installLowGraphicsSetting()) {
    observer?.disconnect();
    observer = null;
    return;
  }
  if (observer || !document.documentElement) return;
  observer = new MutationObserver(() => {
    if (installLowGraphicsSetting()) {
      observer.disconnect();
      observer = null;
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

scheduleInstall();
