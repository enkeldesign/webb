import {
  ACHIEVEMENTS,
  TRACK_IDS,
  TRAINING_CAR_ID
} from './catalog.js?revision=r241-learning-achievements';
import {
  createAchievementStore,
  normalizeAchievementState
} from './store.js?revision=r243-mountain-1300';
import {
  allOnboardingComplete,
  createAchievementView
} from './view.js?revision=r243-reward-modal';
import {
  completedNightShiftSheriff,
  createNightShiftAttempt,
  sampleNightShiftOvertakes
} from './night-shift.js?revision=r146-achievement-expansion';
import {
  TIME_TRIALS,
  TIME_TRIAL_MASTER_ID,
  completedAllTimeTrials,
  qualifyingTimeTrial
} from './time-trials.js?revision=r166-bella-records';
import {
  SCORING_MASTER_ACHIEVEMENT_ID,
  completedAllScoringAchievements,
  qualifyingScoringAchievement,
  storedScoringAchievementUnlockEntries
} from './scoring-achievements.js?revision=r3-trophy-balance';
import {
  DRIVE_BY_EAR_ACHIEVEMENT_ID,
  DRIVE_BY_EAR_PART_COMPLETED_EVENT,
  DRIVE_BY_EAR_PART_IDS,
  HOW_TO_PLAY_DISCLOSURE_IDS,
  HOW_TO_PLAY_DISCLOSURE_OPENED_EVENT,
  LEARNING_FEEDBACK_READY_EVENT,
  LEARN_TO_PLAY_ACHIEVEMENT_ID,
  completedLearningSet
} from './learning-progress.js?revision=r1-learning-achievements';
import { replayFrameAt } from '../race/replay-system.js?revision=r146-achievement-expansion';
import { getStoredBestLap } from '../race/rival-storage.js';

