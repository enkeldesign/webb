import {
  SCORE_FEEDBACK_CHANNEL,
  SCORE_FEEDBACK_EVENT
} from './score-feedback.js';
import { createDriftAttackScorer } from './drift-attack.js';
import {
  getBestDriftRecord,
  saveBestDriftRecord
} from './drift-records.js';

export const DRIFT_ATTACK_FEATURE_ID = 'drift-attack';
export const DRIFT_HUD_STORAGE_KEY = 'turn-drift-hud-v1';

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

export function driftHudVisible(storage) {
  try {
    return getStorage(storage)?.getItem?.(DRIFT_HUD_STORAGE_KEY) !== 'off';
  } catch (_) {
    return true;
  }
}

export function saveDriftHudVisible(visible, storage) {
  const target = getStorage(storage);
  if (!target || typeof target.setItem !== 'function') return false;
  try {
    target.setItem(DRIFT_HUD_STORAGE_KEY, visible === false ? 'off' : 'on');
    return true;
  } catch (_) {
    return false;
  }
}

function dispatchSemanticEvent(eventTarget, type, detail) {
  if (typeof eventTarget?.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  eventTarget.dispatchEvent(new globalThis.CustomEvent(type, { detail }));
}

function presentationDetail(type, detail) {
  if (type === SCORE_FEEDBACK_EVENT.LOSS) {
    return {
      ...detail,
      durationMs: detail?.durationMs ?? 1050
    };
  }
  if (type === SCORE_FEEDBACK_EVENT.BANK && Number(detail?.multiplier) <= 1 && !detail?.label) {
    return {
      ...detail,
      label: '✓ BANKED'
    };
  }
  return detail;
}

export function createDriftAttackRuntime({
  state,
  scoreFeedback,
  storage,
  eventTarget = globalThis,
  isUnlocked = () => true,
  wallClock = () => Date.now()
} = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('TURN DRIFT ATTACK requires race state.');
  if (!scoreFeedback || typeof scoreFeedback.updateState !== 'function') {
    throw new TypeError('TURN DRIFT ATTACK requires ScoreFeedback.');
  }

  const targetStorage = getStorage(storage);
  let enabled = isUnlocked() === true;
  let hudVisible = driftHudVisible(targetStorage);

  function publishState(snapshot, now) {
    if (!enabled || !hudVisible) return;
    scoreFeedback.updateState(SCORE_FEEDBACK_CHANNEL.DRIFT, snapshot, now);
  }

  function publishEvent(type, detail, now) {
    if (enabled && hudVisible) {
      if (type === SCORE_FEEDBACK_EVENT.BUILD) {
        const activeEvent = scoreFeedback.inspect?.().activeEvent;
        if (activeEvent?.active
          && activeEvent.channel === SCORE_FEEDBACK_CHANNEL.DRIFT
          && activeEvent.type === SCORE_FEEDBACK_EVENT.LOSS) {
          scoreFeedback.dismissEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, now);
        }
      } else {
        scoreFeedback.publishEvent(
          SCORE_FEEDBACK_CHANNEL.DRIFT,
          type,
          presentationDetail(type, detail),
          now
        );
      }
    }
    dispatchSemanticEvent(eventTarget, 'turn:drift-score-event', {
      channel: SCORE_FEEDBACK_CHANNEL.DRIFT,
      type,
      at: now,
      ...detail
    });
  }

  const scorer = createDriftAttackScorer({
    onState: publishState,
    onEvent: publishEvent
  });

  function syncPresentation(now = 0) {
    if (enabled && hudVisible) {
      scoreFeedback.updateState(SCORE_FEEDBACK_CHANNEL.DRIFT, scorer.feedbackState, now);
    }
    scoreFeedback.setChannelVisible(
      SCORE_FEEDBACK_CHANNEL.DRIFT,
      enabled && hudVisible,
      now
    );
  }

  function reset(now = 0) {
    scorer.reset(now);
    scoreFeedback.clearChannel(SCORE_FEEDBACK_CHANNEL.DRIFT, now);
  }

  function beginLap(now = 0) {
    if (!enabled) return false;
    scorer.beginLap(now);
    return true;
  }

  function advance(dt, now) {
    if (!enabled) return false;
    return scorer.advance(
      dt,
      now,
      state.speed,
      state.driftSlipAngle,
      state.offRoad,
      state.collided,
      state.lapActive
    );
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

    const scoreResult = scorer.completeLap(now);
    const eligible = valid === true && ranked !== false;
    const previousBest = getBestDriftRecord(trackId, targetStorage);
    const saved = eligible
      ? saveBestDriftRecord({
        trackId,
        score: scoreResult.score,
        carId,
        lapTime: time,
        hitAt: wallClock()
      }, targetStorage)
      : { record: previousBest, isNewBest: false, saved: false };
    const bestScore = saved.record?.score || previousBest?.score || 0;
    const result = Object.freeze({
      available: true,
      score: scoreResult.score,
      bestScore,
      newBest: saved.isNewBest === true,
      saved: saved.saved === true,
      eligible,
      bankCount: scoreResult.bankCount,
      bestBank: scoreResult.bestBank,
      maxMultiplier: scoreResult.maxMultiplier,
      carId: String(carId || ''),
      lapTime: Number(time) || 0
    });

    // The yellow lap-result card is the authoritative finish summary. Keep a
    // separate pink ScoreFeedback release only when the result is exceptional.
    if (hudVisible && result.newBest && scoreResult.score > 0) {
      scoreFeedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.PERSONAL_BEST, {
        score: result.score,
        multiplier: result.maxMultiplier,
        label: 'NEW DRIFT BEST',
        announce: false
      }, now);
    }
    dispatchSemanticEvent(eventTarget, 'turn:drift-lap-result', result);
    return result;
  }

  function setHudVisible(visible, { persist = true, now = 0 } = {}) {
    const next = visible !== false;
    const persisted = !persist || saveDriftHudVisible(next, targetStorage);
    hudVisible = next;
    syncPresentation(now);
    dispatchSemanticEvent(eventTarget, 'turn:drift-hud-visibility-change', {
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
    dispatchSemanticEvent(eventTarget, 'turn:drift-availability-change', { enabled });
    return enabled;
  }

  function handleUiState(event) {
    const reason = event?.detail?.reason;
    if (reason === 'race-started' || reason === 'race-reset' || reason === 'track-changed' || reason === 'home-open') {
      reset(globalThis.performance?.now?.() || 0);
    }
  }

  eventTarget?.addEventListener?.('turn:trophy-road-updated', () => refreshEntitlement(
    globalThis.performance?.now?.() || 0
  ));
  eventTarget?.addEventListener?.('turn:ui-state-change', handleUiState);
  syncPresentation(0);

  return Object.freeze({
    scorer,
    beginLap,
    advance,
    completeLap,
    reset,
    refreshEntitlement,
    setHudVisible,
    isEnabled: () => enabled,
    isHudVisible: () => hudVisible,
    getBestRecord: (trackId = state.trackId) => getBestDriftRecord(trackId, targetStorage)
  });
}
