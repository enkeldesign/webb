import {
  SCORE_FEEDBACK_CHANNEL,
  SCORE_FEEDBACK_EVENT
} from './score-feedback.js';
import {
  FLOW_CHAIN_WINDOW_MS,
  createFlowScorer
} from './flow.js';
import {
  getBestFlowRecord,
  saveBestFlowRecord
} from './flow-records.js';

export const FLOW_FEATURE_ID = 'flow';
export const FLOW_HUD_STORAGE_KEY = 'turn-flow-hud-v1';
export const FLOW_SHIFT_WINDOW_MS = 1800;

const POSITIVE_ACCEL_STATS = new Set(['speed', 'acceleration']);
const POSITIVE_BOOST_STATS = new Set(['boostPower', 'boostDuration']);
const DRIFT_SUPPORT_STATS = new Set(['drift', 'control', 'boostDuration']);
const BOOST_PERFORMANCE_STATS = new Set(['speed', 'acceleration', 'boostPower', 'boostDuration']);
const BOOST_TRADEOFF_STATS = new Set(['boostPower', 'boostDuration']);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

function nowFrom(event) {
  return finiteNumber(event?.detail?.at, globalThis.performance?.now?.() || 0);
}

function hasGain(shift, keys) {
  return shift?.gainKeys?.some((key) => keys.has(key)) === true;
}

function hasLoss(shift, keys) {
  return shift?.lossKeys?.some((key) => keys.has(key)) === true;
}

function driftShiftPoints(shift) {
  let points = 28;
  if (shift?.gainKeys?.includes('drift')) points += 14;
  if (shift?.gainKeys?.includes('control')) points += 10;
  if (shift?.gainKeys?.includes('boostDuration')) points += 8;
  if (shift?.boostCharge <= 0.05 && hasLoss(shift, BOOST_TRADEOFF_STATS)) points += 18;
  return clamp(points, 28, 78);
}

