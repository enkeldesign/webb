import { IN_GAME_MENU_STATE, inGameMenuVisibilityFor } from './in-game-menu-state.js';

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
    .turn-screen-blank-control[hidden] {
      display: none;
    }

    .turn-screen-blank-control {
      position: fixed;
      left: max(16px, calc(env(safe-area-inset-left) + 10px));
      bottom: max(14px, calc(env(safe-area-inset-bottom) + 10px));
      z-index: 2147483001;
      display: grid;
      width: 54px;
      height: 54px;
      padding: 10px;
      place-items: center;
      border: 4px solid #08090a;
      border-radius: 50%;
      background: var(--paper, #fffdf6);
      color: #08090a;
      box-shadow: 5px 6px 0 rgba(8, 9, 10, 0.86);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .turn-screen-blank-control svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
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

    .turn-screen-blank-status {
      position: fixed;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-height: 430px) {
      .turn-screen-blank-control {
        left: max(12px, calc(env(safe-area-inset-left) + 8px));
        bottom: max(10px, calc(env(safe-area-inset-bottom) + 8px));
        width: 48px;
        height: 48px;
        padding: 9px;
        border-width: 3px;
        box-shadow: 4px 5px 0 rgba(8, 9, 10, 0.86);
      }
    }
  `;
  document.head.appendChild(style);
}

export function installScreenBlanking(runtime = globalThis.__turnRuntime) {
  if (!runtime || runtime.__screenBlankingInstalled) return null;
  runtime.__screenBlankingInstalled = true;
  installStyles();

  const controls = document.querySelector('#controls');
  const overlay = document.createElement('div');
  overlay.className = 'turn-screen-blank-overlay';
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'turn-screen-blank-control';
  button.hidden = true;

  const status = document.createElement('p');
  status.className = 'turn-screen-blank-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  // The restore control is deliberately the first focusable element in DOM order.
  // This avoids a positive tabindex while still making it the first Tab stop.
  document.body.prepend(button);
  button.after(status);
  document.body.appendChild(overlay);

  let state = CONTROL_STATE.IDLE;
  let armedTimer = 0;

  function announce(message) {
    status.textContent = '';
    requestAnimationFrame(() => {
      status.textContent = message;
    });
  }

  function render() {
    button.dataset.state = state;
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

  function setIdle({ announceChange = false, keepFocus = true } = {}) {
    const wasActive = state === CONTROL_STATE.ACTIVE;
    clearArmTimer();
    state = CONTROL_STATE.IDLE;
    render();
    syncVisibility();
    if (announceChange && wasActive) announce('Screen shown.');
    if (keepFocus && !button.hidden) button.focus({ preventScroll: true });
  }

  function arm() {
    clearArmTimer();
    state = CONTROL_STATE.ARMED;
    render();
    announce('Tap again to blank the screen. The race and controls will continue.');
    armedTimer = window.setTimeout(() => {
      if (state !== CONTROL_STATE.ARMED) return;
      state = CONTROL_STATE.IDLE;
      render();
    }, 5000);
  }

  function activate() {
    clearArmTimer();
    state = CONTROL_STATE.ACTIVE;
    render();
    syncVisibility();
    button.focus({ preventScroll: true });
    announce('Screen blanked. Show screen button focused.');
  }

  function syncVisibility() {
    const visibility = inGameMenuVisibilityFor(runtime.state?.mode);
    const gameplayVisible = controls?.hidden !== true;

    if ((!gameplayVisible || visibility.menuState === IN_GAME_MENU_STATE.HIDDEN) && state === CONTROL_STATE.ACTIVE) {
      clearArmTimer();
      state = CONTROL_STATE.IDLE;
      render();
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
      activate();
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
  if (controls && typeof MutationObserver === 'function') {
    new MutationObserver(syncVisibility).observe(controls, {
      attributes: true,
      attributeFilter: ['hidden']
    });
  }

  render();
  syncVisibility();
  return { button, overlay };
}
