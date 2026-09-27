// iOS standalone viewport gap. On some iPhones the installed app is laid out one
// status-bar inset shorter than the screen (portrait: client/dvh 793 of lvh 852,
// top inset 59) while it still paints from the very top, so everything anchored to
// the bottom stops early above a strip of page background. The viewport meta pulse
// in pwa-short-viewport-repair-r184.js does not recover this case.
//
// When the gap matches the top inset, the body takes the full large-viewport height
// and becomes the containing block for fixed descendants (a transform), so fixed
// layers anchored to the bottom reach the real screen edge. Modal dialogs live in
// the top layer, outside the body, and extend by the same gap.
(() => {
  const root = document.documentElement;
  const isStandalone =
    root.classList.contains('turn-standalone') ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;
  if (!isStandalone || globalThis.__turnViewportGap) return;

  const CLASS = 'turn-viewport-gap';
  const MIN_GAP = 20;
  const INSET_TOLERANCE = 4;
  const SETTLE_DELAYS_MS = Object.freeze([0, 120, 400, 900]);

  const style = document.createElement('style');
  style.id = 'turn-viewport-gap-style';
  style.textContent = `
    /* Only the fixed body grows: a fixed box adds nothing to the document's
       scrollable height, so the page cannot rubber-band by the gap. */
    html.${CLASS} body {
      height: 100lvh !important;
      min-height: 100lvh !important;
      transform: translateZ(0);
    }
    html.${CLASS} dialog[open]::backdrop {
      bottom: calc(-1 * var(--turn-viewport-gap, 0px));
    }
    html.${CLASS} .turn-home-sheet[open] {
      height: calc(100% + var(--turn-viewport-gap, 0px));
    }
    @media (max-width: 46em) and (orientation: portrait) {
      :root.${CLASS} body :is(dialog.m8-dialog, dialog.audio-settings-dialog, dialog.turn-support-challenge-dialog, dialog.turn-yourturn-share-dialog, dialog.turn-motion-denied-dialog, dialog.lot-shift-dialog, dialog.nuke-dialog)[open] {
        bottom: calc(-1 * var(--turn-viewport-gap, 0px));
      }
    }
  `;
  document.head.appendChild(style);

  function measure(value) {
    if (!document.body) return 0;
    const probe = document.createElement('i');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = `position:absolute;left:-10000px;top:0;width:1px;height:${value};visibility:hidden;pointer-events:none;`;
    document.body.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  }

  function sync() {
    if (!document.body) return;
    const large = measure('100lvh');
    const client = Number(root.clientHeight) || 0;
    const top = measure('env(safe-area-inset-top, 0px)');
    const gap = Math.round(large - client);
    const active = gap >= MIN_GAP && Math.abs(gap - top) <= INSET_TOLERANCE;
    root.classList.toggle(CLASS, active);
    if (active) root.style.setProperty('--turn-viewport-gap', `${gap}px`);
    else root.style.removeProperty('--turn-viewport-gap');
    root.dataset.turnViewportGap = active ? `${gap}px` : 'none';
  }

  let timers = [];
  function settle() {
    for (const timer of timers) window.clearTimeout(timer);
    // documentElement.clientHeight is the layout viewport whatever the root's own
    // height, so the compensation never skews the next measurement.
    timers = SETTLE_DELAYS_MS.map((delay) => window.setTimeout(sync, delay));
  }

  for (const eventName of ['resize', 'orientationchange', 'pageshow']) {
    window.addEventListener(eventName, settle, { passive: true });
  }
  window.visualViewport?.addEventListener('resize', settle, { passive: true });
  if (document.body) settle();
  else document.addEventListener('DOMContentLoaded', settle, { once: true });

  globalThis.__turnViewportGap = Object.freeze({ sync: settle });
})();
