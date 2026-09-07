import {
  deriveVehicleTuningForCar,
  getCarDefinition
} from './catalog.js?revision=r248-supercar';

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
const RESET_REASONS = new Set(['race-started', 'race-reset', 'track-changed', 'home-open']);

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
  state.vehicleStats = stats;
  state.vehicleTuning = tuning;
  state.vehicleEffectiveTuning = tuning;
  globalThis.__turnVehicleTuning = tuning;
  return true;
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
  state.flowMultiplier = 1;
  state.flowShiftGainKeys = null;
}

function defaultShiftLabel(state) {
  return state?.shiftActive === true
    ? 'SHIFT active. Activate to return to standard attributes.'
    : 'SHIFT ready. Activate alternate attributes.';
}

function syncPresentation(state) {
  const bubble = globalThis.document?.querySelector?.('.drive-shift-bubble');
  if (!bubble || !flowShiftAvailable(state)) return;
  const stack = bubble.closest?.('.drive-stack');
  const gains = normalizedGainKeys(state.flowShiftGainKeys);
  const greatFlow = isGreatFlow(state.flowMultiplier);
  const specialEngaged = gains.length === 3;

  bubble.dataset.flowShift = greatFlow ? 'great' : specialEngaged ? 'carried' : 'idle';
  stack?.classList?.toggle('is-shift-active', specialEngaged || state.shiftActive === true);
  bubble.setAttribute('aria-pressed', String(specialEngaged || state.shiftActive === true));

  if (greatFlow && specialEngaged) {
    bubble.setAttribute(
      'aria-label',
      'FLOW SHIFT active. Activate to move the three-point boost to the other three attributes.'
    );
  } else if (greatFlow) {
    bubble.setAttribute(
      'aria-label',
      'FLOW SHIFT ready. Activate to add three attribute points without reductions.'
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
  syncPresentation(state);
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
    syncPresentation(state);
    return;
  }
  if (event?.detail?.intentional !== true) {
    syncPresentation(state);
    return;
  }

  if (isGreatFlow(state.flowMultiplier)) {
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
  syncPresentation(state);
}

function onUiState(event) {
  if (!RESET_REASONS.has(event?.detail?.reason)) return;
  const state = runtimeState();
  clearFlowShiftState(state);
  syncPresentation(state);
}

function initializeRuntime(runtime = globalThis.__turnRuntime) {
  const state = runtime?.state;
  if (!state) return;
  state.flowMultiplier = 1;
  state.flowShiftGainKeys = null;
  syncPresentation(state);
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