function dispatchSemanticEvent(eventTarget, type, detail) {
  if (typeof eventTarget?.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  eventTarget.dispatchEvent(new globalThis.CustomEvent(type, { detail }));
}

export function flowHudVisible(storage) {
  try {
    return getStorage(storage)?.getItem?.(FLOW_HUD_STORAGE_KEY) !== 'off';
  } catch (_) {
    return true;
  }
}

export function saveFlowHudVisible(visible, storage) {
  const target = getStorage(storage);
  if (!target || typeof target.setItem !== 'function') return false;
  try {
    target.setItem(FLOW_HUD_STORAGE_KEY, visible === false ? 'off' : 'on');
    return true;
  } catch (_) {
    return false;
  }
}

export function createFlowRuntime({
  state,
  scoreFeedback,
  storage,
  eventTarget = globalThis,
  isUnlocked = () => true,
  wallClock = () => Date.now(),
  setTimer = (callback, delay) => globalThis.setTimeout?.(callback, delay) || 0,
  clearTimer = (timer) => globalThis.clearTimeout?.(timer)
} = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('TURN FLOW requires race state.');
  if (!scoreFeedback || typeof scoreFeedback.updateState !== 'function') {
    throw new TypeError('TURN FLOW requires ScoreFeedback.');
  }

  const targetStorage = getStorage(storage);
  let enabled = isUnlocked() === true;
  let hudVisible = flowHudVisible(targetStorage);
  let pendingShift = null;
  let driftContext = null;
  let boostShiftContext = null;
  let latestLockRequested = false;
  let lastDriftBankAt = -Infinity;
  let chainTimer = 0;
  let lastMilestoneTier = 1;

  function publishState(snapshot, now) {
    if (!enabled || !hudVisible) return;
    scoreFeedback.updateState(SCORE_FEEDBACK_CHANNEL.FLOW, snapshot, now);
  }

  function publishTechnique(detail, now) {
    dispatchSemanticEvent(eventTarget, 'turn:flow-score-event', {
      channel: SCORE_FEEDBACK_CHANNEL.FLOW,
      type: SCORE_FEEDBACK_EVENT.TECHNIQUE,
      ...detail
    });
    const tier = Math.floor(finiteNumber(detail?.multiplier, 1));
    if (!hudVisible || tier <= lastMilestoneTier || tier < 2) return;
    lastMilestoneTier = tier;
    scoreFeedback.publishEvent(SCORE_FEEDBACK_CHANNEL.FLOW, SCORE_FEEDBACK_EVENT.MILESTONE, {
      score: detail.score,
      multiplier: detail.multiplier,
      label: `FLOW ×${detail.multiplier}`,
      announcement: `Flow times ${detail.multiplier}.`
    }, now);
  }

  const scorer = createFlowScorer({
    onState: publishState,
    onTechnique: publishTechnique
  });

  function clearChainTimer() {
    if (chainTimer) clearTimer(chainTimer);
    chainTimer = 0;
  }

  function scheduleChainExpiry(now) {
    clearChainTimer();
    chainTimer = setTimer(() => {
      chainTimer = 0;
      const expiresAt = scorer.inspect().lastTechniqueAt + FLOW_CHAIN_WINDOW_MS;
      if (scorer.expireChain(expiresAt)) {
        lastMilestoneTier = 1;
        dispatchSemanticEvent(eventTarget, 'turn:flow-score-event', {
          channel: SCORE_FEEDBACK_CHANNEL.FLOW,
          type: 'chain-expired',
          score: scorer.inspect().lapScore
        });
      }
    }, Math.max(0, scorer.inspect().lastTechniqueAt + FLOW_CHAIN_WINDOW_MS - now));
  }

  function accept(technique, token, basePoints, now, detail = {}) {
    const result = scorer.acceptTechnique({ technique, token, basePoints, now, detail });
    if (result) scheduleChainExpiry(now);
    return result;
  }

  function validPendingShift(now) {
    if (!pendingShift || now - pendingShift.at > FLOW_SHIFT_WINDOW_MS) {
      pendingShift = null;
      return null;
    }
    return pendingShift;
  }

  function rewardPendingShift(now, outcome, basePoints) {
    const shift = validPendingShift(now);
    if (!shift) return null;
    pendingShift = null;
    return rewardShift(shift, now, outcome, basePoints);
  }

  function rewardShift(shift, now, outcome, basePoints) {
    return accept('shift', 'SHIFT', basePoints * shift.amount, now, {
      outcome,
      active: shift.active,
      gainKeys: shift.gainKeys,
      lossKeys: shift.lossKeys,
      boostCharge: shift.boostCharge,
      overcharge: shift.overcharge
    });
  }

  function onShiftChange(event) {
    if (!enabled || state.lapActive !== true || event.detail?.intentional !== true) return;
    const now = nowFrom(event);
    const gainKeys = Array.isArray(event.detail?.gainKeys)
      ? event.detail.gainKeys.filter((key) => typeof key === 'string')
      : [];
    const lossKeys = Array.isArray(event.detail?.lossKeys)
      ? event.detail.lossKeys.filter((key) => typeof key === 'string')
      : [];
    boostShiftContext = null;
    pendingShift = {
      at: now,
      active: event.detail?.active === true,
      amount: Number(event.detail?.amount) === 2 ? 2 : 1,
      gainKeys,
      lossKeys,
      zone: String(event.detail?.zone || ''),
      boostCharge: clamp(finiteNumber(event.detail?.boostCharge, 1), 0, 1),
      overcharge: clamp(finiteNumber(event.detail?.overcharge), 0, 1),
      boosting: event.detail?.boosting === true,
      fromDrift: Boolean(driftContext?.active) || now - lastDriftBankAt <= FLOW_SHIFT_WINDOW_MS
    };
    if (driftContext?.active && hasGain(pendingShift, DRIFT_SUPPORT_STATS)) {
      driftContext.contextualShift = pendingShift;
      pendingShift = null;
    } else if ((pendingShift.boosting || pendingShift.zone === 'boost')
      && hasGain(pendingShift, BOOST_PERFORMANCE_STATS)) {
      boostShiftContext = pendingShift;
      pendingShift = null;
    }
  }

  function onShiftOutcome(event) {
    if (!enabled || event.detail?.useful !== true) return;
    const now = nowFrom(event);
    const shift = validPendingShift(now);
    if (!shift || !hasGain(shift, POSITIVE_ACCEL_STATS)) return;
    const speedGain = Math.max(0, finiteNumber(event.detail?.speedGain));
    rewardPendingShift(now, shift.fromDrift ? 'drift-exit-acceleration' : 'acceleration', 30 + speedGain * 8 + (shift.fromDrift ? 24 : 0));
  }

  function onDriveTechniqueState(event) {
    if (!enabled || state.lapActive !== true) return;
    if (typeof event.detail?.lockRequested === 'boolean') {
      latestLockRequested = event.detail.lockRequested;
    }
    if (driftContext?.active && latestLockRequested) driftContext.usedLock = true;
    if (event.detail?.zone !== 'boost') return;
    const now = nowFrom(event);
    const shift = validPendingShift(now);
    if (!shift || !hasGain(shift, BOOST_PERFORMANCE_STATS)) return;
    boostShiftContext = shift;
    pendingShift = null;
  }

  function onDriftScoreEvent(event) {
    if (!enabled || state.lapActive !== true) return;
    const detail = event.detail || {};
    const now = nowFrom(event);
    if (detail.type === SCORE_FEEDBACK_EVENT.BUILD) {
      const shift = validPendingShift(now);
      const contextualShift = hasGain(shift, DRIFT_SUPPORT_STATS) ? shift : null;
      // The short causal window only decides whether SHIFT initiated the
      // drift. Once proven, retain that context until BANK/LOSS so a long,
      // successful drift is not penalized for lasting beyond the window.
      if (contextualShift) pendingShift = null;
      driftContext = {
        active: true,
        usedLock: latestLockRequested,
        contextualShift
      };
      return;
    }

    if (detail.type === SCORE_FEEDBACK_EVENT.LOSS) {
      driftContext = null;
      pendingShift = null;
      clearChainTimer();
      scorer.breakChain(now, 'failure');
      lastMilestoneTier = 1;
      return;
    }

    if (detail.type !== SCORE_FEEDBACK_EVENT.BANK) return;
    const bankScore = Math.max(0, finiteNumber(detail.score));
    const duration = Math.max(0, finiteNumber(detail.duration));
    if (driftContext?.contextualShift) {
      const shift = driftContext.contextualShift;
      rewardShift(shift, now, 'drift-context', driftShiftPoints(shift));
    }
    if (driftContext?.usedLock) {
      accept('lock', 'LOCK', clamp(26 + duration * 10, 26, 72), now, { outcome: 'drift-control' });
    }
    accept('drift', 'DRIFT', clamp(24 + Math.sqrt(bankScore) * 4 + duration * 10, 30, 360), now, {
      driftScore: Math.round(bankScore),
      duration
    });
    if ((detail.reason === 'exit' || detail.reason === 'linked-transition') && duration >= 0.7) {
      accept('clean-exit', 'EXIT', clamp(18 + duration * 8, 20, 56), now, { outcome: 'controlled-transition' });
    }
    lastDriftBankAt = now;
    driftContext = null;
  }

  function onBoostOutcome(event) {
    if (!enabled || state.lapActive !== true) return;
    const capturedShift = boostShiftContext;
    boostShiftContext = null;
    if (event.detail?.useful !== true) return;
    const detail = event.detail || {};
    const now = nowFrom(event);
    if (capturedShift) {
      rewardShift(
        capturedShift,
        now,
        capturedShift.fromDrift && capturedShift.overcharge > 0
          ? 'drift-exit-overcharge-boost'
          : capturedShift.fromDrift
            ? 'drift-exit-boost'
          : capturedShift.overcharge > 0
            ? 'overcharge-boost'
            : 'boost',
        38 + (capturedShift.fromDrift ? 24 : 0) + (capturedShift.overcharge > 0 ? 18 : 0)
      );
    } else {
      const shift = validPendingShift(now);
      if (shift && (hasGain(shift, POSITIVE_BOOST_STATS) || hasGain(shift, POSITIVE_ACCEL_STATS))) {
        rewardPendingShift(now, shift.fromDrift ? 'drift-exit-boost' : 'boost', 38 + (shift.fromDrift ? 24 : 0));
      }
    }
    accept('boost', 'BOOST', clamp(
      28 + Math.max(0, finiteNumber(detail.speedGain)) * 10
        + Math.max(0, finiteNumber(detail.duration)) * 9
        + Math.max(0, finiteNumber(detail.overchargeSpent)) * 45,
      30,
      220
    ), now, {
      speedGain: Math.max(0, finiteNumber(detail.speedGain)),
      duration: Math.max(0, finiteNumber(detail.duration))
    });
  }

  function onOverchargeCatch(event) {
    if (!enabled || state.lapActive !== true) return;
    const now = nowFrom(event);
    const amount = clamp(finiteNumber(event.detail?.amount), 0, 1);
    const shift = validPendingShift(now);
    if (shift?.overcharge > 0 && hasGain(shift, BOOST_PERFORMANCE_STATS)) {
      rewardPendingShift(now, 'overcharge-carry', 42 + shift.overcharge * 45);
    }
    accept('overcharge-catch', 'CATCH', 40 + amount * 80, now, { amount });
  }

  function syncPresentation(now = 0) {
    if (enabled && hudVisible) {
      scoreFeedback.updateState(SCORE_FEEDBACK_CHANNEL.FLOW, scorer.feedbackState, now);
    }
    scoreFeedback.setChannelVisible(SCORE_FEEDBACK_CHANNEL.FLOW, enabled && hudVisible, now);
  }

  function reset(now = 0) {
    clearChainTimer();
    pendingShift = null;
    driftContext = null;
    boostShiftContext = null;
    latestLockRequested = false;
    lastDriftBankAt = -Infinity;
    lastMilestoneTier = 1;
    scorer.reset(now);
    scoreFeedback.clearChannel(SCORE_FEEDBACK_CHANNEL.FLOW, now);
  }

  function beginLap(now = 0) {
    if (!enabled) return false;
    clearChainTimer();
    pendingShift = null;
    driftContext = null;
    boostShiftContext = null;
    lastDriftBankAt = -Infinity;
    lastMilestoneTier = 1;
    scorer.beginLap(now);
    return true;
  }

  function completeLap({
    now = 0,
    time,
    valid = false,
    ranked = true,
    trackId = state.trackId,
    carId = state.vehicleId
  } = {}) {
    if (!enabled) return Object.freeze({ available: false });
    clearChainTimer();
    const scoreResult = scorer.completeLap(now);
    const eligible = valid === true && ranked !== false;
    const previousBest = getBestFlowRecord(trackId, targetStorage);
    const saved = eligible
      ? saveBestFlowRecord({
        trackId,
        score: scoreResult.score,
        carId,
        lapTime: time,
        hitAt: wallClock()
      }, targetStorage)
      : { record: previousBest, isNewBest: false, saved: false };
    const result = Object.freeze({
      available: true,
      score: scoreResult.score,
      bestScore: saved.record?.score || previousBest?.score || 0,
      newBest: saved.isNewBest === true,
      saved: saved.saved === true,
      eligible,
      maxMultiplier: scoreResult.maxMultiplier,
      maxChain: scoreResult.maxChain,
      techniqueCount: scoreResult.techniqueCount,
      carId: String(carId || ''),
      lapTime: Number(time) || 0
    });
    if (hudVisible && result.newBest && result.score > 0) {
      scoreFeedback.publishEvent(SCORE_FEEDBACK_CHANNEL.FLOW, SCORE_FEEDBACK_EVENT.PERSONAL_BEST, {
        score: result.score,
        multiplier: result.maxMultiplier,
        label: 'NEW FLOW BEST',
        announce: false
      }, now);
    }
    dispatchSemanticEvent(eventTarget, 'turn:flow-lap-result', result);
    return result;
  }

  function setHudVisible(visible, { persist = true, now = 0 } = {}) {
    const next = visible !== false;
    const persisted = !persist || saveFlowHudVisible(next, targetStorage);
    hudVisible = next;
    syncPresentation(now);
    dispatchSemanticEvent(eventTarget, 'turn:flow-hud-visibility-change', {
      visible: hudVisible,
      enabled,
      persisted
    });
    return persisted;
  }

  function refreshEntitlement(now = 0) {
    const nextEnabled = isUnlocked() === true;
    if (nextEnabled === enabled) {
      syncPresentation(now);
      return enabled;
    }
    enabled = nextEnabled;
    reset(now);
    syncPresentation(now);
    dispatchSemanticEvent(eventTarget, 'turn:flow-availability-change', { enabled });
    return enabled;
  }

  function handleUiState(event) {
    const reason = event?.detail?.reason;
    if (reason === 'race-started' || reason === 'race-reset' || reason === 'track-changed' || reason === 'home-open') {
      reset(globalThis.performance?.now?.() || 0);
    }
  }

  eventTarget?.addEventListener?.('turn:shift-change', onShiftChange);
  eventTarget?.addEventListener?.('turn:shift-outcome', onShiftOutcome);
  eventTarget?.addEventListener?.('turn:drive-technique-state', onDriveTechniqueState);
  eventTarget?.addEventListener?.('turn:drift-score-event', onDriftScoreEvent);
  eventTarget?.addEventListener?.('turn:boost-outcome', onBoostOutcome);
  eventTarget?.addEventListener?.('turn:overcharge-catch', onOverchargeCatch);
  eventTarget?.addEventListener?.('turn:trophy-road-updated', () => refreshEntitlement(
    globalThis.performance?.now?.() || 0
  ));
  eventTarget?.addEventListener?.('turn:ui-state-change', handleUiState);
  syncPresentation(0);

  return Object.freeze({
    scorer,
    beginLap,
    completeLap,
    reset,
    refreshEntitlement,
    setHudVisible,
    isEnabled: () => enabled,
    isHudVisible: () => hudVisible,
    getBestRecord: (trackId = state.trackId) => getBestFlowRecord(trackId, targetStorage)
  });
}
