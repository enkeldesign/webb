// FLOW pulses (#1171): each technique FLOW scores gives the control that earned it one
// short pulse in FLOW's colour, so the player sees what counts. Nothing is said: the
// FLOW TUTORIAL's lesson text already does. It reacts to FLOW's own announcements
// (scoring/flow-runtime.js) with a class, and does no work per frame. FLOW TUTORIAL
// starts it; regular races may follow once it has been tried on a device.
export const FLOW_PULSE_CLASS = 'is-flow-pulse';
export const FLOW_PULSE_TARGETS = Object.freeze({
  drift: '.drive-drift-zone',
  lock: '.drive-lock-bubble',
  boost: '.drive-boost-zone',
  shift: '.drive-shift-bubble',
  // A clean EXIT and a caught OVERCHARGE are both GAS.
  'clean-exit': '.drive-gas-zone',
  'overcharge-catch': '.drive-gas-zone'
});
const PULSE_MS = 620;
const STYLE_ID = 'turn-flow-pulse-styles';

function installStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  // Inside the control, under its label: the drive pad clips anything outside it, and
  // the LOCK and SHIFT bubbles slide on their own transform. A bright flash inside a
  // ring in FLOW's colour, then the ring alone, fading. The dark pad's labels are cream,
  // so its flash is fainter and they stay readable through it.
  style.textContent = `
    .drive-stack { --turn-flow-flash: 70%; }
    :root[data-theme="dark"] .drive-stack { --turn-flow-flash: 28%; }
    .drive-stack .${FLOW_PULSE_CLASS} { animation: turn-flow-pulse ${PULSE_MS}ms cubic-bezier(.2,.8,.3,1); }
    @keyframes turn-flow-pulse {
      0% {
        box-shadow: inset 0 0 0 0 var(--turn-control-flow),
          inset 0 0 0 999px color-mix(in srgb, var(--turn-paper) 0%, transparent);
      }
      18% {
        box-shadow: inset 0 0 0 var(--turn-space-2) var(--turn-control-flow),
          inset 0 0 0 999px color-mix(in srgb, var(--turn-paper) var(--turn-flow-flash), transparent);
      }
      55% {
        box-shadow: inset 0 0 0 var(--turn-space-2) var(--turn-control-flow),
          inset 0 0 0 999px color-mix(in srgb, var(--turn-paper) 0%, transparent);
      }
      100% {
        box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--turn-control-flow) 0%, transparent),
          inset 0 0 0 999px color-mix(in srgb, var(--turn-paper) 0%, transparent);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .drive-stack .${FLOW_PULSE_CLASS} {
        animation: none;
        box-shadow: inset 0 0 0 var(--turn-space-2) var(--turn-control-flow),
          inset 0 0 0 999px color-mix(in srgb, var(--turn-paper) calc(var(--turn-flow-flash) * 0.6), transparent);
      }
    }
  `;
  documentRef.head.appendChild(style);
}

// Starts the pulses and returns a stop function, which also clears any pulse showing.
export function startFlowPulses({ events = globalThis, documentRef = globalThis.document } = {}) {
  if (!documentRef?.head) return () => {};
  installStyles(documentRef);
  const timers = new Map();

  const clear = (element) => {
    globalThis.clearTimeout(timers.get(element));
    timers.delete(element);
    element.classList.remove(FLOW_PULSE_CLASS);
  };

  const pulse = (technique) => {
    const selector = FLOW_PULSE_TARGETS[technique];
    const element = selector && documentRef.querySelector(`.drive-stack ${selector}`);
    if (!element?.isConnected) return;
    clear(element);
    void element.offsetWidth;
    element.classList.add(FLOW_PULSE_CLASS);
    timers.set(element, globalThis.setTimeout(() => clear(element), PULSE_MS + 80));
  };

  const clearAll = () => {
    for (const element of [...timers.keys()]) clear(element);
  };
  const onFlow = (event) => {
    if (event.detail?.type === 'technique') pulse(event.detail.technique);
  };
  // Nothing of a race runs on through a pause, a restart or leaving (race/race-pause.js).
  const onRaceState = (event) => {
    const reason = event.detail?.reason;
    if (reason === 'race-paused' || reason === 'race-reset' || event.detail?.running === false) clearAll();
  };
  events.addEventListener?.('turn:flow-score-event', onFlow);
  events.addEventListener?.('turn:ui-state-change', onRaceState);
  return () => {
    events.removeEventListener?.('turn:flow-score-event', onFlow);
    events.removeEventListener?.('turn:ui-state-change', onRaceState);
    clearAll();
  };
}
