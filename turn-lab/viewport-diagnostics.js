(() => {
  const STORAGE_KEY = 'turn-lab-viewport-flight-recorder-v1';
  const MAX_SESSIONS = 8;
  const MAX_SNAPSHOTS = 90;
  const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = performance.now();

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (parsed && Array.isArray(parsed.sessions)) return parsed;
    } catch (_) {}
    return { version: 1, sessions: [] };
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
    userAgent: navigator.userAgent || '',
    snapshots: []
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
    return {
      x: Math.round(rect.x * 10) / 10,
      y: Math.round(rect.y * 10) / 10,
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
      right: Math.round(rect.right * 10) / 10,
      bottom: Math.round(rect.bottom * 10) / 10,
      hidden: element.hidden === true,
      display: getComputedStyle(element).display
    };
  }

  function orientationSnapshot() {
    return {
      type: screen.orientation?.type || '',
      angle: Number(screen.orientation?.angle ?? window.orientation ?? 0) || 0,
      portraitMedia: Boolean(window.matchMedia?.('(orientation: portrait)').matches),
      landscapeMedia: Boolean(window.matchMedia?.('(orientation: landscape)').matches)
    };
  }

  function currentSnapshot(reason) {
    const root = document.documentElement;
    const body = document.body;
    const viewport = window.visualViewport;
    const rootStyle = getComputedStyle(root);
    const bodyStyle = body ? getComputedStyle(body) : null;
    const snapshot = {
      reason,
      atMs: Math.round((performance.now() - startedAt) * 10) / 10,
      wallTime: new Date().toISOString(),
      standalone:
        root.classList.contains('turn-standalone') ||
        Boolean(window.matchMedia?.('(display-mode: standalone)').matches) ||
        navigator.standalone === true,
      visibility: document.visibilityState,
      dpr: Number(window.devicePixelRatio) || 1,
      orientation: orientationSnapshot(),
      screen: {
        width: Number(screen.width) || 0,
        height: Number(screen.height) || 0,
        availWidth: Number(screen.availWidth) || 0,
        availHeight: Number(screen.availHeight) || 0
      },
      window: {
        innerWidth: Number(window.innerWidth) || 0,
        innerHeight: Number(window.innerHeight) || 0,
        outerWidth: Number(window.outerWidth) || 0,
        outerHeight: Number(window.outerHeight) || 0,
        scrollX: Number(window.scrollX) || 0,
        scrollY: Number(window.scrollY) || 0
      },
      document: {
        clientWidth: Number(root.clientWidth) || 0,
        clientHeight: Number(root.clientHeight) || 0,
        scrollWidth: Number(root.scrollWidth) || 0,
        scrollHeight: Number(root.scrollHeight) || 0,
        appWidth: rootStyle.getPropertyValue('--app-width').trim(),
        appHeight: rootStyle.getPropertyValue('--app-height').trim(),
        htmlBackground: rootStyle.backgroundColor,
        bodyBackground: bodyStyle?.backgroundColor || ''
      },
      visualViewport: viewport ? {
        width: Math.round(viewport.width * 10) / 10,
        height: Math.round(viewport.height * 10) / 10,
        offsetLeft: Math.round(viewport.offsetLeft * 10) / 10,
        offsetTop: Math.round(viewport.offsetTop * 10) / 10,
        pageLeft: Math.round(viewport.pageLeft * 10) / 10,
        pageTop: Math.round(viewport.pageTop * 10) / 10,
        scale: Math.round(viewport.scale * 1000) / 1000
      } : null,
      rects: {
        body: body ? (() => {
          const rect = body.getBoundingClientRect();
          return {
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            bottom: Math.round(rect.bottom * 10) / 10
          };
        })() : null,
        game: rectFor('#game'),
        home: rectFor('.m8-home'),
        rotate: rectFor('.rotate-panel'),
        loading: rectFor('#installGate')
      },
      productionDiagnostics: globalThis.__turnPwaViewportDiagnostics || null
    };
    return snapshot;
  }

  function saveSnapshot(reason) {
    const liveStore = readStore();
    const liveSession = liveStore.sessions.find((item) => item.id === sessionId);
    if (!liveSession) return;
    liveSession.snapshots.push(currentSnapshot(reason));
    if (liveSession.snapshots.length > MAX_SNAPSHOTS) {
      liveSession.snapshots.splice(0, liveSession.snapshots.length - MAX_SNAPSHOTS);
    }
    writeStore(liveStore);
    updatePanel();
  }

  function scheduleBurst(reason) {
    saveSnapshot(reason);
    for (const delay of [50, 150, 350, 800]) {
      setTimeout(() => saveSnapshot(`${reason}+${delay}`), delay);
    }
  }

  const passiveEvents = ['resize', 'orientationchange', 'pageshow', 'focus'];
  for (const eventName of passiveEvents) {
    window.addEventListener(eventName, () => scheduleBurst(eventName), { passive: true });
  }
  screen.orientation?.addEventListener?.('change', () => scheduleBurst('screen.orientation.change'), { passive: true });
  window.visualViewport?.addEventListener('resize', () => scheduleBurst('visualViewport.resize'), { passive: true });
  window.visualViewport?.addEventListener('scroll', () => saveSnapshot('visualViewport.scroll'), { passive: true });
  document.addEventListener('visibilitychange', () => scheduleBurst(`visibility:${document.visibilityState}`), { passive: true });
  document.addEventListener('DOMContentLoaded', () => scheduleBurst('DOMContentLoaded'), { once: true });
  window.addEventListener('load', () => scheduleBurst('load'), { once: true });
  window.addEventListener('turn:runtime-ready', () => scheduleBurst('turn:runtime-ready'));
  document.addEventListener('turn:home-ready', () => scheduleBurst('turn:home-ready'));

  for (const delay of [0, 100, 300, 650, 1200, 2500]) {
    setTimeout(() => saveSnapshot(`startup+${delay}`), delay);
  }

  function latestSnapshot() {
    const liveStore = readStore();
    const liveSession = liveStore.sessions.find((item) => item.id === sessionId);
    return liveSession?.snapshots.at(-1) || null;
  }

  function compactSummary(snapshot) {
    if (!snapshot) return 'No samples yet.';
    const vv = snapshot.visualViewport;
    const game = snapshot.rects.game;
    const home = snapshot.rects.home;
    return [
      `SESSION ${sessionId}`,
      `standalone: ${snapshot.standalone}`,
      `orientation: ${snapshot.orientation.type || (snapshot.orientation.landscapeMedia ? 'landscape' : 'portrait')} · ${snapshot.orientation.angle}°`,
      `screen: ${snapshot.screen.width}×${snapshot.screen.height}`,
      `inner: ${snapshot.window.innerWidth}×${snapshot.window.innerHeight}`,
      `client: ${snapshot.document.clientWidth}×${snapshot.document.clientHeight}`,
      `visual: ${vv ? `${vv.width}×${vv.height} @ ${vv.offsetLeft},${vv.offsetTop}` : 'n/a'}`,
      `#game: ${game ? `${game.width}×${game.height} bottom ${game.bottom}` : 'n/a'}`,
      `.m8-home: ${home ? `${home.width}×${home.height} bottom ${home.bottom}` : 'n/a'}`,
      `--app: ${snapshot.document.appWidth || '?'} × ${snapshot.document.appHeight || '?'}`,
      `html bg: ${snapshot.document.htmlBackground}`,
      `body bg: ${snapshot.document.bodyBackground}`,
      `last event: ${snapshot.reason} @ ${snapshot.atMs}ms`
    ].join('\n');
  }

  let panel = null;
  let summary = null;
  let labButton = null;

  function updatePanel() {
    if (!summary) return;
    summary.textContent = compactSummary(latestSnapshot());
  }

  function markSession(label) {
    const liveStore = readStore();
    const liveSession = liveStore.sessions.find((item) => item.id === sessionId);
    if (!liveSession) return;
    liveSession.label = label;
    liveSession.markedAt = new Date().toISOString();
    liveSession.snapshots.push(currentSnapshot(`marked:${label}`));
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
    scheduleBurst(enabled ? 'layer-colors:on' : 'layer-colors:off');
  }

  async function copyLog(status) {
    saveSnapshot('copy-log');
    const liveStore = readStore();
    const payload = {
      lab: 'TURN viewport flight recorder r1',
      productionBuild: globalThis.__TURN_BUILD__ || null,
      copiedAt: new Date().toISOString(),
      sessions: liveStore.sessions
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied. Paste the log into ChatGPT.';
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
    status.textContent = copied ? 'Copied. Paste the log into ChatGPT.' : 'Copy failed.';
  }

  function clearLog(status) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    status.textContent = 'Saved lab history cleared. Reload to start a fresh session.';
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
    labButton.textContent = 'LAB';
    labButton.setAttribute('aria-label', 'Open TURN viewport diagnostics');

    panel = document.createElement('section');
    panel.id = 'turnLabDiagnosticsPanel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'turnLabDiagnosticsTitle');
    panel.innerHTML = `
      <h2 id="turnLabDiagnosticsTitle">TURN VIEWPORT LAB</h2>
      <p>Mark the launch while the problem is visible, then copy the log. COLOR LAYERS changes only diagnostic backgrounds after launch.</p>
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
      saveSnapshot('open-lab-panel');
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

  saveSnapshot('script-start');
})();
