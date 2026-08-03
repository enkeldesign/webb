import { IN_GAME_MENU_STATE, inGameMenuVisibilityFor } from './in-game-menu-state.js';
import { driveByEarEnabled } from './drive-by-ear-setting.js';

const CONTROL_STATE = Object.freeze({
  IDLE: 'idle',
  ARMED: 'armed',
  ACTIVE: 'active'
});

const ICONS = Object.freeze({
  idle: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"></path>
      <circle cx="12" cy="12" r="2.5"></circle>
      <path d="M4 4l16 16"></path>
    </svg>`,
  armed: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5"></path>
    </svg>`,
  active: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"></path>
      <circle cx="12" cy="12" r="2.5"></circle>
    </svg>`
});

const LABELS = Object.freeze({
  idle: 'Blank screen for audio-only driving',
  armed: 'Confirm blank screen',
  active: 'Show screen'
});

function installStyles() {
  if (document.querySelector('#turnScreenBlankingStyles')) return;
  const style = document.createElement('style');
  style.id = 'turnScreenBlankingStyles';
  style.textContent = `
    .turn-screen-blank-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      background: #000;
      pointer-events: none;
    }

    .turn-screen-blank-overlay[hidden],
    .turn-screen-blank-control[hidden],
    .turn-screen-blank-toast[hidden] {
      display: none;
    }

    .turn-screen-blank-control {
      display: grid;
      flex: 0 0 50px;
      width: 50px;
      min-width: 50px;
      min-height: 50px;
      padding: 4px;
      place-items: center;
      align-self: stretch;
      border-radius: 12px;
      background: var(--paper, #fffdf6);
      color: #08090a;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .turn-screen-blank-control[data-state="active"] {
      position: fixed;
      left: var(--turn-screen-blank-left, 16px);
      top: var(--turn-screen-blank-top, auto);
      z-index: 2147483001;
      width: var(--turn-screen-blank-width, 50px);
      min-width: var(--turn-screen-blank-width, 50px);
      height: var(--turn-screen-blank-height, 50px);
      min-height: var(--turn-screen-blank-height, 50px);
      margin: 0;
      padding: var(--turn-screen-blank-padding, 4px);
      align-self: auto;
      border-width: var(--turn-screen-blank-border-width, 3px);
      border-radius: var(--turn-screen-blank-radius, 12px);
      background: #ff7b54;
      box-shadow: var(--turn-screen-blank-shadow, 5px 5px 0 #08090a);
    }

    .turn-screen-blank-control svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .turn-screen-blank-control[data-state="armed"] {
      background: #fffdf6;
    }

    .turn-screen-blank-control:focus-visible {
      outline: 4px solid #ffd43b;
      outline-offset: 4px;
    }

    .turn-screen-blank-toast {
      position: fixed;
      left: 50%;
      top: max(16px, calc(env(safe-area-inset-top) + 10px));
      z-index: 2147483002;
      width: min(620px, calc(100vw - 32px));
      padding: 10px 14px;
      border: 3px solid #08090a;
      border-radius: 14px;
      background: var(--paper, #fffdf6);
      color: #08090a;
      box-shadow: 5px 5px 0 #08090a;
      transform: translateX(-50%);
      text-align: center;
      font-size: clamp(0.72rem, 1.7vw, 0.92rem);
      line-height: 1.25;
      pointer-events: none;
    }

    @media (max-height: 430px) {
      .turn-screen-blank-control {
        flex-basis: 40px;
        width: 40px;
        min-width: 40px;
        min-height: 40px;
        padding: 3px;
      }

      .turn-screen-blank-toast {
        top: max(10px, calc(env(safe-area-inset-top) + 6px));
        width: min(700px, calc(100vw - 20px));
        padding: 7px 11px;
        font-size: 0.7rem;
      }
    }
  `;
  document.head.appendChild(style);
}

export function installScreenBlanking(runtime = globalThis.__turnRuntime) {
  if (!runtime || runtime.__screenBlankingInstalled) return null;

  const controls = document.querySelector('#controls');
  const utilityGroup = controls?.querySelector('.utility-group');
  if (!controls || !utilityGroup) return null;

  runtime.__screenBlankingInstalled = true;
  installStyles();

  const overlay = document.createElement('div');
  overlay.className = 'turn-screen-blank-overlay';
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'utility turn-screen-blank-control';
  button.hidden = true;

  const toast = document.createElement('p');
  toast.className = 'turn-screen-blank-toast';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');

  document.body.append(toast, overlay);

  let state = CONTROL_STATE.IDLE;
  let armedTimer = 0;
  let toastTimer = 0;
  let activationPromise = null;
  let temporarilyEnabledDriveByEar = false;

  function notify(message, duration = 3200) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
      toastTimer = 0;
    }, duration);
  }

  function captureButtonPlacement() {
    const rect = button.getBoundingClientRect();
    const computed = globalThis.getComputedStyle?.(button);
    button.style.setProperty('--turn-screen-blank-left', `${rect.left}px`);
    button.style.setProperty('--turn-screen-blank-top', `${rect.top}px`);
    button.style.setProperty('--turn-screen-blank-width', `${rect.width}px`);
    button.style.setProperty('--turn-screen-blank-height', `${rect.height}px`);
    if (computed) {
      button.style.setProperty('--turn-screen-blank-padding', computed.padding);
      button.style.setProperty('--turn-screen-blank-border-width', computed.borderWidth);
      button.style.setProperty('--turn-screen-blank-radius', computed.borderRadius);
      button.style.setProperty('--turn-screen-blank-shadow', computed.boxShadow);
    }
  }

  function placeButton() {
    if (state === CONTROL_STATE.ACTIVE) {
      // Escaping the controls stacking context keeps the restore button above the black overlay.
      document.body.prepend(button);
      return;
    }

    // The control is a real member of the race menu row and its first focusable item.
    utilityGroup.prepend(button);
  }

  function render() {
    button.dataset.state = state;
    placeButton();
    button.innerHTML = ICONS[state];
    button.setAttribute('aria-label', LABELS[state]);
    button.setAttribute('aria-pressed', state === CONTROL_STATE.ACTIVE ? 'true' : 'false');
    button.title = LABELS[state];
    overlay.hidden = state !== CONTROL_STATE.ACTIVE;
    document.documentElement.classList.toggle('turn-screen-blanked', state === CONTROL_STATE.ACTIVE);
  }

  function clearArmTimer() {
    window.clearTimeout(armedTimer);
    armedTimer = 0;
  }

  function restoreChosenDriveByEarSetting() {
    if (!temporarilyEnabledDriveByEar) return false;
    temporarilyEnabledDriveByEar = false;
    const chosenSetting = driveByEarEnabled();
    globalThis.__turnAudioPreferences?.setDriveByEarEnabled?.(chosenSetting);
    return true;
  }

  function setIdle({ announceChange = false, keepFocus = true } = {}) {
    const wasActive = state === CONTROL_STATE.ACTIVE;
    clearArmTimer();
    state = CONTROL_STATE.IDLE;
    render();
    syncVisibility();
    const restoredDriveByEar = wasActive && restoreChosenDriveByEarSetting();
    if (announceChange && wasActive) {
      notify(restoredDriveByEar
        ? 'Screen shown. Drive By Ear returned to your chosen setting.'
        : 'Screen shown.');
    }
    if (keepFocus && !button.hidden) button.focus({ preventScroll: true });
  }

  function arm() {
    clearArmTimer();
    state = CONTROL_STATE.ARMED;
    render();
    const chosenSetting = driveByEarEnabled();
    notify(chosenSetting
      ? 'Tap again to blank the screen. The race and controls will continue.'
      : 'Tap again to blank the screen. Drive By Ear will turn on temporarily and return to your chosen setting afterwards.', 5000);
    armedTimer = window.setTimeout(() => {
      if (state !== CONTROL_STATE.ARMED) return;
      state = CONTROL_STATE.IDLE;
      render();
    }, 5000);
  }

  async function enableDriveByEarForAudioOnly() {
    const preferences = globalThis.__turnAudioPreferences;
    if (!preferences?.setDriveByEarEnabled) return false;

    const chosenSetting = driveByEarEnabled();
    const ensureRuntime = globalThis.__turnEnsureDriveByEarRuntime;
    if (typeof ensureRuntime === 'function') {
      const ready = await ensureRuntime();
      if (!ready) return false;
    } else if (preferences.getSettings?.().dbeEnabled === false) {
      return false;
    }

    temporarilyEnabledDriveByEar = !chosenSetting;
    preferences.setDriveByEarEnabled(true);
    await globalThis.__turnAudio?.unlock?.();
    return true;
  }

  async function activate() {
    if (activationPromise) return activationPromise;
    clearArmTimer();
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    activationPromise = (async () => {
      const ready = await enableDriveByEarForAudioOnly();
      if (state !== CONTROL_STATE.ARMED) {
        restoreChosenDriveByEarSetting();
        return;
      }

      if (!ready) {
        state = CONTROL_STATE.IDLE;
        render();
        syncVisibility();
        notify('Audio-only driving could not start because Drive By Ear is unavailable.');
        return;
      }

      captureButtonPlacement();
      state = CONTROL_STATE.ACTIVE;
      render();
      syncVisibility();
      button.focus({ preventScroll: true });
      notify(temporarilyEnabledDriveByEar
        ? 'Drive By Ear is on for audio-only driving. Your chosen setting will return when the screen is shown.'
        : 'Screen blanked. Drive By Ear is on.');
    })().finally(() => {
      activationPromise = null;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    });

    return activationPromise;
  }

  function syncVisibility() {
    const visibility = inGameMenuVisibilityFor(runtime.state?.mode);
    const gameplayVisible = controls.hidden !== true;

    if ((!gameplayVisible || visibility.menuState === IN_GAME_MENU_STATE.HIDDEN) && state === CONTROL_STATE.ACTIVE) {
      setIdle({ announceChange: false, keepFocus: false });
      return;
    }

    if (visibility.menuState !== IN_GAME_MENU_STATE.STAGED && state === CONTROL_STATE.ARMED) {
      clearArmTimer();
      state = CONTROL_STATE.IDLE;
      render();
    }

    button.hidden = !gameplayVisible || (
      state !== CONTROL_STATE.ACTIVE && visibility.menuState !== IN_GAME_MENU_STATE.STAGED
    );
  }

  button.addEventListener('click', () => {
    if (state === CONTROL_STATE.ACTIVE) {
      setIdle({ announceChange: true });
      return;
    }
    if (state === CONTROL_STATE.ARMED) {
      void activate();
      return;
    }
    arm();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || state !== CONTROL_STATE.ACTIVE) return;
    event.preventDefault();
    setIdle({ announceChange: true });
  });

  window.addEventListener('turn:ui-state-change', syncVisibility);
  if (typeof MutationObserver === 'function') {
    new MutationObserver(syncVisibility).observe(controls, {
      attributes: true,
      attributeFilter: ['hidden']
    });
  }

  render();
  syncVisibility();
  return { button, overlay, toast };
}
