import {
  AIRPORT_EMERGENCY_CONFIG,
  installAirportEmergency as installAirportEmergencyR494
} from './airport-emergency-r494.js?revision=r496-hud-depth';

export { AIRPORT_EMERGENCY_CONFIG };

const STYLE_ID = 'turn-mayday-r496-style';
const TOAST_CLASS = 'is-mayday-alert';
const AMBULANCE_ID = 'ambulance';
const PREPARED_WRECK_NAME = 'Airport B787 Prepared Wreck';
const R494_PENETRATION_Y = 4.40;
// The wreck is 62 world units long and pitched 20 degrees. Half of its nose-to-tail
// vertical swing is about 62 * sin(20deg) / 2 = 10.6 units. The latest playtest still
// reads as airborne at 4.40, while r492 was visibly too deep. 10.5 puts the fuselage
// intersection near the intended halfway-buried pose without returning to r492's extreme.
const TARGET_WRECK_PENETRATION_Y = 10.5;
const EXTRA_WRECK_PENETRATION_Y = TARGET_WRECK_PENETRATION_Y - R494_PENETRATION_Y;
const WRECK_FIND_INTERVAL_MS = 120;
const WRECK_FIND_ATTEMPTS = 160;
let resetTimer = 0;
let listenerInstalled = false;

export function installAirportEmergency(options = {}) {
  const runtime = options.runtime || globalThis.__turnRuntime;
  const installation = installAirportEmergencyR494(options);
  installHudStyle();
  installAchievementToastHook();
  installWreckCalibration(options.world, runtime);
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

function installWreckCalibration(world, runtime) {
  if (!world || world.userData.turnMaydayR496WreckCalibration) return;

  let timer = 0;
  let attempts = 0;
  let applied = false;

  const tryApply = () => {
    timer = 0;
    if (applied) return;

    const wreck = world.getObjectByName(PREPARED_WRECK_NAME);
    const mount = wreck?.parent;
    if (
      wreck
      && mount
      && mount.userData.turnMaydayR494DepthApplied
      && !mount.userData.turnMaydayR496DepthApplied
    ) {
      mount.position.y -= EXTRA_WRECK_PENETRATION_Y;
      mount.userData.turnMaydayR496DepthApplied = true;
      world.updateMatrixWorld(true);
      applied = true;
      return;
    }

    attempts += 1;
    if (
      attempts < WRECK_FIND_ATTEMPTS
      && String(runtime?.state?.vehicleId || '').toLowerCase() === AMBULANCE_ID
    ) {
      timer = globalThis.setTimeout(tryApply, WRECK_FIND_INTERVAL_MS);
    }
  };

  const arm = () => {
    if (applied || timer) return;
    if (String(runtime?.state?.vehicleId || '').toLowerCase() !== AMBULANCE_ID) return;
    attempts = 0;
    timer = globalThis.setTimeout(tryApply, 0);
  };

  globalThis.addEventListener?.('turn:ui-state-change', arm);
  globalThis.addEventListener?.('turn:track-changed', arm);
  arm();

  world.userData.turnMaydayR496WreckCalibration = Object.freeze({
    basePenetration: R494_PENETRATION_Y,
    targetPenetration: TARGET_WRECK_PENETRATION_Y,
    additionalPenetration: EXTRA_WRECK_PENETRATION_Y,
    basis: 'half of the 62-unit B787 nose-to-tail vertical swing at 20 degrees, calibrated against the r492 and r495 playtests'
  });
}
