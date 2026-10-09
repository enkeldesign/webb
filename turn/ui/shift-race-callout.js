// SHIFT in a regular race (#1149): after the SHIFT introduction, the first races where
// the car has a SHIFT setup point at the drive pad's GAS row, where SHIFT slides out.
// It names the move and goes: no lesson, no lap. The first intentional SHIFT ends it;
// a player who never shifts sees it in RACE_SHIFT_HINT_RACES races, then not again.
export const RACE_SHIFT_HINT = 'race-shift';
export const RACE_SHIFT_HINT_RACES = 3;
const STYLE_ID = 'turn-shift-race-callout-styles';
// After the lap starts, so it is not lost in the start; long enough to read and try.
const SHOW_DELAY_MS = 1500;
const VISIBLE_MS = 8000;
const HIDE_REASONS = new Set(['race-paused', 'race-reset', 'track-changed', 'home-open', 'lap-completed']);
export const SHIFT_CALLOUT_TEXT = 'Hold GAS, then slide outward into SHIFT to switch setup.';

function installStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .turn-shift-callout {
      position: absolute;
      z-index: 3;
      /* Beside the GAS row, past where the SHIFT bubble slides out. */
      top: 54%;
      right: calc(100% + var(--shift-bubble-width) + var(--turn-space-3));
      display: grid;
      gap: var(--turn-space-1);
      width: max-content;
      max-width: min(13rem, 38vw);
      padding: var(--turn-space-2) var(--turn-space-3);
      border: var(--turn-border-default) solid var(--turn-outline);
      border-radius: var(--turn-radius-default);
      background: var(--turn-surface-page);
      color: var(--turn-text);
      box-shadow: var(--turn-shadow-compact);
      transform: translateY(-50%);
      pointer-events: none;
    }
    .turn-shift-callout[hidden] { display: none; }
    /* The bubble's tail, pointing across the gap to where SHIFT slides out of the GAS
       row: an outline triangle, with a paper one over it that opens the border. */
    .turn-shift-callout::before,
    .turn-shift-callout::after {
      content: '';
      position: absolute;
      top: 50%;
      border: solid transparent;
      transform: translateY(-50%);
    }
    .turn-shift-callout::before {
      left: calc(100% + var(--turn-border-default));
      border-width: calc(var(--turn-space-3) + var(--turn-border-default));
      border-left-color: var(--turn-outline);
    }
    .turn-shift-callout::after {
      left: 100%;
      border-width: var(--turn-space-3);
      border-left-color: var(--turn-surface-page);
    }
    .turn-shift-callout strong {
      font-size: var(--turn-type-body);
      font-weight: var(--turn-weight-display);
      line-height: var(--turn-leading-title);
    }
    .turn-shift-callout span {
      font-size: var(--turn-type-small);
      line-height: var(--turn-leading-body);
    }
    /* Portrait: the steering control sits level with GAS, so the callout rises from it. */
    @media (orientation: portrait) {
      .turn-shift-callout { top: auto; bottom: 62%; transform: none; }
      .turn-shift-callout::before { top: auto; bottom: var(--turn-space-2); transform: none; }
      .turn-shift-callout::after { top: auto; bottom: calc(var(--turn-space-2) + var(--turn-border-default)); transform: none; }
    }
    :root.turn-left-handed-controls .turn-shift-callout {
      right: auto;
      left: calc(100% + var(--shift-bubble-width) + var(--turn-space-3));
    }
    :root.turn-left-handed-controls .turn-shift-callout::before,
    :root.turn-left-handed-controls .turn-shift-callout::after {
      left: auto;
      border-left-color: transparent;
    }
    :root.turn-left-handed-controls .turn-shift-callout::before {
      right: calc(100% + var(--turn-border-default));
      border-right-color: var(--turn-outline);
    }
    :root.turn-left-handed-controls .turn-shift-callout::after {
      right: 100%;
      border-right-color: var(--turn-surface-page);
    }
  `;
  documentRef.head.appendChild(style);
}

export function installShiftRaceCallout({
  queue,
  isTutorialActive = () => false,
  documentRef = globalThis.document,
  windowRef = globalThis
} = {}) {
  if (!queue) return null;
  installStyles(documentRef);
  const callout = documentRef.createElement('div');
  callout.className = 'turn-shift-callout';
  callout.setAttribute('role', 'status');
  callout.setAttribute('aria-live', 'polite');
  callout.setAttribute('aria-atomic', 'true');
  callout.hidden = true;

  // The drive pad is built by gameplay-controls.js, which may install after Home.
  function driveStack() {
    const stack = documentRef.querySelector('.drive-stack');
    if (stack && callout.parentElement !== stack) stack.appendChild(callout);
    return stack;
  }

  let shownThisRace = false;
  let showTimer = 0;
  let hideTimer = 0;

  function hide() {
    windowRef.clearTimeout?.(showTimer);
    windowRef.clearTimeout?.(hideTimer);
    showTimer = 0;
    hideTimer = 0;
    callout.hidden = true;
    callout.replaceChildren();
  }

  function eligible() {
    const stack = driveStack();
    const state = windowRef.__turnRuntime?.state;
    return queue.hasHint(RACE_SHIFT_HINT)
      && state?.running === true
      && state.lapActive === true
      && windowRef.__turnRacePause?.paused !== true
      && stack?.classList.contains('is-shift-available') === true
      && Boolean(stack.offsetParent)
      && !isTutorialActive();
  }

  function show() {
    showTimer = 0;
    if (shownThisRace || !eligible()) return;
    shownThisRace = true;
    queue.viewHint(RACE_SHIFT_HINT, RACE_SHIFT_HINT_RACES);
    const title = documentRef.createElement('strong');
    title.textContent = 'SHIFT';
    const text = documentRef.createElement('span');
    text.textContent = SHIFT_CALLOUT_TEXT;
    callout.hidden = false;
    callout.replaceChildren(title, text);
    hideTimer = windowRef.setTimeout?.(hide, VISIBLE_MS) || 0;
  }

  windowRef.addEventListener?.('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    if (reason === 'race-started') {
      shownThisRace = false;
      hide();
    }
    if (reason === 'lap-started' && !shownThisRace && !showTimer && queue.hasHint(RACE_SHIFT_HINT)) {
      showTimer = windowRef.setTimeout?.(show, SHOW_DELAY_MS) || 0;
    }
    if (HIDE_REASONS.has(reason) || event.detail?.running === false) hide();
  });
  // The move, made: the callout has done its job, in this race or before it showed.
  windowRef.addEventListener?.('turn:shift-change', (event) => {
    if (event.detail?.intentional !== true) return;
    if (queue.hasHint(RACE_SHIFT_HINT)) queue.consumeHint(RACE_SHIFT_HINT);
    hide();
  });
  windowRef.addEventListener?.('turn:home-shown', hide);

  return Object.freeze({ callout, show, hide });
}
