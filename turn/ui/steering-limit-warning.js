const LIMIT_EVENT = 'turn:steering-limit-feedback';
const SECOND_TONE_DELAY_MS = 90;
const MIN_VISIBLE_OPACITY = 0.08;
const MIN_VISIBLE_GROWTH = 0.3;
const HIDDEN_GROWTH = 0.12;
const VISUAL_RELEASE_HOLD_MS = 300;
const VISUAL_ATTACK_TAU_MS = 360;
const VISUAL_RELEASE_TAU_MS = 780;
const MAX_FRAME_DELTA_MS = 64;
const VISUAL_EPSILON = 0.001;

let installed = false;

export function steeringLimitAnnouncement(side) {
  if (side === 'left') return 'Left steering limit reached.';
  if (side === 'right') return 'Right steering limit reached.';
  return 'Steering limit reached.';
}

export function steeringLimitVisualOpacity(detail = {}) {
  if (!detail.active) return 0;
  const intensity = clamp(Number(detail.intensity) || 0, 0, 1);
  return MIN_VISIBLE_OPACITY + intensity * (1 - MIN_VISIBLE_OPACITY);
}

export function steeringLimitVisualGrowth(detail = {}) {
  if (!detail.active) return HIDDEN_GROWTH;
  const intensity = clamp(Number(detail.intensity) || 0, 0, 1);
  return MIN_VISIBLE_GROWTH + intensity * (1 - MIN_VISIBLE_GROWTH);
}

export function steeringLimitInertialStep(current, target, elapsedMs, timeConstantMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const timeConstant = Math.max(1, Number(timeConstantMs) || 1);
  const blend = 1 - Math.exp(-elapsed / timeConstant);
  return current + (target - current) * blend;
}

