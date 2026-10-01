// Admin SWOOSH SOUND picker (#909, #928): choose the pace-note sound while driving. When
// switched on in SETTINGS → Admin, a small box sits where the on-screen steering pad goes:
// the sound's number and name, ‹ and › to step through the choices (each step plays the
// new sound once), and a caption of the swoosh just played, such as GENTLE LONG LEFT.
// Admin-unlocked profiles only; the choice changes only that profile's pace notes.
// Choice 00 is the race sound every player hears.
const ADMIN_UNLOCK_MARKER = 'turn-admin-unlock-v1';
const PICKER_SETTING_KEY = 'turn-swoosh-picker-v1';
const UPDATE_INTERVAL_MS = 100;
// A caption stays this long after its swoosh ends.
const CAPTION_HOLD_SECONDS = 1.6;

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch (_) {
    return null;
  }
}

function isAdminProfile() {
  try {
    return Boolean(storage()?.getItem(ADMIN_UNLOCK_MARKER));
  } catch (_) {
    return false;
  }
}

function loadEnabled() {
  try {
    return storage()?.getItem(PICKER_SETTING_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function saveEnabled(enabled) {
  try {
    if (enabled) storage()?.setItem(PICKER_SETTING_KEY, '1');
    else storage()?.removeItem(PICKER_SETTING_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

/** A swoosh as words: GENTLE LONG LEFT. */
export function swooshCaption(entry) {
  if (!entry) return '';
  return `${String(entry.tightness || '').toUpperCase()} ${entry.long ? 'LONG' : 'SHORT'} ${entry.side === 'right' ? 'RIGHT' : 'LEFT'}`;
}

/** The latest swoosh heard by now, while its caption still holds. */
export function currentCaptionEntry(history, audioTime) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if ((entry.status !== 'fired' && entry.status !== 'late') || !Number.isFinite(entry.at)) continue;
    if (entry.at > audioTime) continue;
    return audioTime <= entry.endsAt + CAPTION_HOLD_SECONDS ? entry : null;
  }
  return null;
}

function installStyles() {
  if (document.querySelector('#turnSwooshPickerStyles')) return;
  const style = document.createElement('style');
  style.id = 'turnSwooshPickerStyles';
  // The steering pad's place: bottom left, or bottom right for left-handed controls.
  style.textContent = `
    .turn-swoosh-picker {
      position: fixed;
      left: max(16px, env(safe-area-inset-left));
      bottom: max(51px, calc(env(safe-area-inset-bottom) + 42px));
      z-index: 2147483002;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 44px;
      align-items: center;
      gap: 6px;
      width: min(240px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 8px;
      border: 3px solid #08090a;
      border-radius: 16px;
      background: #fff8e8;
      color: #08090a;
      font: 800 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      text-align: center;
    }
    :root.turn-left-handed-controls .turn-swoosh-picker {
      left: auto;
      right: max(16px, env(safe-area-inset-right));
    }
    .turn-swoosh-picker[hidden] { display: none; }
    .turn-swoosh-picker button {
      width: 44px;
      height: 44px;
      border: 3px solid #08090a;
      border-radius: 12px;
      background: #ffd43b;
      color: #08090a;
      font: 900 20px/1 system-ui, sans-serif;
      touch-action: manipulation;
    }
    .turn-swoosh-picker-sound { font-size: 13px; }
    .turn-swoosh-picker-caption {
      grid-column: 1 / -1;
      min-height: 1.2em;
      font-size: 13px;
    }`;
  document.head.append(style);
}

function installPicker() {
  installStyles();
  const box = document.createElement('div');
  box.className = 'turn-swoosh-picker';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Pace-note sound');
  box.hidden = true;
  box.innerHTML = `
    <button type="button" data-swoosh-previous aria-label="Previous sound">‹</button>
    <span class="turn-swoosh-picker-sound" aria-live="polite"></span>
    <button type="button" data-swoosh-next aria-label="Next sound">›</button>
    <span class="turn-swoosh-picker-caption" aria-hidden="true"></span>`;
  document.body.append(box);
  const sound = box.querySelector('.turn-swoosh-picker-sound');
  const caption = box.querySelector('.turn-swoosh-picker-caption');
  let shownIndex = -1;

  const pace = () => globalThis.__turnSwooshPaceNotes || null;
  const showSound = () => {
    const api = pace();
    if (!api) {
      sound.textContent = 'SOUND · waiting';
      return;
    }
    const index = api.soundIndex;
    if (index === shownIndex) return;
    shownIndex = index;
    sound.textContent = `SOUND ${String(index).padStart(2, '0')} · ${api.soundChoices[index].name}`;
  };
  const step = (delta) => {
    const api = pace();
    if (!api) return;
    api.setSoundIndex(api.soundIndex + delta);
    showSound();
    // Hear it at once: a medium short swoosh, alternating sides.
    api.preview({ side: delta < 0 ? -1 : 1, tightness: 'medium', long: false });
  };
  // Pointer presses on the box must never reach the race controls underneath.
  for (const type of ['pointerdown', 'pointerup', 'touchstart']) {
    box.addEventListener(type, (event) => event.stopPropagation());
  }
  box.querySelector('[data-swoosh-previous]').addEventListener('click', () => step(-1));
  box.querySelector('[data-swoosh-next]').addEventListener('click', () => step(1));

  let timer = null;
  const sync = () => {
    const runtime = globalThis.__turnRuntime;
    const racing = runtime?.state?.running === true && document.documentElement.classList.contains('turn-home-open') === false;
    box.hidden = !(loadEnabled() && racing);
    if (box.hidden) return;
    showSound();
    const api = pace();
    caption.textContent = api ? swooshCaption(currentCaptionEntry(api.history, api.audioTime)) : '';
  };
  const start = () => {
    if (timer || !loadEnabled()) return;
    timer = setInterval(sync, UPDATE_INTERVAL_MS);
    sync();
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    box.hidden = true;
  };
  return { start, stop };
}

function installSetting(picker) {
  const card = document.querySelector('[data-turn-route-test-hud-setting]');
  if (!card) return false;
  if (card.querySelector('[data-turn-swoosh-picker-setting]')) return true;
  const row = document.createElement('label');
  row.className = 'm8-toggle-row';
  row.dataset.turnSwooshPickerSetting = '';
  row.innerHTML = `
    <input id="m8SwooshPicker" type="checkbox" aria-describedby="m8SwooshPickerDescription">
    <span>
      <strong>SWOOSH SOUND PICKER</strong>
      <small id="m8SwooshPickerDescription">While racing, choose the pace-note sound in a box where the steering pad goes</small>
    </span>`;
  card.append(row);
  const toggle = row.querySelector('input');
  toggle.checked = loadEnabled();
  toggle.addEventListener('change', () => {
    if (!saveEnabled(toggle.checked)) {
      toggle.checked = !toggle.checked;
      return;
    }
    if (toggle.checked) picker.start();
    else picker.stop();
  });
  card.closest('dialog')?.addEventListener('toggle', () => {
    toggle.checked = loadEnabled();
  });
  return true;
}

function install() {
  if (!isAdminProfile() || !document.body) return;
  const picker = installPicker();
  picker.start();
  if (installSetting(picker)) return;
  const observer = new MutationObserver(() => {
    if (installSetting(picker)) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
