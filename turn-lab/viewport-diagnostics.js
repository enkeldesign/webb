(() => {
  const STORAGE_KEY = 'turn-lab-viewport-surgical-recorder-v2';
  const MAX_SESSIONS = 8;
  const MAX_SAMPLES = 18;
  const STARTUP_DELAYS_MS = Object.freeze([0, 50, 100, 200, 350, 600, 1000, 1600, 2500, 4000, 6000]);
  const EVENT_WINDOW_MS = 7000;
  const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = performance.now();

  function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (parsed && parsed.version === 2 && Array.isArray(parsed.sessions)) return parsed;
    } catch (_) {}
    return { version: 2, sessions: [] };
  }

  function writeStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (_) {}
  }

  const store = readStore();
  const session = {
    id: sessionId,
    startedAt: new Date().toISOString(),
    label: '',
    markedAt: '',
    markedAtMs: 0,
    userAgent: navigator.userAgent || '',
    dpr: Number(window.devicePixelRatio) || 1,
    samples: [],
    mark: null
  };
  store.sessions.push(session);
  if (store.sessions.length > MAX_SESSIONS) {
    store.sessions.splice(0, store.sessions.length - MAX_SESSIONS);
  }
  writeStore(store);

  function rectFor(selector) {
    const element = document.querySelector(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return [round(rect.width), round(rect.height), round(rect.x), round(rect.y), round(rect.bottom)];
  }

  let unitProbe = null;

  function ensureUnitProbe() {
    if (unitProbe?.isConnected) return unitProbe;
    if (!document.body) return null;

    unitProbe = document.createElement('div');
    unitProbe.id = 'turnLabViewportUnitProbe';
    unitProbe.hidden = true;
    unitProbe.setAttribute('aria-hidden', 'true');
    unitProbe.innerHTML = `
      <i data-vh style="position:fixed;height:100vh;width:1px"></i>
      <i data-dvh style="position:fixed;height:100dvh;width:1px"></i>
      <i data-svh style="position:fixed;height:100svh;width:1px"></i>
      <i data-lvh style="position:fixed;height:100lvh;width:1px"></i>
      <i data-vw style="position:fixed;width:100vw;height:1px"></i>
      <i data-dvw style="position:fixed;width:100dvw;height:1px"></i>
      <i data-safe style="position:fixed;padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)"></i>`;
    document.body.appendChild(unitProbe);
    return unitProbe;
  }

  function viewportUnitSnapshot() {
    const probe = ensureUnitProbe();
    if (!probe) return null;

    function height(name) {
      return round(probe.querySelector(`[data-${name}]`)?.getBoundingClientRect().height || 0);
    }

    function width(name) {
      return round(probe.querySelector(`[data-${name}]`)?.getBoundingClientRect().width || 0);
    }

    const safeStyle = getComputedStyle(probe.querySelector('[data-safe]'));
    return {
      h: [height('vh'), height('dvh'), height('svh'), height('lvh')],
      w: [width('vw'), width('dvw')],
      safe: [
        round(parseFloat(safeStyle.paddingTop)),
        round(parseFloat(safeStyle.paddingRight)),
        round(parseFloat(safeStyle.paddingBottom)),
        round(parseFloat(safeStyle.paddingLeft))
      ]
    };
  }

  function orientationSnapshot() {
    const landscapeMedia = Boolean(window.matchMedia?.('(orientation: landscape)').matches);
    return {
      type: screen.orientation?.type || '',
      angle: Number(screen.orientation?.angle ?? window.orientation ?? 0) || 0,
      media: landscapeMedia ? 'landscape' : 'portrait'
    };
  }

  function currentSnapshot(reason) {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const production = globalThis.__turnPwaViewportDiagnostics;
    const units = viewportUnitSnapshot();

    return {
      t: round(performance.now() - startedAt),
      reason,
      orientation: orientationSnapshot(),
      screen: [Number(screen.width) || 0, Number(screen.height) || 0],
      outer: [Number(window.outerWidth) || 0, Number(window.outerHeight) || 0],
      inner: [Number(window.innerWidth) || 0, Number(window.innerHeight) || 0],
      client: [Number(root.clientWidth) || 0, Number(root.clientHeight) || 0],
      visual: viewport ? [
        round(viewport.width),
        round(viewport.height),
        round(viewport.offsetLeft),
        round(viewport.offsetTop),
        round(viewport.scale, 3)
      ] : null,
      units,
      body: document.body ? rectFor('body') : null,
      game: rectFor('#game'),
      home: rectFor('.m8-home'),
      rotate: rectFor('.rotate-panel'),
      loading: rectFor('#installGate'),
      production: production ? [
        Number(production.width) || 0,
        Number(production.height) || 0,
        Number(production.innerWidth) || 0,
        Number(production.innerHeight) || 0,
        Number(production.visualWidth) || 0,
        Number(production.visualHeight) || 0
      ] : null,
      visibility: document.visibilityState
    };
  }

  function measurementSignature(snapshot) {
    return JSON.stringify({
      orientation: snapshot.orientation,
      screen: snapshot.screen,
      outer: snapshot.outer,
      inner: snapshot.inner,
      client: snapshot.client,
      visual: snapshot.visual,
      units: snapshot.units,
      body: snapshot.body,
      game: snapshot.game,
      home: snapshot.home,
      rotate: snapshot.rotate,
      loading: snapshot.loading,
      production: snapshot.production,
      visibility: snapshot.visibility
    });
  }

  function saveSample(reason, { force = false } = {}) {
    const liveStore = readStore();
    const liveSession = liveStore.sessions.find((item) => item.id === sessionId);
    if (!liveSession) return;

    const snapshot = currentSnapshot(reason);
    const latest = liveSession.samples.at(-1);
    if (!force && latest && measurementSignature(latest) === measurementSignature(snapshot)) {
      latest.reason = `${latest.reason}|${reason}`;
      latest.t = snapshot.t;
    } else {
      liveSession.samples.push(snapshot);
      if (liveSession.samples.length > MAX_SAMPLES) {
        liveSession.samples.splice(0, liveSession.samples.length - MAX_SAMPLES);
      }
    }
    writeStore(liveStore);
    updatePanel();
  }

  function withinStartupWindow() {
    return performance.now() - startedAt <= EVENT_WINDOW_MS;
  }

  function captureStartupEvent(reason) {
    if (!withinStartupWindow()) return;
    saveSample(reason);
  }

  for (const eventName of ['resize', 'orientationchange', 'pageshow', 'focus']) {
    window.addEventListener(eventName, () => captureStartupEvent(eventName), { passive: true });
  }
  screen.orientation?.addEventListener?.('change', () => captureStartupEvent('screen.orientation.change'), { passive: true });
  window.visualViewport?.addEventListener('resize', () => captureStartupEvent('visualViewport.resize'), { passive: true });
  document.addEventListener('visibilitychange', () => captureStartupEvent(`visibility:${document.visibilityState}`), { passive: true });
  document.addEventListener('DOMContentLoaded', () => captureStartupEvent('DOMContentLoaded'), { once: true });
  window.addEventListener('load', () => captureStartupEvent('load'), { once: true });
  window.addEventListener('turn:runtime-ready', () => captureStartupEvent('turn:runtime-ready'));
  document.addEventListener('turn:home-ready', () => captureStartupEvent('turn:home-ready'));

  for (const delay of STARTUP_DELAYS_MS) {
    setTimeout(() => saveSample(`startup+${delay}`), delay);
  }

  function latestSnapshot() {
    const liveStore = readStore();
    const liveSession = liveStore.sessions.find((item) => item.id === sessionId);
    return liveSession?.mark || liveSession?.samples.at(-1) || null;
  }

  function compactSummary(snapshot) {
    if (!snapshot) return 'No samples yet.';
    const units = snapshot.units;
    return [
      'SURGICAL RECORDER r2',
      `SESSION ${sessionId}`,
      `orientation: ${snapshot.orientation.type || snapshot.orientation.media} · ${snapshot.orientation.angle}° · ${snapshot.orientation.media}`,
      `screen: ${snapshot.screen.join('×')}`,
      `outer: ${snapshot.outer.join('×')}`,
      `inner: ${snapshot.inner.join('×')}`,
      `client: ${snapshot.client.join('×')}`,
      `visual: ${snapshot.visual ? `${snapshot.visual[0]}×${snapshot.visual[1]} scale ${snapshot.visual[4]}` : 'n/a'}`,
      `viewport heights vh/dvh/svh/lvh: ${units ? units.h.join('/') : 'n/a'}`,
      `safe insets T/R/B/L: ${units ? units.safe.join('/') : 'n/a'}`,
      `#game: ${snapshot.game ? `${snapshot.game[0]}×${snapshot.game[1]}` : 'n/a'}`,
      `.m8-home: ${snapshot.home ? `${snapshot.home[0]}×${snapshot.home[1]}` : 'n/a'}`,
      `last sample: ${snapshot.reason} @ ${snapshot.t}ms`
    ].join('\n');
  }

  let panel = null;
  let summary = null;
  let labButton = null;

  function updatePanel() {
    if (!summary) return;
    summary.textContent = compactSummary(latestSnapshot() || currentSnapshot('panel'));
  }

  function markSession(label) {
    const liveStore = readStore();
    const liveSession = liveStore.sessions.find((item) => item.id === sessionId);
    if (!liveSession) return;

    liveSession.label = label;
    liveSession.markedAt = new Date().toISOString();
    liveSession.markedAtMs = round(performance.now() - startedAt);
    liveSession.mark = currentSnapshot(`marked:${label}`);
    writeStore(liveStore);

    if (labButton) labButton.textContent = label === 'BAD' ? 'LAB BAD' : 'LAB GOOD';
    updatePanel();
  }

  function ensureLayerStyle() {
    let style = document.querySelector('#turn-lab-layer-colors');
    if (style) return style;
    style = document.createElement('style');
    style.id = 'turn-lab-layer-colors';
    style.textContent = `
      html.turn-lab-show-layers { background: #ff2d55 !important; }
      html.turn-lab-show-layers body { background: #32d74b !important; }
      html.turn-lab-show-layers #game { background: #0a84ff !important; }
      html.turn-lab-show-layers .m8-home { box-shadow: inset 0 0 0 7px #ff9f0a !important; }
      html.turn-lab-show-layers .rotate-panel { box-shadow: inset 0 0 0 7px #ffffff !important; }
      html.turn-lab-show-layers #installGate { box-shadow: inset 0 0 0 7px #bf5af2 !important; }
    `;
    document.head.appendChild(style);
    return style;
  }

  function toggleLayers(button) {
    ensureLayerStyle();
    const enabled = document.documentElement.classList.toggle('turn-lab-show-layers');
    button.textContent = enabled ? 'NORMAL COLORS' : 'COLOR LAYERS';
  }

  function mostRecentMarkedSessions(sessions) {
    const selected = [];
    for (const label of ['GOOD', 'BAD']) {
      const match = [...sessions].reverse().find((item) => item.label === label);
      if (match) selected.push(match);
    }
    return selected.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  }

  async function copyLog(status) {
    const liveStore = readStore();
    const results = mostRecentMarkedSessions(liveStore.sessions);
    if (!results.length) {
      status.textContent = 'Mark this launch GOOD or BAD first.';
      return;
    }

    const payload = {
      lab: 'TURN viewport surgical recorder r2',
      productionBuild: globalThis.__TURN_BUILD__ || null,
      copiedAt: new Date().toISOString(),
      legend: {
        rect: '[width,height,x,y,bottom]',
        visual: '[width,height,offsetLeft,offsetTop,scale]',
        unitsH: '[100vh,100dvh,100svh,100lvh]',
        unitsW: '[100vw,100dvw]',
        safe: '[top,right,bottom,left]',
        production: '[width,height,innerWidth,innerHeight,visualWidth,visualHeight]'
      },
      results
    };
    const text = JSON.stringify(payload, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      status.textContent = `Copied ${results.map((item) => item.label).join(' + ')} result${results.length === 1 ? '' : 's'}.`;
      return;
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
    status.textContent = copied ? 'Copied surgical log.' : 'Copy failed.';
  }

  function clearLog(status) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    status.textContent = 'Saved surgical history cleared. Reload to start fresh.';
  }

  function installUi() {
    if (document.querySelector('#turnLabDiagnosticsButton')) return;

    const style = document.createElement('style');
    style.textContent = `
      #turnLabDiagnosticsButton {
        position: fixed;
        z-index: 2147483646;
        top: max(8px, env(safe-area-inset-top));
        right: max(8px, env(safe-area-inset-right));
        min-width: 72px;
        min-height: 44px;
        padding: 8px 10px;
        border: 3px solid #08090a;
        border-radius: 14px;
        background: #ffd43b;
        color: #08090a;
        font: 900 13px/1 system-ui, sans-serif;
        box-shadow: 4px 4px 0 #08090a;
      }
      #turnLabDiagnosticsPanel {
        position: fixed;
        z-index: 2147483647;
        inset: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
        overflow: auto;
        padding: 16px;
        border: 4px solid #08090a;
        border-radius: 18px;
        background: #fff8e8;
        color: #08090a;
        box-shadow: 8px 8px 0 #08090a;
        font: 700 14px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      #turnLabDiagnosticsPanel[hidden] { display: none !important; }
      #turnLabDiagnosticsPanel h2 { margin: 0 0 10px; font: 1000 24px/1 system-ui, sans-serif; }
      #turnLabDiagnosticsPanel pre { white-space: pre-wrap; overflow-wrap: anywhere; }
      #turnLabDiagnosticsPanel .turn-lab-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
      #turnLabDiagnosticsPanel button { min-height: 44px; padding: 8px 12px; background: #ffd43b; color: #08090a; }
      #turnLabDiagnosticsPanel [data-lab-bad] { background: #ff8fab; }
      #turnLabDiagnosticsPanel [data-lab-good] { background: #8ce99a; }
      #turnLabDiagnosticsPanel .turn-lab-status { min-height: 1.4em; margin: 8px 0 0; }
    `;
    document.head.appendChild(style);

    labButton = document.createElement('button');
    labButton.id = 'turnLabDiagnosticsButton';
    labButton.type = 'button';
    labButton.textContent = 'LAB r2';
    labButton.setAttribute('aria-label', 'Open TURN surgical viewport diagnostics');

    panel = document.createElement('section');
    panel.id = 'turnLabDiagnosticsPanel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'turnLabDiagnosticsTitle');
    panel.innerHTML = `
      <h2 id="turnLabDiagnosticsTitle">TURN VIEWPORT LAB r2</h2>
      <p>Cold-launch in landscape. Mark the launch while you can still see whether the strip is present. COPY LOG exports only the newest GOOD and BAD results.</p>
      <pre data-lab-summary></pre>
      <div class="turn-lab-actions">
        <button type="button" data-lab-bad>MARK BAD</button>
        <button type="button" data-lab-good>MARK GOOD</button>
        <button type="button" data-lab-layers>COLOR LAYERS</button>
        <button type="button" data-lab-copy>COPY LOG</button>
        <button type="button" data-lab-clear>CLEAR HISTORY</button>
        <button type="button" data-lab-close>CLOSE</button>
      </div>
      <p class="turn-lab-status" role="status" aria-live="polite"></p>
    `;
    summary = panel.querySelector('[data-lab-summary]');
    const status = panel.querySelector('.turn-lab-status');

    labButton.addEventListener('click', () => {
      panel.hidden = false;
      updatePanel();
      panel.querySelector('[data-lab-bad]')?.focus();
    });
    panel.querySelector('[data-lab-close]').addEventListener('click', () => {
      panel.hidden = true;
      labButton.focus();
    });
    panel.querySelector('[data-lab-bad]').addEventListener('click', () => markSession('BAD'));
    panel.querySelector('[data-lab-good]').addEventListener('click', () => markSession('GOOD'));
    panel.querySelector('[data-lab-layers]').addEventListener('click', (event) => toggleLayers(event.currentTarget));
    panel.querySelector('[data-lab-copy]').addEventListener('click', () => copyLog(status));
    panel.querySelector('[data-lab-clear]').addEventListener('click', () => clearLog(status));

    document.body.append(labButton, panel);
    updatePanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installUi, { once: true });
  } else {
    installUi();
  }

  saveSample('script-start', { force: true });
})();