const SPECTATE_REQUIRED_MS = 5000;
const LISTEN_CLOSELY_REQUIRED_MS = 10000;
const LISTEN_CLOSELY_MIN_BALANCE = 0.75;
const LISTEN_CLOSELY_MIN_SPEED = 1;
const LAP_TOAST_DELAY_MS = 4400;
const REWARD_TOAST_OFFSET_MS = 3900;
const SAMPLE_INTERVAL_MS = 100;
const MAX_SAMPLE_DELTA_MS = 250;

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
  const trackId = state.trackId || globalThis.__turnGetTrackId?.() || '';
  const vehicleId = state.vehicleId || '';
  const rivals = Array.isArray(state.competitorLaps) ? [...state.competitorLaps] : [];

  return {
    trackId,
    vehicleId,
    rivalCountAtStart: rivals.length,
    recalibrated: recalibratedPending,
    blankFromStart: blank,
    blankThroughout: blank,
    flowEligible: zone !== 'gas' && zone !== 'brake' && !state.touchGas && !state.touchBrake,
    usedDrift: zone === 'drift' || globalThis.__turnDriftHeld === true,
    usedBoost: zone === 'boost' || globalThis.__turnBoostActive === true,
    driftChargeGained: 0,
    lastBoostCharge: Number(globalThis.__turnBoostCharge) || 0,
    nightShift: createNightShiftAttempt({ trackId, vehicleId, rivals })
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
    pendingToastRewards: [],
    toastTimer: 0,
    rewardToastTimer: 0,
    samplingTimer: 0,
    listenCloselyMs: 0,
    lastSampleAt: performance.now(),
    secondWind: {
      sawActiveBoost: false,
      sawEmpty: false,
      sawRecharge: false,
      previousBoostActive: false
    }
  };
  const view = createAchievementView({ store, session, utilityGroup });

  function announceAchievementUpdate(unlocked) {
    if (!unlocked.length) return;
    window.dispatchEvent(new CustomEvent('turn:achievements-updated', {
      detail: { unlocked: unlocked.map((achievement) => achievement.id) }
    }));
  }

  function announceRewardUpdate(rewards) {
    if (!rewards.length) return;
    window.dispatchEvent(new CustomEvent('turn:trophy-road-updated', {
      detail: {
        unlocked: rewards.map((reward) => reward.id),
        trophies: store.trophyTotal()
      }
    }));
  }

  function scheduleToastFlush(delay = 0) {
    window.clearTimeout(session.toastTimer);
    session.toastTimer = window.setTimeout(() => {
      session.toastTimer = 0;
      view.showToastBatch(session.pendingToastAchievements.splice(0));
    }, delay);
  }

  function scheduleRewardToastFlush(delay = 0) {
    window.clearTimeout(session.rewardToastTimer);
    session.rewardToastTimer = window.setTimeout(() => {
      session.rewardToastTimer = 0;
      view.showRewardToastBatch(session.pendingToastRewards.splice(0));
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

  function queueRewards(rewards, { delay = 0 } = {}) {
    for (const reward of rewards) {
      if (!reward || session.pendingToastRewards.some((item) => item.id === reward.id)) continue;
      session.pendingToastRewards.push(reward);
    }
    view.syncTriggers();
    view.render();
    if (delay >= 0) scheduleRewardToastFlush(delay);
  }

  function unlock(ids, context, options = {}) {
    let unlocked = [];
    let rewards = [];
    store.batch(() => {
      unlocked = ids
        .map((id) => store.unlock(id, context))
        .filter(Boolean);
      if (unlocked.length) rewards = store.syncRewards();
    });
    if (!unlocked.length) return [];

    announceAchievementUpdate(unlocked);
    queueUnlocked(unlocked, options);
    if (rewards.length) {
      announceRewardUpdate(rewards);
      const rewardDelay = options.delay >= 0
        ? options.delay + REWARD_TOAST_OFFSET_MS
        : -1;
      queueRewards(rewards, { delay: rewardDelay });
    }
    return unlocked;
  }

  function unlockSilently(entries) {
    let unlocked = [];
    let rewards = [];
    store.batch(() => {
      unlocked = entries
        .map(({ id, context }) => store.unlock(id, context))
        .filter(Boolean);
      if (unlocked.length) rewards = store.syncRewards();
    });
    if (!unlocked.length) return [];

    announceAchievementUpdate(unlocked);
    if (rewards.length) announceRewardUpdate(rewards);
    view.syncTriggers();
    view.render();
    return unlocked;
  }

  function importStoredTimeTrials() {
    const entries = [];
    const pendingIds = new Set();

    for (const trial of TIME_TRIALS) {
      const bestLap = getStoredBestLap(trial.trackId);
      const qualified = qualifyingTimeTrial(trial.trackId, bestLap?.time);
      if (!qualified) continue;
      pendingIds.add(qualified.id);
      entries.push({
        id: qualified.id,
        context: {
          trackId: trial.trackId,
          vehicleId: bestLap?.carId || '',
          time: Number(bestLap?.time)
        }
      });
    }

    const completesSet = completedAllTimeTrials(
      (id) => store.isUnlocked(id) || pendingIds.has(id)
    );
    if (completesSet) {
      entries.push({
        id: TIME_TRIAL_MASTER_ID,
        context: { trackId: '', vehicleId: '', time: null }
      });
    }

    unlockSilently(entries);
  }

  function importStoredScoringAchievements() {
    unlockSilently(storedScoringAchievementUnlockEntries(undefined, store.isUnlocked));
  }

  function importStoredLearningAchievements() {
    const entries = [];
    if (completedLearningSet(store.state.progress.driveByEarParts, DRIVE_BY_EAR_PART_IDS)) {
      entries.push({ id: DRIVE_BY_EAR_ACHIEVEMENT_ID, context: {} });
    }
    if (completedLearningSet(
      store.state.progress.howToPlayDisclosures,
      HOW_TO_PLAY_DISCLOSURE_IDS
    )) {
      entries.push({ id: LEARN_TO_PLAY_ACHIEVEMENT_ID, context: {} });
    }
    unlockSilently(entries);
  }

  function recordDriveByEarPart(partId) {
    if (!store.addDriveByEarPart(partId)) return false;
    if (completedLearningSet(store.state.progress.driveByEarParts, DRIVE_BY_EAR_PART_IDS)) {
      unlock([DRIVE_BY_EAR_ACHIEVEMENT_ID], {}, { delay: -1 });
    } else {
      view.render();
    }
    return true;
  }

  function recordHowToPlayDisclosure(disclosureId) {
    if (!store.addHowToPlayDisclosure(disclosureId)) return false;
    if (completedLearningSet(
      store.state.progress.howToPlayDisclosures,
      HOW_TO_PLAY_DISCLOSURE_IDS
    )) {
      unlock([LEARN_TO_PLAY_ACHIEVEMENT_ID], {}, { delay: -1 });
    } else {
      view.render();
    }
    return true;
  }

  function sampleListenClosely(state, elapsedMs) {
    if (store.isUnlocked('listen-closely')) return;
    const settings = globalThis.__turnAudioPreferences?.getSettings?.();
    const balance = Number(settings?.balance);
    const qualifies = state.lapActive === true
      && Number(state.speed) > LISTEN_CLOSELY_MIN_SPEED
      && currentBlankScreenState()
      && settings?.dbeEnabled !== false
      && Number.isFinite(balance)
      && balance >= LISTEN_CLOSELY_MIN_BALANCE
      && document.visibilityState !== 'hidden';

    if (!qualifies) {
      session.listenCloselyMs = 0;
      return;
    }

    session.listenCloselyMs += elapsedMs;
    if (session.listenCloselyMs >= LISTEN_CLOSELY_REQUIRED_MS) {
      unlock(['listen-closely'], unlockContext(runtime), { delay: -1 });
    }
  }

  function sampleDrivingState() {
    const now = performance.now();
    const elapsedMs = Math.min(MAX_SAMPLE_DELTA_MS, Math.max(0, now - session.lastSampleAt));
    session.lastSampleAt = now;

    const state = runtime.state;
    const charge = Math.max(0, Math.min(1, Number(globalThis.__turnBoostCharge) || 0));
    const boostActive = globalThis.__turnBoostActive === true;
    const driftHeld = globalThis.__turnDriftHeld === true;
    const zone = drivePad.dataset.driveZone || '';

    sampleListenClosely(state, elapsedMs);

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

      sampleNightShiftOvertakes(session.currentLap.nightShift, {
        playerProgress: state.progress,
        lapElapsed: state.lapElapsed,
        boostActive
      }, replayFrameAt);
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

  function startDrivingSampler() {
    if (session.samplingTimer || document.visibilityState === 'hidden') return;
    session.lastSampleAt = performance.now();
    session.samplingTimer = window.setInterval(sampleDrivingState, SAMPLE_INTERVAL_MS);
  }

  function stopDrivingSampler() {
    if (session.samplingTimer) window.clearInterval(session.samplingTimer);
    session.samplingTimer = 0;
    session.lastSampleAt = performance.now();
  }

  function syncDrivingSampler() {
    const state = runtime?.state;
    const active = state?.running === true || state?.lapActive === true;
    if (active && document.visibilityState !== 'hidden') startDrivingSampler();
    else stopDrivingSampler();
  }

  function beginLap() {
    session.currentLapVoid = false;
    session.currentLap = makeLapAttempt(runtime, drivePad, session.recalibratedPending);
    startDrivingSampler();
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
    if (attempt.blankFromStart && attempt.blankThroughout) {
      store.addBlankTrack(context.trackId);
      candidates.push('trust-your-ears');
      if (TRACK_IDS.every((trackId) => store.state.progress.blankTracks.includes(trackId))) {
        candidates.push('beyond-sight');
      }
    }
    if (completedNightShiftSheriff(attempt.nightShift, detail)) {
      candidates.push('night-shift-sheriff');
    }
    if (store.state.progress.tracks.length >= 2) candidates.push('new-ground');
    if (TRACK_IDS.every((trackId) => store.state.progress.tracks.includes(trackId))) {
      candidates.push('around-the-turn');
    }

    const timeTrial = detail?.ranked === false
      ? null
      : qualifyingTimeTrial(context.trackId, context.time);
    if (timeTrial) {
      candidates.push(timeTrial.id);
      if (completedAllTimeTrials((id) => store.isUnlocked(id), timeTrial.id)) {
        candidates.push(TIME_TRIAL_MASTER_ID);
      }
    }

    const scoringAchievements = ['drift', 'flow']
      .map((channel) => qualifyingScoringAchievement(
        channel,
        context.trackId,
        detail?.[channel]?.eligible === true ? detail[channel].score : null
      ))
      .filter(Boolean);
    candidates.push(...scoringAchievements.map((achievement) => achievement.id));
    if (completedAllScoringAchievements(
      (id) => store.isUnlocked(id),
      scoringAchievements.map((achievement) => achievement.id)
    )) {
      candidates.push(SCORING_MASTER_ACHIEVEMENT_ID);
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
    if (!view.raceTrigger.hidden && session.pendingToastRewards.length) {
      scheduleRewardToastFlush(
        session.pendingToastAchievements.length ? REWARD_TOAST_OFFSET_MS : 300
      );
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

  window.addEventListener(DRIVE_BY_EAR_PART_COMPLETED_EVENT, (event) => {
    recordDriveByEarPart(event.detail?.stageId);
  });

  window.addEventListener(HOW_TO_PLAY_DISCLOSURE_OPENED_EVENT, (event) => {
    recordHowToPlayDisclosure(event.detail?.disclosureId);
  });

  window.addEventListener(LEARNING_FEEDBACK_READY_EVENT, () => {
    const hasAchievementFeedback = session.pendingToastAchievements.length > 0;
    if (hasAchievementFeedback) scheduleToastFlush(0);
    if (session.pendingToastRewards.length > 0) {
      scheduleRewardToastFlush(hasAchievementFeedback ? REWARD_TOAST_OFFSET_MS : 0);
    }
  });

  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    if (reason === 'lap-started') beginLap();
    if (reason === 'race-reset') {
      if (session.currentLapVoid) {
        unlock(['take-it-from-the-top'], unlockContext(runtime), { delay: 300 });
      } else {
        if (session.pendingToastAchievements.length) scheduleToastFlush(300);
        if (session.pendingToastRewards.length) {
          scheduleRewardToastFlush(
            session.pendingToastAchievements.length ? REWARD_TOAST_OFFSET_MS : 300
          );
        }
      }
      session.currentLapVoid = false;
      session.currentLap = null;
      session.listenCloselyMs = 0;
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
      session.listenCloselyMs = 0;
    }
    syncDrivingSampler();
    syncRaceTriggerVisibility();
    view.render();
  });

  document.addEventListener('visibilitychange', syncDrivingSampler, { passive: true });

  const menuObserver = typeof MutationObserver === 'function'
    ? new MutationObserver(syncRaceTriggerVisibility)
    : null;
  menuObserver?.observe(utilityGroup, { attributes: true, attributeFilter: ['data-menu-state'] });

  importStoredTimeTrials();
  importStoredScoringAchievements();
  importStoredLearningAchievements();
  syncDrivingSampler();
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
    getTrophies: () => store.trophyTotal(),
    getState: () => normalizeAchievementState(store.state)
  });
  globalThis.__turnAchievements = api;
  window.dispatchEvent(new CustomEvent('turn:achievements-ready', { detail: api }));
  return api;
}
