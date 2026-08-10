const BAD_GAP_MIN = 40;
const RECOVERED_GAP_MAX = 20;
const AUTO_SETTLE_MS = 160;
const AUTO_CONFIRM_MS = 90;
const INTERACTION_CONFIRM_MS = 40;
const META_PULSE_MS = 120;
const VERIFY_MS = 80;
const INSTALL_KEY = '__turnShortViewportRepairR184';

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isStandalone() {
  return document.documentElement.classList.contains('turn-standalone') ||
    Boolean(window.matchMedia?.('(display-mode: standalone)').matches) ||
    Boolean(window.matchMedia?.('(display-mode: fullscreen)').matches) ||
    navigator.standalone === true;
}

function measureHeight(value) {
  if (!document.body) return 0;
  const probe = document.createElement('i');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `position:fixed;left:-10000px;top:-10000px;display:block;width:1px;height:${value};visibility:hidden;pointer-events:none;`;
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

function sampleViewport() {
  const viewport = window.visualViewport;
  const dvh = measureHeight('100dvh');
  const lvh = measureHeight('100lvh');
  return Object.freeze({
    landscape: Boolean(window.matchMedia?.('(orientation: landscape)').matches),
    innerH: Number(window.innerHeight) || 0,
    clientH: Number(document.documentElement.clientHeight) || 0,
    visualH: Number(viewport?.height) || 0,
    dvh,
    lvh,
    gap: lvh - dvh
  });
}

function hasBadSignature(sample) {
  return Boolean(
    isStandalone() &&
    sample?.landscape &&
    sample.gap >= BAD_GAP_MIN &&
    Math.abs(sample.clientH - sample.dvh) <= 2 &&
    Math.abs(sample.visualH - sample.dvh) <= 2
  );
}

function homeIsUsable(home) {
  if (!home?.isConnected || document.visibilityState !== 'visible') return false;
  const style = getComputedStyle(home);
  const rect = home.getBoundingClientRect();
  return !home.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

export function installShortViewportAutoRepair({ home } = {}) {
  if (!home || !isStandalone()) return null;
  if (globalThis[INSTALL_KEY]) return globalThis[INSTALL_KEY];

  const root = document.documentElement;
  let repairInFlight = false;
  let autoTimer = 0;
  let incidentActive = false;
  let autoAttempted = false;
  let interactionAttempted = false;

  function resetIncident() {
    incidentActive = false;
    autoAttempted = false;
    interactionAttempted = false;
  }

  function observe(sample = sampleViewport()) {
    if (hasBadSignature(sample)) {
      incidentActive = true;
      return sample;
    }
    if (incidentActive && sample.gap < RECOVERED_GAP_MAX) resetIncident();
    return sample;
  }

  async function pulseViewportMeta(trigger) {
    if (repairInFlight || !homeIsUsable(home)) return false;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return false;

    const before = observe();
    if (!hasBadSignature(before)) return false;

    repairInFlight = true;
    const original = meta.getAttribute('content') || '';
    const pulse = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no';
    root.dataset.turnViewportRepair = `trying-${trigger}`;

    try {
      meta.setAttribute('content', pulse);
      void root.clientHeight;
      await delay(META_PULSE_MS);
      meta.setAttribute('content', original);
      void root.clientHeight;
      await delay(VERIFY_MS);

      const after = observe();
      const recovered = !hasBadSignature(after) &&
        after.clientH >= before.clientH + BAD_GAP_MIN &&
        after.gap < RECOVERED_GAP_MAX;
      root.dataset.turnViewportRepair = recovered ? 'recovered' : 'still-bad';
      globalThis.__turnShortViewportRepairResult = Object.freeze({
        trigger,
        recovered,
        before: Object.freeze({ clientH: before.clientH, dvh: before.dvh, lvh: before.lvh, gap: before.gap }),
        after: Object.freeze({ clientH: after.clientH, dvh: after.dvh, lvh: after.lvh, gap: after.gap })
      });
      if (recovered) resetIncident();
      return recovered;
    } finally {
      meta.setAttribute('content', original);
      repairInFlight = false;
    }
  }

  async function confirmAndRepair(trigger, confirmMs) {
    if (repairInFlight || !homeIsUsable(home)) return false;
    const first = observe();
    if (!hasBadSignature(first)) return false;
    await delay(confirmMs);
    if (repairInFlight || !homeIsUsable(home)) return false;
    const confirmed = observe();
    if (!hasBadSignature(confirmed)) return false;
    return pulseViewportMeta(trigger);
  }

  function scheduleSettledAutoRepair(reason) {
    if (autoTimer) window.clearTimeout(autoTimer);
    autoTimer = window.setTimeout(async () => {
      autoTimer = 0;
      if (!homeIsUsable(home)) return;
      const sample = observe();
      if (!hasBadSignature(sample) || autoAttempted) return;
      autoAttempted = true;
      await confirmAndRepair(reason, AUTO_CONFIRM_MS);
    }, AUTO_SETTLE_MS);
  }

  function onFirstHomeActivation() {
    window.setTimeout(async () => {
      if (repairInFlight || !homeIsUsable(home)) return;
      const sample = observe();
      if (!hasBadSignature(sample) || interactionAttempted) return;
      interactionAttempted = true;
      await confirmAndRepair('first-home-activation', INTERACTION_CONFIRM_MS);
    }, 0);
  }

  home.addEventListener('click', onFirstHomeActivation, { passive: true });

  document.addEventListener('turn:home-ready', () => {
    scheduleSettledAutoRepair('home-ready');
  });
  window.addEventListener('pageshow', () => {
    scheduleSettledAutoRepair('pageshow');
  }, { passive: true });
  window.addEventListener('focus', () => {
    scheduleSettledAutoRepair('focus');
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleSettledAutoRepair('visibility-visible');
  }, { passive: true });

  if (root.classList.contains('turn-home-ready')) {
    scheduleSettledAutoRepair('already-home-ready');
  }

  const api = Object.freeze({
    sample: sampleViewport,
    hasBadSignature,
    repairNow: () => confirmAndRepair('manual-api', 0)
  });
  globalThis[INSTALL_KEY] = api;
  return api;
}
