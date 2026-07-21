import { loadVehicleSelection, makeGhostColor } from '../vehicle/catalog.js?build=20260720-r19';

const RESULT_TOAST_HANDOFF_MS = 4300;
const ONBOARDING_VISIBLE_MS = 2800;
const ONBOARDING_EXIT_MS = 180;

export function installRivalOnboarding() {
  if (globalThis.__turnRivalOnboardingInstalled) return;
  globalThis.__turnRivalOnboardingInstalled = true;

  const hud = document.querySelector('#hud');
  if (!hud) return;

  const plate = document.createElement('div');
  plate.className = 'rival-onboarding';
  plate.hidden = true;
  plate.setAttribute('role', 'status');
  plate.setAttribute('aria-live', 'polite');
  plate.setAttribute('aria-atomic', 'true');
  plate.textContent = 'CHASE YOUR BEST';
  hud.appendChild(plate);

  let hadRival = false;
  let showTimer = 0;
  let hideTimer = 0;
  let exitTimer = 0;

  function clearTimers() {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    window.clearTimeout(exitTimer);
    showTimer = 0;
    hideTimer = 0;
    exitTimer = 0;
  }

  function hide({ immediate = false } = {}) {
    clearTimers();
    if (plate.hidden) return;

    if (immediate) {
      plate.hidden = true;
      plate.classList.remove('is-visible', 'is-leaving');
      return;
    }

    plate.classList.remove('is-visible');
    plate.classList.add('is-leaving');
    exitTimer = window.setTimeout(() => {
      plate.hidden = true;
      plate.classList.remove('is-leaving');
      exitTimer = 0;
    }, ONBOARDING_EXIT_MS);
  }

  function reveal(color) {
    plate.style.setProperty('--rival-onboarding-color', makeGhostColor(color));
    plate.hidden = false;
    plate.classList.remove('is-visible', 'is-leaving');
    void plate.offsetWidth;
    plate.classList.add('is-visible');
    hideTimer = window.setTimeout(() => hide(), ONBOARDING_VISIBLE_MS);
  }

  function schedule() {
    clearTimers();
    plate.hidden = true;
    plate.classList.remove('is-visible', 'is-leaving');
    const color = loadVehicleSelection().color;
    showTimer = window.setTimeout(() => {
      showTimer = 0;
      reveal(color);
    }, RESULT_TOAST_HANDOFF_MS);
  }

  window.addEventListener('turn:rivals-reset', () => {
    hadRival = false;
    hide({ immediate: true });
  });

  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    const hasRival = Boolean(globalThis.__turnHasGhosts?.());

    if (reason === 'rivals-loaded' || reason === 'race-started') {
      hadRival = hasRival;
    } else if (reason === 'lap-completed') {
      if (!hadRival && hasRival) schedule();
      hadRival = hasRival;
    }

    if (!event.detail?.running || reason === 'race-reset') {
      hide({ immediate: true });
    }
  });
}
