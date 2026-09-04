export const FLOW_CHAIN_WINDOW_MS = 5000;
export const FLOW_MAX_MULTIPLIER = 8;
export const FLOW_TOKEN_COUNT = 5;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createFlowScorer({ onState = null, onTechnique = null } = {}) {
  const feedbackState = {
    active: false,
    score: 0,
    unbanked: 0,
    multiplier: 1,
    intensity: 0,
    phase: 'quiet',
    label: 'FLOW',
    tokens: ['', '', '', '', '']
  };

  let attemptActive = false;
  let lapScore = 0;
  let multiplier = 1;
  let maxMultiplier = 1;
  let lastTechnique = '';
  let lastTechniqueAt = 0;
  let chainLength = 0;
  let maxChain = 0;
  let techniqueCount = 0;

  function emitState(now) {
    if (typeof onState === 'function') onState(feedbackState, now);
  }

  function syncFeedback(now, latestAward = 0, phase = 'build') {
    feedbackState.active = chainLength > 0;
    feedbackState.score = Math.max(0, Math.round(lapScore));
    feedbackState.unbanked = Math.max(0, Math.round(latestAward));
    feedbackState.multiplier = multiplier;
    feedbackState.intensity = feedbackState.active
      ? clamp((multiplier - 1) / (FLOW_MAX_MULTIPLIER - 1) * 0.82 + Math.min(0.18, chainLength * 0.025), 0, 1)
      : 0;
    feedbackState.phase = feedbackState.active ? phase : 'quiet';
    emitState(now);
  }

  function clearTokens() {
    for (let index = 0; index < FLOW_TOKEN_COUNT; index += 1) feedbackState.tokens[index] = '';
  }

  function addToken(token) {
    for (let index = 0; index < FLOW_TOKEN_COUNT - 1; index += 1) {
      feedbackState.tokens[index] = feedbackState.tokens[index + 1];
    }
    feedbackState.tokens[FLOW_TOKEN_COUNT - 1] = String(token || '').toUpperCase().slice(0, 8);
  }

  function resetLapValues() {
    lapScore = 0;
    multiplier = 1;
    maxMultiplier = 1;
    lastTechnique = '';
    lastTechniqueAt = 0;
    chainLength = 0;
    maxChain = 0;
    techniqueCount = 0;
    clearTokens();
  }

  function beginLap(now = 0) {
    attemptActive = true;
    resetLapValues();
    syncFeedback(now, 0, 'quiet');
  }

  function reset(now = 0) {
    attemptActive = false;
    resetLapValues();
    syncFeedback(now, 0, 'quiet');
  }

  function breakChain(now = 0, reason = 'expired') {
    if (!chainLength && multiplier === 1) return false;
    multiplier = 1;
    lastTechnique = '';
    lastTechniqueAt = 0;
    chainLength = 0;
    syncFeedback(now, 0, reason === 'failure' ? 'settle' : 'quiet');
    return true;
  }

  function expireChain(now = 0) {
    const timestamp = finiteNumber(now);
    if (!lastTechniqueAt || timestamp - lastTechniqueAt < FLOW_CHAIN_WINDOW_MS) return false;
    return breakChain(timestamp, 'expired');
  }

  function acceptTechnique({ technique, token = technique, basePoints, now = 0, detail = {} } = {}) {
    if (!attemptActive) return null;
    const name = String(technique || '').trim().toLowerCase();
    const base = Math.max(0, finiteNumber(basePoints));
    const timestamp = finiteNumber(now);
    if (!name || base <= 0) return null;

    expireChain(timestamp);
    const repeated = name === lastTechnique;
    const seenRecently = feedbackState.tokens.includes(String(token || technique).toUpperCase().slice(0, 8));
    const varietyFactor = repeated ? 0.2 : seenRecently ? 0.65 : 1;
    if (chainLength > 0 && !repeated) {
      multiplier = Math.min(
        FLOW_MAX_MULTIPLIER,
        Math.round((multiplier + (seenRecently ? 0.25 : 0.5)) * 100) / 100
      );
    }

    const awarded = Math.max(1, Math.round(base * multiplier * varietyFactor));
    lapScore += awarded;
    chainLength += 1;
    maxChain = Math.max(maxChain, chainLength);
    maxMultiplier = Math.max(maxMultiplier, multiplier);
    techniqueCount += 1;
    lastTechnique = name;
    lastTechniqueAt = timestamp;
    addToken(token);
    syncFeedback(timestamp, awarded, multiplier >= 4 ? 'intensify' : 'build');

    const result = Object.freeze({
      technique: name,
      token: String(token || technique).toUpperCase().slice(0, 8),
      awarded,
      score: Math.round(lapScore),
      multiplier,
      chainLength,
      repeated,
      ...detail
    });
    if (typeof onTechnique === 'function') onTechnique(result, timestamp);
    return result;
  }

  function completeLap(now = 0) {
    const result = Object.freeze({
      score: Math.max(0, Math.round(lapScore)),
      maxMultiplier,
      maxChain,
      techniqueCount
    });
    // TURN laps continue immediately across the finish line. Match the DRIFT
    // scorer by arming the next attempt here instead of waiting for another
    // explicit race-start event that will not fire between ordinary laps.
    attemptActive = true;
    resetLapValues();
    syncFeedback(now, 0, 'quiet');
    return result;
  }

  function inspect() {
    return {
      attemptActive,
      lapScore: Math.round(lapScore),
      multiplier,
      maxMultiplier,
      lastTechnique,
      lastTechniqueAt,
      chainLength,
      maxChain,
      techniqueCount,
      tokens: [...feedbackState.tokens]
    };
  }

  return Object.freeze({
    feedbackState,
    beginLap,
    reset,
    breakChain,
    expireChain,
    acceptTechnique,
    completeLap,
    inspect
  });
}
