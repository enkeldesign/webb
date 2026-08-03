import {
  ACHIEVEMENTS,
  TRACK_IDS,
  TRAINING_CAR_ID
} from './catalog.js?revision=r144-achievements';
import {
  createAchievementStore,
  normalizeAchievementState
} from './store.js?revision=r144-achievements';
import {
  allOnboardingComplete,
  createAchievementView
} from './view.js?revision=r144-achievements';

const SPECTATE_REQUIRED_MS = 5000;
const LAP_TOAST_DELAY_MS = 4400;
const SAMPLE_INTERVAL_MS = 100;

function validCompletedLap(detail) {
  const time = Number(detail?.time);
  return Number.isFinite(time) && time > 5;
}

function currentBlankScreenState() {
  return document.documentElement.classList.contains('turn-screen-blanked');
}

function unlockContext(runtime, detail = {}) {
  return {
    trackId: runtime?.state?.trackId || globalThis.__turnGetTrackId?.() || '',
    vehicleId: runtime?.state?.vehicleId || '',
    time: Number.isFinite(Number(detail.time)) ? Number(detail.time) : null
  };
}

function makeLapAttempt(runtime, drivePad, recalibratedPending) {
  const zone = drivePad.dataset.driveZone || '';
  const blank = currentBlankScreenState();
  const state = runtime.state;
  return {
    trackId: state.trackId || globalThis.__turnGetTrackId?.() || '',
    vehicleId: state.vehicleId || '',
    rivalCountAtStart: Array.isArray(state.competitorLaps) ? state.competitorLaps.length : 0,
    recalibrated: recalibratedPending,
    blankFromStart: blank,
    blankThroughout: blank,
    flowEligible: zone !== 'gas' && zone !== 'brake' && !state.touchGas && !state.touchBrake,
    usedDrift: zone === 'drift' || globalThis.__turnDriftHeld === true,
    usedBoost: zone === 'boost' || globalThis.__turnBoostActive === true,
    driftChargeGained: 0,
    lastBoostCharge: Number(globalThis.__turnBoostCharge) || 0
  };
}

