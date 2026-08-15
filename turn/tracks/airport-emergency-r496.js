import {
  AIRPORT_EMERGENCY_CONFIG,
  installAirportEmergency as installAirportEmergencyR494
} from './airport-emergency-r494.js?revision=r496-hud';

export { AIRPORT_EMERGENCY_CONFIG };

const STYLE_ID = 'turn-mayday-r496-style';
const TOAST_CLASS = 'is-mayday-alert';
let resetTimer = 0;
let listenerInstalled = false;

export function installAirportEmergency(options = {}) {
  const installation = installAirportEmergencyR494(options);
  installHudStyle();
  installAchievementToastHook();
  return installation;
}

function installHudStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .turn-mayday-info-plate,
    .turn-achievement-toast.${TOAST_CLASS} {
      top: auto !important;
      bottom: calc(clamp(92px, 20vh, 150px) + 38px);
      background: var(--turn-action-danger, #ff6b6b) !important;
      color: var(--turn-ink, #08090a);
    }
    .turn-achievement-toast.${TOAST_CLASS} {
      transform: translate(-50%, 130%);
    }
    .turn-achievement-toast.${TOAST_CLASS}.is-visible {
      transform: translate(-50%, 0);
    }
    @media (max-height: 430px) {
      .turn-mayday-info-plate,
      .turn-achievement-toast.${TOAST_CLASS} {
        top: auto !important;
        bottom: 106px;
      }
    }
  `;
  document.head.appendChild(style);
}

function installAchievementToastHook() {
  if (listenerInstalled) return;
  listenerInstalled = true;
  globalThis.addEventListener?.('turn:achievements-updated', (event) => {
    const unlocked = Array.isArray(event.detail?.unlocked) ? event.detail.unlocked : [];
    if (!unlocked.includes('golden-hour')) return;
    const toast = document.querySelector('.turn-achievement-toast:not(.turn-trophy-reward-toast)');
    if (!toast) return;
    toast.classList.add(TOAST_CLASS);
    globalThis.clearTimeout(resetTimer);
    resetTimer = globalThis.setTimeout(() => {
      toast.classList.remove(TOAST_CLASS);
      resetTimer = 0;
    }, 5200);
  });
}