export function installSteeringLimitWarning() {
  if (installed) return true;
  if (!document.body) return false;
  installed = true;

  const states = {
    left: createVisualState('left'),
    right: createVisualState('right')
  };
  const announcer = createAnnouncer();
  document.body.append(states.left.overlay, states.right.overlay, announcer);

  const announcedSides = { left: false, right: false };
  let audioTimer = 0;
  let animationFrame = 0;
  let previousFrameTime = 0;

  function applyState(state) {
    state.overlay.style.setProperty('--turn-limit-opacity', state.currentOpacity.toFixed(4));
    state.overlay.style.setProperty('--turn-limit-growth', state.currentGrowth.toFixed(4));
  }

  function setVisibleTarget(state, detail) {
    state.releaseAt = 0;
    state.targetOpacity = steeringLimitVisualOpacity(detail);
    state.targetGrowth = steeringLimitVisualGrowth(detail);
  }

  function setHiddenTarget(state) {
    state.releaseAt = 0;
    state.targetOpacity = 0;
    state.targetGrowth = HIDDEN_GROWTH;
  }

  function scheduleSoftRelease(state, now) {
    if (state.targetOpacity <= 0 && state.currentOpacity <= VISUAL_EPSILON) return;
    state.releaseAt = Math.max(state.releaseAt, now + VISUAL_RELEASE_HOLD_MS);
  }

  function resetVisualsImmediately() {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    previousFrameTime = 0;
    for (const state of Object.values(states)) {
      state.releaseAt = 0;
      state.currentOpacity = 0;
      state.targetOpacity = 0;
      state.currentGrowth = HIDDEN_GROWTH;
      state.targetGrowth = HIDDEN_GROWTH;
      applyState(state);
    }
  }

  function stateNeedsAnimation(state, now) {
    return state.releaseAt > now ||
      Math.abs(state.currentOpacity - state.targetOpacity) > VISUAL_EPSILON ||
      Math.abs(state.currentGrowth - state.targetGrowth) > VISUAL_EPSILON;
  }

  function animateVisuals(timestamp) {
    animationFrame = 0;
    const now = Number.isFinite(timestamp) ? timestamp : currentTime();
    const elapsed = previousFrameTime
      ? Math.min(MAX_FRAME_DELTA_MS, Math.max(0, now - previousFrameTime))
      : 16;
    previousFrameTime = now;
    let keepAnimating = false;

    for (const state of Object.values(states)) {
      if (state.releaseAt && now >= state.releaseAt) setHiddenTarget(state);

      const opacityTau = state.targetOpacity >= state.currentOpacity
        ? VISUAL_ATTACK_TAU_MS
        : VISUAL_RELEASE_TAU_MS;
      const growthTau = state.targetGrowth >= state.currentGrowth
        ? VISUAL_ATTACK_TAU_MS
        : VISUAL_RELEASE_TAU_MS;

      state.currentOpacity = steeringLimitInertialStep(
        state.currentOpacity,
        state.targetOpacity,
        elapsed,
        opacityTau
      );
      state.currentGrowth = steeringLimitInertialStep(
        state.currentGrowth,
        state.targetGrowth,
        elapsed,
        growthTau
      );

      if (Math.abs(state.currentOpacity - state.targetOpacity) <= VISUAL_EPSILON) {
        state.currentOpacity = state.targetOpacity;
      }
      if (Math.abs(state.currentGrowth - state.targetGrowth) <= VISUAL_EPSILON) {
        state.currentGrowth = state.targetGrowth;
      }

      applyState(state);
      keepAnimating ||= stateNeedsAnimation(state, now);
    }

    if (keepAnimating) animationFrame = window.requestAnimationFrame(animateVisuals);
    else previousFrameTime = 0;
  }

  function requestVisualAnimation() {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(animateVisuals);
  }

  function resetRaceAnnouncements() {
    announcedSides.left = false;
    announcedSides.right = false;
    announcer.textContent = '';
  }

  function playLimitCue() {
    window.clearTimeout(audioTimer);
    const audio = globalThis.__turnAudio;
    audio?.cue?.('ui-back');
    audioTimer = window.setTimeout(() => {
      globalThis.__turnAudio?.cue?.('ui-tap');
    }, SECOND_TONE_DELAY_MS);
  }

  function announceLimit(side) {
    if (announcedSides[side]) return;
    announcedSides[side] = true;
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = steeringLimitAnnouncement(side);
    });
  }

  function handleLimitFeedback(event) {
    const detail = event.detail || {};
    const side = detail.side === 'left' || detail.side === 'right' ? detail.side : null;
    const now = currentTime();

    if (!detail.active || !side) {
      scheduleSoftRelease(states.left, now);
      scheduleSoftRelease(states.right, now);
      requestVisualAnimation();
      return;
    }

    const activeState = states[side];
    const inactiveState = states[side === 'left' ? 'right' : 'left'];
    setVisibleTarget(activeState, detail);
    setHiddenTarget(inactiveState);
    requestVisualAnimation();

    if (detail.enteredHard) {
      playLimitCue();
      announceLimit(side);
    }
  }

  window.addEventListener(LIMIT_EVENT, handleLimitFeedback);
  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    if (reason === 'race-started') resetRaceAnnouncements();
    if (!event.detail?.running) {
      window.clearTimeout(audioTimer);
      audioTimer = 0;
      resetVisualsImmediately();
      announcer.textContent = '';
    }
  });

  return true;
}

function createVisualState(side) {
  const overlay = document.createElement('div');
  overlay.className = `turn-steering-limit-edge turn-steering-limit-edge-${side}`;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.setProperty('--turn-limit-opacity', '0');
  overlay.style.setProperty('--turn-limit-growth', String(HIDDEN_GROWTH));
  return {
    overlay,
    currentOpacity: 0,
    targetOpacity: 0,
    currentGrowth: HIDDEN_GROWTH,
    targetGrowth: HIDDEN_GROWTH,
    releaseAt: 0
  };
}

function createAnnouncer() {
  const announcer = document.createElement('div');
  announcer.className = 'turn-sr-only turn-steering-limit-announcer';
  announcer.setAttribute('aria-live', 'assertive');
  announcer.setAttribute('aria-atomic', 'true');
  return announcer;
}

function currentTime() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
