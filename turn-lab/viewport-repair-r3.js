(() => {
  const BAD_GAP_MIN = 40;
  const META_PULSE_MS = 120;
  const CHECKPOINTS_MS = Object.freeze([0, 80, 250, 650]);
  const startedAt = performance.now();
  let lastResult = null;

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
      Math.abs(sample.clientH - sample.dvh) <= 2
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

  async function runMetaReflow(status, signatureText, button) {
    if (button.disabled) return;
    button.disabled = true;

    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      status.textContent = 'Viewport meta tag not found.';
      button.disabled = false;
      return;
    }

    const before = snapshot('before');
    signatureText.textContent = classification(before);
    if (!hasBadSignature(before)) {
      status.textContent = 'Not in the known BAD 393/462 signature. No repair was run.';
      button.disabled = false;
      return;
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

    window.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('resize', onVisualResize);

    const after = checkpoints.at(-1) || snapshot('after');
    const recovered = !hasBadSignature(after) &&
      after.clientH >= before.clientH + BAD_GAP_MIN &&
      after.gap < 20;

    lastResult = {
      lab: 'TURN viewport repair bench r3',
      productionBuild: globalThis.__TURN_BUILD__ || null,
      standalone: isStandalone(),
      originalMeta: original,
      pulseMeta: pulse,
      pulseMs: META_PULSE_MS,
      before,
      checkpoints,
      events,
      outcome: recovered ? 'RECOVERED' : 'STILL_BAD'
    };
    globalThis.__turnLabViewportRepairResult = lastResult;

    signatureText.textContent = classification(after);
    status.textContent = recovered
      ? 'RECOVERED: WebKit expanded the reachable viewport without rotating. Copy the repair result.'
      : 'STILL BAD: viewport-meta reflow did not recover the missing height. Copy the repair result.';
    button.disabled = false;
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
      <strong>REPAIR BENCH r3</strong>
      <div data-lab-repair-signature style="margin:6px 0"></div>
      <button type="button" data-lab-meta-reflow>TRY VIEWPORT REFLOW</button>
      <button type="button" data-lab-copy-repair>COPY REPAIR RESULT</button>`;
    actions.after(bench);

    const signatureText = bench.querySelector('[data-lab-repair-signature]');
    const reflowButton = bench.querySelector('[data-lab-meta-reflow]');
    const copyButton = bench.querySelector('[data-lab-copy-repair]');
    signatureText.textContent = classification();

    reflowButton.addEventListener('click', () => runMetaReflow(status, signatureText, reflowButton));
    copyButton.addEventListener('click', async () => {
      if (!lastResult) {
        status.textContent = 'Run TRY VIEWPORT REFLOW first.';
        return;
      }
      const copied = await copyText(JSON.stringify(lastResult, null, 2));
      status.textContent = copied ? 'Copied compact repair result.' : 'Copy failed.';
    });

    const labButton = document.querySelector('#turnLabDiagnosticsButton');
    labButton?.addEventListener('click', () => {
      signatureText.textContent = classification();
    });
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForBench, { once: true });
  } else {
    waitForBench();
  }
})();
