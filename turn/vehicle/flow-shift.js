import {
  deriveVehicleTuningForCar,
  getCarDefinition
} from './catalog.js?revision=r253-supercar-release';
import {
  applyVehicleShiftTuning,
  clearVehicleShiftTuningTransition,
  isVehicleShiftResetReason
} from './shift-tuning.js?revision=r254-flow-shift-authority';

export const FLOW_SHIFT_VEHICLE_ID = 'supercar';
export const FLOW_SHIFT_MIN_MULTIPLIER = 2;

const FLOW_SHIFT_STAT_KEYS = Object.freeze([
  'speed',
  'acceleration',
  'control',
  'drift',
  'boostPower',
  'boostDuration'
]);
const FLOW_SHIFT_STAT_KEY_SET = new Set(FLOW_SHIFT_STAT_KEYS);
const INSTALL_MARKER = '__turnFlowShiftRuntime';
const PRESENTATION_STYLE_ID = 'turn-flow-shift-button-r255';

function runtimeState() {
  return globalThis.__turnRuntime?.state || null;
}

function normalizedMultiplier(value) {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1;
}

function normalizedGainKeys(value) {
  if (!Array.isArray(value)) return [];
  const unique = [...new Set(value.filter((key) => FLOW_SHIFT_STAT_KEY_SET.has(key)))];
  return unique.length === 3 ? unique : [];
}

function complementaryKeys(gainKeys) {
  const gainSet = new Set(normalizedGainKeys(gainKeys));
  return gainSet.size === 3
    ? FLOW_SHIFT_STAT_KEYS.filter((key) => !gainSet.has(key))
    : [];
}

function supercarBaseStats() {
  return getCarDefinition(FLOW_SHIFT_VEHICLE_ID).stats;
}

function flowShiftAvailable(state) {
  return state?.vehicleId === FLOW_SHIFT_VEHICLE_ID
    && state?.vehiclePerkUnlocked === true;
}

export function isGreatFlow(multiplier) {
  return normalizedMultiplier(multiplier) >= FLOW_SHIFT_MIN_MULTIPLIER;
}

export function inferFlowShiftGainKeys(baseStats, currentStats) {
  if (!baseStats || !currentStats) return Object.freeze([]);
  const gains = FLOW_SHIFT_STAT_KEYS.filter((key) => (
    Number(currentStats[key]) === Number(baseStats[key]) + 1
  ));
  return Object.freeze(gains.length === 3 ? gains : []);
}

export function resolveFlowShiftStats({
  baseStats,
  gainKeys,
  greatFlow = false
} = {}) {
  const gains = normalizedGainKeys(gainKeys);
  if (!baseStats || gains.length !== 3) return null;
  const gainSet = new Set(gains);
  const stats = {};
  for (const key of FLOW_SHIFT_STAT_KEYS) {
    const base = Number(baseStats[key]);
    if (!Number.isInteger(base)) return null;
    const delta = gainSet.has(key) ? 1 : (greatFlow ? 0 : -1);
    const value = base + delta;
    if (value < 1 || value > 5) return null;
    stats[key] = value;
  }
  const expectedTotal = greatFlow ? 21 : 18;
  const total = FLOW_SHIFT_STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
  return total === expectedTotal ? Object.freeze(stats) : null;
}

function applyStats(state, stats) {
  if (!state || !stats) return false;
  const tuning = deriveVehicleTuningForCar(FLOW_SHIFT_VEHICLE_ID, stats);
  return applyVehicleShiftTuning({ state, stats, tuning });
}

function currentGainKeys(state) {
  const stored = normalizedGainKeys(state?.flowShiftGainKeys);
  if (stored.length === 3) return stored;
  if (state?.shiftActive !== true) return [];
  return inferFlowShiftGainKeys(supercarBaseStats(), state?.vehicleStats);
}