export function installAchievements(runtime = globalThis.__turnRuntime) {
  if (!runtime || globalThis.__turnAchievements) return globalThis.__turnAchievements || null;

  const utilityGroup = document.querySelector('.utility-group');
  const drivePad = document.querySelector('.drive-pad');
  const calibrateButton = document.querySelector('#calibrateButton');
  if (!utilityGroup || !drivePad || !calibrateButton) {
    throw new Error('TURN achievements could not find the complete race interface.');
  }

  const store = createAchievementStore();
  const session = {
    currentLap: null,
    currentLapVoid: false,
    recalibratedPending: false,
    spectateStartedAt: 0,
    pendingTrackEntryPulse: false,
    pendingToastAchievements: [],
    toastTimer: 0,
    secondWind: {
      sawActiveBoost: false,
      sawEmpty: false,
      sawRecharge: false,
      previousBoostActive: false
    }
  };
  const view = createAchievementView({ store, session, utilityGroup });

  function scheduleToastFlush(delay = 0) {
    window.clearTimeout(session.toastTimer);
    session.toastTimer = window.setTimeout(() => {
      session.toastTimer = 0;
      view.showToastBatch(session.pendingToastAchievements.splice(0));
    }, delay);
  }

  function queueUnlocked(achievements, { delay = 0 } = {}) {
    for (const achievement of achievements) {
      if (!achievement || session.pendingToastAchievements.some((item) => item.id === achievement.id)) continue;
      session.pendingToastAchievements.push(achievement);
    }
    view.syncTriggers();
    view.render();
    if (delay >= 0) scheduleToastFlush(delay);
  }

  function unlock(ids, context, options = {}) {
    const unlocked = ids
      .map((id) => store.unlock(id, context))
      .filter(Boolean);
    if (!unlocked.length) return [];
    window.dispatchEvent(new CustomEvent('turn:achievements-updated', {
      detail: { unlocked: unlocked.map((achievement) => achievement.id) }
    }));
    queueUnlocked(unlocked, options);
    return unlocked;
  }

  function sampleDrivingState() {
    const state = runtime.state;
    const charge = Math.max(0, Math.min(1, Number(globalThis.__turnBoostCharge) || 0));
    const boostActive = globalThis.__turnBoostActive === true;
    const driftHeld = globalThis.__turnDriftHeld === true;
    const zone = drivePad.dataset.driveZone || '';

    if (state.lapInvalid === true) {
      session.currentLapVoid = true;
      session.currentLap = null;
    }

    if (session.currentLap) {
      if (zone === 'gas' || zone === 'brake' || state.touchGas || state.touchBrake) {
        session.currentLap.flowEligible = false;
      }
      if (zone === 'drift' || driftHeld) session.currentLap.usedDrift = true;
      if (zone === 'boost' || boostActive) session.currentLap.usedBoost = true;
      if (!currentBlankScreenState()) session.currentLap.blankThroughout = false;

      const delta = charge - session.currentLap.lastBoostCharge;
      if (driftHeld && delta > 0) {
        session.currentLap.driftChargeGained += delta;
        if (session.currentLap.driftChargeGained >= 0.25) {
          unlock(['charge-through-it'], unlockContext(runtime), { delay: -1 });
        }
      }
      session.currentLap.lastBoostCharge = charge;
    }

    const secondWind = session.secondWind;
    if (boostActive) secondWind.sawActiveBoost = true;
    if (secondWind.sawActiveBoost && charge <= 0.001) secondWind.sawEmpty = true;
    if (secondWind.sawEmpty && charge >= 0.2) secondWind.sawRecharge = true;
    if (secondWind.sawRecharge && boostActive && !secondWind.previousBoostActive) {
      unlock(['second-wind'], unlockContext(runtime), { delay: -1 });
      secondWind.sawActiveBoost = false;
      secondWind.sawEmpty = false;
      secondWind.sawRecharge = false;
    }
    secondWind.previousBoostActive = boostActive;
  }

  function beginLap() {
    session.currentLapVoid = false;
    session.currentLap = makeLapAttempt(runtime, drivePad, session.recalibratedPending);
    sampleDrivingState();
    view.render();
  }

  function completeValidLap(detail) {
    const attempt = session.currentLap || makeLapAttempt(runtime, drivePad, session.recalibratedPending);
    const context = unlockContext(runtime, detail);
    store.addTrack(context.trackId);

    const candidates = ['first-turn'];
    if (attempt.recalibrated) candidates.push('level-head');
    if (attempt.vehicleId && attempt.vehicleId !== TRAINING_CAR_ID) candidates.push('new-wheels');
    if (attempt.rivalCountAtStart > 0) candidates.push('your-own-rival');
    if (Number(detail?.position) === 1 && Number(detail?.total) > 1 && attempt.rivalCountAtStart > 0) {
      candidates.push('ahead-of-yourself');
    }
    if (attempt.flowEligible && attempt.usedDrift && attempt.usedBoost) candidates.push('flow-state');
    if (attempt.blankFromStart && attempt.blankThroughout) candidates.push('trust-your-ears');
    if (store.state.progress.tracks.length >= 2) candidates.push('new-ground');
    if (TRACK_IDS.every((trackId) => store.state.progress.tracks.includes(trackId))) {
      candidates.push('around-the-turn');
    }

    unlock(candidates, context, { delay: LAP_TOAST_DELAY_MS });
    session.currentLap = null;
    session.currentLapVoid = false;
    session.recalibratedPending = false;
  }

  function syncRaceTriggerVisibility() {
    view.raceTrigger.hidden = utilityGroup.dataset.menuState !== 'staged';
    if (!view.raceTrigger.hidden && session.pendingTrackEntryPulse && !allOnboardingComplete(store)) {
      session.pendingTrackEntryPulse = false;
      view.pulseRaceTrigger();
    }
    if (!view.raceTrigger.hidden && session.pendingToastAchievements.length) {
      scheduleToastFlush(300);
    }
  }

  calibrateButton.addEventListener('click', () => {
    session.recalibratedPending = true;
  });

  const blankObserver = typeof MutationObserver === 'function'
    ? new MutationObserver(() => {
        if (session.currentLap && !currentBlankScreenState()) session.currentLap.blankThroughout = false;
      })
    : null;
  blankObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('turn:lap-invalid', () => {
    session.currentLapVoid = true;
    session.currentLap = null;
  });

  window.addEventListener('turn:lap-result', (event) => {
    if (validCompletedLap(event.detail)) completeValidLap(event.detail);
  });

  window.addEventListener('turn:track-changed', () => {
    session.pendingTrackEntryPulse = true;
  });

  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    if (reason === 'lap-started') beginLap();
    if (reason === 'race-reset') {
      if (session.currentLapVoid) {
        unlock(['take-it-from-the-top'], unlockContext(runtime), { delay: 300 });
      } else if (session.pendingToastAchievements.length) {
        scheduleToastFlush(300);
      }
      session.currentLapVoid = false;
      session.currentLap = null;
    }
    if (reason === 'spectate-started') session.spectateStartedAt = performance.now();
    if (reason === 'spectate-stopped') {
      const watchedMs = session.spectateStartedAt
        ? performance.now() - session.spectateStartedAt
        : 0;
      session.spectateStartedAt = 0;
      if (watchedMs >= SPECTATE_REQUIRED_MS) {
        unlock(['watch-and-learn'], unlockContext(runtime), { delay: 250 });
      }
    }
    if (Object.prototype.hasOwnProperty.call(event.detail || {}, 'running') && event.detail.running === false) {
      session.currentLap = null;
      session.currentLapVoid = false;
      session.spectateStartedAt = 0;
    }
    syncRaceTriggerVisibility();
    view.render();
  });

  const menuObserver = typeof MutationObserver === 'function'
    ? new MutationObserver(syncRaceTriggerVisibility)
    : null;
  menuObserver?.observe(utilityGroup, { attributes: true, attributeFilter: ['data-menu-state'] });

  window.setInterval(sampleDrivingState, SAMPLE_INTERVAL_MS);
  syncRaceTriggerVisibility();

  const api = Object.freeze({
    catalog: ACHIEVEMENTS,
    store,
    homeTrigger: view.homeTrigger,
    raceTrigger: view.raceTrigger,
    dialog: view.dialog,
    toast: view.toast,
    open: view.open,
    close: view.close,
    unlock: (id, context = {}) => unlock([id], context, { delay: 0 }),
    getState: () => normalizeAchievementState(store.state)
  });
  globalThis.__turnAchievements = api;
  return api;
}
