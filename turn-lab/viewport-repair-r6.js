(() => {
  const BAD_GAP_MIN = 40;
  const META_PULSE_MS = 120;
  const CHECKPOINTS_MS = Object.freeze([0, 80, 250, 650]);
  const AUTO_CONFIRM_MS = 90;
  const AUTO_COOLDOWN_MS = 1200;
  const STARTUP_CHECKS_MS = Object.freeze([120, 240, 400, 650, 1000, 1600, 2500, 4000, 6000, 8000, 10000]);
  const LIFECYCLE_SETTLE_MS = Object.freeze([0, 120, 350]);
  const startedAt = performance.now();
  let lastResult = null;
  let repairInFlight = false;
  let autoConfirmationTimer = 0;
  let incidentArmed = true;
  let lastAutoAttemptAt = -Infinity;

  function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function measureHeight(value) {
    if (!document.body) return 0;
    const probe = document.createElement('i');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = `position:fixed;left:-10000px;top:-10000px;display:block;width:1px;height:${value};visibility:hidden;pointer-events:none;`;
    document.body.appendChild(probe);
    const height = round(probe.getBoundingClientRect().height);
    probe.remove();
    return height;
  }

  function snapshot(reason) {
    const viewport = window.visualViewport;
    const game = document.querySelector('#game')?.getBoundingClientRect();
    const dvh = measureHeight('100dvh');
    const lvh = measureHeight('100lvh');
    return {
      t: round(performance.now() - startedAt),
      reason,
      landscape: Boolean(window.matchMedia?.('(orientation: landscape)').matches),
      innerH: Number(window.innerHeight) || 0,
      clientH: Number(document.documentElement.clientHeight) || 0,
      visualH: round(viewport?.height || 0),
      visualScale: round(viewport?.scale || 0, 3),
      dvh,
      lvh,
      gap: round(lvh - dvh),
      gameH: round(game?.height || 0)
    };
  }

  function isStandalone() {
    return document.documentElement.classList.contains('turn-standalone') ||
      Boolean(window.matchMedia?.('(display-mode: standalone)').matches) ||
      navigator.standalone === true;
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

  function classification(sample = snapshot('classify')) {
    return hasBadSignature(sample)
      ? `BAD signature · ${round(sample.gap)}px missing`
      : `GOOD/other signature · ${round(sample.gap)}px lvh-dvh gap`;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) {}
    textarea.remove();
    return copied;
  }

  function benchUi() {
    const panel = document.querySelector('#turnLabDiagnosticsPanel');
    const bench = panel?.querySelector('[data-lab-repair-bench]');
    return {
      status: panel?.querySelector('.turn-lab-status') || null,
      signatureText: bench?.querySelector('[data-lab-repair-signature]') || null,
      reflowButton: bench?.querySelector('[data-lab-meta-reflow]') || null,
      copyButton: bench?.querySelector('[data-lab-copy-repair]') || null
    };
  }

  function syncBenchUi(sample = null) {
    const ui = benchUi();
    if (ui.signatureText) ui.signatureText.textContent = classification(sample || undefined);
    if (ui.reflowButton) ui.reflowButton.disabled = repairInFlight;
    if (ui.copyButton) ui.copyButton.disabled = repairInFlight || !lastResult;
    return ui;
  }

  async function runMetaReflow({ trigger = 'manual' } = {}) {
    if (repairInFlight) return null;

    const meta = document.querySelector('meta[name="viewport"]');
    const ui = syncBenchUi();
    if (!meta) {
      if (ui.status) ui.status.textContent = 'Viewport meta tag not found.';
      return null;
    }

    const before = snapshot('before');
    if (ui.signatureText) ui.signatureText.textContent = classification(before);
    if (!hasBadSignature(before)) {
      incidentArmed = true;
      if (ui.status && trigger === 'manual') {
        ui.status.textContent = 'Not in the known BAD 393/462 signature. No repair was run.';
      }
      return null;
    }

    repairInFlight = true;
    syncBenchUi(before);
    if (ui.status) {
      ui.status.textContent = trigger === 'auto'
        ? 'Known BAD viewport detected. Verifying automatic repair…'
        : 'Repairing viewport and verifying the result…';
    }

    const original = meta.getAttribute('content') || '';
    const events = [];
    const noteEvent = (name) => {
      if (events.length < 12) events.push(`${name}@${round(performance.now() - startedAt)}ms`);
    };
    const onResize = () => noteEvent('resize');
    const onVisualResize = () => noteEvent('visualViewport.resize');
    window.addEventListener('resize', onResize, { passive: true });
    window.visualViewport?.addEventListener('resize', onVisualResize, { passive: true });

    const pulse = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no';
    try {
      meta.setAttribute('content', pulse);
      void document.documentElement.clientHeight;
      await delay(META_PULSE_MS);
      meta.setAttribute('content', original);
      void document.documentElement.clientHeight;

      const checkpoints = [];
      let elapsed = 0;
      for (const target of CHECKPOINTS_MS) {
        const wait = Math.max(0, target - elapsed);
        if (wait) await delay(wait);
        elapsed = target;
        checkpoints.push(snapshot(`after+${target}`));
      }

      const after = checkpoints.at(-1) || snapshot('after');
      const recovered = !hasBadSignature(after) &&
        after.clientH >= before.clientH + BAD_GAP_MIN &&
        after.gap < 20;

      incidentArmed = recovered;
      lastResult = {
        lab: 'TURN viewport repair bench r6 lifecycle watchdog',
        productionBuild: globalThis.__TURN_BUILD__ || null,
        standalone: isStandalone(),
        trigger,
        originalMeta: original,
        pulseMeta: pulse,
        pulseMs: META_PULSE_MS,
        before,
        checkpoints,
        events,
        outcome: recovered ? 'RECOVERED' : 'STILL_BAD'
      };
      globalThis.__turnLabViewportRepairResult = lastResult;
      globalThis.__turnLabViewportAutoRepairResult = trigger === 'auto' ? lastResult : null;

      const currentUi = benchUi();
      if (currentUi.signatureText) currentUi.signatureText.textContent = classification(after);
      if (currentUi.status) {
        currentUi.status.textContent = recovered
          ? `${trigger === 'auto' ? 'AUTO-RECOVERED' : 'RECOVERED'}: WebKit restored the full reachable viewport.`
          : `${trigger === 'auto' ? 'AUTO REPAIR FAILED' : 'STILL BAD'}: viewport-meta reflow did not recover the missing height.`;
      }
      window.dispatchEvent(new CustomEvent('turn-lab:viewport-repair-result', {
        detail: { trigger, outcome: lastResult.outcome }
      }));
      return lastResult;
    } finally {
      meta.setAttribute('content', original);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onVisualResize);
      repairInFlight = false;
      syncBenchUi();
    }
  }

  function installRepairBench() {
    const panel = document.querySelector('#turnLabDiagnosticsPanel');
    if (!panel || panel.querySelector('[data-lab-repair-bench]')) return false;

    const status = panel.querySelector('.turn-lab-status');
    const actions = panel.querySelector('.turn-lab-actions');
    if (!status || !actions) return false;

    const bench = document.createElement('div');
    bench.dataset.labRepairBench = '';
    bench.style.cssText = 'width:100%;margin:10px 0 0;padding-top:10px;border-top:3px solid #08090a;';
    bench.innerHTML = `
      <strong>REPAIR BENCH r6 · LIFECYCLE WATCHDOG ARMED</strong>
      <div data-lab-repair-signature style="margin:6px 0"></div>
      <button type="button" data-lab-meta-reflow>TRY VIEWPORT REFLOW</button>
      <button type="button" data-lab-copy-repair disabled>COPY REPAIR RESULT</button>`;
    actions.after(bench);

    const signatureText = bench.querySelector('[data-lab-repair-signature]');
    const reflowButton = bench.querySelector('[data-lab-meta-reflow]');
    const copyButton = bench.querySelector('[data-lab-copy-repair]');
    signatureText.textContent = classification();

    reflowButton.addEventListener('click', () => runMetaReflow({ trigger: 'manual' }));
    copyButton.addEventListener('click', async () => {
      if (repairInFlight) {
        status.textContent = 'Repair is still verifying. COPY REPAIR RESULT will enable when it is finished.';
        return;
      }
      const result = lastResult || globalThis.__turnLabViewportRepairResult || null;
      if (!result) {
        status.textContent = 'No repair result yet.';
        return;
      }
      const copied = await copyText(JSON.stringify(result, null, 2));
      status.textContent = copied ? 'Copied compact repair result.' : 'Copy failed.';
    });

    const labButton = document.querySelector('#turnLabDiagnosticsButton');
    labButton?.addEventListener('click', () => syncBenchUi());
    syncBenchUi();
    return true;
  }

  function waitForBench() {
    if (installRepairBench()) return;
    const observer = new MutationObserver(() => {
      if (!installRepairBench()) return;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function confirmAutoRepair(reason) {
    if (repairInFlight || autoConfirmationTimer || !document.body) return;

    const first = snapshot(`auto-watch:${reason}`);
    if (!hasBadSignature(first)) {
      incidentArmed = true;
      return;
    }
    if (!incidentArmed) return;
    if (performance.now() - lastAutoAttemptAt < AUTO_COOLDOWN_MS) return;

    autoConfirmationTimer = window.setTimeout(() => {
      autoConfirmationTimer = 0;
      if (repairInFlight || !document.body) return;
      const confirmed = snapshot(`auto-confirm:${reason}`);
      if (!hasBadSignature(confirmed)) {
        incidentArmed = true;
        return;
      }
      if (!incidentArmed) return;
      incidentArmed = false;
      lastAutoAttemptAt = performance.now();
      runMetaReflow({ trigger: 'auto' });
    }, AUTO_CONFIRM_MS);
  }

  function scheduleLifecycleChecks(reason) {
    for (const delayMs of LIFECYCLE_SETTLE_MS) {
      window.setTimeout(() => confirmAutoRepair(`${reason}+${delayMs}`), delayMs);
    }
  }

  function onWatchdogEvent(event) {
    if (repairInFlight) return;
    scheduleLifecycleChecks(event?.type || 'event');
  }

  for (const delayMs of STARTUP_CHECKS_MS) {
    setTimeout(() => confirmAutoRepair(`startup+${delayMs}`), delayMs);
  }

  window.addEventListener('resize', onWatchdogEvent, { passive: true });
  window.addEventListener('orientationchange', onWatchdogEvent, { passive: true });
  window.addEventListener('pageshow', onWatchdogEvent, { passive: true });
  window.addEventListener('focus', onWatchdogEvent, { passive: true });
  window.visualViewport?.addEventListener('resize', onWatchdogEvent, { passive: true });
  window.addEventListener('turn:runtime-ready', onWatchdogEvent);
  window.addEventListener('turn:home-ready', onWatchdogEvent);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (autoConfirmationTimer) {
        clearTimeout(autoConfirmationTimer);
        autoConfirmationTimer = 0;
      }
      incidentArmed = true;
      return;
    }
    scheduleLifecycleChecks('visibility:visible');
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForBench, { once: true });
  } else {
    waitForBench();
  }
})();
