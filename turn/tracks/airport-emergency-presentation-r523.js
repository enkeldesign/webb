import {
  AIRPORT_EMERGENCY_CONFIG,
  installAirportEmergency as installAirportEmergencyR497
} from './airport-emergency-r497.js?revision=r523-standard-toast-longer-guidance';

export { AIRPORT_EMERGENCY_CONFIG };

const ACHIEVEMENT_ID = 'golden-hour';
const MAYDAY_TOAST_CLASS = 'is-mayday-alert';
const MAYDAY_INFO_ID = 'turn-mayday-info-plate';
const HOLD_MS = Object.freeze({
  crash: 5200,
  pickup: 6500,
  retry: 5200,
  resolved: 3200
});

let presentationInstalled = false;
let holdUntil = 0;
let holdTimer = 0;
let plateObserver = null;

export function installAirportEmergency(options = {}) {
  const installation = installAirportEmergencyR497(options);
  installMaydayPresentationCorrections();
  return installation;
}

function installMaydayPresentationCorrections() {
  if (presentationInstalled) return;
  presentationInstalled = true;

  globalThis.addEventListener?.('turn:achievements-updated', normalizeMaydayAchievementToast);
  globalThis.addEventListener?.('turn:airport-emergency', extendMaydayGuidance);
}

function normalizeMaydayAchievementToast(event) {
  const unlocked = Array.isArray(event.detail?.unlocked) ? event.detail.unlocked : [];
  if (!unlocked.includes(ACHIEVEMENT_ID)) return;

  // r496 deliberately gave MAYDAY! a red, boost-adjacent treatment. MAYDAY! is an
  // achievement completion, not an emergency instruction, so remove that one-off class
  // and let the shared achievement toast styling/positioning handle it like every other
  // achievement. The extra microtask also covers DOM updates later in the same dispatch.
  stripMaydayToastClass();
  queueMicrotask(stripMaydayToastClass);
}

function stripMaydayToastClass() {
  document.querySelectorAll?.(`.turn-achievement-toast.${MAYDAY_TOAST_CLASS}`)
    ?.forEach?.((toast) => toast.classList.remove(MAYDAY_TOAST_CLASS));
}

function extendMaydayGuidance(event) {
  const reason = String(event.detail?.reason || '');
  const duration = HOLD_MS[reason];
  if (!duration) return;

  const plate = document.getElementById(MAYDAY_INFO_ID);
  if (!plate) return;

  holdUntil = performance.now() + duration;
  plate.hidden = false;
  ensurePlateObserver(plate);

  globalThis.clearTimeout(holdTimer);
  holdTimer = globalThis.setTimeout(() => {
    if (performance.now() + 1 < holdUntil) return;
    holdUntil = 0;
    plate.hidden = true;
    holdTimer = 0;
  }, duration);
}

function ensurePlateObserver(plate) {
  if (plateObserver || typeof MutationObserver !== 'function') return;

  plateObserver = new MutationObserver(() => {
    if (!plate.hidden || performance.now() >= holdUntil) return;

    // The legacy MAYDAY message timer still asks to hide after ~2–3 seconds. Reversing
    // that attribute change in the same microtask keeps the already-created status
    // region continuously available visually and to assistive technology for the longer
    // rescue-reading window, without introducing a second competing notification bar.
    plate.hidden = false;
  });
  plateObserver.observe(plate, { attributes: true, attributeFilter: ['hidden'] });
}