function applyCurrentFlowShift(state, { greatFlow = isGreatFlow(state?.flowMultiplier) } = {}) {
  if (!flowShiftAvailable(state)) return false;
  const gainKeys = currentGainKeys(state);
  if (gainKeys.length !== 3) return false;
  state.flowShiftGainKeys = Object.freeze([...gainKeys]);
  const stats = resolveFlowShiftStats({
    baseStats: supercarBaseStats(),
    gainKeys,
    greatFlow
  });
  if (!stats) return false;
  return applyStats(state, stats);
}

function clearFlowShiftState(state) {
  if (!state) return;
  clearVehicleShiftTuningTransition(state);
  state.flowMultiplier = 1;
  state.flowShiftGainKeys = null;
}

function defaultShiftLabel(state) {
  return state?.shiftActive === true
    ? 'SHIFT active. Activate to return to standard attributes.'
    : 'SHIFT ready. Activate alternate attributes.';
}

function ensurePresentationStyles() {
  const documentRef = globalThis.document;
  if (!documentRef?.head || documentRef.getElementById(PRESENTATION_STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = PRESENTATION_STYLE_ID;
  style.textContent = `
    .controls .drive-shift-bubble[data-flow-shift="great"] {
      background: #8ce99a;
    }

    .controls .drive-shift-bubble[data-flow-shift="great"][data-flow-shift-gear="base"] {
      background: #b2f2bb;
    }

    .controls .drive-shift-bubble[data-flow-shift="great"][data-flow-shift-gear="up"] {
      background: #8ce99a;
    }

    .drive-shift-bubble[data-flow-shift="great"] span {
      gap: .28em;
      font-size: clamp(.54rem, 1.36vw, .75rem);
    }

    .drive-shift-bubble[data-flow-shift="great"] .flow-shift-copy {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: .1em;
      font: inherit;
      font-weight: inherit;
      letter-spacing: inherit;
      line-height: .88;
    }

    .drive-shift-bubble[data-flow-shift="great"] .flow-shift-copy em {
      display: block;
      font: inherit;
      font-style: normal;
      font-weight: inherit;
      letter-spacing: inherit;
      line-height: inherit;
    }

    /* The old text bullet was intentionally width-animated from zero, but its
       active width was narrower than the glyph on iOS and clipped its edge.
       Keep the same dot convention while drawing it as a real circle instead. */
    .drive-shift-bubble i {
      flex: 0 0 auto;
      width: 0;
      height: .56rem;
      overflow: hidden;
      border-radius: 999px;
      background: currentColor;
      font-size: 0;
      line-height: 0;
    }

    /* Passive FLOW loss carries the current regular SHIFT tuning without a new
       player action. Suppress the dot for that carried state; the next deliberate
       SHIFT toggle clears `carried`, making the dot appear as immediate feedback. */
    .drive-stack.is-shift-active .drive-shift-bubble:not([data-flow-shift="carried"]) i {
      width: .56rem;
      opacity: 1;
    }

    .drive-stack.is-flow-shift-engaged .drive-shift-bubble {
      opacity: 1;
      transform: translateX(0) scaleX(1);
      pointer-events: auto;
    }

    :root.turn-left-handed-controls .drive-stack.is-flow-shift-engaged .drive-shift-bubble {
      transform: translateX(0) scaleX(1);
    }

    .drive-shift-bubble.is-flow-shift-bump {
      --turn-flow-shift-bump-x: -7px;
      --turn-flow-shift-rebound-x: 2px;
      animation: turn-flow-shift-bump 260ms cubic-bezier(.2,.88,.25,1);
    }

    :root.turn-left-handed-controls .drive-shift-bubble.is-flow-shift-bump {
      --turn-flow-shift-bump-x: 7px;
      --turn-flow-shift-rebound-x: -2px;
    }

    @keyframes turn-flow-shift-bump {
      0%, 100% { transform: translateX(0) scaleX(1); }
      38% { transform: translateX(var(--turn-flow-shift-bump-x)) scaleX(1.07); }
      68% { transform: translateX(var(--turn-flow-shift-rebound-x)) scaleX(.985); }
    }

    @media (prefers-reduced-motion: reduce) {
      .drive-shift-bubble.is-flow-shift-bump {
        animation: none;
      }
    }

    @media (forced-colors: active) {
      .drive-stack.is-shift-active .drive-shift-bubble i {
        box-sizing: border-box;
        border: 2px solid ButtonText;
        background: ButtonText;
      }
    }
  `;
  documentRef.head.appendChild(style);
}

function setFlowShiftButtonText(bubble, active) {
  const mode = active ? 'flow' : 'shift';
  if (bubble.dataset.flowShiftText === mode) return;
  bubble.dataset.flowShiftText = mode;
  bubble.innerHTML = active
    ? '<span><b class="flow-shift-copy"><em>FLOW</em><em>SHIFT</em></b><i aria-hidden="true">●</i></span>'
    : '<span>SHIFT<i aria-hidden="true">●</i></span>';
}

function bumpFlowShiftButton() {
  const bubble = globalThis.document?.querySelector?.('.drive-shift-bubble');
  if (!bubble) return;
  bubble.classList.remove('is-flow-shift-bump');
  void bubble.offsetWidth;
  bubble.classList.add('is-flow-shift-bump');
  globalThis.setTimeout?.(() => bubble.classList.remove('is-flow-shift-bump'), 320);
}

function resetPresentation(bubble, stack) {
  bubble.dataset.flowShift = 'idle';
  bubble.dataset.flowShiftGear = 'none';
  setFlowShiftButtonText(bubble, false);
  bubble.classList.remove('is-flow-shift-bump');
  stack?.classList?.remove('is-flow-shift-engaged');
}

export function syncFlowShiftPresentation(state = runtimeState()) {
  const bubble = globalThis.document?.querySelector?.('.drive-shift-bubble');
  if (!bubble) return;
  const stack = bubble.closest?.('.drive-stack');
  ensurePresentationStyles();

  if (!flowShiftAvailable(state)) {
    resetPresentation(bubble, stack);
    return;
  }

  const gains = normalizedGainKeys(state.flowShiftGainKeys);
  const greatFlow = isGreatFlow(state.flowMultiplier);
  const specialEngaged = gains.length === 3;
  const flowShiftEngaged = greatFlow && specialEngaged;
  const upGear = state.shiftActive === true;
  const pressed = greatFlow
    ? upGear
    : specialEngaged || upGear;

  bubble.dataset.flowShift = greatFlow ? 'great' : specialEngaged ? 'carried' : 'idle';
  bubble.dataset.flowShiftGear = greatFlow
    ? (specialEngaged ? (upGear ? 'up' : 'base') : 'ready')
    : 'none';
  setFlowShiftButtonText(bubble, greatFlow);
  stack?.classList?.toggle('is-flow-shift-engaged', flowShiftEngaged);
  stack?.classList?.toggle('is-shift-active', pressed);
  bubble.setAttribute('aria-pressed', String(pressed));

  if (greatFlow && specialEngaged && upGear) {
    bubble.setAttribute(
      'aria-label',
      'FLOW SHIFT. UP gear active. Activate to move the three-point boost to the default gear.'
    );
  } else if (greatFlow && specialEngaged) {
    bubble.setAttribute(
      'aria-label',
      'FLOW SHIFT. Default gear active. Activate to move the three-point boost to the UP gear.'
    );
  } else if (greatFlow) {
    bubble.setAttribute(
      'aria-label',
      'FLOW SHIFT ready. Activate to add its three attribute points without reductions.'
    );
  } else if (specialEngaged) {
    bubble.setAttribute(
      'aria-label',
      'SHIFT active after FLOW. Activate to move SHIFT to the other three attributes.'
    );
  } else {
    bubble.setAttribute('aria-label', defaultShiftLabel(state));
  }
}

function setFlowMultiplier(multiplier) {
  const state = runtimeState();
  if (!state) return;
  const previousGreatFlow = isGreatFlow(state.flowMultiplier);
  state.flowMultiplier = normalizedMultiplier(multiplier);
  const nextGreatFlow = isGreatFlow(state.flowMultiplier);

  if (!flowShiftAvailable(state)) return;
  if (nextGreatFlow) {
    applyCurrentFlowShift(state, { greatFlow: true });
  } else if (previousGreatFlow && normalizedGainKeys(state.flowShiftGainKeys).length === 3) {
    applyCurrentFlowShift(state, { greatFlow: false });
  }
  syncFlowShiftPresentation(state);
}

function onFlowScore(event) {
  if (event?.detail?.type === 'chain-expired') {
    setFlowMultiplier(1);
    return;
  }
  const multiplier = Number(event?.detail?.multiplier);
  if (Number.isFinite(multiplier)) setFlowMultiplier(multiplier);
}

function onDriftScore(event) {
  if (event?.detail?.type === 'loss') setFlowMultiplier(1);
}

function onFlowAvailability(event) {
  if (event?.detail?.enabled === false) setFlowMultiplier(1);
}

function onShiftChange(event) {
  const state = runtimeState();
  if (!flowShiftAvailable(state)) return;

  if (event?.detail?.available === false) {
    state.flowShiftGainKeys = null;
    syncFlowShiftPresentation(state);
    return;
  }
  if (event?.detail?.intentional !== true) {
    syncFlowShiftPresentation(state);
    return;
  }

  const greatFlow = isGreatFlow(state.flowMultiplier);
  if (greatFlow) {
    const gains = normalizedGainKeys(event.detail?.gainKeys);
    if (gains.length === 3) {
      state.flowShiftGainKeys = Object.freeze([...gains]);
      applyCurrentFlowShift(state, { greatFlow: true });
    }
  } else {
    // Below ×2 the regular SHIFT implementation has already applied its normal
    // +3 / -3 tuning before this semantic event is dispatched.
    state.flowShiftGainKeys = null;
    state.vehicleEffectiveTuning = state.vehicleTuning || null;
  }
  syncFlowShiftPresentation(state);
  if (greatFlow && normalizedGainKeys(state.flowShiftGainKeys).length === 3) {
    bumpFlowShiftButton();
  }
}

function onUiState(event) {
  if (!isVehicleShiftResetReason(event?.detail?.reason)) return;
  const state = runtimeState();
  clearFlowShiftState(state);
  syncFlowShiftPresentation(state);
}

function initializeRuntime(runtime = globalThis.__turnRuntime) {
  const state = runtime?.state;
  if (!state) return;
  state.flowMultiplier = 1;
  state.flowShiftGainKeys = null;
  syncFlowShiftPresentation(state);
}

export function installFlowShiftRuntime(eventTarget = globalThis) {
  if (!eventTarget?.addEventListener) return null;
  if (globalThis[INSTALL_MARKER]) return globalThis[INSTALL_MARKER];

  const cleanup = () => {
    eventTarget.removeEventListener?.('turn:flow-score-event', onFlowScore);
    eventTarget.removeEventListener?.('turn:drift-score-event', onDriftScore);
    eventTarget.removeEventListener?.('turn:flow-availability-change', onFlowAvailability);
    eventTarget.removeEventListener?.('turn:shift-change', onShiftChange);
    eventTarget.removeEventListener?.('turn:ui-state-change', onUiState);
    eventTarget.removeEventListener?.('turn:runtime-ready', onRuntimeReady);
    if (globalThis[INSTALL_MARKER]?.cleanup === cleanup) delete globalThis[INSTALL_MARKER];
  };
  const onRuntimeReady = (event) => initializeRuntime(event?.detail || globalThis.__turnRuntime);

  eventTarget.addEventListener('turn:flow-score-event', onFlowScore);
  eventTarget.addEventListener('turn:drift-score-event', onDriftScore);
  eventTarget.addEventListener('turn:flow-availability-change', onFlowAvailability);
  eventTarget.addEventListener('turn:shift-change', onShiftChange);
  eventTarget.addEventListener('turn:ui-state-change', onUiState);
  eventTarget.addEventListener('turn:runtime-ready', onRuntimeReady);
  initializeRuntime();

  const runtime = Object.freeze({ cleanup });
  globalThis[INSTALL_MARKER] = runtime;
  return runtime;
}
