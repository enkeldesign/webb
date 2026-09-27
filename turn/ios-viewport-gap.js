// iOS standalone viewport gap. On some iPhones the installed app is laid out one
// status-bar inset shorter than the screen (portrait: client/dvh 793 of lvh 852,
// top inset 59) while it paints from the very top, so a strip of the root
// background shows below the app. The viewport meta pulse in
// pwa-short-viewport-repair-r184.js does not recover this case, and iOS draws no
// page content in the strip, so it takes the colour of the screen above it:
// Paper under Home and The Lot (their docks are Paper), Ink under a race.
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
  const SETTLE_DELAYS_MS = Object.freeze([0, 120, 400, 900, 1600, 2600]);

  // iOS paints nothing but the root background below the short layout viewport:
  // moving content down there only clips it (1.24.5). So the strip takes the
  // colour of the screen above it instead. The r181 boundary paints it cyan.
  const style = document.createElement('style');
  style.id = 'turn-viewport-gap-style';
  style.textContent = `
    html.${CLASS}:has(body.turn-race-active) {
      background: #08090a !important;
    }
    html.${CLASS}:has(body:is(.turn-home-open, .turn-lot-open)) {
      background: var(--turn-surface-page, #fff8e8) !important;
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
    // iOS settles its viewport numbers late after a rotation; measure again after it.
    timers = SETTLE_DELAYS_MS.map((delay) => window.setTimeout(sync, delay));
  }

  for (const eventName of ['resize', 'orientationchange', 'pageshow']) {
    window.addEventListener(eventName, settle, { passive: true });
  }
  window.visualViewport?.addEventListener('resize', settle, { passive: true });
  window.matchMedia?.('(orientation: portrait)').addEventListener?.('change', settle);
  if (document.body) settle();
  else document.addEventListener('DOMContentLoaded', settle, { once: true });

  globalThis.__turnViewportGap = Object.freeze({ sync: settle });
})();
